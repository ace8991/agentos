# Backoff du health check + reprise automatique de la requête

## Objectif

1. Quand le backend est hors ligne, arrêter de sonder `/health` toutes les 2,5 s : passer à 5 s, puis 10 s (backoff), et revenir immédiatement à 2,5 s dès qu'il répond.
2. Quand une requête chat a été coupée par une panne backend, la relancer automatiquement dès le retour en ligne, sans que l'utilisateur ait à retaper son message.

## 1. Backoff exponentiel du polling

Aujourd'hui `RuntimeSync` (`src/App.tsx`) relance `syncBackendHealth()` toutes les 2 500 ms en continu, en ligne comme hors ligne.

- Paliers : 2 500 ms (en ligne) → 5 000 ms → 10 000 ms (plafond) après échecs consécutifs.
- Retour immédiat à 2 500 ms au premier succès.
- L'anti-flicker existant reste inchangé : `backendOnline` ne passe à `false` qu'après 2 échecs consécutifs (`healthFailureStreak` dans `src/store/useStore.ts`).
- Le délai courant est calculé à partir du nombre d'échecs consécutifs exposé par le store, pas d'un compteur local dupliqué.
- Un retour anticipé au palier rapide est déclenché quand l'onglet redevient visible (`visibilitychange`) ou que le navigateur repasse `online`, pour ne pas attendre 10 s après un réveil.
- La boucle runtime/mobile hub (30 s) n'est pas modifiée.

## 2. Reprise automatique de la requête interrompue

- Quand un flux chat est interrompu par une panne (callback `onStreamAborted` déjà présent dans `ChatPanel`), on mémorise la requête en attente : messages construits, modèle, effort de raisonnement, préférence recherche web, et l'`id` de l'entrée assistant marquée en erreur.
- Le message d'erreur affiché devient explicite : « Backend hors ligne — reprise automatique dès le retour en ligne » avec un bouton *Reprendre maintenant* et un bouton *Annuler la reprise*.
- Dès que `backendOnline` repasse à `true` (surveillé via le store), la requête mémorisée est relancée automatiquement :
  - l'entrée en erreur est réutilisée et remise à l'état `result` vide (pas de doublon dans le fil) ;
  - le buffer partiel précédent est jeté (aucun rendu partiel, conformément au comportement déjà en place) ;
  - la requête est renvoyée telle quelle depuis le début (les modèles ne permettent pas de reprendre un flux à mi-parcours) — c'est la reprise de la *requête*, pas du flux d'octets.
- Garde-fous : une seule reprise automatique par requête (si elle échoue à nouveau, on reste en erreur avec le bouton manuel), pas de reprise si l'utilisateur a déjà envoyé un nouveau message entre-temps, et annulation de la reprise au changement de conversation.

## Détails techniques

- `src/App.tsx` : la boucle health calcule son prochain délai via une fonction `nextHealthDelay(failureStreak)` (2500 / 5000 / 10000) ; ajout des écouteurs `visibilitychange` et `online` pour forcer un probe immédiat.
- `src/store/useStore.ts` : exposer `healthFailureStreak` dans l'état (aujourd'hui variable de module) afin que le calcul du backoff et les composants puissent le lire.
- `src/components/ChatPanel.tsx` : nouveau `pendingResumeRef` (payload + `assistantId` + drapeau `attempted`), extraction de l'appel `chatDirect` existant dans une fonction `runChatRequest(payload, assistantId)` réutilisée par l'envoi initial et par la reprise, plus un `useEffect` qui déclenche la reprise sur transition offline → online.
- Aucun changement backend : `/health` est déjà en place.
