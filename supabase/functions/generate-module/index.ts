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
        JSON.stringify({ error: "Please provide at least 50 characters of source text." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build knowledge base context section if provided
    let kbSection = "";
    if (knowledge_context) {
      const { documents, faqs } = knowledge_context;
      if (documents && documents.length > 0) {
        kbSection += "\n\n## REFERENCE DOCUMENTS (use as authoritative source material)\n";
        for (const doc of documents) {
          kbSection += `\n### ${doc.title}${doc.context ? ` — ${doc.context}` : ""}\n${doc.content}\n`;
        }
      }
      if (faqs && faqs.length > 0) {
        kbSection += "\n\n## REFERENCE FAQ (use these Q&A pairs as authoritative facts)\n";
        for (const faq of faqs) {
          kbSection += `\nQ: ${faq.question}\nA: ${faq.answer}\n`;
        }
      }
    }

    const systemPrompt = `You are a sales training content expert. Given source material, generate a structured training module for new sales reps.
${kbSection ? "\nYou have access to the following knowledge base. Use it as authoritative reference to ensure accuracy and consistency:" + kbSection : ""}
Return a JSON object using the generate_module tool with these fields:
- title: concise module title (max 60 chars)
- summary: 1-2 sentence overview of the module
- key_points: array of 4-6 key takeaways (short strings)
- content_body: full training content in markdown format, well-structured with headers, bullet points, and examples. Should be comprehensive (800-1500 words).
- questions: array of 5-7 assessment questions, each with:
  - question: the question text
  - options: array of exactly 4 answer options (strings)
  - correct_index: index (0-3) of the correct answer
  - feedback_correct: brief explanation why the answer is correct
  - feedback_wrong: brief hint pointing toward the correct answer`;

    const userPrompt = title_hint
      ? `Source material (suggested title: "${title_hint}"):\n\n${text}`
      : `Source material:\n\n${text}`;

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
              description: "Generate a structured training module from source material",
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
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured output");
    }

    const moduleData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(moduleData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
