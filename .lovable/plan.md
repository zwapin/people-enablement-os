

# Paradigm Shift: Manager as Curator, AI as Content Creator

## Status: IMPLEMENTED ✅

## What Changed

The manager is no longer a content creator — they're a curator. Their only job is to keep the Knowledge Base updated and approve what the AI proposes.

### Flow
1. Manager feeds the KB (documents + FAQs) via the Knowledge Base page
2. On the Learn page, clicks "Aggiorna Curriculum" → AI analyzes the full KB and proposes modules
3. Manager reviews proposals: Approve (→ published), Edit (→ draft), Reject (delete)
4. Only approved modules are visible to reps
5. When KB changes, click "Aggiorna Curriculum" again → AI proposes delta revisions

### Database Changes (Done)
- Added `proposed` and `archived` to `module_status` enum
- Added `source_document_ids`, `source_faq_ids`, `ai_rationale` columns to `modules`

### Edge Functions
- `generate-curriculum` — analyzes full KB, proposes structured curriculum via Lovable AI (Gemini 2.5 Flash)
- `generate-module` — kept for single-module regeneration
- `extract-document` — text extraction from uploaded files

### UI Components
- `Learn.tsx` — admin sees "Aggiorna Curriculum" button, proposals section, published curriculum, drafts
- `ProposalsList.tsx` — AI proposals with dashed border, approve/edit/reject actions, rationale display
- `CurriculumList.tsx` — published/draft modules with edit/archive/toggle actions
- `ModuleEditor.tsx` — simplified edit-only form (no more AI generation UI)
- `KnowledgeBase.tsx` — KB management (documents + FAQs) in dedicated sidebar page

### State Machine
```
proposed → draft → published → archived
```
