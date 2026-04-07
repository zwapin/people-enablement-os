

## Fix: Rendere cliccabili le collection in Vista Membro

### Problema
La funzione `renderMemberCard` (riga 651-679 di `Learn.tsx`) non ha né `onClick` né `cursor-pointer`. Le card sono statiche.

### Soluzione

**File: `src/pages/Learn.tsx`** — riga 652-654

Aggiungere `onClick` con navigazione e classi hover/cursor alla `<Card>`:

```tsx
<Card
  key={c.id}
  className="flex flex-col h-full p-5 bg-card border-border cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
  onClick={() => navigate(`/learn/${c.id}?view=rep`)}
>
```

Il parametro `?view=rep` mantiene il contesto di impersonazione dentro la collection.

