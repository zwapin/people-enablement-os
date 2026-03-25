

# Rigenerazione completa curriculum in italiano

## Problema
I prompt AI sono già in italiano, ma: (1) alcune stringhe di errore nelle edge function sono ancora in inglese, (2) i moduli già nel database sono in inglese e serve un modo per cancellarli e rigenerarli, (3) il contesto dei moduli esistenti nel prompt è in inglese (righe 65-70).

## Modifiche

### 1. `supabase/functions/generate-curriculum/index.ts`
- **Righe 65-70**: tradurre le stringhe del contesto moduli esistenti in italiano ("MODULI ESISTENTI PUBBLICATI/BOZZA", "Quando proponi aggiornamenti...")
- **Riga 116**: tradurre description del tool in italiano
- **Righe 169, 176**: tradurre messaggi errore rate limit e credits in italiano
- **Aggiungere supporto `regenerate_all`**: leggere il body della request, se `regenerate_all: true` → cancellare TUTTE le assessment_questions dei moduli esistenti, poi cancellare TUTTI i moduli, e impostare `existingContext = ""` per generare da zero

### 2. `supabase/functions/generate-module/index.ts`
- **Righe 34-44**: tradurre i commenti/header delle sezioni KB reference in italiano
- **Riga 84**: tradurre description del tool in italiano
- **Righe 121, 128**: tradurre messaggi errore rate limit e credits in italiano

### 3. `src/pages/Learn.tsx`
- Aggiungere un pulsante **"Rigenera tutto"** accanto a "Aggiorna Curriculum" con `AlertDialog` di conferma
- Il dialog avverte: "Questo cancellerà tutti i moduli esistenti e li rigenererà da zero. Continuare?"
- Al click chiama `supabase.functions.invoke("generate-curriculum", { body: { regenerate_all: true } })`

### Dettaglio tecnico — Edge function regenerate_all

```text
// All'inizio della funzione, dopo il CORS check:
let regenerateAll = false;
try {
  const body = await req.json();
  regenerateAll = body?.regenerate_all === true;
} catch { /* no body = normal flow */ }

// Prima di generare, se regenerateAll:
if (regenerateAll) {
  const moduleIds = existingModules.map(m => m.id);
  if (moduleIds.length > 0) {
    await supabase.from("assessment_questions").delete().in("module_id", moduleIds);
    await supabase.from("modules").delete().in("id", moduleIds);
  }
  existingContext = ""; // nessun contesto, genera da zero
}
```

Nessuna modifica alla logica AI o allo schema DB — solo traduzioni residue e meccanismo di pulizia + pulsante frontend.

