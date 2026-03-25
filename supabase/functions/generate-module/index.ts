import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { text, title_hint, knowledge_context } = await req.json();

    if (!text || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Fornisci almeno 50 caratteri di testo sorgente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build knowledge base context section if provided
    let kbSection = "";
    if (knowledge_context) {
      const { documents, faqs } = knowledge_context;
      if (documents && documents.length > 0) {
        kbSection += "\n\n## DOCUMENTI DI RIFERIMENTO (usa come materiale autorevole)\n";
        for (const doc of documents) {
          kbSection += `\n### ${doc.title}${doc.context ? ` — ${doc.context}` : ""}\n${doc.content}\n`;
        }
      }
      if (faqs && faqs.length > 0) {
        kbSection += "\n\n## FAQ DI RIFERIMENTO (usa queste coppie D&R come fatti autorevoli)\n";
        for (const faq of faqs) {
          kbSection += `\nD: ${faq.question}\nR: ${faq.answer}\n`;
        }
      }
    }

    const systemPrompt = `Sei un esperto di contenuti formativi per la vendita. Dato del materiale sorgente, genera un modulo formativo strutturato per nuovi commerciali.

IMPORTANTE: Genera TUTTO il contenuto in italiano (titolo, sommario, punti chiave, contenuto, domande, feedback).
${kbSection ? "\nHai accesso alla seguente knowledge base. Usala come riferimento autorevole per garantire accuratezza e coerenza:" + kbSection : ""}
Restituisci un oggetto JSON usando il tool generate_module con questi campi:
- title: titolo conciso del modulo (max 60 caratteri)
- summary: panoramica di 1-2 frasi del modulo
- key_points: array di 4-6 punti chiave (stringhe brevi)
- content_body: contenuto formativo completo in formato markdown, ben strutturato con titoli, elenchi puntati ed esempi. Deve essere esaustivo (800-1500 parole).
- questions: array di 5-7 domande di valutazione, ciascuna con:
  - question: il testo della domanda
  - options: array di esattamente 4 opzioni di risposta (stringhe)
  - correct_index: indice (0-3) della risposta corretta
  - feedback_correct: breve spiegazione del perché la risposta è corretta
  - feedback_wrong: breve suggerimento verso la risposta corretta`;

    const userPrompt = title_hint
      ? `Materiale sorgente (titolo suggerito: "${title_hint}"):\n\n${text}`
      : `Materiale sorgente:\n\n${text}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_module",
              description: "Genera un modulo formativo strutturato dal materiale sorgente. Tutto in italiano.",
              parameters: {
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
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "summary", "key_points", "content_body", "questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_module" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite di richieste superato. Riprova tra qualche istante." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Aggiungi fondi per continuare." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Generazione AI fallita");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("L'AI non ha restituito un output strutturato");
    }

    const moduleData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(moduleData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
