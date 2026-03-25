# ✅ Completato: Contenuti moduli più profondi e fedeli

## Modifiche applicate

### `supabase/functions/generate-module/index.ts`
- Limite contesto alzato da 8.000 a **25.000 caratteri** per documento
- Aggiunte **regole di fedeltà** al materiale sorgente (preservare termini, fasi, KPI originali)
- Supporto per `relevant_sections` dall'outline per focalizzare il contenuto

### `supabase/functions/process-curriculum/index.ts`
- Limite contesto outline alzato da 6.000 a **25.000 caratteri**
- Outline ora genera `relevant_sections` per ogni modulo
- Le sezioni rilevanti vengono passate al child job di generazione

## Nota
I moduli esistenti non cambieranno. Per rigenerarli con la nuova profondità, usare "Rigenera tutto".
