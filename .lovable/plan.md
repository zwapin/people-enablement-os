

# Fix: link di verifica email punta all'URL privato

## Problema
`window.location.origin` nella preview restituisce `https://id-preview--...lovable.app`, che è un URL privato. I link nelle email di reset password e invito puntano lì → gli utenti non riescono ad accedere.

## Soluzione

Usare l'URL pubblico pubblicato come base per tutti i redirect auth.

### 1. `src/pages/Login.tsx`
- Sostituire `window.location.origin` con una costante che punta all'URL pubblicato
- Creare un helper `getBaseUrl()` che ritorna l'URL corretto:
  - Se esiste `VITE_SITE_URL` → usa quello
  - Altrimenti → `window.location.origin` (fallback)

### 2. `supabase/functions/invite-user/index.ts`
- Aggiungere `redirectTo` nella chiamata `inviteUserByEmail` per controllare dove l'utente viene mandato dopo aver accettato l'invito
- Usare una variabile d'ambiente `SITE_URL` o costruirlo dal Supabase URL

### 3. Approccio consigliato
Aggiungere una variabile d'ambiente `VITE_SITE_URL` con l'URL pubblicato del sito. Questo richiede che il progetto sia pubblicato.

**Alternativa senza variabile**: se il progetto non è ancora pubblicato, posso usare direttamente l'URL Lovable pubblico (senza `id-preview`). L'URL pubblicato è nel formato `https://1f8352f5-c0a2-49ef-b553-82af2d7937a7.lovableproject.com`.

### File da modificare
| File | Modifica |
|------|----------|
| `src/pages/Login.tsx` | Usare URL base configurabile per `redirectTo` |
| `supabase/functions/invite-user/index.ts` | Aggiungere `redirectTo` con URL base corretto |

