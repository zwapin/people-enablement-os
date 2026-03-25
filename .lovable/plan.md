

# Outline Curricula — basata sul Sales Playbook Klaaryo

Il playbook copre l'intero ciclo SDR → AE → CS. La struttura naturale è organizzare i curricula per **ruolo/fase**, con sotto-moduli che rispecchiano esattamente i capitoli e le procedure del documento.

## Proposta: 5 Curricula con sotto-moduli

```text
CURRICULUM 1: Fondamenti del Sales Process Klaaryo
  ├── Modulo 1: Perché esiste questo processo — mindset e principi
  ├── Modulo 2: Struttura del team SDR → AE → CS
  ├── Modulo 3: Tool Stack e utilizzo operativo (HubSpot, Klaaryo)
  ├── Modulo 4: Metodologie di vendita — SPICED & MEDDICC
  └── Modulo 5: Regole di ingaggio e standard di qualità

CURRICULUM 2: ICP Targeting e Account Tiering Strategy
  ├── Modulo 1: Cos'è l'ICP Klaaryo — settore, workforce, volume
  ├── Modulo 2: Sistema di Tiering (Tier 1 / Tier 2 / Tier 3)
  ├── Modulo 3: Cadenza e intensità outreach per tier
  └── Modulo 4: Identificazione trigger e prioritizzazione account

CURRICULUM 3: SDR Mastery — Da Cold Call a Qualified Opportunity
  ├── Modulo 1: Pre-Sales — Targeting e preparazione lista
  ├── Modulo 2: Outbound — Cold Call script e tecniche di apertura
  ├── Modulo 3: Qualification Call — Script, checklist e talk ratio 70/30
  ├── Modulo 4: Gate Q-Call → Disco Call — criteri di passaggio
  ├── Modulo 5: Handoff SDR → AE — processo e note HubSpot
  └── Modulo 6: Gestione obiezioni e re-engagement

CURRICULUM 4: AE Excellence — Dal Discovery al Closing
  ├── Modulo 1: Warm-up meeting e preparazione pre-Disco Call
  ├── Modulo 2: Discovery Call SPICED — struttura e domande obbligatorie
  ├── Modulo 3: Stakeholder Mapping e gestione del Decision Maker
  ├── Modulo 4: Executive Call — coinvolgere CEO/DM e Mutual Close Plan
  ├── Modulo 5: Demo mirata — struttura, regole e validazione fit
  ├── Modulo 6: Proposta commerciale e ROI — preparazione e presentazione
  ├── Modulo 7: Negoziazione e gestione obiezioni su pricing
  ├── Modulo 8: Closing — dalla firma all'handoff CS
  └── Modulo 9: Follow-up strategico e gestione pipeline

CURRICULUM 5: Customer Success e Post-Sales Excellence
  ├── Modulo 1: Onboarding cliente — primi 30 giorni
  ├── Modulo 2: Adoption e nurturing continuo
  ├── Modulo 3: Renewal e gestione rinnovi
  └── Modulo 4: Escalation e supporto strategico
```

## Perché questa struttura

- **Rispecchia esattamente i capitoli del playbook** (cap. 1-6 → Curriculum 1, cap. 3 tiering → Curriculum 2, cap. 7-8 handoff → Curriculum 3, cap. 8-11 → Curriculum 4, cap. 12 → Curriculum 5)
- **I sotto-moduli sono granulari**: ogni modulo copre un singolo step operativo con script, checklist e gate specifici
- **Il curriculum AE è il più lungo** (9 moduli) perché il playbook dedica il 60% del contenuto al processo AE
- **Ogni modulo ha materiale reale**: nessun modulo è "inventato" — tutti mappano a sezioni specifiche con script, domande e procedure concrete

## Prossimi passi (implementazione)

1. **Pulire i dati attuali**: eliminare i 5 moduli "macro" esistenti e i 5 curricula vuoti
2. **Ricreare i 5 curricula** con i titoli e le descrizioni sopra
3. **Aggiornare il prompt AI** in `process-curriculum` con questa outline come struttura target, così l'AI genera i sotto-moduli con il contenuto estratto dal playbook
4. Oppure: inserire direttamente i moduli skeleton nel DB e poi lanciare la generazione contenuto per ciascuno

Due approcci possibili:
- **A) Hardcodare l'outline** nel prompt AI e farla generare automaticamente
- **B) Inserire l'outline come dati** (curricula + moduli skeleton) e poi generare solo il contenuto

Consiglio l'approccio **A**: aggiornare il prompt con questa struttura così l'AI la usa come guida per generare contenuto dettagliato per ogni sotto-modulo.

