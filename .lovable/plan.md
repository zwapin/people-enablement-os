

# Fix: Extraction PDF timeout e curriculum generation vuota

## Problema identificato
Due problemi collegati:

1. **Extract-document va in timeout**: I log mostrano solo boot/shutdown, nessun log di esecuzione effettiva. La chiamata curl va in timeout. Il PDF viene convertito in base64 e inviato a Gemini, ma l'operazione supera il timeout dell'edge function (default ~60s per PDF grandi).

2. **Generate-curriculum restituisce 0 moduli**: Il contenuto del documento nel DB e ancora il placeholder `"[PDF text extraction returned empty...]"`. L'AI non ha materiale reale su cui generare il curriculum.

## Piano

### 1. Fix timeout edge function extract-document
**File: `supabase/functions/extract-document/index.ts`**

- Aggiungere logging per tracciare ogni step (download, conversione, chiamata AI)
- Aggiungere `max_tokens: 8192` alla chiamata AI per evitare risposte infinite
- Gestire PDF troppo grandi: se il base64 supera ~10MB, troncare o restituire errore chiaro
- Aggiungere un timeout esplicito al fetch verso il gateway AI con `AbortController` (50s)

### 2. Fix CORS headers
Aggiornare i CORS headers per includere tutti gli header richiesti dal client Supabase SDK (mancano `x-supabase-client-platform`, etc.)

### 3. Re-testare il flusso
Dopo il deploy:
1. Cliccare "Re-extract" sul documento SALES PLAYBOOK
2. Il testo reale viene estratto e salvato nel DB
3. Cliccare "Aggiorna Curriculum" → l'AI ha contenuto reale → genera moduli

### File coinvolti
- `supabase/functions/extract-document/index.ts` — fix timeout, logging, CORS
- `supabase/functions/generate-curriculum/index.ts` — fix CORS headers

### Dettagli tecnici
- Il timeout del gateway AI per PDF grandi puo superare 60s. Aggiungendo `AbortController` con 50s si gestisce gracefully
- I log nel function body aiuteranno a diagnosticare futuri problemi
- Il `max_tokens` limita la risposta AI evitando attese inutili

