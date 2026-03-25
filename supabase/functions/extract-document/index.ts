import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log("[extract-document] Starting...");
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

    console.log("[extract-document] Downloading:", file_path);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("knowledge-files")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }
    console.log("[extract-document] Downloaded, size:", fileData.size);

    let extractedText = "";
    const lowerName = (file_name || file_path).toLowerCase();

    if (lowerName.endsWith(".txt")) {
      extractedText = await fileData.text();
    } else if (lowerName.endsWith(".pdf") || lowerName.endsWith(".docx")) {
      extractedText = await extractTextWithAI(fileData, lowerName);
    } else {
      extractedText = "[Unsupported file type]";
    }

    console.log("[extract-document] Extracted text length:", extractedText.length);

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
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const buffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Check size limit (~10MB base64)
  if (bytes.length > 7_500_000) {
    throw new Error("File too large for AI extraction (max ~7.5MB)");
  }

  const base64 = btoa(
    bytes.reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const mimeType = fileName.endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  console.log("[extract-document] Calling Anthropic API, base64 length:", base64.length);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    // Anthropic supports PDF natively via document type
    const userContent = fileName.endsWith(".pdf")
      ? [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Estrai tutto il testo da questo documento. Preserva la formattazione, la struttura, le tabelle in formato markdown e descrivi le immagini con placeholder markdown.",
          },
        ]
      : [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64,
            },
          },
          {
            type: "text",
            text: "Estrai tutto il testo da questo documento. Preserva la formattazione, la struttura, le tabelle in formato markdown e descrivi le immagini con placeholder markdown.",
          },
        ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16384,
        system: "Sei un estrattore di testo da documenti. Estrai TUTTO il contenuto testuale dal documento fornito. Preserva la struttura (titoli, paragrafi, elenchi puntati). IMPORTANTE: preserva TUTTE le tabelle in formato markdown (con | e ---). Per immagini, grafici o diagrammi presenti nel documento, inserisci un placeholder descrittivo in formato markdown: ![Descrizione dettagliata del contenuto visivo](image-placeholder). Non aggiungere commenti tuoi, restituisci solo il contenuto estratto.",
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`AI extraction failed (${response.status})`);
    }

    console.log("[extract-document] Anthropic response received");
    const result = await response.json();
    const textBlock = result.content?.find((c: any) => c.type === "text");
    const content = textBlock?.text;

    if (!content || !content.trim()) {
      return "[AI text extraction returned empty. The document may be blank or corrupted.]";
    }

    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}