import type { IntentAnalysis, IntentCategory, ResponseType } from './types';

// ── Patterns de détection ───────────────────────────────────

const PATTERNS = {
  // Création web / visuel
  create_web: [
    /\b(crée|génère|fais|construit|développe|code|écris)\b.{0,40}\b(jeu|game|app|application|page|site|web|html|interface|formulaire|form|outil|tool|calculatrice|calculator|timer|horloge|clock|snake|tetris|quiz|dashboard)\b/i,
    /\b(html|css|javascript|react|animation|interactif|interactive)\b/i,
    /\blandingpage\b|\blanding page\b/i,
  ],

  // Création de document
  create_doc: [
    /\b(écris|rédige|génère)\b.{0,30}\b(article|rapport|guide|documentation|readme|email|lettre|cv|resume|essay|dissertation|plan|outline)\b/i,
    /\b(markdown|document|rapport|guide|tutoriel)\b/i,
  ],

  // Code snippet
  create_code: [
    /\b(écris|code|implémente|montre).{0,30}\b(fonction|function|algorithme|algorithm|classe|class|script|snippet|exemple|example)\b/i,
    /\ben (python|typescript|javascript|rust|go|java|php|ruby|swift|kotlin)\b/i,
    /comment (faire|implémenter|coder).{0,40}(en|avec)\b/i,
  ],

  // Explication
  explain: [
    /\b(explique|c'est quoi|qu'est.ce que|comment fonctionne|how does|what is|pourquoi|why|définition|definition)\b/i,
    /\b(aide.moi à comprendre|help me understand|tell me about|parle.moi de)\b/i,
  ],

  // Comparaison
  compare: [
    /\b(compare|comparaison|différence|versus|vs\.?|lequel est mieux|which is better|avantages? et inconvénients?|pros? and cons?)\b/i,
    /\b(entre .+ et .+|between .+ and .+)\b/i,
  ],

  // Données / chiffres
  analyze_data: [
    /\b(données|data|statistiques|stats|chiffres|numbers|analyse|analyze|graphique|chart|graph|visualise|plot)\b/i,
    /\b(\d+%|\d+\s*(dollars?|euros?|usd|eur)|\d+\s*(millions?|billions?))\b/i,
    /\b(tendance|trend|évolution|croissance|growth|performance|KPI)\b/i,
  ],

  // Actions système
  system_action: [
    /\b(crée le fichier|écris dans le fichier|modifie le fichier|supprime|déplace|renomme)\b/i,
    /\b(exécute|lance|run|installe|install|npm|pip|git|commit|push|build)\b/i,
    /\b(terminal|powershell|cmd|bash|commande)\b/i,
  ],

  // Brainstorm / plan
  brainstorm: [
    /\b(brainstorm|idées|ideas|plan|stratégie|strategy|comment je peux|how can i|possibilités|options)\b/i,
    /\b(aide.moi à planifier|help me plan|quelles sont les|what are the)\b/i,
  ],

  // Debug
  debug: [
    /\b(bug|erreur|error|problème|problem|ne fonctionne pas|doesn't work|crash|exception|fix|répare|corrige)\b/i,
    /\b(pourquoi ça marche pas|why (is|isn't|doesn't|won't))\b/i,
  ],

  // Refactor
  refactor: [
    /\b(refactor|réorganise|améliore|optimise|nettoie|clean up|restructure|rends.le meilleur)\b/i,
    /\b(peut.on améliorer|how can (we|I) improve)\b/i,
  ],
};

// ── Auto-triggers (déclenchement sans demande explicite) ────

function shouldAutoTriggerChart(message: string, conversationContext?: string[]): boolean {
  const text = [message, ...(conversationContext ?? [])].join(' ').toLowerCase();

  // Présence de données numériques comparables
  const hasNumbers = (text.match(/\d+/g) ?? []).length >= 3;
  const hasComparisons = /tendance|croissance|evolution|pourcentage|comparaison|vs\.?|versus|plus que|moins que|augmente|diminue/.test(text);
  const hasDataKeywords = /données|statistiques|chiffres|résultats|performance|ventes|revenus|utilisateurs/.test(text);

  return hasNumbers && (hasComparisons || hasDataKeywords);
}

function shouldAutoTriggerMindmap(message: string, responseLength?: number): boolean {
  // Si la question porte sur un concept multidimensionnel
  const isConceptual = /\bcomment fonctionne\b|\barchitecture\b|\bécosystème\b|\bstratégie\b|\bplan\b|\bbrainstorm\b|\bvue d'ensemble\b|\boverview\b/i.test(message);

  // Si la réponse attendue a plusieurs dimensions
  const isMultiDimensional = /\bd'abord.+ensuite.+enfin\b|\bpremièrement.+deuxièmement\b|\b(1\.|2\.|3\.|4\.)\b/i.test(message);

  // Si le sujet est abstrait et complexe
  const isComplex = message.split(' ').length > 8 && isConceptual;

  return isComplex || isMultiDimensional;
}

// ── Détection principale ─────────────────────────────────────

export function detectIntent(
  message: string,
  conversationHistory?: string[],
  backendOnline?: boolean
): IntentAnalysis {
  const reasons: string[] = [];
  let category: IntentCategory = 'question' as IntentCategory;
  let responseType: ResponseType = 'text' as ResponseType;
  let artifactType: string | undefined;
  let artifactTitle: string | undefined;
  let artifactLanguage: string | undefined;
  let confidence = 0.5;

  const msg = message.toLowerCase();

  // ── Priorité 1 : Actions système (si backend disponible) ──
  if (backendOnline && PATTERNS.system_action.some(p => p.test(msg))) {
    category = 'system_action';
    responseType = 'tool_calls';
    confidence = 0.9;
    reasons.push('Action système détectée + backend disponible');
  }

  // ── Priorité 2 : Création web ─────────────────────────────
  else if (PATTERNS.create_web.some(p => p.test(msg))) {
    category = 'create_web';
    responseType = 'artifact_html';
    artifactType = 'html';
    artifactLanguage = 'html';
    confidence = 0.9;

    // Détecte le titre depuis le message
    const gameMatch = msg.match(/\b(jeu|game)\b.{0,20}(\w+)/i);
    const appMatch = msg.match(/\b(app|application|outil|tool)\b.{0,20}(\w+)/i);
    artifactTitle = gameMatch ? `Jeu ${gameMatch[2]}` : appMatch ? `App ${appMatch[2]}` : 'Web App';

    // React si explicitement demandé
    if (/\breact\b|\bjsx\b/.test(msg)) {
      responseType = 'artifact_react';
      artifactType = 'react';
      artifactLanguage = 'jsx';
    }

    reasons.push('Création de contenu web détectée');
  }

  // ── Priorité 3 : Document long ────────────────────────────
  else if (PATTERNS.create_doc.some(p => p.test(msg))) {
    category = 'create_doc';
    responseType = 'artifact_md';
    artifactType = 'markdown';
    artifactLanguage = 'md';
    confidence = 0.85;
    reasons.push('Création de document détectée');
  }

  // ── Priorité 4 : Code court ───────────────────────────────
  else if (PATTERNS.create_code.some(p => p.test(msg))) {
    category = 'create_code';
    responseType = 'code_block';
    confidence = 0.8;

    // Si le code est probablement long → artifact
    if (/classe|class|module|complet|full|entire|tout le|whole/.test(msg)) {
      responseType = 'artifact_js';
      artifactType = 'javascript';
      artifactLanguage = 'js';
    }
    reasons.push('Création de code détectée');
  }

  // ── Priorité 5 : Comparaison → Table ─────────────────────
  else if (PATTERNS.compare.some(p => p.test(msg))) {
    category = 'compare';
    responseType = 'table';
    confidence = 0.85;
    reasons.push('Comparaison détectée → tableau');
  }

  // ── Priorité 6 : Données → Chart ─────────────────────────
  else if (PATTERNS.analyze_data.some(p => p.test(msg))) {
    category = 'analyze_data';
    responseType = 'chart';
    confidence = 0.8;
    reasons.push('Données/statistiques détectées → graphique');
  }

  // ── Priorité 7 : Brainstorm → Mindmap ────────────────────
  else if (PATTERNS.brainstorm.some(p => p.test(msg))) {
    category = 'brainstorm';
    responseType = 'mindmap';
    confidence = 0.75;
    reasons.push('Brainstorm détecté → carte mentale');
  }

  // ── Priorité 8 : Debug ────────────────────────────────────
  else if (PATTERNS.debug.some(p => p.test(msg))) {
    category = 'debug';
    responseType = 'mixed'; // Explication + code corrigé
    confidence = 0.8;
    reasons.push('Debug détecté → explication + code');
  }

  // ── Priorité 9 : Explication complexe → Mindmap auto ─────
  else if (PATTERNS.explain.some(p => p.test(msg))) {
    category = 'explain';
    responseType = 'text';
    confidence = 0.7;
    reasons.push('Explication détectée');
  }

  // ── Détection de longueur ─────────────────────────────────
  const wordCount = message.split(' ').length;
  const suggestedLength =
    wordCount <= 5 ? 'short' :
    wordCount <= 15 ? 'medium' : 'long';

  // ── Auto-triggers ─────────────────────────────────────────
  const autoTriggerChart = responseType === 'text' &&
    shouldAutoTriggerChart(message, conversationHistory);

  const autoTriggerMindmap = responseType === 'text' &&
    shouldAutoTriggerMindmap(message);

  if (autoTriggerChart) {
    reasons.push('AUTO: données numériques détectées → chart automatique');
  }
  if (autoTriggerMindmap) {
    reasons.push('AUTO: concept multidimensionnel → mindmap automatique');
  }

  // ── Ton ───────────────────────────────────────────────────
  const suggestedTone: 'formal' | 'casual' | 'technical' =
    (category === 'create_code' || category === 'debug' || category === 'refactor') ? 'technical' :
    /\b(salut|hey|allo|bonjour|hi|hello|lol|haha)\b/i.test(msg) ? 'casual' : 'formal';

  return {
    category,
    responseType,
    artifactType,
    artifactTitle,
    artifactLanguage,
    confidence,
    autoTriggerChart,
    autoTriggerMindmap,
    reasons,
    suggestedLength,
    suggestedTone,
  };
}
