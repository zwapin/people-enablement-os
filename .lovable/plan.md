

## Piano: Aggiungere selezione "Ruolo Template" all'invito membro

### Cosa cambia
Nel dialog di invito (InviteDialog), si aggiunge un Select per scegliere il ruolo template (AE, SDR, CSM, ecc.) dalla lista dei ruoli definiti nel DB (`onboarding_templates`). Questo permette di:
1. Pre-associare il ruolo al profilo del nuovo membro
2. Creare automaticamente un piano di onboarding con quel ruolo template al momento dell'invito

### Modifiche

**File: `src/components/people/InviteDialog.tsx`**
- Aggiungere una query per caricare i ruoli distinti dalla tabella `onboarding_templates` (o `onboarding_key_activity_templates`)
- Aggiungere un `<Select>` per "Ruolo" (role_template) nel form, dopo il campo "Ruolo lavorativo"
- Passare il valore `role_template` nel body della chiamata all'edge function `invite-user`

**File: `supabase/functions/invite-user/index.ts`**
- Accettare il nuovo campo `role_template` dal body
- Dopo la creazione dell'utente e l'aggiornamento del profilo, se `role_template` è presente e `member_type` è `new_klaaryan`:
  - Creare un record in `onboarding_plans` con `rep_id`, `created_by` (admin che invita), e `role_template`
  - Copiare i template delle milestone da `onboarding_templates` per quel ruolo nelle tabelle `onboarding_milestones` e `onboarding_tasks`
  - Copiare le key activities da `onboarding_key_activity_templates` per quel ruolo in `onboarding_key_activities`

### Layout form risultante
```
Nome completo    [___________]
Email            [___________]
Team             [Multi-select ▾]
Ruolo lavorativo [___________]
Ruolo Template   [Select: AE, SDR, CSM... ▾]  ← NUOVO
Tipo membro      [New Klaaryan ▾]
[Invia invito]
```

### Note
- Il Select dei ruoli viene popolato dinamicamente dal DB (query su `onboarding_key_activity_templates` per ruoli distinti, coerente con il resto dell'app)
- Il piano viene creato solo per i `new_klaaryan`; per i veteran non si genera il piano automaticamente
- Se nessun ruolo template è selezionato, il comportamento resta invariato (invito senza piano)

