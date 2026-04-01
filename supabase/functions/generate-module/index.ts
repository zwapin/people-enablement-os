import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const moduleToolSchema = {
  type: "function" as const,
  function: {
    name: "generate_module",
    description: "Genera il contenuto di un modulo formativo",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
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
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500 });
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

  if (body.job_id) {
    return handleChildJob(body.job_id, supabase, supabaseUrl, serviceRoleKey, LOVABLE_API_KEY);
  }

  if (body.text) {
    return handleDirectGeneration(body, LOVABLE_API_KEY);
  }

  return new Response(JSON.stringify({ error: "job_id or text required" }), { status: 400 });
});

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string, toolSchema: any) {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [toolSchema],
      tool_choice: { type: "function", function: { name: toolSchema.function.name } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Riprova tra qualche istante.");
    }
    if (response.status === 402) {
      throw new Error("Crediti AI esauriti. Aggiungi fondi al workspace.");
    }
    throw new Error(`AI error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("L'AI non ha restituito un output strutturato");

  const parsed = typeof toolCall.function.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;

  return parsed;
}

function shuffleQuestions(questions: any[]) {
  if (!questions?.length) return;
  for (const q of questions) {
    const opts = q.options as string[];
    const correctAnswer = opts[q.correct_index];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    q.correct_index = opts.indexOf(correctAnswer);
    q.options = opts;
  }
}

async function handleChildJob(
  jobId: string,
  supabase: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  apiKey: string
) {
  console.log("[generate-module] Child job:", jobId);

  const { data: job } = await supabase
    .from("generation_jobs")
    .select("input, parent_job_id")
    .eq("id", jobId)
    .single();

  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
  }

  const { module_id, module_title, source_document_ids, source_faq_ids, relevant_sections, custom_instructions } = job.input;

  await supabase
    .from("generation_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
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
- Genera 3 domande di valutazione con correct_index DIVERSO per ogni domanda (varia tra 0, 1, 2, 3 — NON usare sempre lo stesso indice)
- PRESERVA le tabelle originali trovate nei documenti sorgente in formato markdown
- Tutto in italiano

STRUTTURA OBBLIGATORIA DEL CONTENUTO (content_body):
Il contenuto DEVE seguire questa struttura precisa, con ogni sezione separata da un divisore orizzontale (---):

1. **Introduzione** — un breve paragrafo introduttivo che inquadra l'argomento e il suo valore pratico
---
2. **Capitoli tematici** — suddividi il contenuto in 3-5 capitoli con titoli ### chiari. Alterna paragrafi discorsivi brevi (max 4-5 righe) con elenchi puntati, tabelle o blockquote per creare un formato ibrido tra discorsivo e schematico
---
3. **Conclusione** — un breve paragrafo di sintesi e call-to-action pratico
---
4. **Punti chiave** — riassumi i concetti fondamentali in una lista puntata finale

REGOLE PER MEDIA E RISORSE VISIVE (OBBLIGATORIE):
- Se nei documenti sorgente sono presenti riferimenti a immagini, grafici, video, GIF o screenshot, DEVI includerli nel contenuto usando la sintassi markdown appropriata
- Per immagini: usa ![descrizione](url) preservando l'URL originale
- Per video: includi il link come embed o riferimento
- Se un'immagine non ha URL ma è descritta nel testo, crea un placeholder: > 📊 [Grafico: descrizione del contenuto visivo]

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

    console.log("[generate-module] Calling Lovable AI, prompt length:", systemPrompt.length);

    // Child job tool schema doesn't need title/summary
    const childToolSchema = { ...moduleToolSchema };
    childToolSchema.function = {
      ...moduleToolSchema.function,
      parameters: {
        ...moduleToolSchema.function.parameters,
        required: ["key_points", "content_body", "questions"],
      },
    };

    const moduleContent = await callAI(
      systemPrompt,
      `Genera il contenuto completo per il modulo "${module_title}".`,
      apiKey,
      childToolSchema
    );

    shuffleQuestions(moduleContent.questions);

    await supabase
      .from("modules")
      .update({
        content_body: moduleContent.content_body,
        key_points: moduleContent.key_points,
        updated_at: new Date().toISOString(),
      })
      .eq("id", module_id);

    await supabase.from("assessment_questions").delete().eq("module_id", module_id);
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

    await supabase
      .from("generation_jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    if (job.parent_job_id) {
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

      if (completedSteps >= totalSteps) {
        updateData.status = "completed";
        updateData.result = { count: totalSteps };

        const { data: moduleData } = await supabase
          .from("modules")
          .select("curriculum_id")
          .eq("id", module_id)
          .single();

        if (moduleData?.curriculum_id) {
          console.log("[generate-module] All modules done, triggering FAQ generation for collection:", moduleData.curriculum_id);
          fetch(`${supabaseUrl}/functions/v1/generate-faqs`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ collection_id: moduleData.curriculum_id }),
          }).catch(err => console.error("[generate-module] Fire FAQ generation error:", err));
        }
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
    const fullToolSchema = { ...moduleToolSchema };
    fullToolSchema.function = {
      ...moduleToolSchema.function,
      parameters: {
        ...moduleToolSchema.function.parameters,
        required: ["title", "summary", "key_points", "content_body", "questions"],
      },
    };

    const result = await callAI(systemPrompt, userPrompt, apiKey, fullToolSchema);
    shuffleQuestions(result.questions);

    return new Response(JSON.stringify(result), {
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
