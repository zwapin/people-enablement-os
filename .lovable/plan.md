

## Piano: Importare il piano di onboarding per Lorenzo Corea

Lorenzo ha già un piano esistente (`bc1bd158`) con 3 milestone vuote (30d, 60d, 90d) e 7 key activities template. Popolerò i dati esistenti con il contenuto fornito.

### Struttura dati da inserire

**1. Aggiornare il piano** — premessa (non presente nel testo, lascio vuoto) e output_atteso (testo "Output Atteso a 90 Giorni")

**2. Aggiornare le 3 milestone** con obiettivo, focus (array JSON) e kpis (array JSON), lasciando `early_warnings` vuoto come richiesto:
- **30d** — Obiettivo: "Attivazione rapida su pipeline esistente..." / 4 focus / 4 KPI
- **60d** — Obiettivo: "Dimostrare capacità di chiusura..." / 4 focus / 5 KPI  
- **90d** — Obiettivo: "Entrare a regime con ritmo sostenibile..." / 4 focus / 5 KPI

**3. Inserire i task** per ogni milestone, suddivisi in sezioni "Attività Chiave" e "Coaching":

| Milestone | Sezione | # Task |
|-----------|---------|--------|
| 30d | Attività Chiave | ~10 task (shadowing, call CS, co-gestione pipeline, allineamento metodologia, health snapshot, high/low activation, case study vendita, shadowing SDR, allineamento AE-SDR, definizione SQL enterprise) |
| 30d | Coaching | 1 task (coaching settimanale 1:1 con Luana) |
| 60d | Attività Chiave | ~8 task (gestione 10 opp, chiusura primo deal, deal review, calibrazione pricing, discovery enterprise, meeting AE-SDR, analisi forecast, feedback loop) |
| 60d | Coaching | 0 |
| 90d | Attività Chiave | ~10 task (target NB mensile, pipeline coverage 3x, gestione CRM, expansion, upsell low activation, pipeline forecast pairing, allineamento settimanale, ottimizzazione sourcing, target list enterprise, playbook enterprise) |
| 90d | Coaching | 0 |

**4. Eliminare le key activities template** esistenti e inserirne di nuove coerenti con il piano (o lasciarle se già adeguate).

### Operazioni tecniche

Tutte operazioni di UPDATE/INSERT sui dati esistenti tramite il tool di insert (nessuna migrazione necessaria):

1. `UPDATE onboarding_plans` — set `output_atteso`
2. `UPDATE onboarding_milestones` — set `obiettivo`, `focus`, `kpis`, `early_warnings = '[]'` per ciascuna delle 3 milestone
3. `INSERT INTO onboarding_tasks` — ~29 task con `milestone_id`, `title`, `section`, `type='activity'`, `order_index`

Nessuna modifica al codice. Nessuna migrazione schema.

