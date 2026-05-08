// ============================================================
// SCORE TEXT - Moteur de comptage lexical
// ------------------------------------------------------------
// Prend un texte en entree, le tokenise, le classe par couche,
// et produit les trois metriques de Narrative Drift :
//
//   - densiteConcrete : mots concrets par 1000 mots de texte
//     Baseline sain : >= 30 par 1000 dans une comm business
//     Sous 15 par 1000 : alerte
//
//   - ratioAbstraitConcret : Couche 3 / Couche 1
//     Sain : < 0.3
//     Alerte : > 1.0
//     Drapeau rouge : > 2.0
//
//   - opaciteScore : pourcentage de mots semi-abstraits
//     utilises sans contextualisation chiffree adjacente
//     Sain : < 40%
//     Preoccupant : > 60%
//
// V1 : la regle de contextualisation des semi-abstraits est
// approximative (presence d un nombre dans la meme phrase).
// V2 ajoutera l analyse syntaxique fine via embeddings.
// ============================================================

import {
  CONCRETE_WORDS,
  SEMI_ABSTRACT_WORDS,
  ABSTRACT_WORDS,
  classifyWord,
} from './taxonomy';

export interface NarrativeDriftMetrics {
  totalWords: number;
  concreteCount: number;
  semiAbstractCount: number;
  semiAbstractContextualized: number; // semi-abstraits avec chiffre adjacent
  abstractCount: number;
  unclassifiedCount: number;

  densiteConcrete: number; // par 1000 mots
  ratioAbstraitConcret: number;
  opaciteScore: number; // pourcentage de semi-abstraits non contextualises

  topAbstractWords: Array<{ word: string; count: number }>;
  topConcreteWords: Array<{ word: string; count: number }>;

  verdict: 'sain' | 'attention' | 'alerte' | 'drapeau-rouge';
  rationale: string;
}

/**
 * Tokenise un texte en mots, en preservant les chiffres pour
 * la detection de contextualisation.
 */
function tokenize(text: string): { words: string[]; sentences: string[] } {
  // Normaliser : minuscules, gestion accents
  const normalized = text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  // Decoupe en phrases (approximatif, suffisant pour V1)
  const sentences = normalized
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Decoupe en mots (lettres uniquement, on supprime ponctuation et chiffres)
  // Approche es5 : on retire chiffres et ponctuation specifiquement, on garde
  // les accents francais et anglais courants.
  const words = normalized
    .replace(/[0-9]+/g, ' ')
    .replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^_`{|}~]/g, ' ')
    .split(/\s+/)
    .map(function (w) { return w.replace(/^-+|-+$/g, ''); })
    .filter(function (w) { return w.length >= 2; });

  return { words, sentences };
}

/**
 * Detecte si une phrase contient un chiffre (signal de
 * contextualisation chiffree pour les semi-abstraits).
 */
function sentenceHasNumber(sentence: string): boolean {
  return /\b\d+([.,]\d+)?\s*(%|m|md|k|m\$|me|usd|eur|x)?\b/i.test(sentence)
    || /\d+/.test(sentence);
}

/**
 * Compte combien de fois chaque mot d une couche apparait
 * dans le texte. Retourne le top N.
 */
function topOccurrences(
  words: string[],
  layer: Set<string>,
  topN: number = 10,
): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  for (const w of words) {
    if (layer.has(w)) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * Calcule les metriques de Narrative Drift sur un texte.
 */
export function scoreText(text: string): NarrativeDriftMetrics {
  const { words, sentences } = tokenize(text);
  const totalWords = words.length;

  if (totalWords === 0) {
    return emptyMetrics();
  }

  // Comptage par couche
  let concreteCount = 0;
  let semiAbstractCount = 0;
  let abstractCount = 0;
  let unclassifiedCount = 0;

  for (const word of words) {
    const layer = classifyWord(word);
    if (layer === 'concrete') concreteCount++;
    else if (layer === 'semi-abstract') semiAbstractCount++;
    else if (layer === 'abstract') abstractCount++;
    else unclassifiedCount++;
  }

  // Detection de contextualisation pour les semi-abstraits :
  // pour chaque phrase, si elle contient un chiffre ET un mot
  // semi-abstrait, on considere que les semi-abstraits de cette
  // phrase sont contextualises.
  let semiAbstractContextualized = 0;
  for (const sentence of sentences) {
    if (!sentenceHasNumber(sentence)) continue;
    const sentenceWords = sentence
      .replace(/[0-9]+/g, ' ')
      .replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^_`{|}~]/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length >= 2; });
    for (const w of sentenceWords) {
      if (SEMI_ABSTRACT_WORDS.has(w)) {
        semiAbstractContextualized++;
      }
    }
  }

  // Metriques principales
  const densiteConcrete = (concreteCount / totalWords) * 1000;
  const ratioAbstraitConcret = concreteCount > 0
    ? abstractCount / concreteCount
    : abstractCount > 0 ? Infinity : 0;

  // Score d opacite : on mesure d abord la densite de semi-abstraits
  // dans le texte (pour 1000 mots). Si elle est faible (< 30 par 1000),
  // le score d opacite n est pas calculable de maniere significative
  // car l echantillon est trop petit pour conclure. On retourne 0
  // dans ce cas.
  const semiAbstractDensite = (semiAbstractCount / totalWords) * 1000;
  let opaciteScore: number;
  if (semiAbstractCount < 5 || semiAbstractDensite < 30) {
    // Pas assez de semi-abstraits pour conclure : score neutre
    opaciteScore = 0;
  } else {
    opaciteScore = ((semiAbstractCount - semiAbstractContextualized) / semiAbstractCount) * 100;
  }

  // Top occurrences pour debug et analyse
  const topAbstractWords = topOccurrences(words, ABSTRACT_WORDS, 10);
  const topConcreteWords = topOccurrences(words, CONCRETE_WORDS, 10);

  // Verdict
  const { verdict, rationale } = computeVerdict({
    densiteConcrete,
    ratioAbstraitConcret,
    opaciteScore,
  });

  return {
    totalWords,
    concreteCount,
    semiAbstractCount,
    semiAbstractContextualized,
    abstractCount,
    unclassifiedCount,
    densiteConcrete,
    ratioAbstraitConcret,
    opaciteScore,
    topAbstractWords,
    topConcreteWords,
    verdict,
    rationale,
  };
}

function emptyMetrics(): NarrativeDriftMetrics {
  return {
    totalWords: 0,
    concreteCount: 0,
    semiAbstractCount: 0,
    semiAbstractContextualized: 0,
    abstractCount: 0,
    unclassifiedCount: 0,
    densiteConcrete: 0,
    ratioAbstraitConcret: 0,
    opaciteScore: 0,
    topAbstractWords: [],
    topConcreteWords: [],
    verdict: 'sain',
    rationale: 'Texte vide.',
  };
}

function computeVerdict(m: {
  densiteConcrete: number;
  ratioAbstraitConcret: number;
  opaciteScore: number;
}): { verdict: NarrativeDriftMetrics['verdict']; rationale: string } {
  const flags: string[] = [];

  if (m.ratioAbstraitConcret > 2.0) flags.push('drapeau-rouge-ratio');
  else if (m.ratioAbstraitConcret > 1.0) flags.push('alerte-ratio');
  else if (m.ratioAbstraitConcret > 0.5) flags.push('attention-ratio');

  if (m.densiteConcrete < 15) flags.push('alerte-densite');
  else if (m.densiteConcrete < 25) flags.push('attention-densite');

  // L alerte opacite ne se declenche que si la densite concrete est
  // faible. Si une comm a une bonne densite concrete (>= 40 mots/1000),
  // une opacite elevee signale juste du jargon metier, pas du drift.
  // Le drift se reconnait a la combinaison des deux : peu de chiffres
  // ET beaucoup de jargon non contextualise.
  const opaciteAggravante = m.densiteConcrete < 40;
  if (opaciteAggravante && m.opaciteScore > 70) flags.push('alerte-opacite');
  else if (opaciteAggravante && m.opaciteScore > 50) flags.push('attention-opacite');

  if (flags.some(f => f.startsWith('drapeau-rouge'))) {
    return {
      verdict: 'drapeau-rouge',
      rationale: `Ratio abstrait/concret > 2.0 (${m.ratioAbstraitConcret.toFixed(2)}). Communication tres dominee par l abstraction au detriment des fondamentaux.`,
    };
  }
  if (flags.some(f => f.startsWith('alerte'))) {
    return {
      verdict: 'alerte',
      rationale: `Signaux de derive narrative : ${flags.filter(f => f.startsWith('alerte')).join(', ')}.`,
    };
  }
  if (flags.length > 0) {
    return {
      verdict: 'attention',
      rationale: `Signaux faibles a surveiller : ${flags.join(', ')}.`,
    };
  }
  return {
    verdict: 'sain',
    rationale: `Densite concrete ${m.densiteConcrete.toFixed(1)} mots/1000, ratio abstrait/concret ${m.ratioAbstraitConcret.toFixed(2)}. Pas de signal de derive.`,
  };
}
