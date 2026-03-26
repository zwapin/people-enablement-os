

# Generazione bulk moduli per tutte le Collection

## Stato attuale
Ci sono **5 collection pubblicate** con **28 moduli totali**, di cui **27 senza contenuto**:

| Collection | Moduli | Con contenuto |
|---|---|---|
| Fondamenti del Sales Process Klaaryo | 5 | 1 |
| ICP Targeting e Account Tiering Strategy | 4 | 0 |
| SDR Mastery — Da Cold Call a Qualified Opportunity | 6 | 0 |
| AE Excellence — Dal Discovery al Closing | 9 | 0 |
| Customer Success e Post-Sales Excellence | 4 | 0 |

Ogni collection ha 1 documento nella Knowledge Base.

## Piano
Invocherò l'edge function `generate-module` per ciascuno dei 27 moduli vuoti, collection per collection, con un delay tra le chiamate per evitare rate limiting. Userò `supabase--curl_edge_functions` per triggerare la generazione direttamente.

L'ordine sarà:
1. Collection 1 → 4 moduli vuoti
2. Collection 2 → 4 moduli
3. Collection 3 → 6 moduli
4. Collection 4 → 9 moduli
5. Collection 5 → 4 moduli

Per ogni modulo: creo un job record, invoco `generate-module`, e passo al successivo. Il processo richiederà diversi minuti.

