# Vérification de la configuration « génération complète »

## ✅ Ce qui est correctement en place

**Frontend (`src/pages/CodePage.tsx`)**
- `handleSend` détecte une demande de création (`shouldUseProjectGenerator`) et lance directement `ProjectGeneratorPanel` avec `autoStart=true` et `initialPrompt=text`. ✔
- Toast d'erreur clair si le backend est offline (pas de blocage silencieux). ✔
- Auto-reset de `autoStart` à la fermeture. ✔

**Panneau (`src/components/ProjectGeneratorPanel.tsx`)**
- `useEffect` d'auto-start déclenche la génération une seule fois (`autoStartedRef`). ✔
- `handleGenerate` accepte un `overridePrompt` et utilise `effectivePrompt`. ✔

**Backend (`backend/app/services/project_generator.py`)**
- System prompt renforcé : interdiction du « un seul fichier », exige `preview/index.html` + styles + script + `docs/README.md` + configs. ✔
- `MAX_GENERATION_ITERATIONS = 30` (assez pour un projet complet). ✔
- `_inject_workspace_cwd` préfixe chaque commande shell par `cd "<workspace>"` pour confiner les écritures. ✔
- Route `POST /project/generate` (SSE) accepte `prompt`, `model`, `title` et stream les events `phase / text / tool_call / tool_result / file_created / workspace`. ✔

**Client API (`src/lib/api.ts`)**
- `generateProject` parse correctement les `data:` SSE et résout sur l'event `workspace`. ✔

## ⚠️ Deux petits problèmes restants à corriger

### 1. L'auto-start ne passe pas le prompt en argument
`ProjectGeneratorPanel.tsx` (≈ ligne 247) appelle `handleGenerate()` sans argument après `setPrompt(initialPrompt)`. Le `setTimeout(50ms)` est fragile : si React n'a pas flushé, `effectivePrompt = prompt.trim()` peut être vide → génération avortée silencieusement.
→ **Correctif** : `handleGenerate(initialPrompt)` (le param `overridePrompt` existe déjà).

### 2. Le modèle sélectionné dans le CodePage n'est pas transmis
`generateProject({ prompt })` n'envoie jamais le `selectedModel`. Le backend retombe toujours sur `claude-sonnet-4-6` → impose `ANTHROPIC_API_KEY`, et ignore le choix de l'utilisateur (DeepSeek, GPT, Gemini…).
→ **Correctif** : passer `{ prompt: text, model: selectedModel }` depuis `CodePage.handleSend`, et utiliser ce model dans le panneau.

## 🔴 Pré-requis runtime (hors code)

Le preview cloud ne peut **pas** joindre `localhost:8000` — c'est attendu. Pour tester la génération complète :
1. Lancer `start-backend.bat` sur la machine locale (FastAPI sur `:8000`).
2. Renseigner au moins une clé API dans `backend/.env` (`ANTHROPIC_API_KEY` recommandé pour le défaut, ou `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `GOOGLE_API_KEY` selon le modèle).
3. Ouvrir le frontend depuis `localhost` (ou tunnel) pour que le navigateur joigne `localhost:8000`.

## Plan d'action

```text
1. ProjectGeneratorPanel.tsx       → handleGenerate(initialPrompt)
2. CodePage.tsx (handleSend)       → ajouter model: selectedModel à generateProject
3. ProjectGeneratorPanel + api.ts  → propager le champ model dans ProjectGenerateRequest
```

Aucun changement backend nécessaire — la route accepte déjà `model`.
