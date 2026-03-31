

# Piano: Abilitare il toggle New Klaaryan per l'utente corrente

## Problema

Il toggle non funziona perché la query per caricare i profili rep restituisce un array vuoto. La causa: le policy RLS sulla tabella `profiles` usano la funzione `has_role()` che controlla la tabella `user_roles`. L'utente Manu (`6c9a0a45...`) ha `role: admin` nella tabella `profiles`, ma nella tabella `user_roles` ha solo il ruolo `rep`. Quindi la policy "Admins can view all profiles" non si attiva e Manu può vedere solo il proprio profilo.

## Soluzione

Aggiungere una riga nella tabella `user_roles` per dare il ruolo `admin` all'utente Manu:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('6c9a0a45-ca83-4dd9-a5d1-948ac0606ff9', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Questo allineerà il ruolo in `user_roles` con quello già presente in `profiles`, e le policy RLS consentiranno a Manu di vedere tutti i profili, inclusi i rep per il selettore di impersonazione.

### File coinvolti
| Tipo | Dettaglio |
|------|----------|
| Migration SQL | INSERT ruolo admin in `user_roles` per Manu |

