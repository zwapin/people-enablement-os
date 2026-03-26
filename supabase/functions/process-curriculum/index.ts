import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let jobId: string;
  try {
    const body = await req.json();
    jobId = body.job_id;
  } catch {
    return new Response(JSON.stringify({ error: "job_id required" }), { status: 400 });
  }

  console.log("[process-curriculum] Starting outline job:", jobId);

  await supabase
    .from("generation_jobs")
    .update({ status: "processing", current_step: "outline", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    // Fetch job input
    const { data: job } = await supabase
      .from("generation_jobs")
      .select("input")
      .eq("id", jobId)
      .single();

    const regenerateAll = job?.input?.regenerate_all === true;
    const collectionId = job?.input?.collection_id || null;

    // Fetch KB content — scoped to collection if provided
    let docsQuery = supabase.from("knowledge_documents").select("id, title, context, content").order("created_at");
    let faqsQuery = supabase.from("knowledge_faqs").select("id, question, answer, category").order("created_at");
    if (collectionId) {
      docsQuery = docsQuery.eq("collection_id", collectionId);
      faqsQuery = faqsQuery.eq("collection_id", collectionId);
    }

    const [docsResult, faqsResult, modulesResult, curriculaResult] = await Promise.all([
      docsQuery,
      faqsQuery,
      supabase.from("modules").select("*").in("status", ["published", "draft", "proposed"]).order("order_index"),
      supabase.from("curricula").select("*").order("order_index"),
    ]);

    const docs = docsResult.data || [];
    const faqs = faqsResult.data || [];
    const existingModules = modulesResult.data || [];
    const existingCurricula = curriculaResult.data || [];

    // When generating for a specific collection, only clean modules in that collection's curriculum
    if (collectionId) {
      const proposedInCollection = existingModules
        .filter(m => m.curriculum_id === collectionId && m.status === "proposed")
        .map(m => m.id);
      if (proposedInCollection.length > 0) {
        await supabase.from("assessment_questions").delete().in("module_id", proposedInCollection);
        await supabase.from("modules").delete().in("id", proposedInCollection);
      }
    } else if (regenerateAll && existingModules.length > 0) {
      const moduleIds = existingModules.map(m => m.id);
      await supabase.from("assessment_questions").delete().in("module_id", moduleIds);
      await supabase.from("modules").delete().in("id", moduleIds);
    } else if (!regenerateAll) {
      const proposedIds = existingModules.filter(m => m.status === "proposed").map(m => m.id);
      if (proposedIds.length > 0) {
        await supabase.from("assessment_questions").delete().in("module_id", proposedIds);
        await supabase.from("modules").delete().in("id", proposedIds);
      }
      await supabase.from("curricula").delete().eq("status", "proposed");
    }

    // Build KB context
    let kbContext = "## DOCUMENTI DELLA KNOWLEDGE BASE\n\n";
    for (const doc of docs) {
      kbContext += `### Documento: ${doc.title} (ID: ${doc.id})\n`;
      if (doc.context) kbContext += `Contesto: ${doc.context}\n`;
      const content = doc.content && doc.content.length > 25000
        ? doc.content.substring(0, 25000) + "\n[... troncato ...]"
        : doc.content;
      kbContext += `${content}\n\n`;
    }
    kbContext += "\n## FAQ\n\n";
    for (const faq of faqs) {
      kbContext += `D: ${faq.question}\nR: ${faq.answer}\n\n`;
    }

    // Existing modules context and curricula enrichment mode
    let existingContext = "";

    if (collectionId) {
      // Collection-scoped generation: show only modules in this collection
      const collectionModules = existingModules.filter(m => m.curriculum_id === collectionId && (m.status === "published" || m.status === "draft"));
      const targetCurriculum = existingCurricula.find(c => c.id === collectionId);
      if (collectionModules.length > 0) {
        existingContext = "\n## MODULI ESISTENTI IN QUESTA COLLECTION\n";
        for (const mod of collectionModules) {
          existingContext += `- "${mod.title}" (${mod.status})\n`;
        }
        existingContext += "NON riproporre moduli già esistenti.\n";
      }
      if (targetCurriculum) {
        existingContext += `\n## COLLECTION TARGET\nTitolo: "${targetCurriculum.title}"\nDescrizione: ${targetCurriculum.description || "nessuna"}\n`;
        existingContext += "Genera moduli SOLO per questa collection specifica.\n";
      }
    } else if (!regenerateAll) {
      const existing = existingModules.filter(m => m.status === "published" || m.status === "draft");
      if (existing.length > 0) {
        existingContext = "\n## MODULI ESISTENTI\n";
        for (const mod of existing) {
          existingContext += `- "${mod.title}" (${mod.status}, curriculum_id: ${mod.curriculum_id || "nessuno"})\n`;
        }
        existingContext += "NON riproporre moduli già esistenti.\n";
      }
    }

    // STEP 1: Generate OUTLINE
    const outlinePrompt = collectionId
      ? `Sei un architetto di curriculum per la formazione commerciale.
Analizza la Knowledge Base fornita e proponi moduli di formazione per questa SPECIFICA collection.

${kbContext}
${existingContext}

ISTRUZIONI:
- Genera 3-8 moduli che coprano in modo progressivo e dettagliato gli argomenti presenti nei documenti e FAQ forniti
- Ogni modulo deve essere granulare e specifico (es. non "Introduzione generale" ma "Cold Call: Script e Tecniche di Apertura")
- Per ogni modulo fornisci: titolo (max 60 car), summary dettagliata, rationale, fonti usate (document_ids e faq_ids)
- NON generare content_body, key_points o domande (verranno generati separatamente)
- I moduli devono seguire un ordine logico progressivo
- Basa la struttura ESCLUSIVAMENTE sui documenti e FAQ forniti — non inventare contenuto
- Tutto in italiano`
      : `Sei un architetto di curriculum per la formazione commerciale.
Analizza la Knowledge Base e proponi la STRUTTURA del curriculum organizzata in CURRICULA (percorsi tematici).

${kbContext}
${existingContext}

ISTRUZIONI:
- Organizza il contenuto in curricula tematici coerenti (es. uno per il processo di vendita, uno per il prodotto, uno per i tool)
- Per ogni curriculum proponi 3-8 moduli granulari e specifici
- Per ogni modulo fornisci: titolo (max 60 car), summary dettagliata, rationale, fonti usate
- NON generare content_body, key_points o domande (verranno generati separatamente)
- I moduli dentro ogni curriculum devono seguire un ordine logico progressivo
- Basa la struttura ESCLUSIVAMENTE sui documenti e FAQ forniti — non inventare contenuto
- Tutto in italiano`;

    console.log("[process-curriculum] Calling Anthropic for outline, collectionId:", collectionId, "prompt length:", outlinePrompt.length);

    const toolSchema = collectionId
      ? {
          name: "propose_outline",
          description: "Proponi moduli per questa collection specifica",
          input_schema: {
            type: "object",
            properties: {
              modules: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    ai_rationale: { type: "string" },
                    source_document_ids: { type: "array", items: { type: "string" } },
                    source_faq_ids: { type: "array", items: { type: "string" } },
                    relevant_sections: { type: "string" },
                  },
                  required: ["title", "summary", "ai_rationale", "source_document_ids", "source_faq_ids"],
                },
              },
            },
            required: ["modules"],
          },
        }
      : {
          name: "propose_outline",
          description: "Proponi l'outline del curriculum organizzato in percorsi",
          input_schema: {
            type: "object",
            properties: {
              curricula: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    track: { type: "string", enum: ["Vendite", "CS", "Ops", "Generale"] },
                    modules: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          summary: { type: "string" },
                          ai_rationale: { type: "string" },
                          source_document_ids: { type: "array", items: { type: "string" } },
                          source_faq_ids: { type: "array", items: { type: "string" } },
                          relevant_sections: { type: "string" },
                        },
                        required: ["title", "summary", "ai_rationale", "source_document_ids", "source_faq_ids"],
                      },
                    },
                  },
                  required: ["title", "description", "track", "modules"],
                },
              },
            },
            required: ["curricula"],
          },
        };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: outlinePrompt,
        messages: [
          { role: "user", content: collectionId ? "Proponi i moduli per questa collection." : "Proponi la struttura del curriculum organizzata in curricula (percorsi). Solo outline." },
        ],
        tools: [toolSchema],
        tool_choice: { type: "tool", name: "propose_outline" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const toolBlock = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolBlock) throw new Error("L'AI non ha restituito un output strutturato");

    // Get next order indices
    const { data: lastModule } = await supabase
      .from("modules")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1);
    let nextModuleOrder = lastModule && lastModule.length > 0 ? lastModule[0].order_index + 1 : 0;

    const savedModules: any[] = [];

    if (collectionId) {
      // Collection-scoped: modules go directly into this curriculum
      const outlineModules = toolBlock.input.modules || [];
      console.log("[process-curriculum] Collection outline modules:", outlineModules.length);

      for (const mod of outlineModules) {
        const { data: saved, error } = await supabase
          .from("modules")
          .insert({
            title: mod.title,
            summary: mod.summary,
            track: existingCurricula.find(c => c.id === collectionId)?.track || "Generale",
            ai_rationale: mod.ai_rationale,
            source_document_ids: mod.source_document_ids,
            source_faq_ids: mod.source_faq_ids,
            status: "proposed",
            order_index: nextModuleOrder++,
            key_points: [],
            content_body: null,
            curriculum_id: collectionId,
          })
          .select("id, title, source_document_ids, source_faq_ids")
          .single();

        if (error) {
          console.error("[process-curriculum] Failed to save module:", error);
          continue;
        }
        savedModules.push({ ...saved, relevant_sections: mod.relevant_sections || null });
      }
    } else {
      // Global generation: create curricula and modules
      const outlineCurricula = toolBlock.input.curricula || [];
      const { data: lastCurriculum } = await supabase
        .from("curricula")
        .select("order_index")
        .order("order_index", { ascending: false })
        .limit(1);
      let nextCurriculumOrder = lastCurriculum && lastCurriculum.length > 0 ? lastCurriculum[0].order_index + 1 : 0;

      console.log("[process-curriculum] Global outline curricula:", outlineCurricula.length);

      for (const curr of outlineCurricula) {
        const { data: savedCurr, error: currError } = await supabase
          .from("curricula")
          .insert({
            title: curr.title,
            description: curr.description || null,
            track: curr.track,
            status: "proposed",
            order_index: nextCurriculumOrder++,
          })
          .select("id")
          .single();

        if (currError) {
          console.error("[process-curriculum] Failed to save curriculum:", currError);
          continue;
        }

        for (const mod of curr.modules || []) {
          const { data: saved, error } = await supabase
            .from("modules")
            .insert({
              title: mod.title,
              summary: mod.summary,
              track: curr.track,
              ai_rationale: mod.ai_rationale,
              source_document_ids: mod.source_document_ids,
              source_faq_ids: mod.source_faq_ids,
              status: "proposed",
              order_index: nextModuleOrder++,
              key_points: [],
              content_body: null,
              curriculum_id: savedCurr.id,
            })
            .select("id, title, source_document_ids, source_faq_ids")
            .single();

          if (error) {
            console.error("[process-curriculum] Failed to save module:", error);
            continue;
          }
          savedModules.push({ ...saved, relevant_sections: mod.relevant_sections || null });
        }
      }
    }

    console.log("[process-curriculum] Saved", savedModules.length, "skeleton modules");

    // Update parent job with total steps
    await supabase
      .from("generation_jobs")
      .update({
        current_step: "outline_completed",
        total_steps: savedModules.length,
        completed_steps: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // STEP 3: Fire child jobs for each module
    for (const mod of savedModules) {
      const { data: childJob } = await supabase
        .from("generation_jobs")
        .insert({
          job_type: "module_content",
          parent_job_id: jobId,
          status: "pending",
          input: { module_id: mod.id, module_title: mod.title, source_document_ids: mod.source_document_ids, source_faq_ids: mod.source_faq_ids, relevant_sections: mod.relevant_sections },
        })
        .select("id")
        .single();

      if (childJob) {
        fetch(`${supabaseUrl}/functions/v1/generate-module`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ job_id: childJob.id }),
        }).catch(err => console.error("[process-curriculum] Fire child error:", err));
      }
    }

    return new Response(JSON.stringify({ status: "outline_completed", modules: savedModules.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[process-curriculum] Error:", e);
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error: e instanceof Error ? e.message : "Errore sconosciuto",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
