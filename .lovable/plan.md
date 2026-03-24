

# Klaaryo Academy — Full Platform Build Plan

## Current State

- Auth is working: login/signup, profiles table, user_roles table, RLS, deactivation check
- Existing tables: `profiles`, `user_roles` with proper RLS and `has_role()` function
- Basic Home page showing name/role, no navigation shell yet
- Default light theme with shadcn defaults — needs complete restyling

## What This Plan Delivers

The full app shell, database schema for all remaining tables, dark theme, role-based navigation, and scaffolded pages for Learn, Grow, Perform, and People.

---

## Step 1 — Database Migration

Create all remaining tables in a single migration:

**New enums:**
- `module_status`: `draft`, `published`
- `plan_status`: `active`, `archived`
- `milestone_label`: `30d`, `60d`, `90d`
- `task_type`: `module_link`, `activity`, `meeting`

**New tables:**

- `modules` (id, title, summary varchar(300), content_body text, key_points jsonb, track text default 'General', order_index int, status module_status default 'draft', created_at, updated_at)
- `assessment_questions` (id, module_id FK->modules, question text, options jsonb, correct_index int, feedback_correct text, feedback_wrong text, order_index int)
- `module_completions` (id, user_id uuid, module_id FK->modules, score int, attempts int default 1, completed_at timestamptz, unique(user_id, module_id))
- `onboarding_plans` (id, rep_id uuid, created_by uuid, role_template text, plan_status plan_status default 'active', created_at)
- `onboarding_milestones` (id, plan_id FK->onboarding_plans, label milestone_label, goals jsonb default '[]')
- `onboarding_tasks` (id, milestone_id FK->onboarding_milestones, title text, type task_type default 'activity', module_id uuid nullable, completed boolean default false, completed_at timestamptz)

**RLS policies for each table:**
- `modules`: anyone authenticated can SELECT published; admins can SELECT/INSERT/UPDATE/DELETE all
- `assessment_questions`: anyone authenticated can SELECT (where module is published); admins full CRUD
- `module_completions`: users can SELECT/INSERT their own; admins can SELECT all
- `onboarding_plans`: reps can SELECT their own; admins full CRUD
- `onboarding_milestones`: reps can SELECT where plan belongs to them; admins full CRUD
- `onboarding_tasks`: reps can SELECT and UPDATE (completed/completed_at only) their own; admins full CRUD

## Step 2 — Design System (Dark Theme)

Update `src/index.css` CSS variables to match the spec:

- `--background`: #0e0e0e
- `--card` / `--popover`: #161616
- `--border` / `--input`: #2a2a2a
- `--primary`: #c8f060 (lime accent)
- `--primary-foreground`: #0e0e0e (dark text on accent)
- `--foreground`: #f5f3ee
- `--muted-foreground`: #666666
- `--destructive`: #ff4d3d

Import DM Sans (body) and DM Mono (labels) via Google Fonts in `index.html`. Set font-family in CSS. Set `border-radius: 4px`. Remove `.dark` class — this is dark-only.

## Step 3 — App Layout Shell

Create `src/components/AppLayout.tsx`:
- Left sidebar nav with Klaaryo logo/wordmark at top
- Nav items: Learn, Grow, Perform (all roles), People (admin only)
- Each nav item uses an icon (BookOpen, TrendingUp, BarChart3, Users)
- Active state uses accent color
- Bottom: user name, role badge, sign out button
- Main content area scrollable on the right
- Responsive: on mobile, sidebar collapses to a top bar with hamburger menu

Update `src/App.tsx` routes:
- `/` redirects to `/learn`
- `/learn` — Learn page
- `/grow` — Grow page
- `/perform` — Perform page
- `/people` — People page (admin only)
- All wrapped in `ProtectedRoute` and `AppLayout`

## Step 4 — Scaffolded Pages (Empty States)

Create four page components with proper empty states:

- **Learn** (`/learn`): Empty state — "No modules yet." Admin sees "Create your first module" button. Rep sees "Your curriculum will appear here once your admin publishes modules."
- **Grow** (`/grow`): Empty state — "No onboarding plan yet." Admin sees list of reps without plans. Rep sees "Your onboarding plan will appear here once your admin sets it up."
- **Perform** (`/perform`): Empty state with lock icon — "Coming soon. Performance tracking and call coaching will be available in a future update."
- **People** (`/people`, admin only): Empty state — "No team members yet." With "Invite a rep" button placeholder.

## Step 5 — Remove Signup from Login Page

Since the admin creates accounts (via People > Invite), remove the self-service signup toggle from the Login page. Login is email + password only. The signup flow will be handled later via admin invitation.

---

## Technical Notes

- All new tables use `gen_random_uuid()` for IDs and `now()` for timestamps
- Foreign keys use `ON DELETE CASCADE` where appropriate (questions -> modules, milestones -> plans, tasks -> milestones, completions -> modules)
- The `onboarding_tasks.module_id` is nullable (only set for `module_link` type tasks)
- Nav visibility is driven by `profile.role` from AuthContext — no additional API calls needed
- DM Sans / DM Mono loaded from Google Fonts CDN

