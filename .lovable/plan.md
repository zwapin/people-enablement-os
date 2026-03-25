

# Fix: struttura gerarchica curricula non visibile

## Problema
La tabella `curricula` è **vuota** e tutti i 5 moduli hanno `curriculum_id = null`. La struttura gerarchica esiste nel codice ma non ci sono dati: serve cliccare "Converti in Curricula" manualmente, che non è intuitivo.

## Soluzione
Eseguire la migrazione **automaticamente** al caricamento della pagina Learn, senza richiedere un click manuale.

### 1. `src/pages/Learn.tsx` — Auto-migrazione
- Aggiungere un `useEffect` che, se ci sono moduli orfani (senza `curriculum_id`) e la tabella `curricula` è vuota, esegue automaticamente `handleMigrateToCurricula()`
- Rimuovere il pulsante "Converti in Curricula" (non serve più)
- Dopo la migrazione, i 5 moduli diventano 5 curricula con i moduli assegnati, e la UI mostra le card collapsibili

### 2. Verifica visuale
Dopo la migrazione automatica, la pagina Learn admin mostrerà:
```text
Curricula
  ▼ Fondamenti del Sales Process Klaaryo [Pubblicato] — 1 modulo
      01 Fondamenti del Sales Process Klaaryo
  ▼ AE Excellence: Discovery, Demo e Closing [Pubblicato] — 1 modulo
      01 AE Excellence: Discovery, Demo e Closing
  ...
```

Poi cliccando "Aggiorna Curriculum" l'AI genererà 4-8 sotto-moduli per ogni curriculum.

### File da modificare
| File | Modifica |
|------|----------|
| `src/pages/Learn.tsx` | Aggiungere useEffect per auto-migrazione, rimuovere pulsante manuale |

