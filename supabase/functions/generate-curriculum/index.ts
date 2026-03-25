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
    console.log("[generate-curriculum] Starting...");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    // Build KB context for the AI — truncate doc content to avoid massive prompts
    let kbContext = "## KNOWLEDGE BASE DOCUMENTS\n\n";
    for (const doc of docs) {
      kbContext += `### Document: ${doc.title} (ID: ${doc.id})\n`;
      if (doc.context) kbContext += `Context: ${doc.context}\n`;
      const truncatedContent = doc.content && doc.content.length > 5000
        ? doc.content.substring(0, 5000) + "\n[... truncated ...]"
        : doc.content;
      kbContext += `${truncatedContent}\n\n`;
    }

    kbContext += "\n## KNOWLEDGE BASE FAQ\n\n";
    for (const faq of faqs) {
      kbContext += `### FAQ (ID: ${faq.id})${faq.category ? ` [${faq.category}]` : ""}\n`;
      kbContext += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    }

    // Build existing modules context
    let existingContext = "";
    const publishedOrDraft = existingModules.filter(m => m.status === "published" || m.status === "draft");
    if (publishedOrDraft.length > 0) {
      existingContext = "\n\n## EXISTING PUBLISHED/DRAFT MODULES (already approved by manager)\n\n";
      for (const mod of publishedOrDraft) {
        existingContext += `- Module "${mod.title}" (${mod.status}, track: ${mod.track}): ${mod.summary || "no summary"}\n`;
        if (mod.source_document_ids) existingContext += `  Sources: doc IDs ${JSON.stringify(mod.source_document_ids)}\n`;
      }
      existingContext += "\nWhen proposing updates, identify which existing modules are impacted by the KB content and propose revisions only for those. Do NOT re-propose modules that are already accurate.\n";
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
9. Mantieni il content_body tra 200-400 parole per modulo
10. Proponi al massimo 6 moduli in totale
11. Mantieni esattamente 4 key_points per modulo
12. Mantieni tutto il testo conciso per minimizzare la dimensione dell'output

Restituisci il curriculum usando il tool propose_curriculum.`;

    console.log("[generate-curriculum] Calling AI gateway, prompt length:", systemPrompt.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
        body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 8192,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Analizza la knowledge base e proponi un curriculum formativo completo. Progetta la struttura ottimale dei moduli, la sequenza e i contenuti. Tutto in italiano." },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "propose_curriculum",
                description: "Propose a structured training curriculum based on the knowledge base",
                parameters: {
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
                          content_body: { type: "string", description: "Contenuto formativo in markdown in italiano (400-800 parole)" },
                          ai_rationale: { type: "string", description: "Motivazione dell'esistenza di questo modulo, in italiano" },
                          source_document_ids: { type: "array", items: { type: "string" }, description: "IDs of KB documents used" },
                          source_faq_ids: { type: "array", items: { type: "string" }, description: "IDs of KB FAQs used" },
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
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["title", "summary", "track", "key_points", "content_body", "ai_rationale", "source_document_ids", "source_faq_ids", "questions"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["modules"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "propose_curriculum" } },
        }),
      });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-curriculum] AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI generation failed (${response.status})`);
    }

    const responseText = await response.text();
    console.log("[generate-curriculum] AI response length:", responseText.length);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("[generate-curriculum] Failed to parse AI response, length:", responseText.length, "last 100 chars:", responseText.slice(-100));
      throw new Error("AI response was truncated or malformed. Try again.");
    }

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      console.error("[generate-curriculum] No tool call in response:", JSON.stringify(data.choices?.[0]?.message).substring(0, 500));
      throw new Error("AI did not return structured output");
    }

    let curriculum;
    try {
      curriculum = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("[generate-curriculum] Failed to parse tool call arguments, length:", toolCall.function.arguments?.length);
      throw new Error("AI tool call arguments were truncated. Try again.");
    }

    const proposedModules = curriculum.modules || [];
    console.log("[generate-curriculum] Proposed modules:", proposedModules.length);

    // Delete existing proposed modules (they'll be replaced)
    await supabase.from("modules").delete().eq("status", "proposed");

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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
