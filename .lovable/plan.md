# Plan : Architecture "Online + Local" style Claude.ai (adaptée à l'existant)

## Constat

Le projet dispose déjà de la majorité de l'architecture demandée :

| Demande du prompt | État actuel |
|---|---|
| `backendService` / polling santé | `useStore.syncBackendHealth` + `RuntimeSync` dans `App.tsx` (poll 15s/60s) |
| `useBackendStatus` hook | `useStore((s) => s.backendOnline)` |
| Indicateur statut backend | `SidebarToolStatus` + `SidebarModeSwitch` |
| Banner backend offline | `BackendOfflineOverlay` |
| Service IA streaming | `chatDirect()` dans `src/lib/api.ts` (déjà SSE multi-provider) |
| System prompt adaptatif online/local | `buildChatSystemPrompt({ backendOnline })` dans `system-prompt.ts` |
| Settings clés API | `SettingsModal` + `ProviderConfigModal` (localStorage) |
| Variables `VITE_*` | `.env.example` présent |
| Multi-provider (Anthropic/OpenAI/DeepSeek/Google/Mistral/Groq/Qwen/Ollama) | Déjà dans `normalizeModel` |

Recréer `backendService.ts`, `aiService.ts`, `config/index.ts`, `BackendStatusIndicator`, `LocalConnectionBanner`, `SettingsPanel`, `useBackendStatus`, `useApiKeys` **dupliquerait** la logique existante et casserait l'intégration avec `useStore`, `chatDirect`, `SidebarToolStatus`. Mauvaise idée.

## Ce qui manque réellement (et qui vaut la peine)

Trois éléments du prompt ne sont PAS encore présents et apportent une vraie valeur :

1. **Compact `BackendStatusIndicator` chip** dans `TopNavBar` — chip animé "Mode en ligne" / "Local connecté" / "Connexion…" (l'existant `SidebarToolStatus` est riche mais caché dans la sidebar ; un chip top-bar aligne avec Claude.ai).
2. **`LocalConnectionBanner` dismissible** non-bloquant — `BackendOfflineOverlay` actuel est un overlay plein écran ; le prompt propose une bannière fine en haut avec commande copiable, pour ne pas bloquer le mode online pur.
3. **Filtrage explicite des outils filesystem côté frontend** quand `backendOnline=false` — vérifier que `chatDirect` ne propose AUCUN outil filesystem/shell au modèle quand le backend est offline (le system prompt le fait déjà via `buildChatSystemPrompt`, mais confirmer pour les tool schemas envoyés à l'API Anthropic native).

## Plan d'implémentation

### 1. Nouveau composant : `src/components/BackendStatusChip.tsx`
- Petit chip 3 états (checking / online-local / online-cloud) basé sur `useStore((s) => ({ backendOnline, backendChecked, backendHealth }))`.
- Dot animé (pulse vert quand local, bleu quand cloud-only).
- Tooltip : "Backend local connecté" / "Mode en ligne — lance le backend pour filesystem/terminal".
- Style aligné Claude desktop (#1a1a1a, bordures fines).

### 2. Nouveau composant : `src/components/LocalConnectionBanner.tsx`
- Bannière dismissible (sessionStorage `agentos_banner_dismissed`).
- S'affiche uniquement si `backendChecked && !backendOnline && !dismissed`.
- Bouton copier la commande : `python -m uvicorn backend.app.main:app --port 8000` (commande réelle du projet, pas `npx agentos-backend`).
- Bouton "Ouvrir guide" → ouvre `SETUP-ET-DEMARRER.ps1` README.
- N'interfère PAS avec `BackendOfflineOverlay` (qui ne s'affiche que pour les actions agent nécessitant le backend).

### 3. Intégration dans `TopNavBar`
- Ajouter `<BackendStatusChip />` à droite des liens de navigation.
- Ajouter `<LocalConnectionBanner />` au-dessus du contenu principal dans `Welcome`, `Dashboard`, `CodePage`, `CoworkPage` (via un layout shared ou injection directe).

### 4. Audit & filtrage outils dans `src/lib/api.ts`
- Dans `chatDirect`, vérifier le bloc qui construit `tools: ToolSchema[]` envoyé à l'API.
- S'assurer que quand `backendOnline === false`, on retire les tools `file_*`, `shell`, `desktop_commander_*`, `git_*` du payload (pas seulement du prompt système).
- Conserver les tools "purs" (web_search, artifact_create) qui marchent sans backend.

### 5. Documentation rapide
- Mettre à jour `README.md` avec la section "Mode en ligne vs local" (3 paragraphes).

## Ce qui n'est PAS fait (et pourquoi)

- **Pas de `backendService` / `aiService` séparé** : la logique existe déjà dans `useStore` + `lib/api.ts`. Dupliquer ferait diverger les deux sources de vérité.
- **Pas de `src/config/index.ts`** : `import.meta.env` est utilisé directement et c'est suffisant pour Vite.
- **Pas de `useApiKeys` hook séparé** : `SettingsModal` + `user-config.ts` gèrent déjà le localStorage des clés.
- **Pas de modification du `vite.config.ts`** : le proxy `/api/local` n'est pas nécessaire — `API_BASE_URL` pointe déjà sur `http://localhost:8000` avec CORS côté FastAPI.
- **Pas de `npm install @anthropic-ai/sdk`** : `chatDirect` fait du SSE manuel, pas besoin du SDK officiel (qui ajouterait ~200KB).

## Fichiers impactés

**Nouveaux :**
- `src/components/BackendStatusChip.tsx`
- `src/components/LocalConnectionBanner.tsx`

**Modifiés :**
- `src/components/TopNavBar.tsx` (ajout du chip)
- `src/pages/Welcome.tsx`, `Dashboard.tsx`, `CodePage.tsx`, `CoworkPage.tsx` (ajout du banner — ou wrapper layout)
- `src/lib/api.ts` (filtrage tools selon `backendOnline` dans `chatDirect`)
- `README.md` (section online/local)

## Détails techniques

- Le chip lit `useStore` directement (pas de nouveau hook).
- Le banner utilise `sessionStorage` (pas localStorage) pour réapparaître à chaque session.
- Filtrage tools : ajouter une constante `BACKEND_REQUIRED_TOOLS = new Set(['shell', 'file_read', 'file_write', 'file_edit', 'desktop_commander_*', 'git_*'])` et filtrer le tableau `tools` avant le `fetch` Anthropic/OpenAI.
- Tooltip via shadcn `Tooltip` (déjà importé via `TooltipProvider` dans `App.tsx`).
- Animation pulse via Tailwind `animate-pulse` (pas besoin de framer-motion supplémentaire).