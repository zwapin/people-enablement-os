

## Piano: Spostare la barra Salva in alto (sticky top)

### Cosa cambia
Spostare la barra "Salva modifiche / Annulla / Modifiche non salvate" dalla posizione `sticky bottom` attuale a `sticky top`, subito dopo l'header del piano, così è sempre visibile senza dover scrollare fino in fondo.

### Modifica

**File: `src/components/grow/PlanDetail.tsx`**
- Spostare il blocco della save bar (righe 1073-1112) subito dopo l'header (dopo riga ~735, dopo la progress bar)
- Cambiare le classi da `sticky bottom-0` a `sticky top-0`
- Mantenere tutto il resto invariato (logica, stile backdrop-blur, bottoni)

