

# Fix: Confermare l'email dell'utente admin esistente

## Problema
L'auto-confirm è stato abilitato ma funziona solo per **nuovi** signup. L'utente `federico@klaaryo.com` era già registrato prima dell'attivazione, quindi la sua email risulta ancora non confermata. Il login restituisce "Email not confirmed".

## Soluzione

### 1. Creare una edge function temporanea `confirm-admin-email`
Usa la service role key per confermare l'email dell'utente esistente tramite `supabase.auth.admin.updateUserById()` impostando `email_confirm: true`.

```typescript
// PATCH: conferma email per user_id 66141c1d-4ef2-4cc1-af68-f183d7865152
await supabaseAdmin.auth.admin.updateUserById(userId, {
  email_confirm: true
});
```

### 2. Invocare la funzione per confermare l'email

### 3. Eliminare la edge function temporanea

## Risultato
Dopo la conferma, il login con `federico@klaaryo.com` / `Klaaryo2025!` funzionerà senza errori.

