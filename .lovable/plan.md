

# Piano: Toggle "New Klaaryan" globale nella sidebar con selezione utente

## Cosa cambia

Il toggle "New Klaaryan" viene rimosso da Learn e Grow e spostato nel footer della sidebar. Quando un admin lo attiva, appare un selettore utente (dropdown con i profili rep). L'intera app si trasforma nella vista di quell'utente specifico.

## Architettura

Creare un **context globale di impersonation** (`ImpersonationContext`) che espone:
- `impersonating: Profile | null` — il profilo utente selezionato
- `isImpersonating: boolean`
- `startImpersonating(profile)` / `stopImpersonating()`

Tutte le pagine che hanno logica `viewAsRep` la sostituiscono leggendo da questo context.

## File coinvolti

### Nuovo: `src/contexts/ImpersonationContext.tsx`
- Context con stato `impersonatedProfile` salvato in `sessionStorage`
- Fetch dei profili rep per il selettore
- Provider wrappa l'app dentro `AuthProvider`

### Modifica: `src/components/AppLayout.tsx`
- Nel `SidebarFooter`, sotto il nome utente admin, aggiungere:
  - Toggle Switch "New Klaaryan"
  - Quando attivo: dropdown/select con lista profili rep
  - Quando sidebar collapsed: solo icona toggle
- Import `useImpersonation`

### Modifica: `src/pages/Learn.tsx`
- Rimuovere stato locale `viewAsRep` e `handleViewAsRepChange`
- Rimuovere il toggle Switch dalla pagina
- Sostituire `viewAsRep` con `isImpersonating` dal context
- Nella vista rep, usare `impersonating.full_name` invece di `profile.full_name`

### Modifica: `src/pages/Grow.tsx`
- Rimuovere stato locale `viewAsRep`, `handleToggleView`, `effectiveAdmin`
- Rimuovere il toggle Switch dalla pagina
- Sostituire con `isImpersonating` dal context
- Quando impersonating: filtrare piani per `impersonating.user_id` (non tutti i piani)

### Modifica: `src/App.tsx`
- Wrappare con `ImpersonationProvider`

## Logica impersonation su Grow

Quando l'admin impersona un utente su Crescita:
- La query piani filtra per `rep_id = impersonatedProfile.user_id`
- `canToggleTasks = true` (il rep può fare check)
- Nascondere CreatePlanDialog e AddTaskDialog
- Mostrare solo il piano dell'utente selezionato

## UX sidebar

```text
┌─────────────────────┐
│  [Logo]             │
│                     │
│  Formazione         │
│  Crescita           │
│  Performance  Soon  │
│  Team               │
│                     │
│─────────────────────│
│  🔄 New Klaaryan    │  ← Switch toggle
│  [▼ Seleziona rep]  │  ← Select (visibile solo se toggle ON)
│                     │
│  Federico Rossi     │
│  ADMIN              │
│  Esci               │
│─────────────────────│
└─────────────────────┘
```

