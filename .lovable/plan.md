

# Associare il PDF a tutti i curricula

## Situazione attuale
- Il PDF "SALES PLAYBOOK" esiste nel DB con 69.790 caratteri estratti
- Ha `collection_id = NULL` → non è legato a nessun curriculum
- I 5 curricula esistenti non hanno documenti associati
- Quando l'AI genera per un curriculum specifico, non trova materiale sorgente

## Soluzione
Creare una copia del record `knowledge_documents` per ciascuno dei 5 curricula, mantenendo lo stesso `file_path` e `content` ma con il `collection_id` corretto.

### Migrazione SQL
Inserire 5 nuovi record nella tabella `knowledge_documents`, uno per ogni curriculum, copiando titolo, contesto, contenuto e file_path dal documento originale (id `2bb02955-...`).

I 5 curricula target:
1. `c1000001-...-000000000001` — Fondamenti del Sales Process
2. `c1000001-...-000000000002` — ICP Targeting e Account Tiering
3. `c1000001-...-000000000003` — SDR Mastery
4. `c1000001-...-000000000004` — AE Excellence
5. `c1000001-...-000000000005` — Customer Success

### Nessuna modifica al codice
Il sistema già funziona correttamente — `DocumentsList` filtra per `collection_id` e `generate-curriculum` cerca documenti per `collection_id`. Basta popolare i dati.

