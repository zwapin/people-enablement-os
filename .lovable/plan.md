

# Fix: Rimuovere DEV_BYPASS e reimpostare password admin

## Problema
`DEV_BYPASS = true` fa sì che l'app non crei mai una sessione reale. Tutte le chiamate al backend (storage upload, insert in tabelle) partono con il token anonimo, e le policy RLS le bloccano con "new row violates row-level security policy".

## Piano

### 1. Creare edge function `reset-admin-password`
Una funzione temporanea che usa la service role key per reimpostare la password dell'utente admin `federico@klaaryo.com` (già esistente nel database con ruolo admin).

- Riceve `{ new_password: string }` nel body
- Usa `supabase.auth.admin.updateUserById()` per aggiornare la password
- Dopo l'uso, la elimineremo

### 2. Rimuovere DEV_BYPASS da AuthContext
**File: `src/contexts/AuthContext.tsx`**
- Eliminare `DEV_BYPASS`, `DEV_PROFILE` e tutti i blocchi `if (DEV_BYPASS)`
- Mantenere solo il flusso reale: `onAuthStateChange` → `getSession` → `fetchProfile`

### 3. Rimuovere bypass da ProtectedRoute
**File: `src/components/ProtectedRoute.tsx`**
- Eliminare la riga `if (!session && profile) return <>{children}</>;`

### 4. Abilitare auto-confirm email
Per evitare che il login richieda conferma email (siamo in dev), abilitare auto-confirm tramite il tool di configurazione auth.

### Risultato
Dopo queste modifiche:
1. L'app redirige a `/login`
2. Imposti la password admin con la edge function temporanea
3. Fai login con `federico@klaaryo.com` + la nuova password
4. Il JWT reale soddisfa le policy RLS → upload documenti funziona

