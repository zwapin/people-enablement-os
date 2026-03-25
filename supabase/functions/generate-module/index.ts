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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
  }

  // Mode 1: Child job from process-curriculum (has job_id)
  if (body.job_id) {
    return handleChildJob(body.job_id, supabase, supabaseUrl, serviceRoleKey, ANTHROPIC_API_KEY);
  }

  // Mode 2: Direct call from frontend (legacy - has text field)
  if (body.text) {
    return handleDirectGeneration(body, ANTHROPIC_API_KEY);
  }

  return new Response(JSON.stringify({ error: "job_id or text required" }), { status: 400 });
});

async function handleChildJob(
  jobId: string,
  supabase: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  apiKey: string
) {
  console.log("[generate-module] Child job:", jobId);

  // Get job details
  const { data: job } = await supabase
    .from("generation_jobs")
    .select("input, parent_job_id")
    .eq("id", jobId)
    .single();

  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
  }

  const { module_id, module_title, source_document_ids, source_faq_ids, relevant_sections } = job.input;

  // Update child job to processing
  await supabase
    .from("generation_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    // Fetch only the relevant source documents and FAQs
    let sourceContext = "";

    if (source_document_ids?.length > 0) {
      const { data: docs } = await supabase
        .from("knowledge_documents")
        .select("title, context, content")
        .in("id", source_document_ids);

      if (docs?.length > 0) {
        sourceContext += "## DOCUMENTI SORGENTE\n\n";
        for (const doc of docs) {
          sourceContext += `### ${doc.title}\n`;
          if (doc.context) sourceContext += `Contesto: ${doc.context}\n`;
          // Pass up to 25000 chars per doc for detailed module generation
          const content = doc.content?.length > 25000
            ? doc.content.substring(0, 25000) + "\n[... troncato ...]"
            : doc.content;
          sourceContext += `${content}\n\n`;
        }
      }
    }

    if (source_faq_ids?.length > 0) {
      const { data: faqs } = await supabase
        .from("knowledge_faqs")
        .select("question, answer")
        .in("id", source_faq_ids);

      if (faqs?.length > 0) {
        sourceContext += "## FAQ SORGENTE\n\n";
        for (const faq of faqs) {
          sourceContext += `D: ${faq.question}\nR: ${faq.answer}\n\n`;
        }
      }
    }

    // Build section hints if available
    const sectionHint = relevant_sections
      ? `\nSEZIONI RILEVANTI DEL DOCUMENTO SORGENTE DA CUI ESTRARRE IL CONTENUTO:\n${relevant_sections}\nConcentrati su queste sezioni ma includi anche contesto utile dalle altre parti.\n`
      : "";

    const systemPrompt = `Sei un esperto di contenuti formativi per la vendita. Genera il contenuto completo per UN singolo modulo formativo.

Modulo: "${module_title}"
${sectionHint}
${sourceContext}

ISTRUZIONI:
- Genera content_body RICCO e DETTAGLIATO in markdown (800-1500 parole)
- Genera esattamente 4 key_points
- Genera 3 domande di valutazione
- PRESERVA le tabelle originali trovate nei documenti sorgente in formato markdown
- Tutto in italiano

REGOLE DI FEDELTÀ AL MATERIALE SORGENTE (OBBLIGATORIE):
- Includi TUTTI i termini specifici, nomi di fasi, framework, tool e processi menzionati nel materiale sorgente
- NON generalizzare: se il documento menziona "Disco Call", "Executive Call", "MCP", "Pipeline", questi termini DEVONO comparire nel modulo
- Preserva la terminologia e i dettagli operativi esatti del playbook
- Se il documento descrive step di un processo (es. fasi di vendita), elencali TUTTI con i loro nomi originali
- Usa i nomi propri di strumenti, metodologie e framework così come appaiono nel documento
- Quando il documento contiene numeri, KPI, percentuali o metriche, riportali fedelmente

REGOLE DI FORMATTAZIONE (OBBLIGATORIE):
- Usa sottotitoli ### (h3) per spezzare il contenuto in sezioni tematiche chiare
- Usa **elenchi puntati** per liste di concetti, stakeholder, step, vantaggi, caratteristiche
- Usa **tabelle markdown** per confronti, categorizzazioni, metriche
- Usa **blockquote** (> ) per evidenziare concetti chiave, best practice o citazioni importanti
- Usa separatori (---) tra macro-sezioni tematiche diverse
- MAI scrivere paragrafi più lunghi di 4-5 righe consecutive — spezza con bullet point o sottotitoli
- Alterna paragrafi brevi, elenchi e tabelle per creare varietà visiva
- Ogni sezione h3 deve contenere almeno un elemento visivo (lista, tabella o blockquote)`;

    console.log("[generate-module] Calling Anthropic, prompt length:", systemPrompt.length);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Genera il contenuto completo per il modulo "${module_title}".` },
        ],
        tools: [
          {
            name: "generate_module",
            description: "Genera il contenuto di un modulo formativo",
            input_schema: {
              type: "object",
              properties: {
                key_points: { type: "array", items: { type: "string" }, description: "4 punti chiave" },
                content_body: { type: "string", description: "Contenuto formativo in markdown (800-1500 parole)" },
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
              required: ["key_points", "content_body", "questions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "generate_module" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const toolBlock = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolBlock) throw new Error("L'AI non ha restituito un output strutturato");

    const moduleContent = toolBlock.input;

    // Update module with content
    await supabase
      .from("modules")
      .update({
        content_body: moduleContent.content_body,
        key_points: moduleContent.key_points,
        updated_at: new Date().toISOString(),
      })
      .eq("id", module_id);

    // Insert questions
    if (moduleContent.questions?.length > 0) {
      const qRows = moduleContent.questions.map((q: any, i: number) => ({
        module_id,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        feedback_correct: q.feedback_correct || null,
        feedback_wrong: q.feedback_wrong || null,
        order_index: i,
      }));
      await supabase.from("assessment_questions").insert(qRows);
    }

    // Mark child job completed
    await supabase
      .from("generation_jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // Update parent job progress
    if (job.parent_job_id) {
      // Count completed child jobs
      const { count } = await supabase
        .from("generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("parent_job_id", job.parent_job_id)
        .eq("status", "completed");

      const { data: parent } = await supabase
        .from("generation_jobs")
        .select("total_steps")
        .eq("id", job.parent_job_id)
        .single();

      const completedSteps = count ?? 0;
      const totalSteps = parent?.total_steps ?? 0;

      const updateData: any = {
        completed_steps: completedSteps,
        current_step: `module_${completedSteps}_of_${totalSteps}`,
        updated_at: new Date().toISOString(),
      };

      // If all modules done, mark parent completed
      if (completedSteps >= totalSteps) {
        updateData.status = "completed";
        updateData.result = { count: totalSteps };
      }

      await supabase
        .from("generation_jobs")
        .update(updateData)
        .eq("id", job.parent_job_id);
    }

    console.log("[generate-module] Completed module:", module_id);
    return new Response(JSON.stringify({ status: "completed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-module] Error:", e);

    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error: e instanceof Error ? e.message : "Errore sconosciuto",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Check if parent should be marked failed
    if (job.parent_job_id) {
      const { count: failedCount } = await supabase
        .from("generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("parent_job_id", job.parent_job_id)
        .in("status", ["completed", "failed"]);

      const { data: parent } = await supabase
        .from("generation_jobs")
        .select("total_steps, completed_steps")
        .eq("id", job.parent_job_id)
        .single();

      if (parent && (failedCount ?? 0) >= (parent.total_steps ?? 0)) {
        await supabase
          .from("generation_jobs")
          .update({
            status: "completed",
            result: { count: parent.completed_steps ?? 0, partial: true },
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.parent_job_id);
      }
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleDirectGeneration(body: any, apiKey: string) {
  const { text, title_hint, knowledge_context } = body;

  if (!text || text.trim().length < 50) {
    return new Response(
      JSON.stringify({ error: "Fornisci almeno 50 caratteri di testo sorgente." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let kbSection = "";
  if (knowledge_context) {
    const { documents, faqs } = knowledge_context;
    if (documents?.length > 0) {
      kbSection += "\n\n## DOCUMENTI DI RIFERIMENTO\n";
      for (const doc of documents) {
        kbSection += `\n### ${doc.title}${doc.context ? ` — ${doc.context}` : ""}\n${doc.content}\n`;
      }
    }
    if (faqs?.length > 0) {
      kbSection += "\n\n## FAQ DI RIFERIMENTO\n";
      for (const faq of faqs) {
        kbSection += `\nD: ${faq.question}\nR: ${faq.answer}\n`;
      }
    }
  }

  const systemPrompt = `Sei un esperto di contenuti formativi per la vendita. Dato del materiale sorgente, genera un modulo formativo strutturato.
IMPORTANTE: Genera TUTTO in italiano.
${kbSection ? "\nKnowledge base di riferimento:" + kbSection : ""}
Restituisci usando il tool generate_module.`;

  const userPrompt = title_hint
    ? `Materiale sorgente (titolo suggerito: "${title_hint}"):\n\n${text}`
    : `Materiale sorgente:\n\n${text}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "generate_module",
            description: "Genera un modulo formativo strutturato",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                key_points: { type: "array", items: { type: "string" } },
                content_body: { type: "string" },
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
              required: ["title", "summary", "key_points", "content_body", "questions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "generate_module" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite di richieste superato. Riprova tra qualche istante." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      throw new Error(`Generazione AI fallita (${response.status})`);
    }

    const data = await response.json();
    const toolBlock = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolBlock) throw new Error("L'AI non ha restituito un output strutturato");

    return new Response(JSON.stringify(toolBlock.input), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
