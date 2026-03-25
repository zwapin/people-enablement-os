# Architettura generazione curriculum multi-step (implementata)

## Flusso
1. `generate-curriculum` → crea job in DB → fire-and-forget `process-curriculum`
2. `process-curriculum` → genera solo OUTLINE (titoli, summary, track, rationale) → salva moduli skeleton "proposed" → fire-and-forget N child jobs `generate-module`
3. `generate-module` (child mode) → genera content_body + key_points + questions per UN modulo → aggiorna parent job progress → se tutti completati marca parent "completed"
4. Frontend via Realtime → mostra progresso reale (outline → modulo 1/N → ... → completato)

## Campi aggiunti a generation_jobs
- `parent_job_id` (uuid, FK self-referencing)
- `current_step` (text)
- `total_steps` (integer)
- `completed_steps` (integer)
