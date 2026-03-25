

# Aggiungere Genera/Rigenera AI nel ModuleEditor (vista admin)

## Cosa viene aggiunto

Un pulsante **"Genera con AI"** / **"Rigenera con AI"** nel `ModuleEditor` che permette all'admin di lanciare la generazione del contenuto per un singolo modulo, senza dover rigenerare tutto il curriculum.

## Come funziona

Il pulsante crea un `generation_job` di tipo `generate-module` nel database con l'input necessario (module_id, titolo, source_document_ids), poi chiama la edge function `generate-module` passando il job_id. Un polling sul job mostra il progresso. Al completamento, il contenuto del modulo viene ricaricato nell'editor.

## File da modificare

### `src/components/learn/ModuleEditor.tsx`
- Aggiungere pulsante **"Genera con AI"** nella sezione "Contenuto (Markdown)", visibile solo se il modulo ha un `moduleId` salvato
- Al click:
  1. Cancella le vecchie `assessment_questions` del modulo
  2. Crea un job in `generation_jobs` con `job_type: "generate-module"` e input `{ module_id, module_title: title, source_document_ids, source_faq_ids }` (presi dal modulo corrente)
  3. Chiama `supabase.functions.invoke("generate-module", { body: { job_id } })`
  4. Mostra un loading spinner sul pulsante
  5. Al termine, ricarica il modulo con `loadModule()` per aggiornare contenuto, key_points e domande nell'editor
- Per i `source_document_ids` e `source_faq_ids`: se il modulo li ha già salvati, usarli; altrimenti caricare tutti i documenti della knowledge base come fallback
- Aggiungere stato `generating` per disabilitare il pulsante durante la generazione
- Il pulsante mostra "Genera con AI" se `content_body` è vuoto, "Rigenera con AI" se esiste già

### `supabase/functions/generate-module/index.ts`
- Nessuna modifica necessaria — la funzione supporta già il pattern `job_id` che è esattamente quello che serve

## Dettagli tecnici

- Il job viene creato con service role dal client (l'admin ha già accesso via RLS `service_role` per i jobs)
- La edge function legge il job, fetcha i documenti sorgente, genera contenuto e aggiorna il modulo nel DB
- Il polling non serve: la chiamata `invoke` è sincrona — ritorna quando la generazione è completata (o fallita)
- Dopo il completamento, `loadModule()` ricarica tutto nell'editor

