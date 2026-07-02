# Plan — Robustesse backend, traçabilité modèle, garde-fous génération

## 1. Health check bi-directionnel + gate de génération

**Backend** (`backend/app/routes/health.py`)
- Enrichir la réponse `/health` avec :
  - `providers_configured`: dict `{anthropic, openai, deepseek, mistral, groq}` = booléen selon `runtime_config.get_runtime_value`
  - `project_generator_ready`: booléen (workspace dir accessible en écriture + au moins une clé provider présente)
  - `version` + `uptime_seconds`

**Frontend**
- `src/store/useStore.ts` : ajouter `backendHealth: HealthPayload | null`, `backendLastCheck: number`, remplir depuis `syncBackendHealth`.
- `src/components/ProjectGeneratorPanel.tsx` : avant `startGeneration`, appeler un helper `assertBackendReady()` qui :
  1. Force un refresh `/health` (bypass du cache 15s)
  2. Bloque avec un toast explicite si `backendOnline=false` OU `project_generator_ready=false` OU la clé du provider du modèle sélectionné manque
  3. Affiche un état "En attente du backend…" au lieu de lancer une génération qui s'arrêtera au premier tool_call
- `src/pages/CodePage.tsx` : dans le flux "création de projet détectée", même garde avant d'ouvrir le panneau — si offline, message clair au lieu d'un panneau qui timeout.

## 2. ModelSelector — identifiant modèle cohérent partout

**Audit ciblé** :
- `src/components/ModelSelector.tsx` — source de vérité (déjà branchée sur `registry`).
- `src/lib/api.ts` : `chatDirect`, `chatStream`, `runAgent` — vérifier qu'aucun fallback `|| "claude-sonnet-4-7"` ne masque un id vide.
- `src/pages/CodePage.tsx` — prop `model` de `ProjectGeneratorPanel`.
- `src/components/ProjectGeneratorPanel.tsx` — payload POST `/project/generate`.
- `backend/app/routes/chat.py`, `backend/app/routes/project.py`, `backend/app/services/brain.py`, `backend/app/services/project_generator.py` — s'assurer que l'id reçu est utilisé tel quel (pas de remap silencieux).

**Changements** :
- Introduire `src/lib/model-guard.ts` avec `resolveModelId(id?: string): string` qui :
  - Renvoie l'id si présent dans `registry`
  - Sinon **throw** au lieu de fallback silencieux (le caller gère le toast)
- Appeler `resolveModelId` dans `chatDirect`, `runAgent`, `ProjectGeneratorPanel.startGeneration`, `CodePage` (avant envoi).
- Côté backend, `brain.py` et `project_generator.py` : si le modèle reçu n'est pas dans le registry, renvoyer HTTP 400 avec message explicite au lieu de basculer sur un défaut.

## 3. Journalisation détaillée (modèle, thinking, beta headers)

**Backend**
- `src/agent/providers/anthropic_provider.py` : log INFO structuré à chaque `chat()` :
  ```
  [anthropic] model=claude-opus-4-8 thinking=on(budget=8192) beta=computer-use-2025-01-24,interleaved-thinking-2025-05-14 tools=12
  ```
- `backend/app/services/brain.py` : log identique pour le chemin natif Anthropic + le chemin OpenAI-compat (avec `reasoning_effort` si présent).
- `backend/app/services/project_generator.py` : log de démarrage `[project_generator] model=… workspace=… prompt_chars=…` et un log par tool_call.

**Frontend**
- `src/lib/api.ts` : `console.info("[chat]", { model, endpoint, streaming, thinking })` avant chaque requête, gardé derrière `import.meta.env.DEV || localStorage.getItem("agentos:verbose")`.
- Étendre `SidebarToolStatus` (ou créer `DebugConsole` déjà présent si applicable) pour surfacer les 20 derniers logs de génération en UI (mode dev).

## 4. Test de génération multi-fichiers

**Nouveau test** : `backend/tests/test_project_generator_multifile.py`
- Utilise `unittest.mock.patch` pour stubber le client Anthropic : renvoie une séquence scriptée de tool_use (`str_replace_editor` créant `index.html`, `styles.css`, `script.js`, `README.md`, `package.json`, puis un `bash_tool` finalisation, puis stop).
- Appelle `project_generator.run(prompt="landing page moderne", model="claude-sonnet-4-7")` en mode synchrone (helper de test qui draine le SSE).
- Assertions :
  - Au moins 4 fichiers créés dans le workspace temporaire
  - Présence d'un fichier HTML, un CSS, un JS, un README
  - `workspace.json` contient bien `status="complete"` (pas `error` ni `analyzing`)
  - Le run n'a pas terminé après le 1er tool_call (compteur ≥ 5)
- Ajouter un second test négatif : si le stub renvoie un seul tool_call puis stop, le générateur doit marquer `status="incomplete"` et logger un warning — évite la régression "s'arrête après un fichier".

Mettre à jour `.github/workflows/ci.yml` si un job pytest existe pour inclure ce fichier.

## Détails techniques

- Aucun changement de palette / UI majeure — les toasts réutilisent `use-toast` existant.
- `HealthPayload` typé dans `src/lib/api.ts` et partagé avec le store.
- Les logs backend passent par `logging.getLogger("agentos.<module>")` déjà en place ; niveau INFO par défaut, DEBUG pour le détail tool_call.
- Les tests utilisent `pytest` + `pytest-asyncio` déjà présents dans `requirements.txt` (à vérifier lors du build).

## Fichiers touchés

```text
backend/app/routes/health.py            (enrichir payload)
backend/app/services/brain.py           (logs + validation modèle)
backend/app/services/project_generator.py (logs + garde-fou single-file)
backend/tests/test_project_generator_multifile.py (nouveau)
src/agent/providers/anthropic_provider.py (logs)
src/store/useStore.ts                   (backendHealth)
src/lib/api.ts                          (types + logs + resolveModelId usage)
src/lib/model-guard.ts                  (nouveau)
src/components/ProjectGeneratorPanel.tsx (gate + resolveModelId)
src/pages/CodePage.tsx                  (gate avant ouverture panneau)
```
