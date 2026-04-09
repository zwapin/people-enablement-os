

## Piano: Fix preservazione formattazione copy-paste nei moduli

### Problema identificato

Ci sono **3 bug** che impediscono il funzionamento:

1. **L'editor non riceve mai `content_html`** — `ModuleCanvas` riceve solo `content` (markdown). Anche se `content_html` viene salvato nel DB, quando il modulo viene ricaricato l'editor si inizializza dal markdown, perdendo tutta la formattazione.

2. **Il sync esterno sovrascrive l'HTML** — L'`useEffect` a riga 281-288 confronta il markdown corrente con `content` e, se diverso, resetta l'editor con `showdown.makeHtml(content)`. Dopo ogni paste, il ciclo `onUpdate→onChange→setContentBody→useEffect` potrebbe ri-convertire tutto da markdown, cancellando gli stili.

3. **Estensioni TipTap duplicate** — Il warning `Duplicate extension names: ['link', 'underline']` indica che queste estensioni vengono registrate due volte, causando potenziali conflitti.

### Modifiche

**1. `ModuleCanvas.tsx`** — Aggiungere prop `contentHtml` e usarla come fonte primaria

- Aggiungere `contentHtml?: string | null` alle props
- Inizializzare l'editor con `contentHtml` (se presente) anziché convertire da markdown: `content: contentHtml || (content ? showdown.makeHtml(content) : "")`
- Modificare l'`useEffect` di sync (riga 281-288): usare un flag `skipNextSync` ref per evitare che il ciclo `onUpdate→onChange→useEffect` sovrascriva l'HTML dopo un paste
- Rimuovere le estensioni duplicate (verificare se `Link` o `Underline` sono già incluse da StarterKit o da un'altra dipendenza)

**2. `ModuleEditor.tsx`** — Passare `contentHtml` al canvas

- Aggiungere `contentHtml={contentHtml}` alla prop di `ModuleCanvas` (riga 454-463)

**3. `ModuleCanvas.tsx`** — Fix logica sync

- Usare un `useRef` (`isInternalUpdate`) settato a `true` dentro `onUpdate` e controllato nell'`useEffect` di sync, per distinguere aggiornamenti interni (paste/digitazione) da aggiornamenti esterni (caricamento modulo)

```text
Flusso corretto:
  Caricamento modulo → content_html presente? → editor.setContent(content_html)
                        content_html assente?  → editor.setContent(showdown(content_body))
  
  Paste/digitazione → onUpdate → onChange(md, html) → salva entrambi
                    → useEffect NON resetta (è update interno)
  
  Cambio modulo     → useEffect resetta editor con nuovo contenuto
```

