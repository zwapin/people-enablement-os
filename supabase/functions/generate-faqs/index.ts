import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

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

  let collectionId: string;
  try {
    const body = await req.json();
    collectionId = body.collection_id;
    if (!collectionId) throw new Error("missing");
  } catch {
    return new Response(JSON.stringify({ error: "collection_id required" }), { status: 400 });
  }

  console.log("[generate-faqs] Starting for collection:", collectionId);

  try {
    const { data: collection } = await supabase
      .from("curricula")
      .select("title, description")
      .eq("id", collectionId)
      .single();

    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }

    const { data: modules } = await supabase
      .from("modules")
      .select("title, summary, content_body, key_points")
      .eq("curriculum_id", collectionId)
      .in("status", ["published", "draft", "proposed"])
      .order("order_index");

    if (!modules || modules.length === 0) {
      console.log("[generate-faqs] No modules found, skipping");
      return new Response(JSON.stringify({ status: "skipped", reason: "no modules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("knowledge_faqs").delete().eq("collection_id", collectionId).eq("category", "auto-generated");

    let modulesContext = "";
    for (const mod of modules) {
      modulesContext += `### Modulo: ${mod.title}\n`;
      if (mod.summary) modulesContext += `Sommario: ${mod.summary}\n`;
      if (mod.key_points && Array.isArray(mod.key_points)) {
        modulesContext += `Punti chiave: ${(mod.key_points as string[]).join(", ")}\n`;
      }
      if (mod.content_body) {
        const content = mod.content_body.length > 5000
          ? mod.content_body.substring(0, 5000) + "\n[... troncato ...]"
          : mod.content_body;
        modulesContext += `${content}\n\n`;
      }
    }

    const systemPrompt = `Sei un esperto di formazione commerciale. Dato il contenuto di una collection di moduli formativi, genera delle FAQ (Domande Frequenti) che aiutino i commerciali a trovare rapidamente le informazioni più importanti.

## COLLECTION: "${collection.title}"
${collection.description ? `Descrizione: ${collection.description}` : ""}

## CONTENUTO DEI MODULI

${modulesContext}

ISTRUZIONI:
- Genera 5-10 FAQ pertinenti e utili basate sul contenuto dei moduli
- Le domande devono essere quelle che un commerciale si porrebbe realmente
- Le risposte devono essere concise ma complete (2-4 frasi)
- Copri gli argomenti principali trasversalmente ai moduli
- Usa un tono professionale ma accessibile
- Tutto in italiano
- NON inventare informazioni non presenti nei moduli`;

    console.log("[generate-faqs] Calling Lovable AI, modules:", modules.length);

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Genera le FAQ per la collection "${collection.title}".` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_faqs",
              description: "Genera FAQ per una collection formativa",
              parameters: {
                type: "object",
                properties: {
                  faqs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        answer: { type: "string" },
                      },
                      required: ["question", "answer"],
                    },
                  },
                },
                required: ["faqs"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_faqs" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'AI non ha restituito un output strutturato");

    const toolInput = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    const generatedFaqs = toolInput.faqs || [];
    console.log("[generate-faqs] Generated", generatedFaqs.length, "FAQs");

    if (generatedFaqs.length > 0) {
      const faqRows = generatedFaqs.map((faq: any) => ({
        collection_id: collectionId,
        question: faq.question,
        answer: faq.answer,
        category: "auto-generated",
      }));
      const { error } = await supabase.from("knowledge_faqs").insert(faqRows);
      if (error) {
        console.error("[generate-faqs] Insert error:", error);
        throw new Error("Failed to insert FAQs");
      }
    }

    console.log("[generate-faqs] Completed for collection:", collectionId);
    return new Response(JSON.stringify({ status: "completed", faqs_count: generatedFaqs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-faqs] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
