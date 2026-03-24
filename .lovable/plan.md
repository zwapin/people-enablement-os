

# Klaaryo Academy — Full Flow Implementation Plan

## What We're Building

The complete end-to-end flow described in your scenario: admin invites a rep, creates an onboarding plan, the rep logs in and works through modules and tasks. This is a large build — I'll break it into 5 sequential steps.

## Current State

- Database schema: all tables exist (profiles, modules, assessment_questions, module_completions, onboarding_plans, onboarding_milestones, onboarding_tasks) with RLS
- Auth: working with DEV_BYPASS as admin Federico
- UI: app shell with sidebar nav, all 4 pages are empty states
- No functional features yet

---

## Step 1 — People Page (Admin)

**What the admin sees:** A table of all team members showing name, email, department, job role, modules completed, tasks completed, last activity. An "Invite a rep" button opens a dialog.

**Invite flow:**
- Dialog with fields: full name, email, department (dropdown: Sales, CS, Ops, Management), job role (text input)
- On submit: calls an Edge Function `invite-user` that uses the Supabase Admin API to create the user with a temporary password and sends an invite email via `supabase.auth.admin.inviteUserByEmail()`
- The Edge Function also sets department and job_role on the profile
- The new rep appears in the table immediately

**Admin actions per row:** toggle is_active, change role (admin/rep)

**Database changes:** None — existing schema supports this. Need an Edge Function for admin user creation (client-side can't create other users).

---

## Step 2 — Learn: Module CRUD (Admin)

**What the admin sees:** A list of all modules (draft + published) with title, track, status, order. A "Create module" button.

**Create/Edit module flow:**
- Step 1: Upload a source document (PDF/DOCX) or paste text manually
- Step 2: AI generates structured content — title, summary, key_points, content_body (markdown), and 5-7 assessment questions with 4 options each
- Step 3: Admin reviews and edits everything in a rich form
- Step 4: Save as draft or publish

**AI generation:** Edge Function `generate-module` that receives document text, calls an AI model (Gemini 2.5 Flash via Lovable AI), returns structured JSON.

**File upload:** Create a `source-documents` storage bucket for uploaded PDFs/DOCX. Use an Edge Function to extract text from the document.

**Module list:** Drag-to-reorder (updates order_index), status badge (draft/published), edit/delete actions.

---

## Step 3 — Learn: Module View + Assessment (Rep)

**What the rep sees:** A sequential list of modules. Module 1 is unlocked, the rest show a lock icon. Completed modules show a checkmark with score.

**Module detail page** (`/learn/:id`):
- Title, summary, key points as bullet list
- Full content rendered as markdown
- "Start Assessment" button at the bottom

**Assessment flow:**
- 5-7 multiple choice questions, one at a time
- After answering, show immediate feedback (correct/wrong + explanation)
- At the end: show score (e.g., 6/7)
- If score >= 5: mark module as completed, next module unlocks
- If score < 5: "Try again" button, no cooldown
- Score and attempts saved to module_completions

**Unlock logic:** A module at order_index N is unlocked if the user has a completion record for all modules with order_index < N (within the same track).

---

## Step 4 — Grow: Onboarding Plan (Admin + Rep)

**Admin view — Plan creation:**
- Grow page shows list of reps who don't have a plan yet
- "Create plan" button for a rep opens a plan builder
- Select role template (AE, SDR, CSM — pre-fills default tasks/goals)
- Three milestone tabs: 30d, 60d, 90d
- Per milestone: editable goals (text list), editable tasks (title + type: module_link/activity/meeting)
- For module_link tasks: dropdown to select a published module
- Save creates the plan + milestones + tasks in one transaction

**Admin view — Plan management:**
- View any rep's plan, edit goals/tasks, add tasks
- "Archive" button sets plan_status to archived (read-only)

**Rep view:**
- Sees their plan with milestones as collapsible sections
- Current milestone (based on time since plan creation) is expanded
- Tasks have checkboxes — checking one updates completed + completed_at
- Goals shown as reference text
- Archived plans are greyed out, checkboxes disabled

---

## Step 5 — People Dashboard Metrics + Activity Tracking

**Metrics per rep in People table:**
- Modules completed / total published
- Tasks completed / total in their plan
- Last activity date

**Activity tracking:**
- Update `profiles.last_activity_at` on key actions (module completion, task check-off, page load)
- Simple: update on each authenticated page load via AuthContext

---

## Technical Details

**New Edge Functions:**
1. `invite-user` — uses service_role key to create user via admin API, sets profile fields
2. `generate-module` — accepts document text, calls Lovable AI (Gemini 2.5 Flash), returns structured module JSON

**New Storage Bucket:**
- `source-documents` — for uploaded PDFs/DOCX

**New Routes:**
- `/learn/:id` — module detail + assessment
- `/grow/:planId` — plan detail (optional, could be inline)

**New Components (estimated):**
- `PeopleTable` — data table with columns
- `InviteDialog` — form dialog
- `ModuleList` — admin module list with reorder
- `ModuleEditor` — create/edit form with AI generation
- `ModuleDetail` — rep view of module content
- `Assessment` — quiz flow component
- `PlanBuilder` — admin plan creation form
- `PlanView` — rep plan view with checkable tasks
- `MilestoneSection` — collapsible milestone with goals + tasks

**No database schema changes needed** — all tables already exist with the right structure and RLS policies.

---

## Build Order

I recommend building in this exact order since each step is independently testable:

1. **People page** — invite flow + table (enables creating test reps)
2. **Learn admin** — module CRUD + AI generation (enables creating content)
3. **Learn rep** — module view + assessment (enables learning flow)
4. **Grow** — plan creation + task tracking (enables onboarding flow)
5. **Metrics** — dashboard numbers + activity tracking (enables monitoring)

Each step will be a separate implementation message. Approve to start with Step 1 (People page).

