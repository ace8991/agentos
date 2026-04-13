

# Plan : Reproduire le fonctionnement de Claude Cowork

## Contexte

L'utilisateur a fourni une description exhaustive de Claude Cowork d'Anthropic. L'objectif est d'aligner notre page Cowork sur ces fonctionnalites : chat agentique avec execution visible, projets persistants, dispatch/taches planifiees, connecteurs MCP, et computer use.

## Ce qui existe deja et fonctionne

- Sidebar Cowork avec menu (Nouvelle tache, Rechercher, Programme, Projets, Dispatch, Idees, Personnaliser)
- Chat avec artifacts (split-view)
- DispatchPanel avec CRUD de taches planifiees
- ProjectsPanel basique (creation/liste)
- MCPPanel (serveurs MCP)
- ExtensionsMarketplace
- TopNavBar avec Chat/Cowork/Code

## Ce qui manque pour correspondre a Claude Cowork

### 1. Chat agentique avec etapes visibles
Le chat actuel envoie des messages et affiche la reponse. Il faut montrer les **etapes d'execution** comme Claude Cowork : "Lecture du fichier...", "Analyse en cours...", "Creation du document...", avec indicateurs visuels (icones, spinners, statuts).

**Modifications :**
- `CoworkChatView.tsx` : Ajouter un systeme d'**action steps** affiches dans le chat (phase thinking, file read, file write, search, etc.) avec animations
- Ajouter un mode "plan & approve" : Claude montre son plan, l'utilisateur approuve avant execution
- Afficher les fichiers crees/modifies en tant qu'artifacts cliquables dans le panneau droit

### 2. Acces aux fichiers locaux (simulation)
Claude Cowork lit/ecrit dans les dossiers locaux. Nous simulons cela avec un **file browser** integre.

**Modifications :**
- `CoworkChatView.tsx` : Ajouter un bouton "Attacher un dossier" dans l'input qui ouvre un selecteur de fichiers
- Afficher les fichiers du projet dans le contexte du chat
- Les actions de l'agent sur les fichiers sont loggees et visibles

### 3. Projets persistants avec contexte
Les projets Claude ont fichiers, instructions et memoire.

**Modifications :**
- `ProjectsPanel.tsx` : Refonte avec vue detail par projet (fichiers, instructions, memoire, taches liees)
- Ajouter `instructions` et `memory` aux projets
- Permettre d'ouvrir un chat dans le contexte d'un projet (les fichiers du projet sont automatiquement fournis a l'IA)

### 4. Dispatch depuis mobile (envoi de taches)
Claude permet d'envoyer une tache depuis le telephone.

**Modifications :**
- `DispatchPanel.tsx` : Ajouter un champ "Envoyer une tache a l'agent" en haut du panneau
- Les taches dispatch sont executees par le chat agentique
- Historique des executions avec statut (en cours, termine, erreur)

### 5. Computer Use (simulation visuelle)
Claude peut controler l'ecran. Nous affichons les actions desktop dans le chat.

**Modifications :**
- `CoworkChatView.tsx` : Quand l'agent utilise des outils desktop (click, type, scroll), afficher un **screenshot simulee** ou une representation visuelle de l'action
- Lier avec le `desktop-commander` existant du backend

### 6. Sidebar avec conversations recentes fonctionnelles
Les taches recentes dans la sidebar doivent ouvrir la conversation correspondante.

**Modifications :**
- `CoworkSidebar.tsx` : Stocker les conversations Cowork dans le store, cliquer sur un recent charge la conversation
- Ajouter un store `coworkStore` ou etendre `useStore` avec `coworkConversations`

## Fichiers a modifier

| Fichier | Changement |
|---------|-----------|
| `src/components/cowork/CoworkChatView.tsx` | Refonte majeure : action steps, plan & approve, file context, computer use visuel |
| `src/components/cowork/ProjectsPanel.tsx` | Vue detail projet avec fichiers, instructions, memoire |
| `src/components/cowork/DispatchPanel.tsx` | Champ envoi de tache + historique d'execution |
| `src/components/cowork/CoworkSidebar.tsx` | Conversations recentes fonctionnelles, contexte projet actif |
| `src/pages/CoworkPage.tsx` | Gestion du contexte projet actif, passage au chat avec contexte |
| `src/store/useStore.ts` | Ajouter `coworkConversations`, `activeProject` au store |

## Ordre d'implementation

1. Etendre le store avec les conversations et projets Cowork
2. Refondre le chat agentique avec action steps visibles
3. Refondre les projets avec vue detail
4. Ameliorer le dispatch avec envoi de taches
5. Connecter la sidebar aux conversations
6. Polish responsive mobile

