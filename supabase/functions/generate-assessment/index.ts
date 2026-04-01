import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { module_id } = await req.json();
    if (!module_id) throw new Error("module_id is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch module content
    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id, title, content_body, summary, key_points")
      .eq("id", module_id)
      .single();

    if (modErr || !mod) throw new Error("Module not found");
    if (!mod.content_body?.trim()) throw new Error("Il modulo non ha contenuto. Aggiungi del contenuto prima di generare le domande.");

    const keyPointsText = Array.isArray(mod.key_points) && mod.key_points.length > 0
      ? `\n\nPunti Chiave:\n${(mod.key_points as string[]).map((k: string) => `- ${k}`).join("\n")}`
      : "";

    const systemPrompt = `Sei un esperto di formazione aziendale. Genera esattamente 3 domande di valutazione a risposta multipla basandoti ESCLUSIVAMENTE sul contenuto del modulo fornito.

REGOLE:
1. Ogni domanda deve avere esattamente 4 opzioni di risposta.
2. Solo una risposta è corretta.
3. Le domande devono testare la comprensione dei concetti chiave del modulo.
4. Fornisci feedback breve per risposta corretta e sbagliata.
5. Le opzioni errate devono essere plausibili ma chiaramente distinguibili dalla risposta corretta.
6. NON inventare informazioni non presenti nel contenuto del modulo.
7. Varia il tipo di domande: comprensione, applicazione, analisi.

Rispondi SOLO con il tool fornito.`;

    const userPrompt = `Titolo modulo: ${mod.title}
${mod.summary ? `Sommario: ${mod.summary}` : ""}
${keyPointsText}

Contenuto del modulo:
${mod.content_body}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_questions",
              description: "Save the generated assessment questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "The question text" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Exactly 4 answer options",
                        },
                        correct_index: { type: "number", description: "Index (0-3) of the correct answer" },
                        feedback_correct: { type: "string", description: "Brief feedback for correct answer" },
                        feedback_wrong: { type: "string", description: "Brief feedback for wrong answer" },
                      },
                      required: ["question", "options", "correct_index", "feedback_correct", "feedback_wrong"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_questions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No questions generated");
    }

    // Fisher-Yates shuffle for options
    for (const q of questions) {
      const opts = [...q.options];
      const correctText = opts[q.correct_index];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      q.options = opts;
      q.correct_index = opts.indexOf(correctText);
    }

    // Delete existing questions and insert new ones
    await supabase.from("assessment_questions").delete().eq("module_id", module_id);

    const rows = questions.map((q: any, i: number) => ({
      module_id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      feedback_correct: q.feedback_correct || null,
      feedback_wrong: q.feedback_wrong || null,
      order_index: i,
    }));

    const { error: insertErr } = await supabase.from("assessment_questions").insert(rows);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-assessment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
