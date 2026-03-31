

# Piano: Auto-aprire il piano in vista utente su Crescita

Quando `isImpersonating` è attivo e i piani sono caricati, se c'è esattamente un piano (o comunque piani disponibili), selezionare automaticamente il primo piano senza passare dalla griglia di card.

## Modifica: `src/pages/Grow.tsx`

Aggiungere un `useEffect` che, quando `isImpersonating` è true e i piani sono stati caricati, imposta automaticamente `selectedPlanId` al primo piano disponibile. Quando l'impersonation viene disattivata, resettare `selectedPlanId` a `null`.

```typescript
useEffect(() => {
  if (isImpersonating && plans?.length) {
    setSelectedPlanId(plans[0].id);
  }
  if (!isImpersonating) {
    setSelectedPlanId(null);
  }
}, [isImpersonating, plans]);
```

Inoltre, nella vista detail quando `viewAsRep` è attivo, nascondere il pulsante "Indietro" (o disabilitarlo) dato che non ha senso tornare alla griglia se l'utente vede solo il suo piano.

### File coinvolti
| File | Modifica |
|------|----------|
| `src/pages/Grow.tsx` | `useEffect` per auto-select piano + nascondere back button in vista rep |

