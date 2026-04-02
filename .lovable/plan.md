

## Piano: Spostare "Output Atteso a 90 Giorni" subito dopo la Intro

### Modifica

**File: `src/components/grow/PlanDetail.tsx`**
- Tagliare il blocco "Output Atteso" (righe 1099-1112) dalla posizione attuale (in fondo, dopo il DndContext)
- Incollarlo subito dopo il blocco "Intro" (dopo riga 782), prima della sezione "Attività Chiave"
- Nessuna modifica alla logica o allo stile, solo riposizionamento

L'ordine delle sezioni diventerà: **Save bar → Intro → Output Atteso a 90 Giorni → Attività Chiave → Milestone → Coaching**

