

# Plan de diagnostic et correction des erreurs de build

## Problemes identifies

4 erreurs TypeScript a corriger :

### 1. `ChatPanel.tsx` ligne 547 - Type `role: string` au lieu de `role: 'user' | 'assistant' | 'system'`
Les messages construits manuellement (lignes 520-531) utilisent `{ role: 'user', content: ... }` sans typage explicite, ce qui infere `string` au lieu du type union attendu par `ChatMessage`.

**Fix** : Typer le tableau `messages` comme `ChatMessage[]` avec l'import correspondant.

### 2. `SidebarToolStatus.tsx` ligne 38 - `desktop_commander` absent de `HealthResponse`
Le composant accede a `backendHealth?.available_tools?.desktop_commander` mais `HealthResponse` ne declare pas cette propriete comme obligatoire dans le type (elle est optionnelle avec `?`). L'erreur vient du fait que `backendHealth` est type comme `HealthResponse` et le composant accede aussi a `backendHealth?.desktop_commander` (ligne 39) qui n'existe pas du tout dans l'interface.

**Fix** : Ajouter `desktop_commander?: { enabled?: boolean }` a `HealthResponse` et s'assurer que `available_tools.desktop_commander` est bien declare (il l'est deja avec `?`). Le probleme est sur la ligne 39 qui accede a `backendHealth.desktop_commander` directement - ajouter cette propriete au type.

### 3. `desktop-commander-intents.ts` lignes 483, 518, 545 - Cast `as Record<string, unknown>` invalide
Les types `DCSearchResult`, `DCCommandResult`, `DCSystemInfoResult` ne sont pas compatibles avec `Record<string, unknown>` directement.

**Fix** : Utiliser un double cast `as unknown as Record<string, unknown>` sur les 3 lignes.

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `src/components/ChatPanel.tsx` | Importer `ChatMessage`, typer le tableau `messages` |
| `src/lib/api.ts` | Ajouter `desktop_commander?: { enabled?: boolean }` a `HealthResponse` |
| `src/lib/desktop-commander-intents.ts` | 3x remplacer `as Record<string, unknown>` par `as unknown as Record<string, unknown>` |

## Impact
Aucun changement fonctionnel - uniquement des corrections de types TypeScript pour que le build passe proprement.

