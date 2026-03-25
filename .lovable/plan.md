

# Aggiungere "Recupera password" alla pagina Login

## Cosa viene creato

1. **Link "Password dimenticata?" sulla pagina Login** — sotto il form, apre un dialog/modale inline per inserire l'email e richiedere il reset.

2. **Pagina `/reset-password`** — dove l'utente atterra dopo aver cliccato il link nell'email. Mostra un form per impostare la nuova password. Verifica la presenza di `type=recovery` nell'URL hash prima di mostrare il form.

3. **Rotta pubblica in `App.tsx`** — aggiungere `/reset-password` come rotta non protetta.

## File da creare/modificare

| File | Azione |
|------|--------|
| `src/pages/Login.tsx` | Aggiungere stato per "forgot password mode", input email, chiamata a `supabase.auth.resetPasswordForEmail()` con `redirectTo` verso `/reset-password` |
| `src/pages/ResetPassword.tsx` | Nuova pagina: form per nuova password, chiama `supabase.auth.updateUser({ password })` |
| `src/App.tsx` | Aggiungere `<Route path="/reset-password" element={<ResetPassword />} />` come rotta pubblica |

## Dettagli tecnici

- **Login.tsx**: aggiunge un link "Password dimenticata?" che mostra un campo email + bottone "Invia link di reset". Usa `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`. Mostra messaggio di conferma dopo l'invio.
- **ResetPassword.tsx**: al mount controlla `window.location.hash` per `type=recovery`. Se presente, mostra form con due campi password (nuova + conferma). Chiama `supabase.auth.updateUser({ password })`. Dopo il successo, redirect a `/learn`.
- Tutta la UI in italiano, coerente con lo stile esistente (Tailwind, shadcn components).

