

## Piano: Sezioni task standardizzate e task per sezione nello stepper

### Contesto attuale
- I task nelle milestone hanno un campo `section` (stringa libera, già in DB) che li raggruppa nella vista piano
- Il fallback è "Attività generali" se `section` è null
- Lo stepper di creazione (Step 2: Milestone) mostra solo obiettivi, focus e KPI — **non mostra task**
- I task vengono importati silenziosamente da `onboarding_templates` (filtrati per ruolo) al momento della creazione
- Le sezioni attuali nei template possono essere qualsiasi stringa (es. "Integrazione SDR")

### Cosa cambia

**1. Sezioni fisse e scalabili**
- Definire due sezioni standard: **"Attività Chiave"** e **"Coaching"** (rimuovere "Integrazione SDR" e simili)
- Costante in `src/lib/constants.ts`:
  ```ts
  export const TASK_SECTIONS = ["Attività Chiave", "Coaching"] as const;
  ```

**2. Aggiungere task per sezione nello Step 2 dello stepper (`CreatePlanDialog.tsx`)**
- Dentro ogni tab di milestone (30d/60d/90d), dopo Focus e prima dei KPI, mostrare i task raggruppati per sezione (Attività Chiave, Coaching)
- Ogni sezione mostra i task pre-caricati da template + possibilità di aggiungere/rimuovere task manualmente
- Nuovo stato: `milestoneTasks` — un `Record<milestoneLabel, TaskDraft[]>` dove ogni `TaskDraft` ha `{ tempId, title, section }`
- Quando il ruolo cambia, auto-popolare i task dai template `onboarding_templates` (già filtrati per ruolo e milestone_label)
- Aggiungere un select "Sezione" quando si crea un nuovo task inline

**3. Gestione template task per sezione in Impostazioni (`Settings.tsx`)**
- Aggiungere una nuova tab/sezione in Settings per gestire i **template task per milestone** (tabella `onboarding_templates`)
- Ogni template ha già i campi `section`, `role`, `milestone_label` — basta esporre un'interfaccia CRUD
- L'admin può creare template di task assegnandoli a una sezione (Attività Chiave / Coaching), un ruolo e una fase (30d/60d/90d)
- Stessa UX della gestione attività chiave: lista con add/delete/reorder

**4. Assegnare sezione ai task nella vista piano (`PlanDetail.tsx`)**
- Quando si aggiunge un task inline in una milestone (l'add task in basso), aggiungere un select per scegliere la sezione
- Il nuovo task viene creato con `section` valorizzato
- Aggiornare `handleAddTask` per accettare un parametro `section`

**5. Migrazione dati esistenti**
- Aggiornare i template e task esistenti che hanno `section = 'Integrazione SDR'` → mapparli a `'Attività Chiave'`
- Query: `UPDATE onboarding_tasks SET section = 'Attività Chiave' WHERE section = 'Integrazione SDR'`
- Stessa cosa per `onboarding_templates`

### File coinvolti
| File | Modifica |
|------|----------|
| `src/lib/constants.ts` | Aggiungere `TASK_SECTIONS` |
| `src/components/grow/CreatePlanDialog.tsx` | Aggiungere stato task per milestone, UI task per sezione nello step 2, auto-import da template |
| `src/components/grow/PlanDetail.tsx` | Select sezione nell'add-task inline |
| `src/pages/Settings.tsx` | Nuova sezione per gestione template task milestone |
| Migrazione DB | Rinominare sezioni legacy nei dati esistenti |

### Note tecniche
- Nessuna modifica allo schema DB: `onboarding_tasks.section` e `onboarding_templates.section` esistono già
- Solo migrazione dati per pulizia sezioni legacy
- La costante `TASK_SECTIONS` è la single source of truth per le sezioni disponibili

