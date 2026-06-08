# Adopter la palette de couleurs Claude AI (Anthropic)

## Objectif
Remplacer la palette actuelle (violet/indigo #7C3AED) par celle de Claude AI : fonds chauds crème/ivoire en clair, ardoise profonde en sombre, et l'accent signature **Claude Orange** (terracotta #C96442 / #D97757).

## Palette cible (Anthropic / Claude.ai)

**Mode sombre (par défaut du projet)**
- Background : `#262624` (ardoise très sombre chaude)
- Surface / card : `#30302E`
- Surface elevated : `#3A3A37`
- Foreground : `#F5F4EE` (ivoire)
- Muted foreground : `#A8A29E` (warm gray)
- Border : `rgba(245,244,238,0.08)`
- **Primary (Claude Orange)** : `#D97757`
- Primary hover : `#C96442`
- Primary muted : `#7A3A2A`

**Mode clair (cohérence)**
- Background : `#FAF9F5` (crème Anthropic)
- Surface : `#FFFFFF`
- Foreground : `#1F1E1D`
- Muted foreground : `#6B6862`
- Border : `rgba(31,30,29,0.10)`
- Primary : `#C96442`

**Sémantiques**
- Success : `#7A9E7E` (sauge), Warning : `#D9A441`, Destructive : `#B5453B` (rouge brique, garde le rouge pour les erreurs)

## Fichiers impactés

1. **`src/index.css`** — réécrire le bloc `:root` (toutes les variables HSL `--background`, `--foreground`, `--primary`, `--primary-*`, `--card`, `--muted`, `--accent`, `--border`, `--ring`, `--surface`, `--success`, `--info`, `--warning`, échelle `--primary-100..900`). La structure des tokens reste identique — seules les valeurs HSL changent. La classe utilitaire `.glow-purple` est renommée en `.glow-primary` (ou conservée comme alias) et son ombre passe à l'orange Claude.

2. **`index.html`** — le `<style>` de boot (favicon SVG violet `#7C3AED`, gradient `app-boot`, `app-boot__logo`) est mis à jour pour utiliser la crème/ardoise + orange Claude, afin que l'écran de chargement matche.

3. **`src/components/StepProgressBar.tsx`** — le gradient inline `hsl(263 84% 58%) → hsl(174 84% 32%)` est remplacé par un gradient orange Claude (`hsl(var(--primary)) → hsl(var(--primary-light))`) pour rester cohérent.

4. **`tailwind.config.ts`** — aucun changement structurel (les classes `primary`, `primary-100..900`, `surface`, etc. lisent déjà les variables CSS). Vérification seulement.

## Hors scope
- Pas de changement de typographie, layout, espacements ou composants.
- Pas de modification des workspaces générés sous `backend/generated_workspaces/*` (sorties d'agent, pas le shell de l'app).
- Pas de logique métier touchée.

## Vérification
- `tsc --noEmit` + lecture visuelle du preview (Dashboard, CodePage, Settings) pour confirmer que plus aucune trace de violet ne subsiste dans le shell.
