import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    if (docs.length === 0 && faqs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Knowledge Base is empty. Upload documents or add FAQs first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build KB context for the AI
    let kbContext = "## KNOWLEDGE BASE DOCUMENTS\n\n";
    for (const doc of docs) {
      kbContext += `### Document: ${doc.title} (ID: ${doc.id})\n`;
      if (doc.context) kbContext += `Context: ${doc.context}\n`;
      kbContext += `${doc.content}\n\n`;
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

    const systemPrompt = `You are a sales training curriculum architect. Your job is to analyze a Knowledge Base and design a complete training curriculum for new sales reps.

${kbContext}
${existingContext}

INSTRUCTIONS:
1. Analyze ALL the knowledge base content holistically
2. Design a logical curriculum structure: what topics to cover, in what sequence, how to group information
3. For each proposed module, generate complete content including assessment questions
4. Reference which KB documents and FAQs you used for each module (by their IDs)
5. Provide a rationale for each module explaining why it exists and what gap it fills
6. Modules should flow logically — foundational concepts first, advanced topics later
7. Each module should be self-contained but build on previous ones
8. Generate 3-7 assessment questions per module

Return the curriculum using the propose_curriculum tool.`;

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
          { role: "user", content: "Analyze the knowledge base and propose a complete training curriculum. Design the optimal module structure, sequence, and content." },
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
                        title: { type: "string", description: "Module title (max 60 chars)" },
                        summary: { type: "string", description: "1-2 sentence overview" },
                        track: { type: "string", enum: ["Sales", "CS", "Ops", "General"] },
                        key_points: { type: "array", items: { type: "string" }, description: "4-6 key takeaways" },
                        content_body: { type: "string", description: "Full training content in markdown (800-1500 words)" },
                        ai_rationale: { type: "string", description: "Why this module exists, what knowledge gap it fills" },
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

    const curriculum = JSON.parse(toolCall.function.arguments);
    const proposedModules = curriculum.modules || [];

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

    return new Response(
      JSON.stringify({ modules: savedModules, count: savedModules.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
