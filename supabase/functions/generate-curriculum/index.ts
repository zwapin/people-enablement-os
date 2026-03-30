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
    let regenerateAll = false;
    let collectionId: string | null = null;
    let customInstructions: string | null = null;
    let selectedDocumentIds: string[] | null = null;
    try {
      const body = await req.json();
      regenerateAll = body?.regenerate_all === true;
      collectionId = body?.collection_id || null;
      customInstructions = body?.custom_instructions || null;
      selectedDocumentIds = body?.selected_document_ids || null;
    } catch {
      // no body
    }

    console.log("[generate-curriculum] Enqueuing job, regenerateAll:", regenerateAll, "collectionId:", collectionId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Quick validation: check KB is not empty (scoped to collection if provided)
    let docsQuery = supabase.from("knowledge_documents").select("id", { count: "exact", head: true });
    let faqsQuery = supabase.from("knowledge_faqs").select("id", { count: "exact", head: true });
    if (collectionId) {
      docsQuery = docsQuery.eq("collection_id", collectionId);
      faqsQuery = faqsQuery.eq("collection_id", collectionId);
    }
    const { count: docsCount } = await docsQuery;
    const { count: faqsCount } = await faqsQuery;

    if ((docsCount ?? 0) === 0 && (faqsCount ?? 0) === 0) {
      const msg = collectionId
        ? "Questa collection non ha documenti né FAQ. Carica materiale prima di generare."
        : "La Knowledge Base è vuota. Carica documenti o aggiungi FAQ prima di generare il curriculum.";
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If regenerating all, also clean curricula
    if (regenerateAll && !collectionId) {
      console.log("[generate-curriculum] Cleaning existing curricula for full regen");
      await supabase.from("curricula").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Insert job record
    const { data: job, error: insertError } = await supabase
      .from("generation_jobs")
      .insert({
        job_type: "curriculum",
        input: { regenerate_all: regenerateAll, collection_id: collectionId, custom_instructions: customInstructions },
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("[generate-curriculum] Insert error:", insertError);
      throw new Error("Impossibile creare il job di generazione");
    }

    console.log("[generate-curriculum] Job created:", job.id);

    // Fire-and-forget: call process-curriculum
    const processUrl = `${supabaseUrl}/functions/v1/process-curriculum`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch(err => console.error("[generate-curriculum] Fire-and-forget error:", err));

    return new Response(
      JSON.stringify({ jobId: job.id, status: "pending" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-curriculum] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
