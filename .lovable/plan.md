

# Introduzione dei Curricula come contenitori di moduli

## Concetto

Attualmente i moduli sono "piatti" — una lista unica. L'utente vuole una gerarchia:

```text
Curriculum (es. "Essere Account Executive a Klaaryo")
  ├── Modulo 1: Intro al ruolo AE
  ├── Modulo 2: Discovery Call
  ├── Modulo 3: Demo e Proposal
  └── Modulo 4: Closing e Negoziazione
```

Il **curriculum** è il contenitore alto (un percorso tematico). I **moduli** restano le unità di contenuto con assessment, ma appartengono a un curriculum.

## Modifiche

### 1. Nuova tabella `curricula`

```sql
CREATE TABLE public.curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  track text NOT NULL DEFAULT 'Generale',
  order_index integer NOT NULL DEFAULT 0,
  status module_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;
-- RLS: admin full access, reps vedono solo published
```

### 2. Aggiungere `curriculum_id` alla tabella `modules`

```sql
ALTER TABLE public.modules ADD COLUMN curriculum_id uuid REFERENCES public.curricula(id) ON DELETE SET NULL;
```

I moduli senza `curriculum_id` restano "orfani" (retrocompatibilità).

### 3. UI Admin — `Learn.tsx`

- La vista admin mostra i **curricula** come card espandibili (accordion/collapsible)
- Ogni curriculum mostra i suoi moduli dentro
- Pulsante "Nuovo Curriculum" per crearne uno manualmente
- I moduli orfani (senza curriculum) vengono mostrati in una sezione "Moduli non assegnati"
- Il pulsante "Aggiorna Curriculum" / "Rigenera tutto" continua a funzionare ma ora genera curricula + moduli

### 4. UI Rep — `RepRoadmap.tsx`

- Il roadmap mostra i curricula come sezioni con titolo e descrizione
- Dentro ogni curriculum, la lista verticale dei moduli (come ora)
- Progresso calcolato per curriculum e globale

### 5. `ModuleEditor.tsx`

- Aggiungere un dropdown "Curriculum" per assegnare il modulo a un curriculum esistente

### 6. Edge functions (`process-curriculum`)

- L'outline AI ora propone anche i **curricula** come raggruppamenti
- L'AI riceve istruzione di organizzare i moduli in percorsi tematici (es. "Percorso AE", "Percorso CS")
- Ogni modulo proposto include il `curriculum_title` a cui appartiene
- Il worker crea prima i curricula, poi i moduli con `curriculum_id`

### 7. Nuovo componente `CurriculumCard.tsx`

- Card collapsible che mostra titolo curriculum, descrizione, conteggio moduli, stato
- Dentro: lista dei moduli (riusa `CurriculumList` esistente)
- Azioni admin: modifica titolo/descrizione, cambia stato, elimina

## Dettagli tecnici

- La tabella `curricula` usa lo stesso enum `module_status` (proposed → draft → published → archived)
- RLS: stesse policy dei moduli (admin full, reps vedono published)
- L'outline prompt viene modificato per raggruppare in curricula: l'AI propone `{ curricula: [{ title, description, modules: [...] }] }`
- Il `generate-module` non cambia — genera contenuto per singolo modulo come prima
- Realtime su `curricula` non serve — il polling/refetch esistente basta

