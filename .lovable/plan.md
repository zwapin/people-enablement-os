

# Piano: Miglioramento flusso creazione Collection

## Problema attuale
Cliccando "Nuova Collection" in `Learn.tsx`, viene creata una collection con titolo "Nuova Collection" e l'utente resta sulla pagina lista. Nessun redirect, nessun prompt per titolo o documenti.

## Soluzione

### 1. Creazione con redirect + titolo inline
In `Learn.tsx` → `handleCreateCollection`:
- Dopo l'insert, ottenere l'`id` della nuova collection (`.select("id").single()`)
- Fare `navigate(`/learn/${newId}`)` per portare l'utente dentro la collection

In `CollectionDetail.tsx`:
- Rendere il titolo **editabile inline** (click per editare) quando la collection è in stato `draft`
- Se il titolo è "Nuova Collection" (default), mostrarlo già in modalità edit con autofocus così l'utente lo cambia subito
- Al blur/enter, salvare il titolo via update su `curricula`

### 2. "Genera moduli" condizionato ai documenti
In `CollectionDetail.tsx`:
- Aggiungere una query per contare i documenti della collection (`knowledge_documents` con `collection_id`)
- Se `documentsCount > 0`: il bottone "Genera moduli" funziona normalmente
- Se `documentsCount === 0`: al click, mostrare un **Dialog** che dice "Nessun documento caricato. Carica almeno un documento per generare i moduli." con due bottoni:
  - "Carica documento" → apre direttamente il dialog di upload di `DocumentsList`
  - "Annulla"

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/Learn.tsx` | `handleCreateCollection`: aggiungere `.select("id").single()` + `navigate` |
| `src/pages/CollectionDetail.tsx` | Titolo editabile inline + logica "genera" condizionata a documenti presenti |
| `src/components/learn/DocumentsList.tsx` | Esporre `refetch` o accettare prop `onUploadComplete` per refresh dal parent |

### Dettagli tecnici

**Titolo editabile** in CollectionDetail:
```
- Stato: `editingTitle` (boolean), `titleValue` (string)
- Se `collection.title === "Nuova Collection"` → `editingTitle = true` al mount
- Renderizzare un `<Input>` al posto dell'`<h1>` quando in editing
- onBlur/onKeyDown Enter → salva con supabase update + invalidate query
```

**Genera condizionato**:
```
- Query: `knowledge_documents` count where `collection_id = curriculumId`
- Nel bottone "Genera moduli" onClick: check count, se 0 mostra dialog
- Il dialog contiene il form di upload documenti inline (riuso DocumentsList upload logic)
```

