

# Fix: Subtask creation bug + Save button chiaro

## Problemi identificati

1. **Bug subtask**: quando si crea un task/subtask inline, il codice inserisce direttamente nel DB e poi fa `invalidateQueries`, che resetta lo state locale `editedPlan` — perdendo eventuali modifiche non salvate. Inoltre il task appena creato non appare nello state locale fino al refetch.

2. **forwardRef warnings**: `SortableTaskRow` e `PlanCanvas` non usano `forwardRef`, ma `@dnd-kit` prova a passare ref — causa warning in console.

3. **Save button poco chiaro**: il bottone "Salva modifiche" appare solo quando ci sono cambiamenti pendenti, in sticky bottom. L'utente non capisce quando/come salvare.

## Cosa cambiamo

### 1. Subtask/task inline → creazione locale (no DB diretto)
- Invece di inserire subito nel DB, il nuovo task viene aggiunto allo state locale `editedPlan` con un ID temporaneo (uuid generato client-side).
- Il task appare immediatamente nella lista e viene salvato col batch "Salva modifiche" insieme a tutto il resto.
- Nel `saveMutation`, i task con ID temporaneo vengono inseriti (`INSERT`), quelli esistenti aggiornati (`UPDATE`).

### 2. Fix forwardRef
- Wrappare `SortableTaskRow` con `React.forwardRef`
- PlanCanvas non ha bisogno di ref (non è sortable), ma il warning viene dal contesto — verificare e risolvere

### 3. Save button sempre visibile in edit mode
- In modalità edit, mostrare una barra sticky in basso sempre visibile con:
  - Bottone "Salva modifiche" (abilitato solo se `hasChanges`)
  - Bottone "Annulla modifiche" per resettare allo state originale
  - Indicatore visivo "Modifiche non salvate" quando `hasChanges` è true

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/grow/PlanDetail.tsx` | Fix creazione task locale, forwardRef su SortableTaskRow, barra save persistente |
| `src/components/grow/PlanCanvas.tsx` | Nessuna modifica necessaria (ref non applicata qui) |

