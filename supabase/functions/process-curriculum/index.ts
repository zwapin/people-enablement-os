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

    // Fetch KB content
    const [docsResult, faqsResult, modulesResult, curriculaResult] = await Promise.all([
      supabase.from("knowledge_documents").select("id, title, context, content").order("created_at"),
      supabase.from("knowledge_faqs").select("id, question, answer, category").order("created_at"),
      supabase.from("modules").select("*").in("status", ["published", "draft", "proposed"]).order("order_index"),
      supabase.from("curricula").select("*").order("order_index"),
    ]);

    const docs = docsResult.data || [];
    const faqs = faqsResult.data || [];
    const existingModules = modulesResult.data || [];
    const existingCurricula = curriculaResult.data || [];

    // Delete existing modules if regenerating
    if (regenerateAll && existingModules.length > 0) {
      const moduleIds = existingModules.map(m => m.id);
      await supabase.from("assessment_questions").delete().in("module_id", moduleIds);
      await supabase.from("modules").delete().in("id", moduleIds);
    } else if (!regenerateAll) {
      // Delete only proposed modules
      const proposedIds = existingModules.filter(m => m.status === "proposed").map(m => m.id);
      if (proposedIds.length > 0) {
        await supabase.from("assessment_questions").delete().in("module_id", proposedIds);
        await supabase.from("modules").delete().in("id", proposedIds);
      }
      // Delete proposed curricula
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

    // Existing modules context
    let existingContext = "";
    if (!regenerateAll) {
      const existing = existingModules.filter(m => m.status === "published" || m.status === "draft");
      if (existing.length > 0) {
        existingContext = "\n## MODULI ESISTENTI\n";
        for (const mod of existing) {
          existingContext += `- "${mod.title}" (${mod.status}, track: ${mod.track})\n`;
        }
        existingContext += "NON riproporre moduli già esistenti.\n";
      }
      if (existingCurricula.length > 0) {
        existingContext += "\n## CURRICULA ESISTENTI\n";
        for (const c of existingCurricula) {
          existingContext += `- "${c.title}" (${c.status})\n`;
        }
        existingContext += "Puoi aggiungere moduli a curricula esistenti o proporne di nuovi.\n";
      }
    }

    // STEP 1: Generate OUTLINE with curricula groupings
    const outlinePrompt = `Sei un architetto di curriculum per la formazione commerciale.
Analizza la Knowledge Base e proponi la STRUTTURA del curriculum organizzata in CURRICULA (percorsi tematici).

${kbContext}
${existingContext}

ISTRUZIONI:
- Organizza i moduli in CURRICULA (percorsi tematici). Esempio: "Essere Account Executive a Klaaryo", "Customer Success", etc.
- Ogni curriculum è un percorso completo su un tema/ruolo
- Ogni curriculum contiene più moduli che coprono le varie fasi/aspetti di quel percorso
- Proponi al massimo 3 curricula, ognuno con 3-8 moduli
- Per ogni modulo fornisci SOLO: titolo, summary breve, track, rationale, fonti usate, e le sezioni rilevanti del documento sorgente
- NON generare content_body, key_points o domande (verranno generati separatamente)
- I moduli dentro ogni curriculum devono avere un flusso logico progressivo
- Tutto in italiano`;

    console.log("[process-curriculum] Calling Anthropic for outline with curricula, prompt length:", outlinePrompt.length);

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
          { role: "user", content: "Proponi la struttura del curriculum organizzata in curricula (percorsi). Solo outline." },
        ],
        tools: [
          {
            name: "propose_outline",
            description: "Proponi l'outline del curriculum organizzato in percorsi",
            input_schema: {
              type: "object",
              properties: {
                curricula: {
                  type: "array",
                  description: "Lista di curricula (percorsi tematici)",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Titolo del curriculum/percorso (es. 'Essere Account Executive a Klaaryo')" },
                      description: { type: "string", description: "Descrizione breve del percorso (1-2 frasi)" },
                      track: { type: "string", enum: ["Vendite", "CS", "Ops", "Generale"] },
                      modules: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string", description: "Titolo modulo (max 60 car)" },
                            summary: { type: "string", description: "1-2 frasi" },
                            ai_rationale: { type: "string" },
                            source_document_ids: { type: "array", items: { type: "string" } },
                            source_faq_ids: { type: "array", items: { type: "string" } },
                            relevant_sections: { type: "string", description: "Sezioni/capitoli specifici del documento sorgente rilevanti" },
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
          },
        ],
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

    const outlineCurricula = toolBlock.input.curricula || [];
    const totalModules = outlineCurricula.reduce((sum: number, c: any) => sum + (c.modules?.length || 0), 0);
    console.log("[process-curriculum] Outline curricula:", outlineCurricula.length, "total modules:", totalModules);

    // Get next order indices
    const { data: lastModule } = await supabase
      .from("modules")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1);
    let nextModuleOrder = lastModule && lastModule.length > 0 ? lastModule[0].order_index + 1 : 0;

    const { data: lastCurriculum } = await supabase
      .from("curricula")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1);
    let nextCurriculumOrder = lastCurriculum && lastCurriculum.length > 0 ? lastCurriculum[0].order_index + 1 : 0;

    // STEP 2: Save curricula and skeleton modules
    const savedModules = [];

    for (const curr of outlineCurricula) {
      // Create curriculum
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

      const curriculumId = savedCurr.id;

      // Create modules for this curriculum
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
            curriculum_id: curriculumId,
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

    console.log("[process-curriculum] Saved", outlineCurricula.length, "curricula and", savedModules.length, "skeleton modules");

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

    return new Response(JSON.stringify({ status: "outline_completed", curricula: outlineCurricula.length, modules: savedModules.length }), {
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
