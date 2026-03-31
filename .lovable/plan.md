

# Piano: Sezione Crescita — Piani di Onboarding 30-60-90 Strutturati

## Analisi del problema

L'attuale implementazione è un semplice task tracker con milestone generici. Il piano di Lorenzo che hai condiviso è molto più ricco: include **premessa contestuale**, **obiettivo per fase**, **focus**, **attività chiave strutturate per categoria**, **milestone misurabili con KPI**, **early warning** e un **output atteso finale**. Serve un modello dati e una UX completamente diversi.

## Architettura proposta

Il piano di onboarding diventa un documento strutturato con sezioni ricche, non una semplice lista di task. Ogni milestone (30d, 60d, 90d) ha contesto narrativo, obiettivi, attività raggruppate per area, KPI misurabili e segnali di allarme.

```text
onboarding_plans
  ├── premessa (testo libero)
  ├── output_atteso (testo libero)
  └── milestones (30d, 60d, 90d)
       ├── obiettivo (testo)
       ├── focus (lista punti)
       ├── sezioni attività (raggruppate per area)
       │    └── attività (checkbox + testo)
       ├── milestone_kpis (KPI misurabili)
       └── early_warnings (segnali di allarme)
```

## Schema DB — Modifiche

### 1. Estendere `onboarding_plans`
- Aggiungere colonna `premessa text` — contesto iniziale sul profilo/ruolo
- Aggiungere colonna `output_atteso text` — risultato atteso a fine 90 giorni

### 2. Estendere `onboarding_milestones`
- Aggiungere `obiettivo text` — obiettivo della fase
- Aggiungere `focus jsonb default '[]'` — lista di punti di focus
- Aggiungere `early_warnings jsonb default '[]'` — segnali di allarme
- Rinominare/ripensare `goals` → diventa `kpis jsonb` (KPI misurabili con target)

### 3. Estendere `onboarding_tasks`
- Aggiungere `section text` — area/categoria di raggruppamento (es. "Integrazione SDR", "Discovery avanzata")
- Aggiungere `order_index integer default 0`
- Aggiungere `is_common boolean default false` — flag per task trasversali (setup tools, admin)

### 4. Nuova tabella: `onboarding_templates`
Per le task trasversali (comuni a tutti i team):
- `id uuid PK`
- `title text`
- `type task_type`
- `section text`
- `order_index integer`
- `created_at timestamptz`

Quando si crea un nuovo piano, le task dal template vengono copiate automaticamente nel milestone 30d.

## Flusso Admin — Creazione Piano

### Step 1: Selezione Klaaryan + Ruolo
Come ora, ma con campo aggiuntivo per la **premessa** (textarea ricca).

### Step 2: Configurazione Milestone
Per ogni fase (30d, 60d, 90d):
- **Obiettivo** della fase (testo)
- **Focus** (lista editabile di punti)
- **Attività** raggruppate per sezione — le task comuni (template) sono pre-caricate e disabilitabili
- **KPI / Milestone** misurabili (lista con target numerico opzionale)
- **Early Warning** (lista di segnali + soglie)

### Step 3: Output Atteso
Textarea per descrivere il risultato atteso a 90 giorni.

## Flusso Admin — UX

Sostituire il dialog attuale con una **pagina dedicata di creazione/editing** (non un dialog piccolo). Layout a step o a scroll verticale con sezioni collassabili per ciascun milestone.

La lista piani mostra card con: nome Klaaryan, ruolo, progresso %, stato.

Il dettaglio piano diventa una vista completa con:
- Header con premessa
- 3 sezioni milestone espandibili con tutto il contesto
- Footer con output atteso
- Task con checkbox raggruppate per sezione

## Flusso Rep (New Klaaryan)

Vede il proprio piano come documento di onboarding:
- Premessa e contesto del ruolo
- Per ogni fase: obiettivo, focus, attività (con checkbox), KPI da raggiungere, early warning
- Progresso complessivo e per fase

## Task Comuni (Template)

L'admin gestisce una libreria di task trasversali (setup tools, accessi, compliance) che vengono automaticamente inserite in ogni nuovo piano. Sezione dedicata nelle impostazioni o nella pagina Crescita.

## File coinvolti

| File | Azione |
|------|--------|
| Migration SQL | Alter `onboarding_plans`, `onboarding_milestones`, `onboarding_tasks` + create `onboarding_templates` |
| `src/pages/Grow.tsx` | Ristrutturare per supportare la nuova vista ricca |
| `src/components/grow/CreatePlanDialog.tsx` | Sostituire con pagina/form multi-step |
| `src/components/grow/PlanDetail.tsx` | Ristrutturare con sezioni ricche per milestone |
| `src/components/grow/AddTaskDialog.tsx` | Aggiornare con campo sezione e flag comune |
| `src/components/grow/PlanCard.tsx` | Aggiornare con info aggiuntive |
| Nuovo: `src/components/grow/MilestoneEditor.tsx` | Editor ricco per singolo milestone |
| Nuovo: `src/components/grow/CommonTasksManager.tsx` | Gestione template task trasversali |

## Priorità di implementazione

1. **Migration DB** — estendere tabelle + creare template
2. **Vista dettaglio piano ricca** — la parte più impattante per l'esperienza
3. **Form creazione/editing piano** — multi-step con tutti i campi
4. **Template task comuni** — libreria riutilizzabile
5. **Vista rep** — adattamento della vista dettaglio

