

# Generare il curriculum in italiano

Il problema è che i prompt AI nelle edge function sono in inglese, quindi il contenuto generato (titoli, sommari, contenuti, domande) esce in inglese.

## Modifiche

### 1. `supabase/functions/generate-curriculum/index.ts`
- System prompt: cambiare da "You are a sales training curriculum architect" a istruzioni in italiano che specificano di generare tutto in italiano
- Aggiungere istruzione esplicita: "IMPORTANT: Generate ALL content in Italian (titles, summaries, content, questions, feedback)"
- Tool description: aggiornare le descrizioni dei campi per indicare lingua italiana
- User prompt (riga 107): tradurre in italiano
- Error messages (riga 39): tradurre "Knowledge Base is empty..." → "La Knowledge Base è vuota..."
- Track enum: cambiare da `["Sales", "CS", "Ops", "General"]` a `["Vendite", "CS", "Ops", "Generale"]`

### 2. `supabase/functions/generate-module/index.ts`
- System prompt: stesse modifiche — istruzioni di generare tutto in italiano
- Aggiungere "IMPORTANT: Generate ALL content in Italian"
- Error messages tradotti

### Dettaglio prompt generate-curriculum (riga 73)
```
Sei un architetto di curriculum per la formazione commerciale. Il tuo compito è analizzare una Knowledge Base e progettare un curriculum completo per nuovi commerciali.

IMPORTANTE: Genera TUTTO il contenuto in italiano (titoli, sommari, contenuti, punti chiave, domande, feedback).

ISTRUZIONI:
1. Analizza TUTTO il contenuto della knowledge base in modo olistico
2. Progetta una struttura logica del curriculum: quali argomenti coprire, in quale sequenza, come raggruppare le informazioni
3. Per ogni modulo proposto, genera contenuto completo incluse domande di valutazione
...
```

### Dettaglio prompt generate-module (riga 47)
```
Sei un esperto di contenuti formativi per la vendita. Dato del materiale sorgente, genera un modulo formativo strutturato per nuovi commerciali.

IMPORTANTE: Genera TUTTO il contenuto in italiano.
```

Nessuna modifica di logica, solo prompt e stringhe di errore.

