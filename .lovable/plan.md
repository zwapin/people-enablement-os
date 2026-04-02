

## Piano: Rinominare "Premessa" in "Intro" e aggiungere titolo personalizzato

### Modifiche

**1. `src/components/grow/PlanDetail.tsx`**

- **Titolo hero sopra tutto** (riga ~638): Cambiare il titolo da `{repName} · Piano 90 Giorni` / `Il tuo Piano di Onboarding` a:
  - Per i member: **"Ecco il tuo piano dei prossimi 90 giorni, {Nome}"**
  - Per la vista admin con rep selezionato: **"Ecco il piano dei prossimi 90 giorni di {NomeRep}"**

- **Rinominare "Premessa" → "Intro"** (riga ~662): Cambiare il label della CardTitle da `Premessa` a `Intro`

**2. `src/components/grow/CreatePlanDialog.tsx`**

- Rinominare il label "Premessa (opzionale)" → "Intro (opzionale)" (riga ~441)
- Aggiornare il subtitle dello step 0 da "Rep, ruolo e premessa" → "Rep, ruolo e intro" (riga ~37)
- Aggiornare il toast "Premessa generata" → "Intro generata" (riga ~188)

**3. `src/components/grow/PlanCard.tsx`**

- Aggiornare il commento/label "Premessa preview" (riga ~87) — cosmetico

### Note tecniche
- Il campo database resta `premessa` (nessuna migrazione necessaria), cambia solo il testo visibile nella UI
- Nessun impatto su logica di salvataggio o generazione AI

