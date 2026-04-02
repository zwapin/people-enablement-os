

## Piano: UI Notion-style per la pagina Onboarding Plan

### Problema
La pagina del piano di onboarding usa Card tradizionali con bordi e header separati per Intro, Output Atteso e le milestone. L'esperienza risulta "old school" rispetto alla UI canvas Notion-like già usata nel modulo editor (ModuleCanvas).

### Cosa cambia

**1. Rimuovere le Card wrapper per Intro e Output Atteso**
- Sostituire le `<Card>` con layout puliti senza bordi — titolo inline con icona, poi direttamente il canvas TipTap sotto
- Stile: titolo come heading leggero (`text-base font-semibold text-foreground`), nessun background colorato, separatore sottile opzionale
- In modalità lettura: rendering markdown con stile prose pulito (no card background)

**2. Aggiornare PlanCanvas per stile Notion**
- Rimuovere il bordo esterno (`border border-input`) — l'editor appare direttamente nel flusso della pagina
- Toolbar: renderla solo on focus o hover (floating toolbar), non sempre visibile. Oppure toolbar semitrasparente che appare al passaggio
- Placeholder più prominente e stilizzato
- Min-height maggiore per sensazione di "pagina aperta"

**3. Layout generale della pagina — stile documento**
- Rimuovere `max-w-4xl` e usare un layout centrato più ampio (`max-w-3xl mx-auto`) con più padding verticale tra le sezioni
- Header del piano: titolo grande (`text-2xl`), ruolo come sottotitolo discreto, senza Input visibile (bordo appare solo al click in edit mode)
- Progress bar: più minimale, integrata nell'header come barra sottile

**4. Milestone cards — stile più leggero**
- Rimuovere i bordi pesanti delle Card milestone
- Usare separatori sottili e spacing verticale al posto di card con background
- Header milestone: tipografia più grande, senza CardHeader wrapper
- Sezioni Focus/KPI: badge su sfondo neutro senza i container colorati

**5. Task list — stile checklist Notion**
- Rimuovere i background hover/completed pesanti
- Checkbox + testo pulito con line-height generoso
- In edit mode: input inline completamente borderless (appare bordo solo al focus)

### File coinvolti
| File | Modifica |
|------|----------|
| `src/components/grow/PlanCanvas.tsx` | Rimuovere bordo esterno, toolbar floating/on-focus, min-height maggiore |
| `src/components/grow/PlanDetail.tsx` | Rimuovere Card wrapper da Intro/Output, layout documento centrato, milestone più leggere, task list pulita |
| `src/index.css` | Eventuali stili ProseMirror aggiuntivi per il canvas plan |

### Dettagli tecnici
- PlanCanvas già usa TipTap — si tratta solo di aggiornare classi CSS e rimuovere wrapper
- Nessuna modifica alla logica di salvataggio o gestione stato
- La toolbar floating può usare un semplice stato `isFocused` dall'editor TipTap (`onFocus`/`onBlur`)

