

# Plan : Configurer le pipeline complet Claude AI dans le projet

## Contexte

L'utilisateur a fourni une description technique exhaustive du fonctionnement interne de Claude AI (12 phases). L'objectif est d'aligner le systeme de chat et d'agent sur cette architecture : system prompt structure, streaming SSE, tool use avec pauses, artifacts React/HTML dans iframe, extended thinking, et rendu Markdown progressif.

## Ce qui existe deja

- **Chat streaming SSE** via `chatDirect()` dans `src/lib/api.ts` — fonctionne avec Anthropic/OpenAI/DeepSeek
- **System prompt** structure dans `src/lib/system-prompt.ts` — skills, agent mode, security rules
- **ChatMessage** avec rendu Markdown (code blocks, listes, headers) et tool steps collapsibles
- **Artifacts** systeme avec types (code, html, app, slides, markdown, etc.) et `ArtifactCard`
- **Agent mode** avec boucle perceive/plan/act/verify et LogEntry
- **Tool use** : Desktop Commander, file operations, shell execution

## Ce qui manque pour reproduire Claude AI

### 1. System prompt structure comme l'API Anthropic (Phase 1)

Le system prompt actuel est fonctionnel mais ne suit pas la structure exacte Claude. Il faut :
- Separer clairement : regles de securite, outils disponibles (avec schemas JSON), memoires injectees, preferences utilisateur
- Ajouter l'injection automatique des memoires inter-sessions (deja partiellement fait via projets)
- Structurer les `tools` au format Anthropic (name, description, input_schema)

**Fichier :** `src/lib/system-prompt.ts`

### 2. Extended Thinking visible (Phase 5)

Le composant `ThinkingStep` existe mais est basique. Il faut :
- Ajouter un budget de tokens de reflexion configurable (low/medium/high)
- Afficher les thinking tokens dans un bloc collapsible avec compteur
- Distinguer visuellement "Extended Thinking" du simple "Thinking..."
- Envoyer `reasoning_effort` au backend (deja supporte)

**Fichiers :** `src/components/chat/ChatMessage.tsx`, `src/components/ChatPanel.tsx`

### 3. Tool Use avec pauses et format structure (Phase 7)

Le systeme de tool steps existe mais il faut :
- Ajouter des indicateurs de chargement pendant l'execution d'un outil (spinner + duree)
- Afficher le format des appels d'outils (nom + parametres) de facon structuree
- Gerer les pauses visibles pendant l'execution (l'IA s'arrete, l'outil tourne, le resultat revient)
- Ajouter un compteur de temps par outil

**Fichier :** `src/components/chat/ChatMessage.tsx`

### 4. Artifacts React/HTML dans iframe sandboxe (Phase 10)

Le systeme `ArtifactCard` existe mais ne fait pas de rendu live. Il faut :
- Creer un composant `ArtifactPreview` qui execute les artifacts React dans un `<iframe>` sandboxe
- Transpiler le JSX via `@babel/standalone` dans le navigateur
- Injecter React, Tailwind, lucide-react via import map
- Gerer les erreurs de compilation/runtime dans l'iframe
- Ajouter les boutons "Copier", "Telecharger", "Ouvrir en plein ecran"

**Nouveau fichier :** `src/components/chat/ArtifactPreview.tsx`
**Modifier :** `src/components/chat/ArtifactCard.tsx`

### 5. Rendu Markdown progressif pendant le streaming (Phase 9)

Le rendu Markdown actuel (`Md` dans ChatMessage) est basique. Il faut :
- Ajouter le syntax highlighting pour les blocs de code (via highlight.js ou Prism)
- Supporter les tables Markdown
- Supporter les blockquotes
- Gerer le rendu progressif sans saut visuel pendant le streaming

**Fichier :** `src/components/chat/ChatMessage.tsx`

### 6. Pipeline de construction de requete complet (Phase 1+8)

Aligner `chatDirect()` pour :
- Structurer le corps exactement comme l'API Anthropic (system, messages, tools, max_tokens, stream)
- Gerer le format SSE Anthropic natif (content_block_delta, message_stop, tool_use blocks)
- Ajouter la gestion des `stop_sequences` personnalisees
- Ajouter le support des images base64 dans les messages

**Fichier :** `src/lib/api.ts`

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `src/lib/system-prompt.ts` | Restructurer : regles, tools JSON, memoires, preferences |
| `src/lib/api.ts` | Ajouter support images base64, stop_sequences, tool_use blocks |
| `src/components/chat/ChatMessage.tsx` | Extended thinking enrichi, tool steps avec timing, Markdown avance (tables, blockquotes, syntax highlighting) |
| `src/components/chat/ArtifactPreview.tsx` | Creer — iframe sandboxe avec transpilation Babel pour artifacts React/HTML |
| `src/components/chat/ArtifactCard.tsx` | Integrer ArtifactPreview pour le rendu live |
| `src/components/ChatPanel.tsx` | Passer le thinking budget, gerer les tool_use pauses |

## Ordre d'implementation

1. Enrichir le rendu Markdown (tables, blockquotes, syntax highlighting)
2. Ameliorer les tool steps (timing, format structure, spinners)
3. Enrichir l'Extended Thinking (budget, compteur, visuel)
4. Creer ArtifactPreview avec iframe sandboxe + Babel
5. Restructurer le system prompt
6. Ameliorer le pipeline API (images, tool_use blocks)

## Detail technique

- **Syntax highlighting** : utilisation de Prism.js inline (pas de dependance lourde), detection automatique du langage
- **Iframe sandbox** : attributs `sandbox="allow-scripts"`, CSP strict, communication via `postMessage`
- **Babel transpilation** : `@babel/standalone` charge en CDN dans l'iframe, transforme JSX → JS
- **Tables Markdown** : detection du pattern `| col | col |` avec alignement
- **Timing des outils** : `performance.now()` au debut et fin de chaque tool step

