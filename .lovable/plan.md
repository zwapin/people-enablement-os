
# Aggiungere toggle Admin ↔ Rep view nella pagina Learn

## Cosa cambia
Aggiungere un toggle switch nell'header della vista admin che permette di passare alla vista rep (roadmap) per anteprima. Solo visibile agli admin.

## Modifiche

### File: `src/pages/Learn.tsx`
- Aggiungere stato `const [viewAsRep, setViewAsRep] = useState(false)`
- Nell'header admin, aggiungere un toggle con label "Vista Rep" accanto al titolo
- Quando `viewAsRep` è true, anche se `isAdmin`, fetch le completions e renderizzare `<RepRoadmap>` al posto della vista admin
- Il toggle resta visibile in cima anche nella vista rep (per poter tornare indietro)
- Aggiornare la query `module_completions` per fetchare anche quando admin ha `viewAsRep = true`

### UI del toggle
- Usare il componente `Switch` + label "Vista Rep" posizionato nell'header accanto al titolo
- Import `Switch` da `@/components/ui/switch`
- Import `Label` da `@/components/ui/label`

### Dettaglio logica
```text
if (viewAsRep && isAdmin) → mostra header minimale con toggle + RepRoadmap
if (!isAdmin)             → mostra RepRoadmap (come ora)  
if (isAdmin && !viewAsRep)→ mostra vista admin completa con toggle nell'header
```
