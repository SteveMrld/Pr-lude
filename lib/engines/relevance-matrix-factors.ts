// ============================================================
// PRELUDE - Codes stables des facteurs de la matrice de pertinence
// ------------------------------------------------------------
// Decouplage engine / affichage pour les tags de facteurs emis par
// computeRelevanceMatrix. Avant cette unite, relevance-matrix.ts
// emettait des chaines francaises replies en ASCII qui servaient a
// la fois de cle de matching en aval (financial-coherence-archetype
// notamment) et de texte affiche au partner. Ce double usage
// empechait de corriger l orthographe sans risquer de casser les
// matchers en silence.
//
// Doctrine : l engine emet des codes machine stables en kebab-case
// namespaces par dimension (supply / macro / geo / reproducibility).
// Les consommateurs matchent sur ces codes. Cette meme unite rend
// le libelle francais accentue au point d affichage, source unique.
// Meme discipline que section-fallback.ts : l engine emet des cles,
// la couche d affichage rend le francais.
//
// Backward compat : les analyses persistees avant ce decouplage
// contiennent encore les anciennes chaines ASCII dans leurs
// *Factors arrays. Le renderFactor pass-through gracieusement ces
// chaines sans erreur : elles s affichent telles quelles jusqu au
// backfill du dossier concerne. Aucun matcher externe ne doit
// dependre de l ancienne chaine texte apres cette refonte.
// ============================================================

// ------------------------------------------------------------
// TYPE
// L union litterale figee documente le catalogue exhaustif des
// facteurs emis. Toute nouvelle emission passe par l ajout d un
// code ici, du libelle correspondant plus bas, et d une mise a
// jour du site d emission dans relevance-matrix.ts.
// ------------------------------------------------------------
export type FactorCode =
  // Supply chain exposure
  | 'supply:semiconductors'
  | 'supply:strategic-materials'
  | 'supply:fossil-energy-intensity'
  | 'supply:long-maritime-logistics'
  | 'supply:export-controls-submission'
  // Macro sensitivity
  | 'macro:consumer-discretionary'
  | 'macro:interest-rate-sensitivity'
  | 'macro:b2c-volume-dependency'
  | 'macro:consumer-exposure'
  // Geopolitical exposure
  | 'geo:semiconductors-chain'
  | 'geo:strategic-materials'
  | 'geo:energy-price-exposure'
  | 'geo:sensitive-trade-routes'
  | 'geo:export-controls'
  | 'geo:high-risk-country-presence'
  | 'geo:defense-sector'
  // Digital reproducibility
  | 'reproducibility:hardware-product'
  | 'reproducibility:non-duplicable-physical-infra'
  | 'reproducibility:non-duplicable-wet-biotech'
  | 'reproducibility:human-regulated-service'
  | 'reproducibility:proprietary-data'
  | 'reproducibility:regulatory-barrier'
  | 'reproducibility:network-effect'
  | 'reproducibility:custom-trained-model'
  | 'reproducibility:deep-workflow-integration'
  | 'reproducibility:software-protected'
  | 'reproducibility:no-significant-protection'
  | 'reproducibility:content-distribution-duplicable'
  | 'reproducibility:undetermined-production-chain';

// ------------------------------------------------------------
// LIBELLES FRANCAIS ACCENTUES
// Voix editoriale Le Grand Continent : accents corrects, apostrophe
// typographique (U+2019), pas de tirets em. Les libelles restent
// courts et homogenes pour l affichage en cellule de tableau et
// pour l interpolation dans les rationales du moteur macro.
// ------------------------------------------------------------
export const FACTOR_LABELS: Record<FactorCode, string> = {
  // Supply chain
  'supply:semiconductors': 'semi-conducteurs',
  'supply:strategic-materials': 'matériaux stratégiques',
  'supply:fossil-energy-intensity': 'intensité énergétique fossile',
  'supply:long-maritime-logistics': 'logistique maritime longue',
  'supply:export-controls-submission': 'soumission export controls',

  // Macro
  'macro:consumer-discretionary': 'consommation discrétionnaire',
  'macro:interest-rate-sensitivity': 'sensibilité aux taux d’intérêt',
  'macro:b2c-volume-dependency': 'dépendance volume B2C',
  'macro:consumer-exposure': 'exposition consumer',

  // Geopolitical
  'geo:semiconductors-chain': 'chaîne semi-conducteurs',
  'geo:strategic-materials': 'matériaux stratégiques',
  'geo:energy-price-exposure': 'exposition prix énergie',
  'geo:sensitive-trade-routes': 'routes commerciales sensibles',
  'geo:export-controls': 'export controls',
  'geo:high-risk-country-presence': 'présence zones à risque pays',
  'geo:defense-sector': 'secteur défense',

  // Reproducibility
  'reproducibility:hardware-product': 'produit hardware physique',
  'reproducibility:non-duplicable-physical-infra': 'infrastructure physique non duplicable par logiciel',
  'reproducibility:non-duplicable-wet-biotech': 'biotech humide non duplicable par logiciel',
  'reproducibility:human-regulated-service': 'service régulé à barrière humaine',
  'reproducibility:proprietary-data': 'données propriétaires',
  'reproducibility:regulatory-barrier': 'barrière réglementaire',
  'reproducibility:network-effect': 'network effect',
  'reproducibility:custom-trained-model': 'modèle entraîné custom',
  'reproducibility:deep-workflow-integration': 'intégration profonde dans workflows clients',
  'reproducibility:software-protected': 'software protégé par barrières non triviales',
  'reproducibility:no-significant-protection': 'software pur sans protection significative détectée',
  'reproducibility:content-distribution-duplicable': 'couche distribution duplicable, contenu original protégé par droit d’auteur',
  'reproducibility:undetermined-production-chain': 'chaîne de production indéterminée',
};

// Set derive du record pour la verification O(1). Sert au type
// guard et au renderer pass-through.
const CODE_SET: Set<string> = new Set(Object.keys(FACTOR_LABELS));

/**
 * Type guard : true si la chaine est un FactorCode reconnu.
 */
export function isFactorCode(s: string): s is FactorCode {
  return CODE_SET.has(s);
}

/**
 * Rend un facteur en libelle francais accentue. Backward-compat
 * avec les analyses persistees avant le decouplage : une chaine
 * non reconnue comme code est retournee telle quelle. Aucune
 * erreur remontee, aucun log : le pass-through est silencieux
 * pour ne pas polluer le rendu partner sur les dossiers legacy.
 */
export function renderFactor(input: string): string {
  return isFactorCode(input) ? FACTOR_LABELS[input] : input;
}

/**
 * Rend un tableau de facteurs en chaine concatenee par ', '.
 * Utilise a la fois par l affichage note (section 1.6b) et par
 * l interpolation des factors dans les rationales du prompt
 * macro. La virgule espace est le separateur canonique pour
 * ces enumerations courtes.
 */
export function renderFactors(inputs: readonly string[]): string {
  return inputs.map(renderFactor).join(', ');
}
