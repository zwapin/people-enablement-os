

# Contenuti moduli più ricchi + UX migliorata

## Problemi attuali
1. **Contenuto troppo corto**: il prompt del curriculum dice "200-400 parole" e tronca i documenti a 5000 caratteri — il playbook viene tagliato
2. **UX del modulo**: tutto il markdown è renderizzato come blocco unico con `prose-sm`, poco leggibile
3. **Tabelle non renderizzate**: manca il plugin `remark-gfm` per il supporto tabelle in ReactMarkdown
4. **Immagini perse**: l'extraction dei documenti estrae solo testo, le immagini del playbook vengono ignorate

## Piano

### 1. Contenuti più lunghi — `generate-curriculum/index.ts`
- **Rimuovere il troncamento a 5000 caratteri** (riga 66-68): passare il contenuto completo dei documenti (o alzare a 30000+)
- **Alzare il limite parole** nel prompt: da "200-400 parole" a "800-1500 parole per modulo" (riga 111)
- **Alzare max_tokens** da 8192 a 16384 per permettere output più lunghi
- **Istruire l'AI a preservare tabelle**: aggiungere nel prompt "Preserva le tabelle originali in formato markdown e includi riferimenti a immagini quando presenti nel materiale sorgente"
- **Ridurre il max moduli** da 6 a 4-5 per dare più spazio a ogni modulo

### 2. Immagini dal playbook — `extract-document/index.ts`
- Modificare il prompt di estrazione per chiedere all'AI di **descrivere le immagini trovate** con placeholder markdown (es. `![Descrizione immagine](image-placeholder)`) e preservare le tabelle in formato markdown
- Quando il curriculum generator genera contenuto, includerà queste descrizioni/tabelle nel testo
- **Nota**: le immagini originali non possono essere estratte programmaticamente dal PDF in un edge function Deno. In futuro si potrà aggiungere un'estrazione immagini vera. Per ora l'AI descriverà il contenuto visivo nel testo.

### 3. UX del modulo — `src/pages/ModuleView.tsx`
- Installare **`remark-gfm`** per supporto tabelle e strikethrough
- Ridisegnare il layout del contenuto:
  - Sostituire `prose-sm` con `prose-base` per testo più leggibile
  - Aggiungere stili custom per tabelle markdown (bordi, padding, zebra striping)
  - Aggiungere **spaziatura tra sezioni** (heading con margin-top maggiore)
  - Componenti custom per ReactMarkdown: `h2` con bordo sotto, `blockquote` stilizzato come callout, `table/th/td` con stili dedicati
  - Contenuto in card con padding generoso invece di testo "nudo"
  - Immagini markdown stilizzate con bordo arrotondato e ombra

### 4. Tabelle markdown — stili
- Aggiungere CSS per tabelle nel markdown:
  ```css
  .prose table { border-collapse: collapse; width: 100%; }
  .prose th { background: hsl(var(--muted)); padding: 8px 12px; border: 1px solid hsl(var(--border)); }
  .prose td { padding: 8px 12px; border: 1px solid hsl(var(--border)); }
  .prose tr:nth-child(even) { background: hsl(var(--muted)/0.3); }
  ```

## File da modificare
1. `supabase/functions/generate-curriculum/index.ts` — prompt più lungo, no troncamento, istruzioni tabelle
2. `supabase/functions/extract-document/index.ts` — prompt che preserva tabelle e descrive immagini
3. `src/pages/ModuleView.tsx` — UX migliorata, componenti custom ReactMarkdown, remark-gfm
4. `src/index.css` — stili tabelle markdown
5. `package.json` — aggiungere `remark-gfm`

