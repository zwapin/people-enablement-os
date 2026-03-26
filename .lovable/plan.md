

# Tema Light (White shadcn)

Cambiare il tema da dark a light aggiornando le CSS custom properties in `src/index.css`. Tutti i componenti shadcn si adatteranno automaticamente.

## Modifiche

### `src/index.css` — Nuove variabili colore light
Sostituire i valori `:root` con il tema light standard shadcn, mantenendo il lime accent `--primary: 75 87% 67%` per coerenza brand:

| Variabile | Da (dark) | A (light) |
|-----------|-----------|-----------|
| `--background` | `0 0% 5.5%` | `0 0% 100%` |
| `--foreground` | `40 20% 95%` | `0 0% 3.9%` |
| `--card` | `0 0% 8.6%` | `0 0% 100%` |
| `--card-foreground` | `40 20% 95%` | `0 0% 3.9%` |
| `--popover` | `0 0% 8.6%` | `0 0% 100%` |
| `--muted` | `0 0% 12%` | `0 0% 96.1%` |
| `--muted-foreground` | `0 0% 40%` | `0 0% 45.1%` |
| `--accent` | `0 0% 12%` | `0 0% 96.1%` |
| `--secondary` | `0 0% 12%` | `0 0% 96.1%` |
| `--border` | `0 0% 16.5%` | `0 0% 89.8%` |
| `--input` | `0 0% 16.5%` | `0 0% 89.8%` |
| `--primary` | mantieni lime | mantieni lime (foreground → dark) |
| `--sidebar-*` | dark | valori light corrispondenti |

### Controllo componenti
- Verificare che `CurriculumCard`, `CurriculumDetail`, `AppLayout` non abbiano classi hardcoded dark (es. `bg-[#161616]`, `text-white`) che sovrascrivono le variabili CSS
- Sostituire eventuali colori hardcoded con classi semantiche (`bg-card`, `text-foreground`, etc.)

## File coinvolti

| File | Modifica |
|------|----------|
| `src/index.css` | Variabili CSS `:root` → tema light |
| Componenti vari | Rimuovere eventuali colori hardcoded dark |

