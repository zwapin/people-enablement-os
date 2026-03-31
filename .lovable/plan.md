

# Piano: Rimuovere Early Warnings + Aggiungere vista New Klaaryan su Crescita

## Modifiche

### 1. Rimuovere Early Warnings ovunque

**PlanDetail.tsx**:
- Rimuovere il blocco early warnings (righe 304-317) dalla vista milestone
- Rimuovere la variabile `earlyWarnings` (riga 168)
- Rimuovere l'import `AlertTriangle`

**CreatePlanDialog.tsx**:
- Rimuovere il `ListEditor` per early_warnings (righe 307-313)
- Rimuovere `early_warnings` dal tipo `MilestoneData` e da tutti gli stati/reset/mutation

**PlanCard.tsx**: Nessun riferimento a early warnings, nessuna modifica necessaria.

Non serve una migration DB: la colonna `early_warnings` resta nel database ma semplicemente non viene più usata nell'UI.

### 2. Aggiungere toggle "New Klaaryan" nella pagina Crescita

Replicare lo stesso pattern già usato in `Learn.tsx`:
- Aggiungere stato `viewAsRep` con `sessionStorage` in `Grow.tsx`
- Aggiungere un toggle `Switch` + label "New Klaaryan" nell'header (visibile solo per admin)
- Quando attivo: nascondere `CreatePlanDialog`, `AddTaskDialog` e mostrare la vista come la vedrebbe il rep (il proprio piano, con checkbox attive per completare task)
- Nel `PlanDetail`, quando `viewAsRep` è true: `canToggleTasks=true` e nascondere le azioni admin

### File coinvolti

| File | Modifica |
|------|----------|
| `PlanDetail.tsx` | Rimuovere early warnings |
| `CreatePlanDialog.tsx` | Rimuovere early warnings dal form |
| `Grow.tsx` | Aggiungere toggle viewAsRep + logica vista |

