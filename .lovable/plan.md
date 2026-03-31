

# Piano: Popolare il piano di Federico con il contenuto Account Executive Enterprise

Questo è un task di **inserimento dati** nelle tabelle esistenti, non una modifica allo schema.

## Dati identificati

- **Plan ID**: `a2a32dc1-a338-4447-b0bb-89c21f7838f3`
- **Milestone 30d**: `ac2ed325-dfe5-45e3-aaf7-b045e4541978`
- **Milestone 60d**: `25e295cf-3d61-47bb-8e3d-78783567daad`
- **Milestone 90d**: `a7e7cf3f-58d1-40a5-b1c8-cef76458e2b1`

## Operazioni da eseguire

### 1. Aggiornare `onboarding_plans`
- `premessa`: il testo sulla vendita enterprise e le caratteristiche dei clienti target
- `output_atteso`: i 6 punti finali (operativo su NB, pipeline autonoma, forecast, ecc.)
- `role_template`: "Account Executive Enterprise"

### 2. Aggiornare i 3 milestone con obiettivo, focus, KPI ed early warnings

| Milestone | Obiettivo | Focus (JSONB array) | KPIs (JSONB array) | Early Warnings (JSONB array) |
|-----------|-----------|---------------------|---------------------|------------------------------|
| 30d | Attivazione rapida su pipeline... | 3 punti | 4 KPI | 2 warning |
| 60d | Dimostrare capacità di chiusura... | 4 punti | 5 KPI | 2 warning |
| 90d | Entrare a regime con ritmo... | 4 punti | 5 KPI | 3 warning |

### 3. Inserire i task raggruppati per sezione

**30d** (~11 task in 3 sezioni):
- "Attività chiave" (7 task)
- "Integrazione SDR" (3 task)
- "Coaching" (1 task)

**60d** (~9 task in 3 sezioni):
- "Attività chiave" (4 task)
- "Discovery avanzata" (1 task)
- "Integrazione SDR + pipeline control" (4 task)

**90d** (~9 task in 3 sezioni):
- "Attività chiave" (5 task)
- "Integrazione SDR + previsione" (4 task)

Tutti i task saranno di tipo `activity` con `completed: false`.

## Approccio tecnico

Userò il tool di inserimento dati (non migration) per eseguire UPDATE sulle tabelle `onboarding_plans` e `onboarding_milestones`, e INSERT sulla tabella `onboarding_tasks`. Tutto in SQL diretto.

