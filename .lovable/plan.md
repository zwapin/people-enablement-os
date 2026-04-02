

## Piano: Sostituire il colore teal (#0093AD) con #053147

### Cosa cambia
Il colore teal `hsl(189, 100%, 34%)` usato come secondary, accent, ring e in vari elementi viene sostituito con `#053147` che corrisponde a `hsl(200, 87%, 15%)`.

### Modifiche
**File: `src/index.css`** — Sostituire tutte le occorrenze di `189 100% 34%` con `200 87% 15%`:
- `--secondary` (riga 21)
- `--accent` (riga 27)
- `--ring` (riga 44)
- `--module-h3` (riga 50)
- `--module-callout-bg` (riga 51)
- `--module-callout-border` (riga 52)
- `--sidebar-primary` (riga 58)
- `--sidebar-ring` (riga 63)

Totale: 8 variabili CSS, un solo file.

