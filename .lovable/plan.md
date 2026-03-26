

# Editor Modulo — Layout Notion-style

Ridisegnare `ModuleEditor` per replicare il layout di `ModuleView` (pagina singola, colonna centrata `max-w-3xl`, lettura pulita) ma con tutti i campi editabili inline e il canvas TipTap come protagonista.

## Struttura della pagina

```text
┌─────────────────────────────────────────┐
│ ← Torna al curriculum                  │
│                                         │
│ [Badge Area ▾]  [Curriculum ▾]          │
│ Titolo del modulo (input inline h1)     │
│ Sommario (textarea inline, no border)   │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ [Canvas TipTap — toolbar floating]      │
│ Il contenuto del modulo va qui...       │
│ Premi / per i comandi                   │
│                                         │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ 💡 Punti Chiave (collapsible card)      │
│    • punto 1  [x]                       │
│    • punto 2  [x]                       │
│    + Aggiungi                           │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ 📝 Domande Assessment (collapsible)     │
│    D1: testo domanda...                 │
│    ...                                  │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ [Annulla]  [Salva bozza]  [Pubblica]    │
└─────────────────────────────────────────┘
```

## Modifiche

### `src/components/learn/ModuleEditor.tsx` — Redesign completo

1. **Layout**: `max-w-3xl mx-auto` come ModuleView, rimuovere le Card wrapper
2. **Header inline**:
   - Back link come in ModuleView (text button, non icon)
   - Titolo: `<input>` senza bordo, font `text-2xl sm:text-3xl font-bold`, placeholder "Titolo del modulo"
   - Sommario: `<textarea>` senza bordo, `text-muted-foreground`, auto-resize
   - Badge area/curriculum come piccoli Select inline sopra il titolo (come i metadata badge in ModuleView)
3. **Canvas TipTap**: a piena larghezza, senza card wrapper, solo il toolbar sopra e l'area di editing. Rimuovere il bordo extra — il canvas È la pagina
4. **Punti chiave**: sezione collapsible (Collapsible di shadcn) sotto il contenuto, stile Card leggero come in ModuleView
5. **Domande Assessment**: sezione collapsible, con il contatore nel titolo
6. **Action bar**: sticky bottom o in fondo pagina, `Annulla | Salva bozza | Pubblica`
7. **Generate AI button**: spostato nella toolbar del canvas o come floating action, non nel header della sezione contenuto

### `src/components/learn/ModuleCanvas.tsx` — Cleanup bordi

- Rimuovere `border rounded` wrapper, lasciare solo toolbar + area editing seamless
- Toolbar: sticky o floating, con sfondo `bg-background/80 backdrop-blur`

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/learn/ModuleEditor.tsx` | Redesign layout Notion-style |
| `src/components/learn/ModuleCanvas.tsx` | Bordi/wrapper più minimali |

