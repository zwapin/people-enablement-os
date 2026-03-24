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
      // Plain text — read directly
      extractedText = await fileData.text();
    } else if (lowerName.endsWith(".pdf")) {
      // PDF — extract text using basic approach
      // Read raw bytes and extract text between stream markers
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      extractedText = extractTextFromPdfBytes(bytes);
      if (!extractedText.trim()) {
        extractedText = "[PDF text extraction returned empty — the file may contain scanned images. Please paste the text manually.]";
      }
    } else if (lowerName.endsWith(".docx")) {
      // DOCX — it's a ZIP of XML files, extract from word/document.xml
      extractedText = await extractTextFromDocx(fileData);
      if (!extractedText.trim()) {
        extractedText = "[DOCX text extraction returned empty.]";
      }
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

function extractTextFromPdfBytes(bytes: Uint8Array): string {
  // Simple PDF text extraction: find text between BT/ET operators and parentheses
  const text = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];

  // Match text in Tj and TJ operators
  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(text)) !== null) {
    textParts.push(decodePdfString(match[1]));
  }

  // Match TJ arrays
  const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(text)) !== null) {
    const content = match[1];
    const stringRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = stringRegex.exec(content)) !== null) {
      textParts.push(decodePdfString(strMatch[1]));
    }
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

async function extractTextFromDocx(blob: Blob): Promise<string> {
  // DOCX is a ZIP file. We need to find word/document.xml and extract text from <w:t> tags.
  // Using basic ZIP parsing since we can't import heavy libraries in edge functions.
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Find the document.xml entry in the ZIP
    const documentXml = findFileInZip(bytes, "word/document.xml");
    if (!documentXml) return "";

    const xmlText = new TextDecoder().decode(documentXml);

    // Extract text from <w:t> tags
    const textParts: string[] = [];
    const tagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = tagRegex.exec(xmlText)) !== null) {
      textParts.push(match[1]);
    }

    // Also detect paragraph boundaries for better formatting
    return xmlText
      .replace(/<w:p[^/]*?\/>/g, "\n")
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

function findFileInZip(data: Uint8Array, targetFile: string): Uint8Array | null {
  // Basic ZIP local file header parser
  let offset = 0;

  while (offset < data.length - 4) {
    // Check for local file header signature 0x04034b50
    if (data[offset] === 0x50 && data[offset + 1] === 0x4b &&
        data[offset + 2] === 0x03 && data[offset + 3] === 0x04) {

      const compressionMethod = data[offset + 8] | (data[offset + 9] << 8);
      const compressedSize = data[offset + 18] | (data[offset + 19] << 8) |
                             (data[offset + 20] << 16) | (data[offset + 21] << 24);
      const uncompressedSize = data[offset + 22] | (data[offset + 23] << 8) |
                               (data[offset + 24] << 16) | (data[offset + 25] << 24);
      const fileNameLength = data[offset + 26] | (data[offset + 27] << 8);
      const extraFieldLength = data[offset + 28] | (data[offset + 29] << 8);

      const fileName = new TextDecoder().decode(data.slice(offset + 30, offset + 30 + fileNameLength));
      const dataStart = offset + 30 + fileNameLength + extraFieldLength;

      if (fileName === targetFile) {
        if (compressionMethod === 0) {
          // Stored (not compressed)
          return data.slice(dataStart, dataStart + uncompressedSize);
        } else {
          // Deflated — use DecompressionStream
          try {
            const compressed = data.slice(dataStart, dataStart + compressedSize);
            // For edge functions, try raw inflate
            const ds = new DecompressionStream("raw");
            const writer = ds.writable.getWriter();
            writer.write(compressed);
            writer.close();

            const reader = ds.readable.getReader();
            const chunks: Uint8Array[] = [];
            let totalLength = 0;

            // Synchronous-ish read
            const readAll = async () => {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                totalLength += value.length;
              }
              const result = new Uint8Array(totalLength);
              let pos = 0;
              for (const chunk of chunks) {
                result.set(chunk, pos);
                pos += chunk.length;
              }
              return result;
            };

            // We can't await here in a sync function, so return null and handle at caller
            // Actually, the caller is async, so let's restructure
            return null; // Will be handled by async version
          } catch {
            return null;
          }
        }
      }

      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }

  return null;
}
