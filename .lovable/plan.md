# AgentOS Ultra — Mise à jour complète des capacités

Objectif : hisser AgentOS au niveau des assistants les plus récents — modèles à jour avec réflexion réglable, agent réellement autonome, nouveaux outils, et voix/vision temps réel. Tout fonctionne en ligne (sans serveur local) et se renforce quand le serveur local tourne.

## 1. Modèles récents + mode réflexion

- Catalogue unifié : une seule liste de modèles partagée par le chat, le mode Code et le générateur de projets (fin des doublons entre l'ancienne liste et le registre).
- Chaque modèle affiche ses aptitudes : vision, réflexion, contrôle d'écran, taille de contexte.
- Nouveau réglage « Niveau de réflexion » : Désactivé / Rapide / Équilibré / Profond, visible à côté du sélecteur de modèle et mémorisé.
- Le raisonnement s'affiche en direct dans une zone dépliable au-dessus de la réponse, avec le temps de réflexion.
- Sélecteur de modèle qui signale les fournisseurs sans clé configurée, au lieu de basculer silencieusement sur un autre modèle.

## 2. Agent plus autonome

- **Plan puis exécution** : pour toute demande complexe, l'agent propose d'abord un plan en étapes que vous approuvez, modifiez ou lancez directement.
- **Sous-agents parallèles** : les étapes indépendantes (recherche, écriture de fichiers, tests) partent en parallèle, avec un panneau montrant l'avancement de chacune.
- **Reprise après échec** : une étape qui échoue est réessayée avec le message d'erreur en contexte, jusqu'à 2 fois, sans perdre les étapes déjà réussies.
- **Mémoire de projet** : un fichier de contexte par projet (décisions, conventions, structure) relu automatiquement à chaque nouvelle session.
- **Barre d'état d'exécution** : étape courante, étapes restantes, coût/temps écoulé, bouton Arrêter.

## 3. Nouveaux outils

- Recherche web enrichie (résultats cités dans la réponse) et lecture d'une page à la demande.
- Lecture de documents : PDF, images, feuilles de calcul, texte — déposés dans le chat et compris par le modèle.
- Génération d'images depuis le chat, rendue comme un artefact ré-utilisable.
- Exécution de code Python/JS avec sortie affichée (sandbox local quand le serveur tourne).
- Écriture/lecture de fichiers et terminal : conservés, mais regroupés avec confirmation obligatoire pour les actions destructives.
- Panneau « Outils » listant chaque outil, son état (disponible / nécessite le serveur / nécessite une clé) et un interrupteur par outil.

## 4. Voix et vision temps réel (Parlor)

- Conversation vocale continue : détection de fin de parole, interruption possible en parlant par-dessus la réponse.
- Choix de la voix et de la vitesse, transcription affichée en direct.
- Partage d'écran en plus de la caméra, avec envoi d'images à cadence maîtrisée pour rester fluide.
- Mode mains libres : l'agent peut lancer des actions demandées à la voix.

## 5. En ligne et local

- Chaque capacité déclare si elle marche en navigateur seul ou exige le serveur local ; l'interface l'indique clairement au lieu d'échouer.
- Les outils fichiers/terminal/sandbox s'activent automatiquement dès que le serveur local est détecté, et se désactivent proprement sinon.

## Détails techniques

- **Registre modèles** : `src/agent/core/registry.py` devient la source unique ; ajout des champs `reasoning_levels`, `supports_tools`, `input_modalities`. `backend/app/services/model_catalog.py` est réduit à un adaptateur (suppression de `_MODELS`). Exposition via `/models` avec les capacités.
- **Réflexion** : mapping niveau → `thinking.budget_tokens` (Anthropic), `reasoning_effort` (OpenAI), équivalent Gemini/DeepSeek. Passé de bout en bout : ModelSelector → `resolveModelId` (`src/lib/model-guard.ts`) → `/chat` et `browser-providers.ts`. Blocs `thinking` diffusés en SSE comme événements dédiés et rendus par `ChatMessage`.
- **Orchestration** : `src/agent/core/orchestrator.py` gagne un mode planificateur (plan structuré → validation → exécution), `asyncio.gather` borné pour les étapes parallèles, et une politique de retry par outil. `backend/app/services/subagents.py` sert de pool d'exécution ; `agentic_loop.py` émet des événements `plan`, `step_start`, `step_done`, `step_error`.
- **Outils** : nouveaux schémas dans `backend/app/services/tool_definitions.py` (`fetch_url`, `read_document`, `generate_image`, `run_code`) + implémentations dans `tool_executor.py`/`web.py`. Chaque outil porte un flag `requires_local` filtré selon `capabilities.py`.
- **Mémoire projet** : fichier `AGENTOS.md` par workspace, lu/écrit par `project.py`, injecté dans le prompt système via `prompting.py`.
- **Parlor** : `useParlorSession.ts` étendu (VAD avec seuil adaptatif, barge-in, `getDisplayMedia`, throttle des frames, sélection de voix). UI dans `src/pages/ParlorPage.tsx`.
- **Front** : panneau Outils et réglage réflexion dans les Réglages ; `useStore` stocke `reasoningLevel`, `enabledTools`, `capabilities`. Aucune régression sur le health check / backoff / reprise déjà en place.
- **Tests** : registre cohérent front/back, mapping des niveaux de réflexion par fournisseur, exécution parallèle avec une étape en échec, filtrage des outils hors ligne, et le test multi-fichiers existant conservé.

## Ordre de livraison

1. Registre unifié + réflexion réglable et affichée.
2. Plan & exécution, sous-agents parallèles, reprise après échec, mémoire projet.
3. Nouveaux outils + panneau Outils avec états en ligne/local.
4. Parlor : voix continue, barge-in, partage d'écran.
