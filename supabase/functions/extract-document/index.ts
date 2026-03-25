import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { file_path, file_name } = await req.json();

    if (!file_path) {
      return new Response(
        JSON.stringify({ error: "file_path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("knowledge-files")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    let extractedText = "";
    const lowerName = (file_name || file_path).toLowerCase();

    if (lowerName.endsWith(".txt")) {
      extractedText = await fileData.text();
    } else if (lowerName.endsWith(".pdf") || lowerName.endsWith(".docx")) {
      // Use Lovable AI (Gemini) to extract text from PDF/DOCX
      extractedText = await extractTextWithAI(fileData, lowerName);
    } else {
      extractedText = "[Unsupported file type]";
    }

    return new Response(
      JSON.stringify({ content: extractedText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractTextWithAI(fileData: Blob, fileName: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const buffer = await fileData.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const mimeType = fileName.endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a document text extractor. Extract ALL text content from the provided document. Preserve the structure (headings, paragraphs, bullet points, tables). Output only the extracted text, no commentary."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this document. Preserve formatting and structure."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI extraction failed (${response.status})`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content || !content.trim()) {
    return "[AI text extraction returned empty. The document may be blank or corrupted.]";
  }

  return content.trim();
}
