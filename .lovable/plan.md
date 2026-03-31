

# Settings: Gestione template attività chiave + Auto-populate nello stepper

## Panoramica
1. Creare una pagina **Impostazioni** (solo admin) con una sezione per gestire i template delle attività chiave per ruolo (CRUD).
2. Nello stepper di creazione piano, quando si seleziona un ruolo, le attività chiave vengono **auto-popolate** immediatamente senza bisogno del bottone "Carica template".

## Cosa cambia

### 1. Nuova pagina Settings (`src/pages/Settings.tsx`)
- Accessibile solo ad admin, aggiunta alla sidebar con icona Settings
- Sezione "Template Attività Chiave per Ruolo":
  - Tabs per ruolo (AE, SDR, CSM, SE, Manager)
  - Lista delle attività con titolo, collection collegata (dropdown), ordine (drag o frecce)
  - Bottone per aggiungere nuova attività, inline edit del titolo, delete
  - Salvataggio diretto su `onboarding_key_activity_templates`

### 2. Auto-populate nello stepper (`CreatePlanDialog.tsx`)
- Rimuovere il bottone "Carica template {role}"
- In `handleRoleChange`, quando i template vengono caricati (via react-query), popolare automaticamente `keyActivities` con i template del ruolo
- Se l'utente cambia ruolo, chiedere conferma se ci sono già attività modificate, poi sovrascrivere
- L'utente può comunque aggiungere/rimuovere/modificare le attività dopo l'auto-populate

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Settings.tsx` | Nuova pagina con gestione template attività chiave |
| `src/App.tsx` | Aggiungere rotta `/settings` |
| `src/components/AppLayout.tsx` | Aggiungere voce "Impostazioni" nella sidebar admin |
| `src/components/grow/CreatePlanDialog.tsx` | Rimuovere bottone "Carica template", auto-populate su selezione ruolo |

