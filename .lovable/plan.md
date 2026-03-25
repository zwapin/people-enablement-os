

# Paradigm Shift: Manager as Curator, AI as Content Creator

## The Change

Currently the manager manually creates modules. The new flow:

1. Manager feeds the Knowledge Base (documents + FAQs) — this is their only active input
2. Manager clicks "Update Curriculum" on the Learn page — AI analyzes the entire KB and proposes a full curriculum
3. Manager reviews proposals: approve, edit, or regenerate individual modules
4. Only approved modules become visible to reps
5. When KB changes, manager clicks "Update" again — AI identifies impacted modules and proposes revisions (delta only)

## Database Changes

**Alter `modules` table:**
- Add `proposed` and `archived` to the `module_status` enum (currently only `draft` and `published`)
- Add `source_document_ids` (jsonb, nullable) — tracks which KB documents were used to generate the module
- Add `source_faq_ids` (jsonb, nullable) — tracks which FAQs were used
- Add `ai_rationale` (text, nullable) — AI's explanation for why this module exists and what it covers

**State machine:**
```text
proposed → draft → published → archived
   ↑                               │
   └───────── (AI re-proposes) ────┘
```

- `proposed` — AI generated, manager hasn't interacted yet
- `draft` — manager edited but not published
- `published` — visible to reps
- `archived` — obsolete, hidden

## New Edge Function: `generate-curriculum`

Replaces the current single-module generation approach. This function:

1. Receives the full KB (all documents + all FAQs) plus existing published/draft modules
2. AI analyzes the knowledge and produces a curriculum proposal: how many modules, in what order, what each covers, which KB sources it draws from
3. Returns an array of proposed modules, each with: title, summary, key_points, content_body, questions, source references, rationale
4. For updates (when KB changed): also receives current modules, AI identifies which are impacted and only proposes changes to those

Uses Lovable AI (Gemini 2.5 Flash) with tool calling to return structured JSON.

## UI Changes

### Learn Page (Admin View) — Complete Redesign

The admin no longer sees a module editor. They see:

**Top section:** "Update Curriculum" button + last update timestamp. When clicked, calls `generate-curriculum` with the full KB. Shows a loading state during generation.

**Main section — two views:**

1. **Published Curriculum** — the current live modules (published status), shown as an ordered list. Each has: title, summary, track, status badge. Actions: edit, archive, unpublish.

2. **Proposals** — modules in `proposed` status, shown as cards with a distinct visual treatment (e.g. dashed border, "AI Proposed" badge). Each shows:
   - Title, summary, rationale (why AI created this)
   - Sources used (linked to KB documents/FAQs)
   - Actions: Approve (→ published), Edit (opens editor → draft), Reject (deletes), Regenerate (re-runs AI for just this module)

**"Approve All" button** to bulk-publish all proposals at once.

### Module Editor (Simplified)

Still exists but only for editing — no more "paste source text and generate" flow. The AI does that automatically. The editor opens when the manager clicks "Edit" on a proposed or draft module.

### Learn Page (Rep View) — No Change

Reps still see published modules in sequence. No change needed.

## Flow Detail

### First-time curriculum generation
1. Manager has populated the KB with documents and FAQs
2. Goes to Learn, clicks "Update Curriculum"
3. Edge function fetches all KB content, sends to AI
4. AI returns N proposed modules with full content + assessments
5. All modules saved with status `proposed`
6. Manager reviews each proposal, approves/edits/rejects

### KB update → delta refresh
1. Manager uploads a new document or edits FAQs
2. Goes to Learn, clicks "Update Curriculum"
3. Edge function sends full KB + existing modules to AI
4. AI compares and returns only new/changed modules as proposals
5. Existing published modules that need updating get new `proposed` versions (the old ones stay published until the manager swaps them)

## Build Steps

1. **DB migration** — add `proposed` and `archived` to module_status enum, add `source_document_ids`, `source_faq_ids`, `ai_rationale` columns
2. **Create `generate-curriculum` edge function** — full KB analysis, structured curriculum output
3. **Rebuild Learn page (admin)** — proposals view, approve/reject/edit actions, "Update Curriculum" button
4. **Update ModuleList** — handle new statuses, visual distinction for proposed modules
5. **Simplify ModuleEditor** — remove AI generation UI, keep as edit-only form
6. **Keep `generate-module`** — repurpose for single-module regeneration when manager clicks "Regenerate" on a proposal

## Technical Details

- The `generate-curriculum` function will need to handle large KB content. Gemini 2.5 Flash has a large context window so this works without embeddings for now.
- Source tracking (`source_document_ids`, `source_faq_ids`) enables the delta detection: when a document changes, AI knows which modules used it.
- The old `generate-module` function stays for single-module regen. `generate-curriculum` is the new primary flow.
- No changes needed to assessment_questions table — questions are still created per module, just now they come from the curriculum generation.

