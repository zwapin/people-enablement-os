

# Mobile Responsive — Vista Rep

## Componenti da adattare

### 1. `src/components/learn/RepRoadmap.tsx`
- Il layout è già abbastanza responsive (roadmap verticale), ma:
  - Header: `text-2xl` → `text-xl sm:text-2xl`
  - Progress card: il testo `font-mono` con "X/Y moduli · Z%" può andare a capo — usare `flex-wrap`
  - Section header con progress inline: `flex-wrap` per evitare overflow su schermi stretti
  - Module cards: il titolo usa `truncate` — OK, ma il layout `flex items-start justify-between` potrebbe beneficiare di `flex-col