

# Miglioramento UI Rep: Saluto + Collection Cards con navigazione

## Situazione attuale
Il rep vede `RepRoadmap` che mostra un'unica lista verticale con tutti i moduli raggruppati per collection inline, con il roadmap (timeline) visibile subito. Le card hanno dimensioni inconsistenti e manca un saluto personalizzato.

## Soluzione

### 1. Saluto personalizzato
In `Learn.tsx` (vista rep), aggiungere un header "Ciao {nome}!" prima del contenuto, usando `profile.full_name` dal context. Sotto, un sottotitolo motivazionale (es. "Ecco le tue collection di formazione").

### 2. Vista rep a livello Collection (cards uniformi)
Invece di mostrare subito `RepRoadmap` con tutti i moduli, la pagina Learn mostra **card Collection** uniformi in una griglia. Ogni card mostra:
- Titolo collection
- Descrizione (troncata)
- Progress bar con `X/Y moduli completati`
- Icona `BookOpen`

Le card hanno tutte la stessa altezza (`h-full` + flex layout). Click su una card → naviga a `/learn/:collectionId` dove si vede il roadmap dei moduli di quella specifica collection.

### 3. Pagina CollectionDetail per rep
In `CollectionDetail.tsx`, se l'utente è un rep (non admin), mostrare:
- Breadcrumb "Formazione > Nome Collection"
- Il roadmap verticale (`RepRoadmap`) filtrato solo sui moduli di quella collection
- Stats: moduli completati, percentuale, punteggio medio

### File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Learn.tsx` | Vista rep: sostituire `RepRoadmap` con griglia di collection cards + saluto |
| `src/components/learn/RepRoadmap.tsx` | Semplificare: riceve moduli di UNA sola collection (rimuovere raggruppamento interno) |
| `src/pages/CollectionDetail.tsx` | Aggiungere vista rep con roadmap + stats quando `!isAdmin` |

### Dettagli implementativi

**Learn.tsx (rep view):**
```
- Header: "Ciao {profile.full_name?.split(' ')[0]}!" + subtitle
- Barra progresso globale (tutti i moduli)
- Grid 1-2 colonne di Card per ogni publishedCollection
- Ogni card: titolo, descrizione, progress, click → navigate(`/learn/${c.id}`)
- Card con className="h-full" per uniformità
```

**CollectionDetail.tsx (rep view):**
```
- Se !isAdmin: mostrare breadcrumb + RepRoadmap con solo i moduli della collection
- Query completions per l'utente corrente
- Stats header: completati/totali, punteggio medio
```

**RepRoadmap.tsx:**
```
- Rimuovere prop collections e logica di raggruppamento
- Riceve solo modules e completions di una singola collection
- Mantiene la timeline verticale invariata
```

