

# Piano: Task inline + Subtask con drag-and-drop

## Panoramica
1. Spostare il bottone "Aggiungi Task" dentro ogni sezione task del milestone (dentro PlanDetail), non più in cima alla pagina.
2. Aggiungere il concetto di subtask: ogni task può avere sotto-task annidati.
3. Trascinando una task su un'altra, questa diventa subtask della destinazione.

## Cosa cambia per l'utente
- Il bottone "+ Aggiungi Task" appare in fondo a ogni milestone (solo in modalità admin edit), con milestone già pre-selezionato
- Le subtask appaiono indentate sotto il task padre con un bordo sinistro sottile
- Drag-and-drop: trascinando un task sopra un altro lo rende subtask; trascinandolo fuori lo riporta a livello root
- Le subtask possono essere create anche manualmente (bottone "+" piccolo accanto a ogni task)

## Dettaglio tecnico

### 1. Migrazione DB
Aggiungere colonna `parent_task_id` alla tabella `onboarding_tasks`:
```sql
ALTER TABLE onboarding_tasks ADD COLUMN parent_task_id uuid REFERENCES onboarding_tasks(id) ON DELETE CASCADE DEFAULT NULL;
```

### 2. Modifiche a `PlanDetail.tsx`
- Rimuovere `AddTaskDialog` dalla pagina `Grow.tsx`
- Aggiungere inline "Add task" button in fondo a ogni milestone (inserisce direttamente nel DB con milestone_id pre-impostato, input inline rapido)
- Raggruppare task: separare root tasks (`parent_task_id IS NULL`) e subtasks, renderizzare subtask indentate sotto il padre
- Aggiungere bottoncino "+" su ogni task per creare una subtask
- Implementare drag-and-drop con `@dnd-kit/core` + `@dnd-kit/sortable`:
  - Drop su un task → diventa subtask (set `parent_task_id`)
  - Drop su area root → torna task principale (clear `parent_task_id`)
- Subtask visualizzate con `ml-8 border-l-2 border-border pl-3`
- Salvare `parent_task_id` nel batch save esistente

### 3. Modifiche a `Grow.tsx`
- Rimuovere import e render di `AddTaskDialog` dalla pagina

### 4. File coinvolti
| File | Azione |
|------|--------|
| `onboarding_tasks` | Migrazione — aggiungere `parent_task_id` |
| `src/components/grow/PlanDetail.tsx` | Refactor — add task inline, subtask rendering, drag-and-drop |
| `src/pages/Grow.tsx` | Rimuovere AddTaskDialog |

