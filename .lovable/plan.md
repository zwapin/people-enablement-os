

# Piano: Progress indicator, Preview Rep, e allineamento formattazione

## 1. Progress indicator durante generazione AI

Attualmente il bottone "Genera con AI" mostra solo un Loader2 spinner. Aggiungere un overlay/banner visibile nel canvas che mostra lo stato della generazione.

**ModuleEditor.tsx**:
- Quando `generating === true`, mostrare un overlay sopra il canvas con:
  - Animazione progress indeterminata (Progress component con animazione)
  - Testo di stato che cambia: "Analisi documenti sorgente..." → "Generazione contenuto..." → "Quasi fatto..."
  - Usare `useEffect` con timer per ciclare i messaggi ogni ~4 secondi
  - L'overlay copre l'area canvas con sfondo semi-trasparente `bg-background/80 backdrop-blur`

## 2. Bottone Preview "Vista Rep"

Aggiungere un bottone nella action bar (o nell'header) che apre una modale/drawer full-width con il contenuto renderizzato esattamente come lo vede il Rep in `ModuleView`.

**ModuleEditor.tsx**:
- Aggiungere bottone `Eye` icon "Anteprima Rep" nell'header vicino ai badge
- Al click, aprire un Dialog/Sheet full-screen che renderizza il contenuto con le stesse classi e componenti di `ModuleView`
- Creare un componente `ModulePreview` che riceve title, summary, track, contentBody, keyPoints, questions e li renderizza con lo stesso markup di ModuleView (article con ReactMarkdown + remarkGfm + custom components)
- Include anche la sezione Assessment in read-only/preview mode

**Nuovo file `src/components/learn/ModulePreview.tsx`**:
- Estrae il rendering markup da ModuleView in un componente riutilizzabile
- Riceve i dati come props (non da DB), così funziona live con i dati dell'editor
- Stesso layout `max-w-3xl`, stesse custom components per ReactMarkdown (h2 con border-b, h3 con barra primary, blockquote styled, tabelle con bordi, ecc.)

## 3. Allineamento formattazione TipTap ↔ ModuleView

Il canvas TipTap usa `prose prose-sm` generico, mentre ModuleView ha custom components molto specifici. Allineare gli stili del canvas TipTap per avere una resa visiva coerente.

**ModuleCanvas.tsx / index.css**:
- Aggiungere stili CSS custom per il TipTap editor (`.ProseMirror`) che replicano la formattazione di ModuleView:
  - `h2`: `text-xl font-bold mt-10 mb-4 pb-2 border-b border-border`
  - `h3`: `text-lg font-semibold mt-8 mb-3` con barra primary a sinistra
  - `blockquote`: `border-l-4 border-primary/50 bg-secondary/30 rounded-r-lg px-5 py-4`
  - `table`: bordi, header con `bg-muted/60`, padding consistente
  - `strong`: `bg-primary/10 px-1 rounded`
  - `ul li`: dot primary, spacing coerente
- Questi stili vanno in `src/index.css` sotto un selettore `.ProseMirror`

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/learn/ModuleEditor.tsx` | Overlay progress + bottone anteprima |
| `src/components/learn/ModulePreview.tsx` | Nuovo — componente preview Vista Rep |
| `src/components/learn/ModuleCanvas.tsx` | Classe prose aggiornata |
| `src/index.css` | Stili `.ProseMirror` allineati a ModuleView |

