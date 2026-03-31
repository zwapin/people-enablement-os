import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, role, repName, premessa, milestones } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = `Sei un esperto di onboarding per team sales B2B SaaS. Genera contenuti in italiano, professionali e concreti. Non usare markdown nei campi singoli (obiettivo, premessa, output). Usa frasi concise e azionabili.`;

    let tools: any[] = [];
    let toolChoice: any = undefined;
    let userPrompt = "";

    if (type === "premessa") {
      userPrompt = `Genera una premessa per il piano di onboarding di un nuovo ${role}${repName ? ` di nome ${repName}` : ""}. La premessa deve descrivere il contesto del ruolo, le aspettative e le sfide principali. 2-4 frasi.`;
      tools = [{
        type: "function",
        function: {
          name: "set_premessa",
          description: "Set the premessa text for the onboarding plan",
          parameters: {
            type: "object",
            properties: { premessa: { type: "string", description: "The premessa text" } },
            required: ["premessa"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "set_premessa" } };
    } else if (type === "milestones") {
      const context = premessa ? `\nContesto/Premessa del piano: ${premessa}` : "";
      userPrompt = `Genera i milestone 30-60-90 giorni per l'onboarding di un ${role}.${context}

Per ogni fase (30d, 60d, 90d) fornisci:
- obiettivo: una frase che descrive l'obiettivo principale della fase
- focus: 2-4 punti di focus concreti
- kpis: 2-3 KPI misurabili per valutare il progresso`;
      tools = [{
        type: "function",
        function: {
          name: "set_milestones",
          description: "Set milestones for all three phases",
          parameters: {
            type: "object",
            properties: {
              "30d": {
                type: "object",
                properties: {
                  obiettivo: { type: "string" },
                  focus: { type: "array", items: { type: "string" } },
                  kpis: { type: "array", items: { type: "string" } },
                },
                required: ["obiettivo", "focus", "kpis"],
              },
              "60d": {
                type: "object",
                properties: {
                  obiettivo: { type: "string" },
                  focus: { type: "array", items: { type: "string" } },
                  kpis: { type: "array", items: { type: "string" } },
                },
                required: ["obiettivo", "focus", "kpis"],
              },
              "90d": {
                type: "object",
                properties: {
                  obiettivo: { type: "string" },
                  focus: { type: "array", items: { type: "string" } },
                  kpis: { type: "array", items: { type: "string" } },
                },
                required: ["obiettivo", "focus", "kpis"],
              },
            },
            required: ["30d", "60d", "90d"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "set_milestones" } };
    } else if (type === "output") {
      const context = [
        premessa ? `Premessa: ${premessa}` : "",
        milestones ? `Milestone 90d obiettivo: ${milestones["90d"]?.obiettivo || "non definito"}` : "",
      ].filter(Boolean).join("\n");
      userPrompt = `Genera l'output atteso a 90 giorni per l'onboarding di un ${role}. ${context}\n\nDescrivi in 2-4 frasi il risultato concreto atteso al termine del piano.`;
      tools = [{
        type: "function",
        function: {
          name: "set_output",
          description: "Set the expected output text",
          parameters: {
            type: "object",
            properties: { output_atteso: { type: "string" } },
            required: ["output_atteso"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "set_output" } };
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit raggiunto, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-onboarding-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
