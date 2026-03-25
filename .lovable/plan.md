
Diagnosi rapida

Ho verificato codice, log runtime e stato del database. Il problema non è il bottone né la chiamata iniziale dal browser.

Cosa sta succedendo davvero
- La chiamata frontend a `generate-curriculum` funziona: ritorna `200` con `jobId`.
- La funzione `generate-curriculum` crea correttamente il job.
- La funzione `process-curriculum` parte davvero e aggiorna il job a `processing`.
- Poi si ferma prima di completare o fallire.

Evidenze trovate
- Log `generate-curriculum`: job creato correttamente.
- Log `process-curriculum`: arriva fino a  
  `Calling Anthropic API, prompt length: 31272`
  e subito dopo c’è `shutdown`.
- Query DB: il job più recente (`b5a95e23-37c1-43d7-ac39-cffa291bf6ae`) è ancora `processing`, senza `result` e senza `error`.
- La tabella `modules` è ancora vuota.

Perché non si genera il curriculum
- Il worker `process-curriculum` sta ancora facendo un’unica generazione enorme:
  - prompt molto lungo (~31k caratteri)
  - `max_tokens: 16384`
  - fino a 5 moduli
  - ogni modulo con 800–1500 parole
  - più 3 domande per modulo
- Quindi la funzione edge viene terminata dal runtime prima che Anthropic risponda o prima che il catch possa salvare `failed`.
- In pratica, l’architettura asincrona ha tolto il timeout del browser, ma non ha risolto il timeout del worker backend.

Perché la UI mostra “sta impiegando troppo tempo”
- In `Learn.tsx` il client aspetta un update realtime su `generation_jobs`.
- Siccome il job resta bloccato su `processing`, non arriva mai `completed` o `failed`.
- Dopo 4 minuti scatta il timeout lato UI e compare il toast di errore.

Piano di fix corretto

1. Spezzare la generazione in più job piccoli
- Primo job: generare solo l’outline del curriculum
  - titolo modulo
  - summary
  - track
  - rationale
  - fonti usate
- Nessun `content_body` lungo e nessuna domanda in questa fase.

2. Salvare subito i moduli “proposed” vuoti/parziali
- Creare i record modulo appena arriva l’outline.
- Così il sistema ha qualcosa di persistente anche se una fase successiva fallisce.

3. Generare ogni modulo separatamente
- Un job per modulo per creare:
  - `content_body`
  - `key_points`
  - `assessment_questions`
- Ogni job resta abbastanza corto da non andare in timeout.
- Qui conviene riusare o adattare la logica di `generate-module`.

4. Aggiungere tracking vero del progresso
- Estendere `generation_jobs` con progress/stage oppure creare job figli.
- Esempio:
  - `outline_pending`
  - `outline_completed`
  - `module_1_processing`
  - `module_1_completed`
  - ...
- La UI leggerà il progresso reale invece di una simulazione.

5. Gestire meglio gli hard shutdown
- Se un job figlio non conclude, il parent job non deve restare appeso per sempre.
- Serve una logica di recovery/stato parziale, così l’admin vede cosa è stato creato e cosa no.

File da toccare
- `supabase/functions/process-curriculum/index.ts`
  - togliere la mega-generazione unica
  - trasformarlo in orchestratore a step
- `supabase/functions/generate-curriculum/index.ts`
  - lasciare solo enqueue del job padre
- `supabase/functions/generate-module/index.ts`
  - riusarlo/adattarlo per generazione per-modulo
- `src/pages/Learn.tsx`
  - leggere stati reali dei job/child jobs
  - mostrare progresso reale e stati parziali
- nuova migration SQL
  - per progress/stage o tabella child jobs

Nota importante
- Ridurre solo `max_tokens` o tagliare un po’ il prompt potrebbe migliorare, ma non è un fix robusto.
- Il problema strutturale è che oggi stiamo chiedendo a una singola edge function di fare troppo lavoro in una sola esecuzione.

Conclusione
Il curriculum non si genera perché il worker backend va in timeout durante la chiamata Anthropic, resta bloccato su `processing`, e quindi la UI aspetta invano. Il fix giusto è passare da “una generazione gigante” a “outline + un job per ogni modulo”.
