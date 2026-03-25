

# Generazione contenuti: per-modulo e bulk per curriculum

## Situazione attuale
- Il pulsante "Genera con AI" / "Rigenera con AI" **esiste già** nel ModuleEditor (riga 327-341)
- Funziona: crea un job, invoca `generate-module`, aggiorna contenuto + domande
- Problema: con 28 moduli, aprirli uno a uno è tedioso

## Cosa aggiungere

### 1. Pulsante "Genera tutti" su ogni CurriculumCard
Aggiungere un pulsante con icona Sparkles su ogni curriculum nella vista admin. Cliccandolo:
- Prende tutti i moduli del curriculum che hanno `content_body` vuoto (o tutti se forzato)
- Li genera uno alla volta in sequenza (per evitare rate limit)
- Mostra progresso: "Generazione modulo 3/9..."

### 2. Pulsante "Genera tutti i curricula" globale
Un pulsante in alto nella pagina Learn che lancia la generazione per TUTTI i moduli senza contenuto, curriculum per curriculum.

### File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Learn.tsx` | Aggiungere `handleBulkGenerate(curriculumId?)` che itera sui moduli vuoti e chiama `generate-module` per ciascuno con delay tra le chiamate. Aggiungere pulsante globale "Genera tutti i contenuti" |
| `src/components/learn/CurriculumList.tsx` | Passare callback `onBulkGenerate` e mostrare pulsante Sparkles per curriculum |

### 3. Logica `handleBulkGenerate`

```text
Per ogni modulo senza content_body:
  1. Crea generation_job (job_type: "generate-module")
  2. Invoca generate-module con job_id
  3. Attendi completamento (poll job status)
  4. Aggiorna progresso UI
  5. Pausa 2s tra moduli (rate limit)
Alla fine: refetch moduli + toast successo
```

### 4. Nessuna modifica backend
L'edge function `generate-module` gestisce già tutto. Serve solo orchestrare le chiamate dal frontend.

