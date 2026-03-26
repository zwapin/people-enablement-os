

# Curriculum come pagina dedicata (no dropdown)

## Concetto

Invece di collapsible/dropdown, ogni curriculum è una **card cliccabile** nella lista. Al click si entra in una **sotto-pagina dedicata** dove si trovano moduli, documenti, FAQ e azioni di generazione. Nessuna menzione di "collection" nell'UI — il termine resta "curriculum".

## Modifiche

### 1. Nuova route `/learn/:curriculumId`
- In `App.tsx`, aggiungere route `<Route path="/learn/:curriculumId" element={<CurriculumDetail />} />`
- Nuova pagina `src/pages/CurriculumDetail.tsx`

### 2. `CurriculumDetail.tsx` — Pagina dedicata al singolo curriculum
- Prende `curriculumId` da `useParams()`
- Header con titolo, descrizione, stato, bottoni admin (edit inline, pubblica/bozza, genera, genera contenuti)
- Breadcrumb: Formazione > Nome Curriculum
- Sezione **Moduli** (lista con CurriculumList)
- Sezione **Documenti** (DocumentsList con `collectionId`)
- Sezione **FAQ** (FaqList con `collectionId`)
- Le tre sezioni sono visibili tutte nella stessa pagina (scroll) oppure con tabs — ma non dentro un collapsible

### 3. `CurriculumCard.tsx` — Semplificato a card cliccabile
- Rimuovere il Collapsible e i Tabs interni
- Diventa una card con: titolo, descrizione, badge stato, conteggio moduli/documenti/FAQ
- Al click → `navigate(/learn/${curriculum.id})`
- I bottoni admin (edit, pubblica, archivia) restano sulla card per azioni rapide

### 4. `Learn.tsx` — Lista di card
- La sezione "Curricula" mostra le card semplificate
- Nessun contenuto espanso inline

### 5. Contatori KB sulla card
- Query count di `knowledge_documents` e `knowledge_faqs` per `collection_id` da mostrare sulla card (es. "5 moduli · 3 documenti · 2 FAQ")

## File coinvolti

| File | Modifica |
|------|----------|
| `App.tsx` | Nuova route `/learn/:curriculumId` |
| `CurriculumDetail.tsx` | Nuova pagina con moduli + documenti + FAQ |
| `CurriculumCard.tsx` | Semplificare a card cliccabile, rimuovere Collapsible/Tabs |
| `Learn.tsx` | Nessuna modifica sostanziale, le card navigano alla detail |

