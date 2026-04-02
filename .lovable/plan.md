

## Piano: Import da template per Attività Chiave nel piano esistente

### Cosa cambia
Nella sezione "Attività Chiave" del piano (PlanDetail), in modalità edit, aggiungere un bottone "Importa da template" accanto al titolo. Al click, carica i template da `onboarding_key_activity_templates` filtrati per il ruolo del piano (`role_template`) e li aggiunge come nuove attività (con id temporanei `temp-`), evitando duplicati per titolo.

### Modifiche

**File: `src/components/grow/PlanDetail.tsx`**
- Aggiungere una query per `onboarding_key_activity_templates` filtrata per `role_template` del piano (stessa logica già usata in `CreatePlanDialog`)
- Nella riga header della sezione "Attività Chiave", in edit mode, aggiungere un `Button` variant ghost con icona `Download` e label "Importa da template"
- Al click: per ogni template non già presente (check su titolo), creare un nuovo item `KeyActivity` con `id: "temp-..."` e aggiungerlo a `editedKeyActivities`
- Toast di conferma con il numero di attività importate (o "Tutte le attività sono già presenti" se nessuna nuova)

### Dettagli tecnici
- La query templates si attiva solo quando `isEditable` e `displayPlan.role_template` esiste
- Il check duplicati confronta `title.trim().toLowerCase()` tra template e attività esistenti (sia salvate che locali)
- I nuovi item ereditano `collection_id` dal template se presente, `order_index` incrementale

