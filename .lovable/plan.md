

# Stepper Creazione Piano — Full Screen + AI Generation

## Panoramica
Trasformare il dialog di creazione piano da modale piccolo a **esperienza full-screen** con stepper visivo laterale, e aggiungere la possibilità di usare l'AI per **generare proposte** di premessa, milestone (obiettivi, focus, KPI) e output atteso in base al ruolo e al contesto fornito dal manager.

## Cosa cambia per l'utente

### Full-screen experience
- Il dialog diventa una pagina overlay full-screen (o quasi: `max-w-5xl h-[95vh]`) con layout a due colonne:
  - **Sidebar sinistra**: stepper verticale con indicatori di progresso (step completati, step corrente, step futuri)
  - **Area destra**: contenuto dello step corrente, più spazioso e leggibile
- Ogni step ha un titolo chiaro e un'icona nella sidebar

### AI Generation
- In ogni step rilevante (Premessa, Milestone, Output Atteso), un bottone **"Genera con AI"** (icona sparkles) che:
  - Prende come input: ruolo selezionato, nome rep, premessa (se già scritta), contesto dei passi precedenti
  - Chiama una nuova edge function `generate-onboarding-plan` che usa il Lovable AI Gateway
  - Restituisce proposte strutturate che vengono inserite nei campi come bozza editabile
- L'AI può generare:
  - **Step 0 (Premessa)**: proposta di premessa basata sul ruolo
  - **Step 1 (Attività Chiave)**: già gestito dai template, nessuna AI necessaria qui
  - **Step 2 (Milestone)**: obiettivi, focus e KPI per ciascuna delle 3 fasi, basati su ruolo + premessa
  - **Step 3 (Output Atteso)**: proposta di output atteso coerente con il piano compilato
- Il manager può sempre modificare tutto dopo la generazione — l'AI è solo un punto di partenza

## Dettaglio tecnico

### 1. Layout full-screen del Dialog
- `DialogContent` con `className="max-w-5xl w-full h-[95vh] p-0 flex"`
- Sidebar sinistra (~220px) con stepper verticale: icone, titoli, stato (done/current/todo)
- Area principale con scroll e padding generoso
- Footer fisso in basso con bottoni Indietro/Avanti

### 2. Nuova Edge Function `generate-onboarding-plan`
- Riceve: `{ type: "premessa" | "milestones" | "output", role, repName, premessa?, milestones? }`
- Usa Lovable AI Gateway con `google/gemini-3-flash-preview`
- Usa tool calling per output strutturato (JSON con i campi attesi)
- Restituisce la proposta come JSON tipizzato

### 3. Integrazione AI nel componente
- Hook o funzione `useGenerateProposal` che chiama la edge function
- Bottone "Genera con AI" in ogni step con stato loading (spinner)
- Al ricevimento della risposta, popola i campi dello step corrente
- Toast di conferma "Proposta generata — puoi modificarla"

### 4. File coinvolti

| File | Azione |
|------|--------|
| `src/components/grow/CreatePlanDialog.tsx` | Refactor layout full-screen, aggiungere stepper sidebar, bottoni AI |
| `supabase/functions/generate-onboarding-plan/index.ts` | Nuova edge function per generazione AI |

### 5. Struttura stepper sidebar

```text
┌──────────────────────────────────────────────┐
│ ┌────────┐  ┌──────────────────────────────┐ │
│ │  ● 1   │  │                              │ │
│ │ Basics │  │   Contenuto dello step       │ │
│ │        │  │   corrente                   │ │
│ │  ○ 2   │  │                              │ │
│ │ Attiv. │  │   [Genera con AI ✨]         │ │
│ │        │  │                              │ │
│ │  ○ 3   │  │   Form fields...             │ │
│ │ Miles. │  │                              │ │
│ │        │  │                              │ │
│ │  ○ 4   │  │                              │ │
│ │ Output │  ├──────────────────────────────┤ │
│ │        │  │   [Indietro]    [Avanti →]   │ │
│ └────────┘  └──────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

