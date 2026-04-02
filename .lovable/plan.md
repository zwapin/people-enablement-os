

## Piano: Selezione ruolo per import template + ruolo nell'header del piano

### Cosa cambia
1. **Import da template con selezione ruolo**: Il bottone "Importa da template" apre un dropdown/select per scegliere da quale ruolo template importare (lista ruoli dal DB, come in Settings), invece di usare silenziosamente il `role_template` del piano.
2. **Ruolo nell'header**: Il campo `role_template` nell'header del piano diventa un Select con i ruoli disponibili dal database (stessa lista), invece di un Input di testo libero. In lettura rimane testo statico.

### Modifiche

**File: `src/components/grow/PlanDetail.tsx`**

**A. Query ruoli dal DB**
- Aggiungere una query `template-roles` che estrae i ruoli distinti da `onboarding_key_activity_templates` (stessa logica di Settings: `select("role")` → `Set` → sorted array)

**B. Header — Select ruolo**
- Sostituire l'`<Input>` per `role_template` (righe 684-689) con un `<Select>` che mostra i ruoli disponibili dal DB
- In modalità lettura resta il `<p>` attuale

**C. Import con selezione ruolo**
- Modificare `handleImportKeyActivityTemplates` per accettare un parametro `role: string` invece di leggere da `editedPlan.role_template`
- Sostituire il `<Button>` singolo con un `<Select>` o `<DropdownMenu>` che elenca i ruoli disponibili; al click su un ruolo, chiama `handleImportKeyActivityTemplates(role)`
- Stile: bottone ghost "Importa da template" che apre un dropdown con i ruoli

### Dettagli tecnici
- La query ruoli è condivisa tra header select e import dropdown (stessa queryKey `template-roles`)
- L'import non cambia il `role_template` del piano — importa solo le attività dal ruolo selezionato
- Il campo `role_template` nell'header determina il ruolo del piano (persistito nel DB al salvataggio)

