

# Knowledge Base — Plan

## What We're Building

A new "Knowledge Base" section in the Learn admin view where the manager can:
1. **Upload documents** (PDF, DOCX, TXT) with an optional context/description per document
2. **Create FAQ entries** (question/answer pairs) manually
3. Both feed into the AI module generation as RAG context

The idea is that when generating a module, the AI pulls relevant knowledge from uploaded docs + FAQs to produce better, more accurate content. The Q&A format is particularly interesting for RAG because it's already structured as retrieval-ready chunks with clear semantic intent.

## Architecture

```text
┌─────────────────────────────────────────┐
│  Learn Page (Admin)                     │
│  ┌─────────┐  ┌──────────────────────┐  │
│  │ Modules  │  │ Knowledge Base (tab) │  │
│  └─────────┘  └──────────────────────┘  │
│                  ├─ Documents list       │
│                  │   upload + context    │
│                  └─ FAQ list             │
│                     Q&A pairs           │
└─────────────────────────────────────────┘

Module Generation:
  source text + relevant KB docs + relevant FAQs → AI → module
```

## Database Changes

**New table: `knowledge_documents`**
- `id` (uuid, PK)
- `title` (text) — file name or custom title
- `context` (text, nullable) — admin's description of what this doc covers
- `content` (text) — extracted text content from the file
- `file_path` (text, nullable) — storage path if uploaded as file
- `created_at` (timestamptz)
- RLS: admin-only CRUD

**New table: `knowledge_faqs`**
- `id` (uuid, PK)
- `question` (text)
- `answer` (text)
- `category` (text, nullable) — optional grouping (e.g. "Pricing", "Product", "Process")
- `created_at` (timestamptz)
- RLS: admin-only CRUD, reps can SELECT

**New storage bucket: `knowledge-files`** — for uploaded PDFs/DOCX

## UI Changes

**Learn page** — Add a tab switcher at the top for admins: "Modules" | "Knowledge Base"

**Knowledge Base tab** has two sections:
1. **Documents** — table with title, context preview, upload date. "Upload document" button opens a dialog where admin uploads a file + adds context. Text extraction happens server-side via edge function.
2. **FAQs** — table with question, answer preview, category. "Add FAQ" button opens inline form. Supports edit/delete.

**Module Editor** — When generating with AI, the edge function now also queries `knowledge_documents` and `knowledge_faqs` to inject relevant context into the prompt. The admin can optionally select which KB items to include.

## Edge Functions

**New: `extract-document`** — receives uploaded file, extracts text (PDF via basic parsing, DOCX via XML extraction, TXT direct), stores extracted text in `knowledge_documents.content`.

**Updated: `generate-module`** — accepts optional `knowledge_context` parameter (array of doc contents + FAQ pairs). Injects them into the system prompt as reference material for more accurate generation.

## Why Q&A Format Works Well for RAG

FAQ entries are self-contained semantic units — each question defines the retrieval intent and the answer provides the exact knowledge. When the AI generates a module, matching source questions to module topics is more precise than searching unstructured document text. Both formats complement each other: docs provide depth, FAQs provide precision.

## Build Steps

1. Create `knowledge_documents` and `knowledge_faqs` tables with RLS
2. Create `knowledge-files` storage bucket
3. Build Knowledge Base UI (tab on Learn page, document upload, FAQ CRUD)
4. Build `extract-document` edge function for text extraction
5. Update `generate-module` to pull KB context into AI prompt
6. Add KB item selector to ModuleEditor's AI generation section

## Technical Details

- File upload: max 10MB, PDF/DOCX/TXT only
- Text extraction: edge function using basic parsing (no heavy OCR in v1)
- RAG approach: for now, pass full relevant KB text to the AI prompt (no vector embeddings in v1 — the context window of Gemini 2.5 Flash is large enough). Can add embeddings later if KB grows beyond prompt limits.
- FAQ categories are optional but help with organization and filtering

