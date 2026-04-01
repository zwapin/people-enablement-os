

## Plan: White Sidebar + Tools Admin View

### 1. White sidebar theme

Update CSS variables in `src/index.css` (lines 56–64) to switch the sidebar from dark navy to white:

```
--sidebar-background: 0 0% 100%;
--sidebar-foreground: 200 90% 15%;
--sidebar-primary: 189 100% 34%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 210 20% 96%;
--sidebar-accent-foreground: 200 90% 15%;
--sidebar-border: 210 18% 90%;
--sidebar-ring: 189 100% 34%;
--sidebar-muted: 200 15% 46%;
```

Update `src/components/AppLayout.tsx`:
- Remove `brightness-0 invert` filters from the Klaaryo logo (no longer needed on white background)
- Rename "Tool" to "Tools" in `navItems`

### 2. Tools page: show admin ToolsManager

Update `src/pages/Tools.tsx`:
- Import `useAuth` and check if the user is admin
- If admin, render the `ToolsManager` component (from `src/components/settings/ToolsManager.tsx`) instead of or in addition to the member tools grid
- Rename the page title accordingly

### 3. Sidebar nav label

Update `navItems` in `AppLayout.tsx` to use "Tools" instead of "Tool".

### Files to modify
- `src/index.css` — sidebar CSS variables
- `src/components/AppLayout.tsx` — logo styling, nav label
- `src/pages/Tools.tsx` — conditional admin view with ToolsManager

