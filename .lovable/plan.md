

# Ristrutturazione: da moduli piatti a curricula con sotto-moduli

## Situazione attuale
- 5 moduli pubblicati, tutti senza `curriculum_id`
- Tabella `curricula` vuota
- I moduli attuali sono "macro-temi" che dovrebbero diventare **curricula** (contenitori)

## Cosa fare

### 1. Migrare i moduli attuali in curricula
Ogni modulo esistente diventa un **curriculum**. Il contenuto attuale viene preservato come descrizione/contesto del curriculum.

Trasformazione:
```text
PRIMA (piatto):
  - Fondamenti del Sales Process Klaaryo
  - ICP Targeting e Account Tiering Strategy
  - SDR Mastery: Da Cold Call a Qualified Opportunity
  - AE Excellence: Discovery, Demo e Closing
  - Customer Success e Post-Sales Excellence

DOPO (gerarchico):
  Fondamenti del Sales Process Klaaryo (CURRICULUM)
    ├── Modulo 1: ...
    ├── Modulo 2: ...
    └── Modulo 3: ...
  AE Excellence (CURRICULUM)
    ├── Discovery Call
    ├── Demo e Presentazione
    ├── Proposta Commerciale
    ├── Negoziazione
    └── Closing
  ... etc.
```

### 2. Approccio di implementazione

**Passo 1 — Conversione automatica** (nel codice Learn.tsx):
- Aggiungere un pulsante "Converti in Curricula" o farlo automaticamente al prossimo "Aggiorna Curriculum"
- Prende i 5 moduli attuali, crea 5 curricula con gli stessi titoli/descrizioni, poi cancella i vecchi moduli
- Lancia la rigenerazione AI che ora genera sotto-moduli per ogni curriculum

**Passo 2 — Aggiornare il prompt AI** (`process-curriculum`):
- Il prompt deve sapere che i curricula esistono già come contenitori
- L'AI deve generare 4-8 sotto-moduli **per ogni curriculum**, coprendo ogni aspetto del tema
- Esempio per "AE Excellence": Discovery Call, Qualificazione BANT, Demo Structure, Gestione Obiezioni, Proposta e Pricing, Negoziazione, Closing Techniques, Handoff al CS

**Passo 3 — Azione concreta proposta**: 
Siccome i curricula sono vuoti e i moduli sono "macro", il modo più pulito è:
1. Creare i 5 curricula a partire dai titoli dei moduli attuali
2. Assegnare `curriculum_id` ai moduli esistenti (come primo modulo "introduttivo" di ogni curriculum)
3. Lanciare "Aggiorna Curriculum" che genererà nuovi sotto-moduli per ogni curriculum

### 3. File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Learn.tsx` | Aggiungere funzione `handleMigrateToCurricula()` che converte i moduli orfani in curricula e li assegna |
| `supabase/functions/process-curriculum/index.ts` | Aggiornare il prompt per generare sotto-moduli specifici per ogni curriculum esistente, non nuovi curricula |

### 4. Dettagli `handleMigrateToCurricula()`
- Per ogni modulo orfano pubblicato: crea un curriculum con lo stesso titolo/summary
- Assegna il modulo al curriculum appena creato (come modulo "introduttivo")
- Toast di conferma
- L'admin poi clicca "Aggiorna Curriculum" per far generare all'AI i sotto-moduli mancanti

### 5. Dettagli aggiornamento prompt
- Se esistono curricula con pochi moduli (< 4), l'AI deve proporre nuovi moduli per riempirli
- Il prompt riceve la lista dei curricula con i loro moduli attuali e genera sotto-moduli aggiuntivi
- Ogni sotto-modulo copre un aspetto specifico del tema del curriculum padre

