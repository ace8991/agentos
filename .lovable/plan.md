# SSE robuste + polling health 2–3 s

## Objectif

Quand le backend tombe pendant un streaming : couper le flux immédiatement, marquer l'app offline, et ne jamais laisser un rendu partiel/orphelin à l'écran. En parallèle, sonder le health check toutes les 2,5 s pour tenir `backendOnline` à jour dans Zustand.

## 1. Polling du health check (2,5 s)

`src/App.tsx` (`RuntimeSync`) sonde aujourd'hui toutes les 15 s (60 s si offline), et rejoue `syncRuntimeConfig` + `getMobileHubState` à chaque tour.

- Séparer les deux boucles : une boucle *health* rapide (2500 ms, en ligne comme hors ligne) qui n'appelle que `syncBackendHealth()`, et une boucle *runtime/mobile hub* lente (30 s) qui garde `syncRuntimeConfig` + `getMobileHubState`.
- Ajouter un timeout court (2 s via `AbortSignal.timeout`) dans `checkHealth` pour que le probe ne se chevauche pas avec l'intervalle.
- Continuer à miroiter l'état sur `window.__agentos_backend_online__` à chaque tick (utilisé par le fast-path direct de `chatDirect`).
- Anti-flicker : ne passer `backendOnline` à `false` qu'après 2 échecs consécutifs ; repasser à `true` dès le premier succès.

## 2. Gestion d'erreur SSE — chat (`chatDirect`, `src/lib/api.ts`)

- Attacher un `AbortController` au `fetch('/chat')` avec un watchdog d'inactivité (si aucun octet reçu pendant ~20 s → abort + erreur explicite).
- Envelopper la boucle `reader.read()` dans un `try/catch` : une coupure réseau en cours de flux déclenche aujourd'hui une exception non gérée. Au catch : fermer le reader, marquer le backend offline (`setBackendOnline(false)`) et appeler `onError`.
- Nouveau callback optionnel `onStreamAborted(partialText)` : si des tokens avaient déjà été émis, le consommateur peut décider (voir §4) ; sinon `onError` seul, sans aucun token émis.
- Après une coupure en plein flux, ne pas tenter le fallback provider direct (risque de réponse dupliquée) : le fallback direct reste réservé au cas où le backend échoue **avant** le premier token.
- Traiter `event.type === 'error'` et `[DONE]` prématuré de façon uniforme : fermer le reader, statut offline si l'erreur est réseau.

## 3. Gestion d'erreur SSE — agent (`createExecutionEventStream`)

- Sur `onerror` définitif (après les 2 tentatives de reconnexion) : appeler `onError('Connection lost')` **et** basculer `backendOnline: false` dans le store, plus déclencher un health check immédiat.
- Protéger `JSON.parse(message.data)` par un `try/catch` (un fragment SSE tronqué fait actuellement crasher le handler).
- Garantir la fermeture de l'`EventSource` dans tous les chemins terminaux.

## 4. Empêcher tout rendu partiel

- Store (`src/store/useStore.ts`) : lorsqu'un flux est interrompu par une panne backend, marquer le message assistant en cours comme `interrupted` au lieu de le laisser tel quel, et vider le contenu partiel s'il est vide/inutilisable.
- UI chat : afficher une bannière « Flux interrompu — backend hors ligne » à la place du texte tronqué, avec bouton *Réessayer* ; ne pas exécuter la détection d'artifact / le parsing de projet sur du contenu incomplet (garde sur `interrupted`).
- Agent : si `status === 'running'` et que le backend passe offline, passer en `error` avec message explicite et arrêter le timer (déjà partiellement fait), sans conserver de steps à moitié écrits.
- Réactiver l'envoi et la génération uniquement quand `backendOnline` redevient `true` (le gate de `ProjectGeneratorPanel` reste inchangé).

## Détails techniques

Fichiers touchés : `src/App.tsx` (boucles de polling), `src/lib/api.ts` (`checkHealth`, `chatDirect`, `createExecutionEventStream`), `src/store/useStore.ts` (compteur d'échecs, marquage `interrupted`, arrêt propre du run), plus le composant de rendu des messages de chat pour la bannière d'interruption. Aucun changement backend requis : `/health` existe déjà et renvoie les capacités.
