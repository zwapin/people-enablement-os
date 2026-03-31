

# Popolare template attività chiave per AE, SDR e CSM

## Panoramica
Aggiornare i template AE esistenti (linkando le collection appropriate) e creare i template per SDR e CSM con attività specifiche per ruolo.

## Dati da inserire

### AE (aggiornamento dei 4 esistenti + eventuali nuovi)
| # | Titolo | Collection |
|---|--------|-----------|
| 0 | Completa la formazione Sales Fundamentals | Fondamenti del Sales Process Klaaryo |
| 1 | Setup CRM e strumenti di lavoro | — |
| 2 | Completa la formazione Prodotto | Come funziona Klaaryo |
| 3 | Revisiona playbook commerciale | — |
| 4 | Completa formazione Discovery e Closing | AE Excellence — Dal Discovery al Closing |
| 5 | Completa formazione ICP e Account Tiering | ICP Targeting e Account Tiering Strategy |
| 6 | Effettua 3 shadow call con un AE senior | — |
| 7 | Prepara e presenta una demo di prova | — |

### SDR (nuovi)
| # | Titolo | Collection |
|---|--------|-----------|
| 0 | Completa la formazione Sales Fundamentals | Fondamenti del Sales Process Klaaryo |
| 1 | Setup CRM e strumenti di lavoro | — |
| 2 | Completa la formazione Prodotto | Come funziona Klaaryo |
| 3 | Completa formazione SDR Mastery | SDR Mastery — Da Cold Call a Qualified Opportunity |
| 4 | Completa formazione ICP e Account Tiering | ICP Targeting e Account Tiering Strategy |
| 5 | Effettua 10 cold call di pratica con feedback | — |
| 6 | Scrivi 5 email di prospecting e falle revisionare | — |
| 7 | Studia e memorizza il pitch di 30 secondi | — |

### CSM (nuovi)
| # | Titolo | Collection |
|---|--------|-----------|
| 0 | Completa la formazione Sales Fundamentals | Fondamenti del Sales Process Klaaryo |
| 1 | Setup CRM e strumenti di lavoro | — |
| 2 | Completa la formazione Prodotto | Come funziona Klaaryo |
| 3 | Completa formazione Customer Success | Customer Success e Post-Sales Excellence |
| 4 | Revisiona il processo di onboarding cliente | — |
| 5 | Effettua 2 shadow call con un CSM senior | — |
| 6 | Studia le metriche chiave (NPS, Churn, Health Score) | — |
| 7 | Prepara un piano di successo per un account fittizio | — |

## Operazioni tecniche
- **UPDATE** i 4 template AE esistenti per aggiungere i `collection_id` mancanti
- **INSERT** 4 nuovi template AE (attività 4-7)
- **INSERT** 8 template SDR
- **INSERT** 8 template CSM
- Tutto tramite il tool di insert dati (non migrazione, sono operazioni sui dati)

