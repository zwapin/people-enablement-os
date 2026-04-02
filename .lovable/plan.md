

## Piano: Ripristinare l'account admin eliminato

### Problema
L'account `federico@klaaryo.com` è stato eliminato (visibile nei log auth: `user_deleted`). I tentativi di login falliscono con "Invalid login credentials".

### Soluzione
Invocare la edge function `seed-admin` già esistente. Questa funzione:
1. Ricrea l'utente `federico@klaaryo.com` con password `Klaaryo2025!`
2. Conferma l'email automaticamente
3. Imposta il profilo e il ruolo come **admin**

### Azione
- Chiamare `POST` alla edge function `seed-admin` (nessun body richiesto)
- Dopo l'esecuzione, potrai fare login normalmente dalla pagina di login

Nessuna modifica al codice necessaria.

