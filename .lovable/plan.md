

# Plan : Aligner la page Code sur l'architecture Claude Code

## Analyse de l'existant

La page Code actuelle (1025 lignes) dispose deja de :
- Explorateur de fichiers, editeur avec diff/split/preview
- Terminal simule, chat de code, repos GitHub, branches
- Layout responsive avec Sheets mobiles

## Ce qui manque par rapport a Claude Code

D'apres la description fournie, Claude Code est un **assistant agentique terminal-first** avec une boucle agentique (contexte -> plan -> execution -> verification). Voici les ecarts :

### 1. Boucle agentique visible dans le chat
Le chat actuel est un simple Q&A. Claude Code montre les **etapes d'execution** : lecture de fichiers, execution de commandes, modifications, tests.

**Modifications dans `CodePage.tsx` (chat section) :**
- Ajouter des types `ActionStep` (read_file, write_file, bash, search, test, think)
- Afficher chaque etape avec icone, statut (running/done/error) et contenu collapsible
- Simuler la boucle agentique : quand l'utilisateur envoie une tache, l'IA genere un plan puis execute les etapes une par une

### 2. CLAUDE.md - Memoire de projet
Claude Code lit un fichier `CLAUDE.md` au debut de chaque session.

**Nouveau composant `src/components/code/ClaudeMdEditor.tsx` :**
- Editeur de fichier CLAUDE.md accessible depuis la sidebar (onglet "Memoire")
- Champs : stack technique, conventions, instructions recurrentes
- Persiste dans localStorage

### 3. Systeme de permissions & checkpoints
Claude Code demande l'approbation avant les actions sensibles et permet de revenir en arriere.

**Modifications dans `CodePage.tsx` :**
- Ajouter un systeme de "checkpoints" : avant chaque modification de fichier, afficher un diff avec Accepter/Rejeter
- Bouton "Undo" global pour revenir au dernier checkpoint
- Indicateur de permissions dans la toolbar (auto-accept toggle deja present, l'enrichir)

### 4. Terminal connecte a l'agent
Le terminal actuel est decoratif. Claude Code execute vraiment des commandes.

**Modifications dans le terminal :**
- Quand l'IA decide d'executer une commande, l'afficher dans le terminal automatiquement
- Lier les sorties terminal au chat (l'IA voit les resultats)
- Ajouter des commandes agent : `/plan`, `/undo`, `/context`

### 5. Sous-agents (Task tool)
Claude Code decompose le travail en sous-taches paralleles.

**Nouveau composant `src/components/code/SubAgentPanel.tsx` :**
- Panneau montrant les sous-taches actives
- Chaque sous-tache a son propre contexte et statut
- Accessible depuis la toolbar

### 6. LSP & recherche semantique (simulation)
Claude Code utilise LSP pour naviguer le code.

**Enrichir l'explorateur de fichiers :**
- Ajouter "Go to definition", "Find references" dans le menu contextuel des fichiers
- Recherche globale dans le codebase (deja partiellement present avec le champ recherche)

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `src/pages/CodePage.tsx` | Refonte du chat avec action steps, terminal connecte, checkpoints, permissions |
| `src/components/code/ClaudeMdEditor.tsx` | Creer - Editeur CLAUDE.md (memoire de projet) |
| `src/components/code/SubAgentPanel.tsx` | Creer - Panneau de sous-agents |
| `src/components/code/AgentActionStep.tsx` | Creer - Composant d'affichage d'etape agentique |

## Ordre d'implementation

1. Creer `AgentActionStep.tsx` - composant reutilisable pour les etapes
2. Refondre le chat dans `CodePage.tsx` avec la boucle agentique
3. Connecter le terminal aux actions de l'agent
4. Creer `ClaudeMdEditor.tsx` et l'integrer dans la sidebar
5. Creer `SubAgentPanel.tsx` et l'ajouter a la toolbar
6. Ajouter le systeme de checkpoints/undo

## Detail technique

Les etapes agentiques seront simulees avec des delais (`setTimeout`) pour reproduire l'experience visuelle de Claude Code. L'IA genere toujours ses reponses via `chatDirect`, mais le rendu affiche les actions intermediaires (lecture de fichier, commande shell, modification) avant la reponse finale.

