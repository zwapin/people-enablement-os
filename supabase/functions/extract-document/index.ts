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
    } else if (lowerName.endsWith(".docx")) {
      extractedText = await extractDocx(fileData);
    } else if (lowerName.endsWith(".pdf")) {
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

async function extractDocx(fileData: Blob): Promise<string> {
  // DOCX is a ZIP containing XML. We import fflate to unzip, then parse the XML.
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const buffer = new Uint8Array(await fileData.arrayBuffer());
  const unzipped = unzipSync(buffer);

  const documentXml = unzipped["word/document.xml"];
  if (!documentXml) {
    return "[Could not find word/document.xml in DOCX]";
  }

  const xmlText = new TextDecoder().decode(documentXml);

  // Extract text from <w:t> tags, preserving paragraph breaks
  const paragraphs: string[] = [];
  // Split by paragraph tags
  const pMatches = xmlText.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  for (const p of pMatches) {
    const texts: string[] = [];
    const tMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    for (const t of tMatches) {
      const content = t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "");
      texts.push(content);
    }
    if (texts.length > 0) {
      paragraphs.push(texts.join(""));
    }
  }

  const result = paragraphs.join("\n\n");
  if (!result.trim()) {
    return "[No text content found in DOCX]";
  }
  return result;
}

async function extractTextWithAI(fileData: Blob, fileName: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const buffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // No size limit enforced

  const base64 = btoa(
    bytes.reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  console.log("[extract-document] Calling Anthropic API for PDF, base64 length:", base64.length);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 240_000);

  try {
    const userContent = [
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
      if (response.status === 429) {
        return "[Estrazione temporaneamente non disponibile per limiti di frequenza API. Il file è stato caricato correttamente. Riprova tra qualche minuto con 'Ri-estrai'.]";
      }
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
  } catch (error) {
    const isAbortError =
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");

    if (isAbortError) {
      console.warn("[extract-document] Extraction timeout reached, returning fallback content");
      return "[Estrazione interrotta per timeout. Il file è stato caricato correttamente, ma l'estrazione automatica non è riuscita. Riprova con 'Ri-estrai' o carica un file suddiviso.]";
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}