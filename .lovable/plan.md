

# Mobile Responsive — Piano

## Problemi identificati

1. **Learn.tsx admin header**: i pulsanti (`Genera tutti`, `Nuovo Curriculum`, `Rigenera tutto`, `Aggiorna Curriculum`) sono in una riga `flex` che straborda su mobile
2. **Learn.tsx admin header**: il toggle "Vista Rep" è inline con il titolo, non si adatta
3. **ModuleEditor.tsx**: `grid-cols-2` per Area/Curriculum non si adatta; footer buttons overflow
4. **PeopleTable.tsx**: tabella a 7 colonne non leggibile su mobile — serve un layout card-based su schermi piccoli
5. **CurriculumCard.tsx**: header con tanti pulsanti admin può straripare
6. **CurriculumList.tsx**: card con pulsanti inline può straripare
7. **ModuleCanvas.tsx**: toolbar con molti pulsanti inline straborda
8. **ModuleView.tsx**: `max-w-3xl` e prose content sono già OK, ma il feedback grid `grid-cols-2` nelle domande può essere stretto

## Modifiche per file

### `src/pages/Learn.tsx`
- Header admin: wrappare titolo + toggle e bottoni in layout responsive (`flex-col` su mobile, `flex-row` su desktop)
- Bottoni: usare `flex-wrap gap-2` e nascondere il testo dei bottoni meno importanti su mobile (solo icone)

### `src/components/learn/ModuleEditor.tsx`
- Cambiare `grid-cols-2` a `grid-cols-1 sm:grid-cols-2`
- Footer bottoni: `flex-wrap` per mobile
- Feedback domande: `grid-cols-1 sm:grid-cols-2`

### `src/components/people/PeopleTable.tsx`
- Su mobile: mostrare layout a card invece della tabella
- Usare `useIsMobile()` per switchare tra Table e card layout

### `src/components/learn/CurriculumCard.tsx`
- Header: wrappare su mobile con `flex-wrap`
- Pulsanti admin: `flex-wrap` o dropdown menu su mobile

### `src/components/learn/CurriculumList.tsx`
- Card interna: `flex-col` su mobile invece di `flex items-center`

### `src/components/learn/ModuleCanvas.tsx`
- Toolbar: aggiungere `overflow-x-auto` e `flex-nowrap` per scroll orizzontale, oppure `flex-wrap` su mobile

### `src/pages/ModuleView.tsx`
- Feedback grid: `grid-cols-1 sm:grid-cols-2` (riga 389)

### `src/components/AppLayout.tsx`
- Già OK grazie al sidebar component shadcn — nessuna modifica necessaria

## Approccio
Responsive breakpoints con Tailwind (`sm:`, `md:`). Nessuna nuova dipendenza. Principalmente cambiamenti di classi CSS.

