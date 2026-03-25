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
        JSON.stringify({ error: "Knowledge Base is empty. Upload documents or add FAQs first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build KB context for the AI — truncate doc content to avoid massive prompts
    let kbContext = "## KNOWLEDGE BASE DOCUMENTS\n\n";
    for (const doc of docs) {
      kbContext += `### Document: ${doc.title} (ID: ${doc.id})\n`;
      if (doc.context) kbContext += `Context: ${doc.context}\n`;
      const truncatedContent = doc.content && doc.content.length > 8000
        ? doc.content.substring(0, 8000) + "\n[... truncated for brevity ...]"
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
8. Generate 3-5 assessment questions per module (keep them concise)
9. Keep content_body between 400-800 words per module to stay within output limits
10. Propose at most 8 modules total

Return the curriculum using the propose_curriculum tool.`;

    console.log("[generate-curriculum] Calling AI gateway, prompt length:", systemPrompt.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 16384,
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
                          content_body: { type: "string", description: "Training content in markdown (400-800 words)" },
                          ai_rationale: { type: "string", description: "Why this module exists" },
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
    } finally {
      clearTimeout(timeout);
    }

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
