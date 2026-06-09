## Objectif
Transformer le mode Code pour qu’une demande comme “crée-moi un site moderne” lance directement une génération complète de projet, façon Claude Code / Lovable / Codex, au lieu de créer un seul fichier puis s’arrêter.

## Plan

1. **Corriger le déclenchement “one prompt”**
   - Prioriser la détection de création de site/app avant les intentions simples Desktop Commander.
   - Lancer automatiquement le générateur de projet sans demander une confirmation intermédiaire.
   - Si le backend local est offline, afficher une erreur claire avec l’action à faire, au lieu de tomber vers une création de fichier simple.

2. **Corriger le bug d’auto-start du générateur**
   - Dans `ProjectGeneratorPanel`, utiliser le prompt reçu en paramètre (`initialPrompt`) au lieu de relire un état React potentiellement vide.
   - Envoyer `effectivePrompt` à l’API, pas `prompt.trim()`.
   - Passer le modèle sélectionné au générateur pour que le mode Code utilise bien le modèle choisi.

3. **Renforcer la boucle agentique backend**
   - Améliorer le prompt système “Project Architect” pour imposer plusieurs fichiers minimum selon le type de projet : preview, source, styles, README, config si nécessaire.
   - Éviter les générations “un seul fichier” sauf si l’utilisateur demande explicitement un fichier unique.
   - Demander à l’agent de créer, vérifier, puis finaliser le projet avec un aperçu utilisable.

4. **Sécuriser le workspace de génération**
   - Forcer les commandes et fichiers générés à rester dans le dossier workspace du projet généré.
   - Corriger l’injection de répertoire de travail pour `bash_tool`, afin que les commandes ne créent pas des fichiers ailleurs sur le PC.
   - Ajouter un fallback multi-fichiers plus utile si le modèle ou la clé API échoue.

5. **Améliorer le retour visuel dans le mode Code**
   - Ajouter dans le chat/log une entrée claire : analyse, création des fichiers, vérification, workspace prêt.
   - Ouvrir automatiquement l’aperçu du workspace généré quand la génération se termine.
   - Garder les actions Preview / Code / Files disponibles juste après la génération.

## Résultat attendu
Après modification, une seule demande comme “crée un website moderne pour un restaurant” doit lancer directement une génération complète, créer plusieurs fichiers dans un workspace, afficher la progression, puis ouvrir l’aperçu du site généré.