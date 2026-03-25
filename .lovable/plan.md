

# UX Completa Curriculum — Piano di Implementazione

Questo e un refactoring significativo della sezione Learn. Il lavoro si divide in due macro-aree: la **vista curriculum (lista moduli con roadmap)** e la **vista modulo (contenuto + assessment + score)**.

## Panoramica architettura

```text
/learn              → Lista curriculum (roadmap verticale)
/learn/:moduleId    → Vista modulo (3 atti: contenuto → assessment → score)
```

Serve una nuova route in `App.tsx` e una nuova pagina `ModuleView`.

## Modifiche

### 1. Nuova route `/learn/:moduleId`
**File: `src/App.tsx`**
- Aggiungere route protetta `/learn/:moduleId` che renderizza il nuovo componente `ModuleView`

### 2. Refactor vista rep in `Learn.tsx`
**File: `src/pages/Learn.tsx`**
- La vista rep (non-admin) diventa la roadmap verticale:
  - Progress bar globale in cima (% completata, N/M moduli)
  - Fetch `module_completions` per l'utente corrente
  - Lista verticale con linea di connessione tra moduli (CSS `border-left` + pallini)
  - Ogni card mostra: numero, titolo, sommario, tag track, tempo lettura stimato (basato su `content_body.length / 1000` min)
  - **Stato visivo**: Completato (spunta verde + score), Disponibile (accent, cliccabile), Bloccato (opacita 50%, non cliccabile)
  - Logica sblocco: modulo N disponibile se modulo N-1 completato (o se e il primo)
  - Click su modulo disponibile → naviga a `/learn/:moduleId`
- La vista admin resta invariata

### 3. Nuovo componente `ModuleView` — i tre atti
**File: `src/pages/ModuleView.tsx`**

Pagina singola con scroll verticale, tre sezioni:

**Atto 1 — Contenuto**
- Header: titolo, badge track, tempo lettura
- Corpo markdown renderizzato (usare `react-markdown` o rendering HTML semplice dei `\n`, `**`, `#`)
- Sezione "Punti chiave" in card riepilogativa
- Bottone "Inizia Assessment" in fondo

**Atto 2 — Assessment**
- Sezione che appare sotto il contenuto dopo click
- Fetch domande da `assessment_questions` per il modulo
- Domande una alla volta con progress indicator ("Domanda 2 di 7")
- 4 opzioni come bottoni verticali
- Al click: blocco immediato, verde/rosso, feedback testuale, bottone "Prossima domanda"
- Rimescolamento ordine domande e opzioni (shuffle con Fisher-Yates)
- Stato locale, nessun salvataggio intermedio

**Atto 3 — Score screen**
- Punteggio grande (es. 6/7)
- Messaggio contestuale per fascia (7/7 perfetto, 5-6 buono, sotto 5 riprova)
- Riepilogo domande con icona verde/rossa e risposta corretta
- Se score >= ~70% (calcolato su numero domande): salva in `module_completions` e mostra "Continua al modulo successivo"
- Se non promosso: "Riprova assessment" — rimescola e riparte dall'Atto 2

### 4. Aggiornare `CurriculumList.tsx` per la vista rep roadmap
**File: `src/components/learn/CurriculumList.tsx`**
- Nuova prop `completions` e `userId`
- Per la vista rep: renderizzare con linea verticale di connessione, stati visivi (completato/disponibile/bloccato), link navigazione
- Per la vista admin: resta come adesso

### 5. Installare dipendenza
- `react-markdown` per renderizzare il contenuto markdown nei moduli

### File coinvolti
| File | Azione |
|------|--------|
| `src/App.tsx` | Aggiungere route `/learn/:moduleId` |
| `src/pages/Learn.tsx` | Refactor vista rep con roadmap e progress globale |
| `src/pages/ModuleView.tsx` | **Nuovo** — vista modulo 3 atti |
| `src/components/learn/CurriculumList.tsx` | Aggiungere vista roadmap per rep |
| `package.json` | Aggiungere `react-markdown` |

### Note implementative
- Il tempo di lettura e stimato: `Math.ceil(content_body.length / 1000)` minuti (approssimazione)
- La soglia di promozione e 70% arrotondata per eccesso (es. 5/7 = 71% = promosso)
- Il rimescolamento usa Fisher-Yates per garantire distribuzione uniforme
- `module_completions` gia ha RLS per insert/select per l'utente corrente
- Tutto il testo UI e in italiano

