

# Fix: Edge function timeout durante la generazione curriculum

## Problema
La edge function `generate-curriculum` va in timeout (~150 secondi) prima che Claude risponda. I log mostrano che la chiamata Anthropic parte ("Calling Anthropic API, prompt length: 31872") ma poi la funzione fa "shutdown" senza mai ricevere la risposta. Il prompt è lungo (31k caratteri) + max_tokens 16384 = Claude impiega troppo tempo.

## Soluzione
Implementare un'architettura a due fasi: la edge function salva il job nel database e ritorna subito, poi una seconda edge function (`process-curriculum`) fa la chiamata lenta ad Anthropic senza vincoli di timeout del client.

### 1. Database — nuova tabella `generation_jobs`
```sql
CREATE TABLE generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  job_type text NOT NULL, -- 'curriculum'
  input jsonb,
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read jobs" ON generation_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage jobs" ON generation_jobs FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE generation_jobs;
```

### 2. `generate-curriculum/index.ts` — diventa "enqueue"
- Crea un record in `generation_jobs` con status `pending` e i parametri (regenerate_all)
- Chiama `process-curriculum` in background con `fetch()` senza `await` (fire-and-forget via `EdgeRuntime.waitUntil`)
- Ritorna subito con `{ jobId, status: "pending" }`

### 3. Nuova edge function `process-curriculum/index.ts`
- Riceve il `jobId`, aggiorna status a `processing`
- Esegue tutta la logica attuale (fetch KB, chiama Anthropic, salva moduli)
- Aggiorna il job a `completed` o `failed`
- Ha un timeout più lungo perché non è vincolata alla connessione del browser

### 4. Frontend `Learn.tsx` — polling con realtime
- Dopo aver ricevuto il `jobId`, sottoscrive a `generation_jobs` via Supabase Realtime
- Quando il job diventa `completed`, fa refetch dei moduli e mostra il toast di successo
- Se `failed`, mostra l'errore
- Timeout di sicurezza a 3 minuti con messaggio utile

## Dettaglio tecnico

```text
PRIMA (timeout):
  Browser → generate-curriculum → Anthropic API (120s+) → timeout → "Failed to fetch"

DOPO:
  Browser → generate-curriculum → INSERT job → return { jobId } (< 1s)
  generate-curriculum → fire-and-forget → process-curriculum
  process-curriculum → Anthropic API (120s) → UPDATE job → INSERT modules
  Browser ← Realtime subscription ← job status = "completed" → refetch modules
```

## File da creare/modificare
1. **Migration SQL** — tabella `generation_jobs` + RLS + realtime
2. **`supabase/functions/generate-curriculum/index.ts`** — semplificato: crea job + fire-and-forget
3. **`supabase/functions/process-curriculum/index.ts`** — nuova: logica completa di generazione
4. **`src/pages/Learn.tsx`** — polling via Realtime invece di await sincrono

