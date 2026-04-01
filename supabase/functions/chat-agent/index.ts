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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all knowledge documents for context
    const { data: docs } = await supabase
      .from("knowledge_documents")
      .select("id, title, content, collection_id");

    // Fetch collection titles for references
    const { data: collections } = await supabase
      .from("curricula")
      .select("id, title");

    const collectionMap = new Map(collections?.map((c: any) => [c.id, c.title]) ?? []);

    const docsContext = (docs ?? [])
      .map((d: any) => {
        const collTitle = d.collection_id ? collectionMap.get(d.collection_id) ?? "N/A" : "Generale";
        return `--- Documento: "${d.title}" (ID: ${d.id}) (Collection: ${collTitle}, Collection ID: ${d.collection_id || "none"}) ---\n${d.content}\n`;
      })
      .join("\n");

    const systemPrompt = `Sei Klaaryo Assistant, l'assistente AI dello spazio di formazione Klaaryo.

REGOLE FONDAMENTALI:
1. Per domande di CONTENUTO (prodotto, processi, regole, informazioni aziendali):
   - Rispondi SOLO basandoti sui documenti caricati nelle collection, riportati qui sotto.
   - Cita SEMPRE la porzione esatta del documento a cui fai riferimento.
   - DOPO la tua risposta, aggiungi SEMPRE una sezione "Fonti" con i riferimenti ai documenti usando questo formato ESATTO per ogni fonte:
     [📄 TITOLO_DOCUMENTO](klaaryo-doc://ID_DOCUMENTO/ID_COLLECTION)
     > Citazione esatta della porzione di testo da cui hai estratto la risposta
   - Se l'informazione non è presente nei documenti, rispondi: "Non ho trovato questa informazione nei documenti disponibili. Prova a chiedere al tuo manager."
   - NON inventare MAI informazioni.

2. Per domande sul FUNZIONAMENTO dello spazio Klaaryo:
   - Home: è la dashboard personale con progresso formazione, badge di livello (da Explorer a Champion), messaggi di incoraggiamento e accesso rapido ai tool del team.
   - Formazione (Learn): contiene le collection di moduli formativi organizzati per area. Ogni modulo ha contenuti + assessment finale. Completa i moduli per avanzare di livello.
   - Crescita (Grow): mostra il tuo piano di onboarding con milestone a 30, 60 e 90 giorni, attività chiave e task da completare.
   - Performance (Perform): sezione dedicata al monitoraggio delle performance.

DOCUMENTI DISPONIBILI:
${docsContext || "Nessun documento caricato."}

Rispondi in italiano, in modo chiaro e conciso. Usa il markdown per formattare le risposte.`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
