

## Piano: Fix flusso primo accesso via link di invito

### Problema
Quando un utente invitato clicca il link nell'email, Supabase redirige a `/reset-password#access_token=...&type=invite`. Ma la pagina `ResetPassword.tsx` accetta solo `type=recovery` — per qualsiasi altro tipo mostra "Link non valido". L'utente non riesce mai a impostare la password e ad accedere.

### Soluzione

**File: `src/pages/ResetPassword.tsx`**

1. Estendere il check nel `useEffect` per accettare anche `type=invite` e `type=signup` (entrambi usati da Supabase per gli inviti)
2. Tracciare il tipo di flusso (recovery vs invite) in uno state per mostrare messaggi contestuali
3. Per il flusso invite: mostrare "Benvenuto in Klaaryo Academy — Imposta la tua password" invece di "Nuova password"
4. Dopo il submit con successo, redirigere a `/home` (per i nuovi utenti) invece che `/learn`

**File: `src/components/ProtectedRoute.tsx`**

5. Aggiungere un check: se l'URL corrente è `/reset-password`, non redirigere a `/login` — la pagina deve restare accessibile anche quando la sessione è in fase di creazione dal token nell'hash (questo è già gestito perché `/reset-password` non è dentro `ProtectedRoute`, ma verificare che il flusso funzioni)

### Dettagli tecnici

```typescript
// ResetPassword.tsx — useEffect aggiornato
useEffect(() => {
  const hash = window.location.hash;
  if (hash.includes("type=recovery")) {
    setValid(true);
    setFlowType("recovery");
  } else if (hash.includes("type=invite") || hash.includes("type=signup")) {
    setValid(true);
    setFlowType("invite");
  }
}, []);
```

Il form rimane identico (due campi password + conferma), cambia solo il testo di intestazione e il messaggio di successo. Il client Supabase nell'`AuthContext` gestisce già automaticamente lo scambio del token dall'hash URL, quindi la sessione viene creata prima che l'utente invii il form.

