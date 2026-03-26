

# Rinominare "Curriculum/Curricula" → "Collection/Collections"

Cambiare tutte le occorrenze visibili all'utente e i nomi dei componenti/variabili, mantenendo invariato il nome della tabella DB `curricula`.

## Modifiche per file

### `src/components/learn/CurriculumCard.tsx` → rinominare file a `CollectionCard.tsx`
- Rinominare interfaccia `Curriculum` → `Collection`, `CurriculumCardProps` → `CollectionCardProps`
- Export `CollectionCard`
- Toast: "Curriculum aggiornato" → "Collection aggiornata", "Curriculum pubblicato/archiviato" → "Collection pubblicata/archiviata"

### `src/components/learn/CurriculumList.tsx` → rinominare file a `CollectionModuleList.tsx`
- Interfaccia `CurriculumListProps` → `CollectionModuleListProps`
- Export corrispondente

### `src/pages/CurriculumDetail.tsx` → rinominare file a `CollectionDetail.tsx`
- Variabili: `curriculumId` (dalla route, resta), `curriculum` → `collection`
- Breadcrumb: "Curricula" → "Collections"
- Titolo e label visibili aggiornati

### `src/pages/Learn.tsx`
- Import aggiornati per i nuovi nomi componenti
- Variabili: `publishedCurricula` → `publishedCollections`, `allCurricula` → `allCollections`, `getModulesForCurriculum` → `getModulesForCollection`
- Label UI: "Curricula" → "Collections"

### `src/components/learn/ModuleEditor.tsx`
- Interfaccia `Curriculum` → `Collection`
- Props: `curricula` → `collections`
- Placeholder: "Nessun curriculum" → "Nessuna collection"
- Back link: "Torna al curriculum" → "Torna alla collection"

### `src/components/learn/RepRoadmap.tsx`
- Interfaccia `Curriculum` → `Collection`
- Props/variabili: `curricula` → `collections`, `curriculaMap` → `collectionsMap`
- Testo UI: "Progresso curriculum" → "Progresso collection", "Completa i moduli per avanzare nel curriculum" → "...nella collection"

### `src/pages/ModuleView.tsx`
- Testo bottoni: "Torna al curriculum" → "Torna alla collection"

### `src/App.tsx`
- Import `CurriculumDetail` → `CollectionDetail`
- Route path resta `/learn/:curriculumId` (parametro URL, non impatta utente)

### Note
- Il nome della tabella DB `curricula` e le query Supabase `.from("curricula")` restano invariati
- Le colonne DB (`curriculum_id`) restano invariate
- Solo testi visibili e nomi componenti/variabili nel frontend cambiano

