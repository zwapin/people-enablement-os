

# Piano: Rendere il piano di onboarding modificabile inline dall'admin

## Panoramica
Trasformare la vista dettaglio del piano (`PlanDetail`) da read-only a una vista editabile inline quando l'utente è admin. I campi testuali lunghi (Premessa, Output Atteso, Obiettivo milestone) useranno un mini canvas TipTap Notion-style. I campi lista (Focus, KPI) e i task saranno editabili inline con possibilità di aggiungere, rimuovere e riordinare.

## Cosa cambia per l'utente
- L'admin vede ogni sezione del piano con un aspetto pulito ma cliccabile/editabile
- Premessa e Output Atteso diventano aree TipTap con toolbar minimale (bold, italic, liste, heading)
- Obiettivo di ogni milestone: campo testo inline editabile
- Focus e KPI: lista editabile con aggiunta/rimozione inline (chip con X + input per aggiungere)
- Task: titolo editabile inline, possibilità di eliminare task, drag per riordinare
- Role Template: input inline editabile nell'header
- Salvataggio automatico con debounce oppure bottone "Salva" esplicito sticky in basso
- La vista rep (non-admin) resta identica a oggi (read-only)

## Dettaglio tecnico

### 1. Nuovo componente `PlanCanvas` (leggero)
- Un wrapper TipTap semplificato (riusa la stessa struttura di `ModuleCanvas` ma con toolbar ridotta)
- Props: `content`, `onChange`, `placeholder`, `disabled`
- Supporta: bold, italic, liste puntate/numerate, heading, divider
- Converte markdown ↔ HTML come fa già ModuleCanvas

### 2. Modifiche a `PlanDetail.tsx`
- Nuova prop `isEditable` (true quando admin e non impersonating)
- **Header**: `role_template` diventa un `<Input>` borderless
- **Premessa**: il `<p>` diventa `<PlanCanvas>` quando editable
- **Output Atteso**: stesso trattamento
- **Obiettivo milestone**: `<Textarea>` inline auto-resize
- **Focus / KPI**: lista con chip rimovibili + input per aggiungere (stessa UX del `ListEditor` già in CreatePlanDialog)
- **Task**: titolo editabile con input inline, bottone delete, possibilità di cambiare sezione
- State locale con le modifiche, salvataggio tramite bottone "Salva modifiche"

### 3. Logica di salvataggio
- Un unico bottone "Salva modifiche" sticky in basso (visibile solo se ci sono modifiche pendenti)
- Salva in batch: update `onboarding_plans` (premessa, output_atteso, role_template) + update `onboarding_milestones` (obiettivo, focus, kpis) + update `onboarding_tasks` (title, section, order_index)
- Invalidazione query dopo il save

### 4. File coinvolti
| File | Azione |
|------|--------|
| `src/components/grow/PlanCanvas.tsx` | Nuovo — TipTap leggero per testi del piano |
| `src/components/grow/PlanDetail.tsx` | Refactor — aggiungere modalità edit inline |
| `src/pages/Grow.tsx` | Passare `isEditable` a PlanDetail |

Nessuna migrazione DB necessaria — i campi esistono già tutti.

