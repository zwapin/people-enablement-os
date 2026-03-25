

# Integrazione Claude (Anthropic) per generazione curriculum

## Cosa faremo
Sostituire il modello AI attuale (Gemini via Lovable AI Gateway) con Claude di Anthropic, usando la tua API key personale. L'API di Anthropic supporta tool calling come l'attuale setup, quindi la struttura resta identica — cambia solo l'endpoint e il formato della request.

## Modifiche

### 1. Aggiungere il secret `ANTHROPIC_API_KEY`
- Usare il tool `add_secret` per chiederti di inserire la tua API key di Anthropic
- Sarà disponibile nelle edge functions come variabile d'ambiente

### 2. `supabase/functions/generate-curriculum/index.ts`
- **Endpoint**: da `https://ai.gateway.lovable.dev/v1/chat/completions` → `https://api.anthropic.com/v1/messages`
- **Headers**: `x-api-key` + `anthropic-version: 2023-06-01` invece di Bearer token
- **Body format**: adattare al formato Anthropic Messages API:
  - `system` come campo top-level (non nel messages array)
  - `model: "claude-sonnet-4-20250514"` (o claude-3.5-sonnet)
  - `max_tokens: 16384`
  - `tools` nel formato Anthropic (molto simile, solo `input_schema` invece di `parameters`)
  - `tool_choice: { type: "tool", name: "propose_curriculum" }`
- **Parsing risposta**: estrarre il tool use da `content[].type === "tool_use"` invece di `choices[0].message.tool_calls[0]`
- **Errori**: mantenere gestione 429/402 adattata ai codici Anthropic

### 3. `supabase/functions/generate-module/index.ts`
- Stesse modifiche di formato: endpoint Anthropic, headers, body format, parsing risposta
- `model: "claude-sonnet-4-20250514"`

### 4. `supabase/functions/extract-document/index.ts`
- Verificare se anche questa usa Lovable AI Gateway e adattare allo stesso modo

### Dettaglio formato Anthropic vs attuale

```text
ATTUALE (OpenAI-compatible):
  POST ai.gateway.lovable.dev/v1/chat/completions
  Authorization: Bearer $KEY
  { model, messages: [{role:"system",...},{role:"user",...}], tools: [{type:"function", function:{name, parameters}}], tool_choice }

ANTHROPIC:
  POST api.anthropic.com/v1/messages
  x-api-key: $KEY
  anthropic-version: 2023-06-01
  { model, system: "...", messages: [{role:"user",...}], tools: [{name, description, input_schema}], tool_choice: {type:"tool", name:"..."} }

PARSING RISPOSTA:
  Attuale: data.choices[0].message.tool_calls[0].function.arguments
  Anthropic: data.content.find(c => c.type === "tool_use").input
```

## File da modificare
1. `supabase/functions/generate-curriculum/index.ts` — endpoint + formato Anthropic
2. `supabase/functions/generate-module/index.ts` — idem
3. `supabase/functions/extract-document/index.ts` — idem (se usa AI)

