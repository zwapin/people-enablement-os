

# Piano: Attività chiave evergreen per ruolo + Link Formazione

## Panoramica
Aggiungere al piano di onboarding una sezione **"Attività Chiave"** separata dalla timeline 30/60/90, che contiene le cose che ogni nuovo hire di quel ruolo deve fare (formazione, setup tool, documentazione). Queste attività vengono pre-popolate da template per ruolo e includono link diretti a collection della sezione Learn. Il manager può modificarle liberamente dopo la creazione.

## Cosa cambia per l'utente

**Nella creazione del piano:**
- Nuovo step: scegli il **ruolo** (AE, SDR, CSM, etc.) — il sistema pre-popola le attività chiave standard per quel ruolo
- Le attività chiave appaiono come checklist, il manager può aggiungerne, rimuoverne o modificarle prima di creare il piano

**Nel piano creato (PlanDetail):**
- Nuova sezione **"Attività Chiave"** sopra la timeline dei milestone, con card dedicata
- Ogni attività chiave è una todo con checkbox, titolo e opzionalmente un link a una collection Learn
- Le attività con link a collection mostrano un badge/chip cliccabile "→ Collection Name" che porta alla pagina della collection
- Il completamento è manuale (checkbox) — per ora non auto-sync con il progresso moduli
- La sezione è visivamente distinta (icona diversa, card separata, niente milestone label)

**Per l'admin (gestione template):**
- In una fase futura si potrà gestire i template da UI; per ora li popoliamo via seed/migrazione

## Dettaglio tecnico

### 1. Migrazione DB

**Nuova tabella `onboarding_key_activities`** (le attività chiave dentro il piano individuale):
```sql
CREATE TABLE onboarding_key_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  collection_id uuid REFERENCES curricula(id) ON DELETE SET NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
Con RLS: admin full access, rep read+update sui propri piani.

**Aggiungere campo `role` a `onboarding_templates`** per filtrare i template task per ruolo:
```sql
ALTER TABLE onboarding_templates ADD COLUMN role text DEFAULT NULL;
```

**Nuova tabella `onboarding_key_activity_templates`** (i template delle attività chiave per ruolo):
```sql
CREATE TABLE onboarding_key_activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  title text NOT NULL,
  collection_id uuid REFERENCES curricula(id) ON DELETE SET NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
Con RLS: admin full, rep read.

### 2. Modifiche a `CreatePlanDialog.tsx`
- Aggiungere select/input per il **ruolo** nel Step 0 (accanto a "Ruolo / Template" già esistente, o sostituirlo con un dropdown di ruoli predefiniti)
- Quando si seleziona un ruolo, fetch `onboarding_key_activity_templates` filtrate per quel ruolo
- Mostrare le attività chiave pre-popolate in un nuovo step (o nel Step 0 sotto), editabili
- Per le attività con `collection_id`, mostrare il nome della collection accanto
- Alla creazione del piano, inserire le attività in `onboarding_key_activities`
- Anche i template task in `onboarding_templates` vengono filtrati per `role` (se il campo è valorizzato)

### 3. Modifiche a `PlanDetail.tsx`
- Fetch `onboarding_key_activities` per il piano corrente
- Renderizzare la sezione "Attività Chiave" come card sopra i milestone
- Ogni attività: checkbox + titolo + link collection (se presente)
- Link collection: badge cliccabile che naviga a `/learn` con la collection selezionata (o apre in nuovo tab)
- In modalità edit: titolo editabile inline, possibilità di aggiungere/rimuovere, possibilità di linkare una collection (dropdown)
- Salvare le modifiche nel batch save esistente

### 4. File coinvolti

| File | Azione |
|------|--------|
| DB | Migrazione: `onboarding_key_activities`, `onboarding_key_activity_templates`, campo `role` su templates |
| `src/components/grow/CreatePlanDialog.tsx` | Aggiungere selezione ruolo, pre-popolazione attività chiave |
| `src/components/grow/PlanDetail.tsx` | Nuova sezione "Attività Chiave" con link a collection |
| `src/pages/Grow.tsx` | Nessuna modifica significativa |

### 5. Seed dati di esempio
Inserire via migrazione alcune attività chiave template per il ruolo "AE":
- "Completa la formazione Sales Fundamentals" → link a collection Sales
- "Setup CRM e strumenti di lavoro"
- "Completa la formazione Prodotto" → link a collection Prodotto
- "Revisiona playbook commerciale"

