

# Migliorare la formattazione dei contenuti dei moduli

## Problema
Il contenuto generato dall'AI esce come "muro di testo" — paragrafi densi con bold ma senza bullet point, tabelle, separatori o struttura visiva chiara. Il prompt attuale dice solo "in markdown (800-1500 parole)" senza indicazioni di formattazione.

## Soluzione in due parti

### 1. Prompt di generazione — `supabase/functions/generate-module/index.ts`
Aggiornare le istruzioni nel system prompt (riga ~110-121) per richiedere esplicitamente:
- Usare **elenchi puntati** per liste di concetti, stakeholder, step
- Usare **tabelle markdown** per confronti e categorizzazioni
- Usare **blockquote** (`>`) per evidenziare concetti chiave o citazioni
- Usare **separatori** (`---`) tra sezioni tematiche diverse
- Usare **sottotitoli h3** per spezzare il contenuto in blocchi leggibili
- Mai scrivere paragrafi più lunghi di 4-5 righe consecutive

### 2. Rendering frontend — `src/pages/ModuleView.tsx`
Migliorare i componenti ReactMarkdown (riga ~257-312) per dare più respiro visivo:
- Aggiungere stile per `ul`/`ol` con spacing, icone/pallini colorati e indentazione
- Migliorare lo stile delle liste con padding e gap tra item
- Aggiungere un componente custom per `li` con marker visivo in colore primario
- Aggiungere stile per `strong` inline con un leggero highlight di sfondo

### File da modificare
| File | Modifica |
|------|----------|
| `supabase/functions/generate-module/index.ts` | Arricchire il system prompt con regole di formattazione |
| `src/pages/ModuleView.tsx` | Migliorare i componenti custom di ReactMarkdown per liste e testo |

I moduli già generati manterranno la formattazione attuale. Per rigenerarli con la nuova formattazione sarà necessario cliccare "Rigenera tutto" o rigenerare i singoli moduli.

