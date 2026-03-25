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

  try {
    // Parse optional body for regenerate_all flag
    let regenerateAll = false;
    try {
      const body = await req.json();
      regenerateAll = body?.regenerate_all === true;
    } catch {
      // no body = normal incremental flow
    }

    console.log("[generate-curriculum] Starting... regenerateAll:", regenerateAll);
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all KB content
    const [docsResult, faqsResult, modulesResult] = await Promise.all([
      supabase.from("knowledge_documents").select("id, title, context, content").order("created_at"),
      supabase.from("knowledge_faqs").select("id, question, answer, category").order("created_at"),
      supabase.from("modules").select("*").in("status", ["published", "draft", "proposed"]).order("order_index"),
    ]);

    const docs = docsResult.data || [];
    const faqs = faqsResult.data || [];
    const existingModules = modulesResult.data || [];

    console.log("[generate-curriculum] Docs:", docs.length, "FAQs:", faqs.length, "Existing modules:", existingModules.length);

    if (docs.length === 0 && faqs.length === 0) {
      return new Response(
        JSON.stringify({ error: "La Knowledge Base è vuota. Carica documenti o aggiungi FAQ prima di generare il curriculum." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If regenerate_all, delete ALL existing modules and their questions
    if (regenerateAll && existingModules.length > 0) {
      const moduleIds = existingModules.map(m => m.id);
      console.log("[generate-curriculum] Regenerate all: deleting", moduleIds.length, "modules and their questions");
      await supabase.from("assessment_questions").delete().in("module_id", moduleIds);
      await supabase.from("modules").delete().in("id", moduleIds);
    }

    // Build KB context for the AI — pass full document content for richer modules
    let kbContext = "## DOCUMENTI DELLA KNOWLEDGE BASE\n\n";
    for (const doc of docs) {
      kbContext += `### Documento: ${doc.title} (ID: ${doc.id})\n`;
      if (doc.context) kbContext += `Contesto: ${doc.context}\n`;
      const content = doc.content && doc.content.length > 30000
        ? doc.content.substring(0, 30000) + "\n[... contenuto troncato per limiti di contesto ...]"
        : doc.content;
      kbContext += `${content}\n\n`;
    }

    kbContext += "\n## FAQ DELLA KNOWLEDGE BASE\n\n";
    for (const faq of faqs) {
      kbContext += `### FAQ (ID: ${faq.id})${faq.category ? ` [${faq.category}]` : ""}\n`;
      kbContext += `D: ${faq.question}\nR: ${faq.answer}\n\n`;
    }

    // Build existing modules context (skip if regenerating all)
    let existingContext = "";
    if (!regenerateAll) {
      const publishedOrDraft = existingModules.filter(m => m.status === "published" || m.status === "draft");
      if (publishedOrDraft.length > 0) {
        existingContext = "\n\n## MODULI ESISTENTI PUBBLICATI/BOZZA (già approvati dal manager)\n\n";
        for (const mod of publishedOrDraft) {
          existingContext += `- Modulo "${mod.title}" (${mod.status}, track: ${mod.track}): ${mod.summary || "nessun sommario"}\n`;
          if (mod.source_document_ids) existingContext += `  Fonti: doc IDs ${JSON.stringify(mod.source_document_ids)}\n`;
        }
        existingContext += "\nQuando proponi aggiornamenti, identifica quali moduli esistenti sono impattati dal contenuto della KB e proponi revisioni solo per quelli. NON riproporre moduli che sono già accurati.\n";
      }

      // Delete only proposed modules (incremental flow)
      await supabase.from("modules").delete().eq("status", "proposed");
    }

    const systemPrompt = `Sei un architetto di curriculum per la formazione commerciale. Il tuo compito è analizzare una Knowledge Base e progettare un curriculum completo per nuovi commerciali.

IMPORTANTE: Genera TUTTO il contenuto in italiano (titoli, sommari, contenuti, punti chiave, domande di valutazione, feedback). Ogni stringa deve essere in lingua italiana.

${kbContext}
${existingContext}

ISTRUZIONI:
1. Analizza TUTTO il contenuto della knowledge base in modo olistico
2. Progetta una struttura logica del curriculum: quali argomenti coprire, in quale sequenza, come raggruppare le informazioni
3. Per ogni modulo proposto, genera contenuto completo incluse domande di valutazione
4. Indica quali documenti e FAQ della KB hai usato per ogni modulo (tramite i loro ID)
5. Fornisci una motivazione per ogni modulo spiegando perché esiste e quale lacuna colma
6. I moduli devono avere un flusso logico — concetti fondamentali prima, argomenti avanzati dopo
7. Ogni modulo deve essere autonomo ma costruire sui precedenti
8. Genera 3 domande di valutazione per modulo (mantienile concise)
9. Il content_body deve essere RICCO e DETTAGLIATO: 800-1500 parole per modulo. Includi esempi concreti, tabelle markdown quando utili, e riferimenti specifici dal materiale sorgente.
10. Proponi al massimo 5 moduli in totale per dare spazio adeguato a ciascuno
11. Mantieni esattamente 4 key_points per modulo
12. PRESERVA le tabelle originali trovate nei documenti sorgente in formato markdown
13. Se nel materiale sorgente ci sono riferimenti a immagini o diagrammi, descrivili nel testo con placeholder markdown (es. ![Descrizione](image-placeholder))

Restituisci il curriculum usando il tool propose_curriculum.`;

    console.log("[generate-curriculum] Calling Anthropic API, prompt length:", systemPrompt.length);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16384,
        system: systemPrompt,
        messages: [
          { role: "user", content: "Analizza la knowledge base e proponi un curriculum formativo completo. Progetta la struttura ottimale dei moduli, la sequenza e i contenuti. Tutto in italiano." },
        ],
        tools: [
          {
            name: "propose_curriculum",
            description: "Proponi un curriculum formativo strutturato basato sulla knowledge base. Tutto in italiano.",
            input_schema: {
              type: "object",
              properties: {
                modules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Titolo del modulo in italiano (max 60 caratteri)" },
                      summary: { type: "string", description: "Panoramica di 1-2 frasi in italiano" },
                      track: { type: "string", enum: ["Vendite", "CS", "Ops", "Generale"] },
                      key_points: { type: "array", items: { type: "string" }, description: "4-6 punti chiave in italiano" },
                      content_body: { type: "string", description: "Contenuto formativo RICCO in markdown in italiano (800-1500 parole). Includi tabelle, esempi concreti e struttura con sezioni." },
                      ai_rationale: { type: "string", description: "Motivazione dell'esistenza di questo modulo, in italiano" },
                      source_document_ids: { type: "array", items: { type: "string" }, description: "ID dei documenti KB utilizzati" },
                      source_faq_ids: { type: "array", items: { type: "string" }, description: "ID delle FAQ KB utilizzate" },
                      questions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            question: { type: "string" },
                            options: { type: "array", items: { type: "string" } },
                            correct_index: { type: "integer" },
                            feedback_correct: { type: "string" },
                            feedback_wrong: { type: "string" },
                          },
                          required: ["question", "options", "correct_index", "feedback_correct", "feedback_wrong"],
                        },
                      },
                    },
                    required: ["title", "summary", "track", "key_points", "content_body", "ai_rationale", "source_document_ids", "source_faq_ids", "questions"],
                  },
                },
              },
              required: ["modules"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "propose_curriculum" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-curriculum] Anthropic API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite di richieste superato. Riprova tra qualche istante." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402 || response.status === 400) {
        return new Response(
          JSON.stringify({ error: `Errore API Anthropic (${response.status}): ${errText}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Generazione AI fallita (${response.status})`);
    }

    const data = await response.json();
    console.log("[generate-curriculum] Anthropic response stop_reason:", data.stop_reason);

    // Extract tool_use block from Anthropic response
    const toolUseBlock = data.content?.find((c: any) => c.type === "tool_use");

    if (!toolUseBlock) {
      console.error("[generate-curriculum] No tool_use in response:", JSON.stringify(data.content?.map((c: any) => c.type)));
      throw new Error("L'AI non ha restituito un output strutturato");
    }

    const curriculum = toolUseBlock.input;
    const proposedModules = curriculum.modules || [];
    console.log("[generate-curriculum] Proposed modules:", proposedModules.length);

    // Get next order_index
    const { data: lastModule } = await supabase
      .from("modules")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1);

    let nextOrder = lastModule && lastModule.length > 0 ? lastModule[0].order_index + 1 : 0;

    // Insert proposed modules with their questions
    const savedModules = [];
    for (const mod of proposedModules) {
      const { data: savedMod, error: modError } = await supabase
        .from("modules")
        .insert({
          title: mod.title,
          summary: mod.summary,
          track: mod.track,
          key_points: mod.key_points,
          content_body: mod.content_body,
          ai_rationale: mod.ai_rationale,
          source_document_ids: mod.source_document_ids,
          source_faq_ids: mod.source_faq_ids,
          status: "proposed",
          order_index: nextOrder++,
        })
        .select()
        .single();

      if (modError) {
        console.error("Failed to save module:", modError);
        continue;
      }

      // Insert questions for this module
      if (mod.questions && mod.questions.length > 0) {
        const qRows = mod.questions.map((q: any, i: number) => ({
          module_id: savedMod.id,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
          feedback_correct: q.feedback_correct || null,
          feedback_wrong: q.feedback_wrong || null,
          order_index: i,
        }));

        await supabase.from("assessment_questions").insert(qRows);
      }

      savedModules.push(savedMod);
    }

    console.log("[generate-curriculum] Saved modules:", savedModules.length);

    return new Response(
      JSON.stringify({ modules: savedModules, count: savedModules.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-curriculum] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});