# Plan: Transformation de CodePage en interface identique à ChatPanel

## Objectif
Rendre l'interface de `CodePage.tsx` **exactement identique** à celle de `ChatPanel.tsx`, avec les fonctionnalités code (Monaco Editor, file tree, terminal, git) intégrées comme un panneau latéral (similaire à `ArtifactPanel`).

## Architecture

### Layout final
```
┌──────────────────────────────────────────────────────┐
│ Header: ModelSelector | Chat/Agent | Projets | Code  │
├──────────────────────────────┬───────────────────────┤
│                              │                       │
│   Chat Messages              │   Code Panel (56%)    │
│   (ChatMessage,              │   ┌─────────────────┐ │
│    LiveSessionCard,          │   │ File Tree       │ │
│    ThinkingIndicator)        │   ├─────────────────┤ │
│                              │   │ Monaco Editor   │ │
│                              │   ├─────────────────┤ │
│                              │   │ Terminal        │ │
│                              │   ├─────────────────┤ │
│                              │   │ Git Bar         │ │
│                              │   └─────────────────┘ │
├──────────────────────────────┴───────────────────────┤
│ Input: textarea + send + mic + attach                │
└──────────────────────────────────────────────────────┘
```

### Nouveaux fichiers à créer

1. **`src/components/code/CodePanel.tsx`** — Panneau latéral droit (56%) qui contient :
   - File Tree (arborescence réelle)
   - Monaco Editor (édition de code)
   - Terminal (SSE)
   - Git Bar (status, commit, push, pull, branches)
   - Quick Open (Ctrl+P)

2. **`src/pages/CodePage.tsx`** — Réécriture complète pour être identique à `ChatPanel.tsx` :
   - Mêmes imports, mêmes états, mêmes handlers
   - Même render (header, messages, input)
   - `CodePanel` remplace `ArtifactPanel` comme panneau latéral
   - Bouton "Code" dans le header pour ouvrir/fermer le panneau

### Ce qui est préservé de l'ancien CodePage.tsx
- Toute la logique `code-api.ts` (listDirectory, readFile, writeFile, executeCommandStream, gitCommand, etc.)
- Les composants : `AgentActionStep`, `PreviewPanel`, `ClaudeMdEditor`, `SubAgentPanel`
- Les helpers : `buildFileTree`, `FileTreeNode`, `extractCodeBlocks`, `getLanguageFromPath`
- Les modales : `RepoPickerModal`, `BranchPicker`, `GitCommitModal`, `CreateProjectModal`, `ProjectPicker`

### Ce qui est NOUVEAU (copié de ChatPanel.tsx)
- `useStore` pour le state global (task, entries, mode, status, etc.)
- `chatDirect` pour la communication API
- `ChatMessage`, `ThinkingIndicator`, `LiveSessionCard`, `TakeoverBanner`
- `ModelSelector`, `ProviderConfigModal`, `ComposerInsertMenu`
- `useSpeechInput`, `useIntentEngine`
- `ResponseTypePill`
- `ArtifactWorkspaceModal`, `ArtifactPanel`
- `ProjectsModal`, `ConnectorConfigModal`, `ConnectorsDirectoryModal`
- Tout le système de `handleSend`, `handleChatSend`, `handleBuilderSend`, `handleDesktopCommanderSend`

## Étapes d'implémentation

### Étape 1: Créer `CodePanel.tsx`
- Prendre la structure de `ArtifactPanel.tsx` comme modèle
- Ajouter des tabs : Files, Code, Terminal, Git
- Files: arbre de fichiers avec `buildFileTree` + `FileTreeNode`
- Code: Monaco Editor avec `Editor` de `@monaco-editor/react`
- Terminal: zone de commandes avec historique
- Git: status, diff, commit, push, pull, branches

### Étape 2: Réécrire `CodePage.tsx`
- Copier la structure exacte de `ChatPanel.tsx`
- Remplacer `ArtifactPanel` par `CodePanel`
- Ajouter un bouton "Code" dans le header (comme "Workspace")
- Ajouter `useCodePanelStore` ou state local pour ouvrir/fermer le panneau code
- Intégrer les fonctionnalités de projet (ouvrir, créer, récents)

### Étape 3: Intégration
- Quand un projet est ouvert, le panneau code s'affiche automatiquement
- Le bouton "Code" dans le header toggle le panneau
- Les messages du chat peuvent inclure des code blocks avec bouton "Open in Editor"
- Les actions de l'agent (Read, Write, Execute) interagissent avec le panneau code

### Étape 4: Tests
- Vérifier que la compilation passe
- Vérifier que le HMR fonctionne
- Vérifier que toutes les fonctionnalités code sont accessibles
