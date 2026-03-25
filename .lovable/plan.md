

# Fix: Estrazione testo PDF con AI

## Problema
Il file PDF e stato caricato correttamente nello storage (Status 200) e un record esiste in `knowledge_documents`, ma il campo `content` contiene solo il messaggio di errore. Il parser PDF attuale usa semplici regex che non funzionano con la maggior parte dei PDF moderni (che usano stream compressi, font encoding, ecc.).

## Soluzione
Sostituire il parser PDF basilare con l'AI di Lovable per estrarre il testo. Il modello `google/gemini-2.5-flash` supporta input multimodali (inclusi PDF) e puo estrarre il testo completo.

### Modifiche

#### 1. Aggiornare `supabase/functions/extract-document/index.ts`
- Rimuovere le funzioni `extractTextFromPdfBytes` e `decodePdfString`
- Per i PDF: convertire il file in base64 e inviarlo a Gemini via Lovable AI proxy
- Il modello analizza il PDF (anche se scansionato/immagini) e restituisce il testo completo
- Usare il secret `LOVABLE_API_KEY` gia configurato per chiamare l'endpoint AI

```text
Flusso:
1. Download file da storage
2. Converti in base64
3. Invia a Gemini con prompt "Extract all text from this document"
4. Salva il testo estratto nel campo content
```

#### 2. Aggiornare il record esistente
- Dopo il deploy, il documento gia caricato ("SALES PLAYBOOK") potra essere ri-estratto
- Aggiungere un pulsante "Re-extract" nella UI di DocumentsList per ri-processare documenti con contenuto vuoto

### File coinvolti
- `supabase/functions/extract-document/index.ts` — logica di estrazione AI
- `src/components/learn/DocumentsList.tsx` — pulsante re-extract

