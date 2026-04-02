

## Piano: Aggiungere selezione destinatario (rep) nell'header del piano

### Cosa cambia
Nell'header del piano, in modalità edit, si aggiunge un Select per cambiare il team member a cui è assegnato il piano (`rep_id`). In modalità lettura resta il nome statico.

### Modifiche

**File: `src/components/grow/PlanDetail.tsx`**

1. **Query profili** — Aggiungere una query per caricare la lista dei profili (team members) dal DB, filtrando solo i rep attivi
2. **Select destinatario nell'header** — Sotto il titolo e accanto/sotto al Select ruolo, aggiungere un `<Select>` con i nomi dei team members. Il valore corrente è `editedPlan.rep_id`. Al cambio, aggiornare `editedPlan.rep_id` e il `repName` visualizzato
3. **Titolo dinamico** — Aggiornare il titolo `Piano 90 giorni — {repName}` per riflettere il membro selezionato (dal nuovo select, non solo dalla prop)
4. **Salvataggio** — La mutation di salvataggio già persiste tutto il piano; assicurarsi che `rep_id` venga incluso nell'update

### Layout header risultante (edit mode)
```
Piano 90 giorni — [Nome]
[Select Ruolo ▾]  [Select Destinatario ▾]
[===== progress bar =====]
```

