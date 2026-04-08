

## Piano: Preservare la formattazione di testo incollato da fonti esterne

### Problema attuale
Il contenuto dei moduli viene convertito in Markdown (via Turndown) prima del salvataggio. Markdown non supporta colori, stili inline, sfondi o layout complessi — tutto viene perso al paste.

### Soluzione
Salvare il contenuto come **HTML nativo** anziché Markdown, ed estendere TipTap con le estensioni necessarie per preservare stili inline.

### Modifiche

**1. Migrazione database** — Aggiungere colonna `content_html` (text, nullable) alla tabella `modules`
- Quando presente, `content_html` ha priorità su `content_body` (markdown) per il rendering
- Retrocompatibilità garantita: i moduli esistenti continuano a funzionare con il markdown

**2. Estensioni TipTap** — `src/components/learn/ModuleCanvas.tsx`
- Aggiungere `TextStyle`, `Color`, `Underline`, `TextAlign` per preservare stili inline al paste
- Modificare il `handlePaste`: quando il contenuto HTML non contiene immagini (caso attuale che già funziona), lasciare che TipTap gestisca il paste nativamente con le nuove estensioni, anziché fare return false (che scarta gli stili)
- Modificare `onUpdate`: salvare **sia** il markdown (per retrocompatibilità) **sia** l'HTML grezzo (`editor.getHTML()`)

**3. Callback onChange** — `src/components/learn/ModuleEditor.tsx`
- Estendere `onChange` per ricevere sia markdown che HTML
- Salvare `content_html` nel database insieme a `content_body`

**4. Rendering lato membro** — `src/pages/ModuleView.tsx` e `src/components/learn/ModulePreview.tsx`
- Se `content_html` è presente: renderizzare con `dangerouslySetInnerHTML` dentro un container con le classi `module-content` e `prose`
- Se assente: fallback al rendering ReactMarkdown attuale

**5. CSS** — `src/index.css`
- Aggiungere regole `.module-content` per garantire che il contenuto HTML pasted mantenga un aspetto coerente con il design system (font, spaziatura base) senza sovrascrivere colori e stili inline

### Dettagli tecnici

```text
Flusso attuale:
  Paste → TipTap (perde stili) → Turndown → Markdown → DB

Nuovo flusso:
  Paste → TipTap + estensioni stile → HTML preservato → DB (content_html)
                                    → Turndown → DB (content_body, fallback)
```

Migrazione SQL:
```sql
ALTER TABLE modules ADD COLUMN content_html text;
```

Nuove dipendenze npm: `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`

