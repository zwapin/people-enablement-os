

# Canvas Editor per Moduli — stile Notion

## Obiettivo
Sostituire la textarea Markdown nel ModuleEditor con un rich text editor a blocchi (stile Notion), dove l'admin può scrivere con formatting visuale e generare contenuto AI inline, con riferimento opzionale a documenti del Knowledge Base.

## Scelta tecnologica: TipTap

TipTap è il miglior fit per React + Tailwind: headless, estensibile, output HTML/Markdown, supporta slash commands e toolbar floating. BlockNote sarebbe un'alternativa ma TipTap offre più controllo.

## Cosa cambia

### 1. Installare TipTap
Pacchetti: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-heading`, `@tiptap/extension-table`, `@tiptap/extension-highlight`, `@tiptap/extension-typography`, `turndown` (HTML→Markdown), `showdown` (Markdown→HTML per caricare contenuto esistente).

### 2. Nuovo componente `src/components/learn/ModuleCanvas.tsx`
- Editor TipTap con toolbar floating (bold, italic, heading, bullet list, ordered list, blockquote, table, separator)
- Slash command menu (`/`) con opzioni: Heading, Lista, Tabella, Blockquote, **Genera con AI**
- Il comando "Genera con AI" apre un piccolo dialog inline con:
  - Prompt testuale (es. "Scrivi la sezione sulla Discovery Call")
  - Select opzionale per scegliere un documento dal Knowledge Base come riferimento
  - Bottone "Genera" → chiama `generate-module` edge function in modalità diretta, inserisce il risultato nel punto del cursore
- Converte Markdown esistente (`content_body`) in HTML al caricamento
- Converte HTML in Markdown al salvataggio (per compatibilità con la vista rep che usa ReactMarkdown)

### 3. Aggiornare `ModuleEditor.tsx`
- Sostituire la `<Textarea>` del contenuto con `<ModuleCanvas>`
- Il pulsante "Genera con AI" globale resta come opzione per rigenerare tutto il modulo
- Il canvas riceve `contentBody` e `setContentBody` come props

### 4. AI inline nel canvas
- Quando l'utente usa il comando AI dal canvas:
  - Mostra un popover con campo prompt + dropdown dei `knowledge_documents`
  - Chiama l'edge function `generate-module` in modalità diretta (`text` mode) con il prompt e il contenuto del documento selezionato come context
  - Inserisce il markdown generato convertito in HTML nel punto del cursore
  - Nessuna modifica backend necessaria — l'edge function supporta già `handleDirectGeneration` con `knowledge_context`

### File da creare/modificare

| File | Azione |
|------|--------|
| `src/components/learn/ModuleCanvas.tsx` | **Nuovo** — Editor TipTap con toolbar, slash commands, AI inline |
| `src/components/learn/AIGeneratePopover.tsx` | **Nuovo** — Popover per prompt AI + selezione documento KB |
| `src/components/learn/ModuleEditor.tsx` | Sostituire textarea con ModuleCanvas |

### Flusso utente
```text
Admin apre modulo → vede canvas ricco con toolbar
  → può scrivere liberamente con H2, H3, bold, liste, tabelle
  → preme "/" → menu appare → seleziona "Genera con AI"
  → popover: scrive "Scrivi sezione sulla Qualification Call"
  → opzionale: seleziona "Sales Playbook Klaaryo" dal dropdown KB
  → clicca Genera → contenuto appare nel canvas
  → continua a editare, aggiungere sezioni, rigenerare parti
  → Salva → content_body salvato come Markdown
```

