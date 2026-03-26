

# Fix: Creare credenziali admin funzionanti

## Problema
L'utente `federico@klaaryo.com` è stato creato via invite ma la password non corrisponde. Il sistema è invite-only, quindi non c'è signup.

## Soluzione
Creare una edge function one-time `seed-admin` che usa `auth.admin.createUser()` per creare (o ricreare) l'utente admin con una password nota e `email_confirm: true` (così salta la verifica email).

### Passi

1. **Nuova edge function `supabase/functions/seed-admin/index.ts`**
   - Usa `supabaseAdmin.auth.admin.createUser()` con:
     - email: `federico@klaaryo.com`
     - password: una password sicura (es. `Klaaryo2025!`)
     - `email_confirm: true`
     - `user_metadata: { full_name: "Federico" }`
   - Se l'utente esiste già, prima lo elimina (`listUsers` + `deleteUser`) e lo ricrea
   - Assegna ruolo `admin` in `user_roles` e crea profilo con `role: admin`

2. **Invocare la function una volta** per creare le credenziali

### Credenziali risultanti
- Email: `federico@klaaryo.com`
- Password: `Klaaryo2025!`

Nessuna modifica al frontend — il login page funziona già correttamente.

