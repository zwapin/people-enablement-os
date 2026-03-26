

# Collection = Curriculum — KB integrata in Formazione

## Concetto

Ogni Curriculum **è** una Collection. I documenti e le FAQ vengono caricati **dentro** il curriculum specifico (es. "Fondamenti del Sales Process" ha i suoi documenti). La generazione AI usa solo il KB di quella collection.

La pagina Knowledge Base standalone viene deprecata — tutto si gestisce dentro Formazione.

## Modifiche al Data Model

### Migration SQL
```sql
-- Aggiungere collection_id (= curriculum_id) a documenti e FAQ
ALTER TABLE knowledge_documents ADD COLUMN collection_id uuid REFERENCES curricula(id) ON DELETE SET NULL;
ALTER TABLE knowledge_faqs ADD COLUMN collection_id uuid REFERENCES curricula(id) ON DELETE SET NULL;
```

## Modifiche Frontend

### 1. `CurriculumCard.tsx` — Aggiungere sezione KB dentro ogni curriculum
- Dentro il `CollapsibleContent`, aggiungere Tabs: **Moduli** | **Documenti** | **FAQ**
- Tab Moduli = quello che c'è ora (CurriculumList)
- Tab Documenti = `DocumentsList` con prop `collectionId={curriculum.id}`
- Tab FAQ = `FaqList` con prop `collectionId={curriculum.id}`
- Bottone "Genera Curriculum" che lancia la generazione per questa specifica collection

### 2. `DocumentsList.tsx` — Filtro per collection
- Aggiungere prop opzionale `collectionId?: string`
- Filtrare query: `.eq("collection_id", collectionId)` quando presente
- Insert: includere `collection_id` nel nuovo record

### 3. `FaqList.tsx` — Filtro per collection
- Stessa logica di DocumentsList

### 4. `AppLayout.tsx` — Rimuovere link Knowledge Base dalla sidebar
- Togliere `{ title: "Knowledge Base", url: "/knowledge", icon: Database }` da `adminItems`

### 5. `App.tsx` — Rimuovere route `/knowledge`
- Eliminare la route e l'import di KnowledgeBasePage

### 6. `generate-curriculum/index.ts` — Accettare `collection_id`
- Nuovo parametro opzionale `collection_id`
- Validare che la collection specifica abbia documenti/FAQ
- Passare `collection_id` a `process-curriculum`

### 7. `process-curriculum/index.ts` — Filtrare KB per collection
- Quando `collection_id` è presente, filtrare documenti e FAQ per `.eq("collection_id", collectionId)`
- Generare moduli solo dentro quel curriculum
- Rimuovere l'outline hardcoded — ogni collection genera la sua struttura basandosi sui suoi documenti

### 8. `Learn.tsx` — Bottone genera per collection
- Aggiungere callback `onGenerateCurriculum` a CurriculumCard
- Il bottone "Aggiorna Curriculum" globale rimane come scorciatoia (genera tutte le collection in sequenza)

## File coinvolti

| File | Modifica |
|------|----------|
| Migration SQL | `collection_id` su docs e faqs |
| `CurriculumCard.tsx` | Tabs Moduli/Documenti/FAQ + bottone genera |
| `DocumentsList.tsx` | Prop `collectionId`, filtro query |
| `FaqList.tsx` | Prop `collectionId`, filtro query |
| `AppLayout.tsx` | Rimuovere link KB |
| `App.tsx` | Rimuovere route `/knowledge` |
| `Learn.tsx` | Callback genera per collection |
| `generate-curriculum/index.ts` | Parametro `collection_id` |
| `process-curriculum/index.ts` | Filtro KB per collection |
| Eliminare `src/pages/KnowledgeBase.tsx` e `src/components/learn/KnowledgeBase.tsx` | Deprecati |

