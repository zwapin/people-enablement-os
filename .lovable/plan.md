

# Contenuti moduli troppo generici: aumentare profondità e fedeltà al documento sorgente

## Problema
Il documento sorgente (Sales Playbook) è lungo **70.000 caratteri**, ma ogni modulo riceve solo **8.000 caratteri** di contesto — circa l'11%. L'AI non vede le sezioni specifiche (disco call, executive call, MCP, pipeline stages) e produce contenuti generici.

## Soluzione

### 1. Passare più contesto al singolo modulo — `generate-module/index.ts`
- Alzare il limite da 8.000 a **25.000 caratteri** per documento sorgente
- Possibile perché ogni modulo gira in una edge function separata, quindi non c'è rischio timeout
- Con `max_tokens: 8192` e un prompt più lungo, la generazione resta entro i limiti

### 2. Estrarre la porzione rilevante del documento — `process-curriculum/index.ts`
- Nel prompt outline, chiedere all'AI di restituire anche i **capitoli/sezioni rilevanti** per ogni modulo (es. "Sezione 9: Processo AE")
- Passare queste indicazioni nel `input` del child job
- In `generate-module`, usare queste indicazioni per fare un "taglio intelligente" del documento lungo

### 3. Rafforzare il prompt di generazione — `generate-module/index.ts`
- Aggiungere istruzioni esplicite: "Includi TUTTI i termini specifici, nomi di fasi, framework e tool menzionati nel materiale sorgente"
- Richiedere di non generalizzare ma di preservare la terminologia e i dettagli operativi del playbook
- Esempio: "Se il documento menziona 'Disco Call', 'Executive Call', 'MCP', questi devono comparire nel modulo"

### File da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/process-curriculum/index.ts` | Aggiungere `relevant_sections` all'output outline; alzare truncation a 25k |
| `supabase/functions/generate-module/index.ts` | Alzare limite da 8k a 25k; aggiungere istruzioni di fedeltà al materiale sorgente |

### Nota
I moduli esistenti non cambieranno. Per vedere i miglioramenti bisogna rigenerarli.

