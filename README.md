# Générateur de textes — Mastra + Albert IA

Workflow multi-agents qui génère un texte original sur un sujet extrait d'une page web, rédigé dans le style d'un auteur académique donné. Il repose sur le framework [Mastra.js](https://mastra.ai) et le service IA souverain [Albert (Etalab)](https://albert.api.etalab.gouv.fr).

---

## Table des matières

1. [Architecture générale](#architecture-générale)
2. [Structure du projet](#structure-du-projet)
3. [Pipeline du workflow](#pipeline-du-workflow)
4. [Agents](#agents)
5. [Tools](#tools)
6. [Schémas de données](#schémas-de-données)
7. [Configuration](#configuration)
8. [Installation et lancement](#installation-et-lancement)
9. [Application cliente web](#application-cliente-web)
10. [Dépendances](#dépendances)

---

## Architecture générale

```mermaid
graph TB
    CLI(["💻 CLI\nnode src/index.js"])
    Browser(["🌐 Navigateur\nlocalhost:3000"])
    Server["🖥️ Serveur HTTP\nsrc/server.js\n(Hono)"]
    Mastra["🔧 Mastra\ntextGenerationWorkflow"]
    Step1["⚡ Step : coordinator\n(parallèle)"]
    Step2["⚡ Step : generate-text"]
    CA["🤖 contextAgent"]
    AA["🤖 authorAgent"]
    WA["🤖 writerAgent"]
    Albert["🧠 Albert IA\nalbert.api.etalab.gouv.fr"]
    Web["🌐 Page web"]
    Scholar["📚 Semantic Scholar API"]
    Out(["📄 Texte généré\n(titre + texte + notes)"])

    CLI -->|"url, authorName"| Mastra
    Browser -->|"POST /api/generate"| Server
    Server -->|"url, authorName"| Mastra
    Mastra --> Step1
    Step1 -->|"url"| CA
    Step1 -->|"authorName"| AA
    CA -->|"fetch page"| Web
    CA -->|"analyze"| Albert
    AA -->|"search author"| Scholar
    AA -->|"build profile"| Albert
    Step1 --> Step2
    Step2 -->|"context + profile"| WA
    WA -->|"generate text"| Albert
    Step2 --> Out
    Out -->|"JSON"| Server
    Server -->|"{ title, text, authorVoiceNotes }"| Browser
```

---

## Structure du projet

```mermaid
graph LR
    subgraph root["📁 generateur/"]
        ENV[".env"]
        PKG["package.json"]
        subgraph public["📁 public/"]
            HTML["index.html\n(interface web)"]
        end
        subgraph src["📁 src/"]
            IDX["index.js\n(CLI)"]
            SRV["server.js\n(HTTP Hono)"]
            subgraph agents["📁 agents/"]
                CA2["contextAgent.js"]
                AA2["authorAgent.js"]
                WA2["writerAgent.js"]
            end
            subgraph tools["📁 tools/"]
                AT["albertTool.js"]
                WT["webFetchTool.js"]
                ST["scholarTool.js"]
            end
            subgraph workflows["📁 workflows/"]
                WF["textGenerationWorkflow.js"]
            end
        end
    end

    IDX --> WF
    SRV --> WF
    SRV -.->|"sert"| HTML
    WF --> CA2 & AA2 & WA2
    CA2 --> AT & WT
    AA2 --> AT & ST
    WA2 --> AT
```

---

## Pipeline du workflow

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant WF as Workflow Mastra
    participant Coord as coordinator (step 1)
    participant CA as contextAgent
    participant AA as authorAgent
    participant WT as webFetchTool
    participant ST as scholarTool
    participant Albert as Albert IA
    participant Writer as generate-text (step 2)
    participant WA as writerAgent

    User->>WF: run.start({ url, authorName })
    WF->>Coord: { url, authorName }

    par Parallèle
        Coord->>CA: generate(url)
        CA->>WT: execute({ url })
        WT-->>CA: { content, title }
        CA->>Albert: callAlbert(instructions, content)
        Albert-->>CA: SemanticContext (JSON)
    and
        Coord->>AA: generate(authorName)
        AA->>ST: execute({ author, maxResults:10 })
        ST-->>AA: { publications, citationCount, ... }
        AA->>Albert: callAlbert(instructions, publications)
        Albert-->>AA: AuthorProfile (JSON)
    end

    Coord-->>WF: { semanticContext, authorProfile }
    WF->>Writer: { semanticContext, authorProfile }
    Writer->>WA: generate(semanticContext, authorProfile)
    WA->>Albert: callAlbert(instructions, context+profile)
    Albert-->>WA: GeneratedText (JSON)
    Writer-->>WF: { title, text, authorVoiceNotes }
    WF-->>User: résultat affiché dans le terminal
```

> Le même workflow est également accessible via le serveur HTTP (voir [Application cliente web](#application-cliente-web)).

---

## Agents

Les agents sont des modules JavaScript légers. Chacun encapsule un prompt système et une fonction `generate()` qui orchestre ses tools puis appelle Albert.

### contextAgent

**Rôle** : extraire le contexte sémantique d'une page web.

```mermaid
flowchart LR
    IN["url (string)"]
    FT["webFetchTool\n→ { content, title }"]
    LLM["Albert IA\n(prompt : analyse sémantique)"]
    OUT["SemanticContext\n{ mainTopic, keyConcepts,\nsummary, themes,\ntargetAudience, tone,\nlanguage }"]

    IN --> FT --> LLM --> OUT
```

| Champ de sortie | Type | Description |
|---|---|---|
| `mainTopic` | string | Sujet central de la page |
| `keyConcepts` | `{term, definition}[]` | 5–10 concepts-clés |
| `summary` | string | Synthèse en 3–5 phrases |
| `themes` | string[] | 3–5 thèmes transversaux |
| `targetAudience` | string | Public visé |
| `tone` | string | Registre rhétorique |
| `language` | string | Langue détectée |

---

### authorAgent

**Rôle** : construire un profil d'auteur à partir de ses publications sur Semantic Scholar.

```mermaid
flowchart LR
    IN["authorName (string)"]
    SS["scholarTool\n→ { publications, citationCount, ... }"]
    LLM["Albert IA\n(prompt : profil bibliométrique)"]
    OUT["AuthorProfile\n{ name, mainDiscipline,\nresearchAreas, writingStyle,\nargumentativeApproach,\nnotablePublications,\nacademicVoice }"]

    IN --> SS --> LLM --> OUT
```

| Champ de sortie | Type | Description |
|---|---|---|
| `name` | string | Nom complet |
| `mainDiscipline` | string | Discipline principale |
| `researchAreas` | string[] | 3–6 domaines de recherche |
| `writingStyle` | string | Style d'écriture typique |
| `argumentativeApproach` | string | Mode d'argumentation |
| `notablePublications` | `{title, year}[]` | Top 3 publications |
| `academicVoice` | string | Personnalité intellectuelle |

---

### writerAgent

**Rôle** : rédiger un texte original en adoptant la voix de l'auteur sur le sujet du contexte.

```mermaid
flowchart LR
    IN1["SemanticContext"]
    IN2["AuthorProfile"]
    LLM["Albert IA\n(prompt : ghost-writer)"]
    OUT["GeneratedText\n{ title, text,\nauthorVoiceNotes }"]

    IN1 --> LLM
    IN2 --> LLM
    LLM --> OUT
```

| Champ de sortie | Type | Description |
|---|---|---|
| `title` | string | Titre du texte généré |
| `text` | string | Texte original (400–600 mots) |
| `authorVoiceNotes` | string | Explication de l'application du style |

---

## Tools

### albertTool

Encapsule le client OpenAI pointant sur l'API Albert. Exporte deux interfaces :

```mermaid
classDiagram
    class albertTool {
        +id: "albert-ai"
        +execute(systemPrompt, userMessage) response
    }
    class callAlbert {
        <<function>>
        +callAlbert(systemPrompt, userMessage) string
    }
    class OpenAIClient {
        +baseURL: ALBERT_BASE_URL
        +apiKey: ALBERT_API_KEY
        +model: ALBERT_MODEL
    }
    albertTool --> OpenAIClient : uses
    callAlbert --> OpenAIClient : uses
    albertTool ..> callAlbert : delegates
```

| Export | Usage |
|---|---|
| `callAlbert(sys, msg)` | Appel direct depuis les agents |
| `albertTool` | Mastra `createTool` enregistrable dans le registry |

**Configuration (`.env`) :**

```
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
ALBERT_API_KEY=<votre clé>
ALBERT_MODEL=openai/gpt-oss-120b
```

Modèles disponibles sur Albert :

| Modèle | Usage recommandé |
|---|---|
| `openai/gpt-oss-120b` | Usage général (défaut) |
| `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | Tâches légères |
| `Qwen/Qwen3-Coder-30B-A3B-Instruct` | Code |

---

### webFetchTool

Récupère et nettoie le contenu textuel d'une page web.

```mermaid
flowchart LR
    IN["{ url }"]
    FETCH["fetch(url)\nUser-Agent: MastraBot"]
    CLEAN["Nettoyage HTML\n- strip scripts/styles\n- strip balises\n- decode entités\n- tronquer à 12 000 chars"]
    OUT["{ content, title }"]

    IN --> FETCH --> CLEAN --> OUT
```

| Paramètre | Type | Description |
|---|---|---|
| `url` | string (URL) | Page à récupérer |

| Retour | Type | Description |
|---|---|---|
| `title` | string | Titre `<title>` de la page |
| `content` | string | Texte nettoyé (max 12 000 car.) |

---

### scholarTool

Interroge l'[API Semantic Scholar](https://api.semanticscholar.org) (gratuite, sans clé) en deux requêtes.

```mermaid
flowchart LR
    IN["{ author, maxResults }"]
    Q1["GET /author/search\n?query=author&limit=1"]
    Q2["GET /author/:id/papers\n?sort=citationCount"]
    OUT["{ authorId, authorName,\npaperCount, citationCount,\npublications[] }"]

    IN --> Q1 -->|"authorId"| Q2 --> OUT
```

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| `author` | string | — | Nom de l'auteur |
| `maxResults` | int (1–20) | 10 | Nombre de publications |

| Retour | Type | Description |
|---|---|---|
| `authorId` | string | Identifiant Semantic Scholar |
| `authorName` | string | Nom résolu |
| `paperCount` | number | Nombre total de publications |
| `citationCount` | number | Citations totales |
| `publications[]` | object[] | Liste triée par citations |

---

## Schémas de données

```mermaid
erDiagram
    WorkflowInput {
        string url
        string authorName
    }

    SemanticContext {
        string mainTopic
        array keyConcepts
        string summary
        array themes
        string targetAudience
        string tone
        string language
    }

    AuthorProfile {
        string name
        string mainDiscipline
        array researchAreas
        string writingStyle
        string argumentativeApproach
        array notablePublications
        string academicVoice
    }

    GeneratedText {
        string title
        string text
        string authorVoiceNotes
    }

    WorkflowInput ||--|| SemanticContext : "contextAgent produit"
    WorkflowInput ||--|| AuthorProfile : "authorAgent produit"
    SemanticContext ||--|| GeneratedText : "writerAgent combine"
    AuthorProfile ||--|| GeneratedText : "writerAgent combine"
```

---

## Configuration

Créer un fichier `.env` à la racine :

```dotenv
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
ALBERT_API_KEY=<votre clé API Albert>
ALBERT_MODEL=openai/gpt-oss-120b
```

La clé API est obtenue sur [albert.api.etalab.gouv.fr](https://albert.api.etalab.gouv.fr).

---

## Installation et lancement

```bash
npm install
```

### Mode CLI

Lance le workflow directement dans le terminal.

```bash
# Valeurs par défaut (Wikipedia/Web sémantique + Tim Berners-Lee)
npm start

# Avec vos paramètres
node src/index.js "<URL>" "<Nom Auteur>"

# Exemples
node src/index.js "https://fr.wikipedia.org/wiki/Web_sémantique" "Bruno Bachimont"
node src/index.js "https://www.lemonde.fr/article-exemple" "Yann LeCun"
```

**Sortie dans le terminal :**

```
=== Text Generation Workflow ===
Source URL  : https://fr.wikipedia.org/wiki/Web_sémantique
Author      : Bruno Bachimont
================================

TITLE: ...

TEXT:
...

AUTHOR VOICE NOTES:
...
```

### Mode serveur web

Vérifie si le serveur est lancé

MAC
```bash
lsof -Pi :3000
```
LINUX
```bash
netstat -nlp | grep :3000
```

Stop le serveur par son id process
```bash
$ kill -9 1073
```

Lance le serveur HTTP et l'interface graphique.

```bash
npm run server
```

Puis ouvrir **http://localhost:3000** dans un navigateur.

Le port peut être personnalisé via la variable d'environnement `PORT` :

```bash
PORT=8080 npm run server
```

---

## Application cliente web

Le serveur (`src/server.js`) expose deux routes :

| Route | Méthode | Description |
|---|---|---|
| `/` | GET | Sert `public/index.html` |
| `/api/generate` | POST | Exécute le workflow et renvoie le JSON |

### Requête `POST /api/generate`

```json
{
  "url": "https://fr.wikipedia.org/wiki/Intelligence_artificielle",
  "authorName": "Yann LeCun"
}
```

### Réponse (succès `200`)

```json
{
  "title": "...",
  "text": "...",
  "authorVoiceNotes": "..."
}
```

### Réponse (erreur `500`)

```json
{
  "error": "Workflow échoué",
  "status": "failed",
  "steps": [{ "step": "coordinator", "error": "..." }]
}
```

### Interface web (`public/index.html`)

```mermaid
sequenceDiagram
    actor User as Utilisateur (navigateur)
    participant UI as index.html
    participant API as POST /api/generate
    participant WF as Workflow Mastra

    User->>UI: saisit URL + auteur, clique Générer
    UI->>API: fetch POST { url, authorName }
    Note over UI: spinner + messages de progression
    API->>WF: workflow.createRun().start(...)
    WF-->>API: { title, text, authorVoiceNotes }
    API-->>UI: JSON 200
    UI-->>User: affiche titre, texte, notes de style
```

L'interface ne dépend d'aucune librairie externe — HTML/CSS/JS vanilla uniquement.

---

## Dépendances

```mermaid
graph LR
    App["generateur"]
    Mastra["@mastra/core\nWorkflow + Step + Tool"]
    OpenAI["openai\nSDK natif OpenAI"]
    AiSDK["@ai-sdk/openai\n(provider Vercel AI SDK)"]
    Zod["zod\nValidation des schémas"]
    Dotenv["dotenv\nVariables d'environnement"]
    Hono["hono\nServeur HTTP"]
    HonoNode["@hono/node-server\nAdaptateur Node.js"]

    App --> Mastra
    App --> OpenAI
    App --> AiSDK
    App --> Zod
    App --> Dotenv
    App --> Hono
    App --> HonoNode
    HonoNode --> Hono
```

| Package | Version | Rôle |
|---|---|---|
| `@mastra/core` | ^1.35 | Framework workflow/agent |
| `openai` | ^6.38 | Client Albert IA (SDK natif) |
| `@ai-sdk/openai` | ^3.0 | Provider Vercel AI SDK |
| `zod` | ^3.25 | Validation des schémas I/O |
| `dotenv` | ^17.4 | Chargement des variables `.env` |
| `hono` | ^4.12 | Routeur HTTP léger (serveur web) |
| `@hono/node-server` | ^1.19 | Adaptateur Node.js pour Hono |
