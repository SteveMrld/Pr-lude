// Logique de selection des risques critiques d un dossier.
//
// Reutilise dans plusieurs vues : dashboard synthese (Top 3 sous l argumentation),
// page de couverture de la note d instruction (cartouche RISQUES MAJEURS),
// et Pack IC (page deliberation). Centraliser ici evite la divergence entre
// vues et garantit que le comite voit les memes risques que le partner principal.
//
// Strategie :
// 1. On remonte les patterns à risque detectes avec intensite >= 60.
// 2. Si insuffisant, on complete avec les alertesCritiques bruts du moteur 8,
//    en deduplicant celles qui correspondent deja a un pattern remonte.
// 3. Tri par intensite decroissante, on retourne les N premiers (default 3).

export type TopRisk = {
  label: string;
  intensity: number;
  evidence: string;
};

/**
 * Extrait un label court (~40-60 caracteres) depuis le texte d une alerte
 * critique. Le moteur blindspot stocke les alertesCritiques comme des
 * phrases francaises completes ("Effet de meute légitimation. Le pitch
 * s appuie sur le buzz IA pour..."). On veut un label court pour le
 * cartouche RISQUES MAJEURS de la page de couverture.
 *
 * Strategie en cascade :
 * 1. Si l alerte est structuree "Categorie : description", on prend
 *    Categorie qui est typiquement le label clair voulu.
 * 2. Sinon si la premiere phrase est courte (5-60 chars), on la prend
 *    entiere (par exemple "Concentration des revenus sur un seul client").
 * 3. Sinon on truncate proprement aux mots avec ellipse.
 *
 * Cette fonction remplace l ancien comportement qui affichait
 * "Alerte critique" en label hardcode pour TOUTES les alertes,
 * ce qui produisait deux ou trois cartouches identiques sur la
 * page de couverture, sans information.
 */
function extractAlertLabel(text: string): string {
  if (!text || typeof text !== 'string') return 'Alerte critique';
  const trimmed = text.trim();

  // Pattern "Categorie : description" - typique des alertes structurees
  // par le LLM. On prend la categorie si elle fait entre 5 et 60 chars.
  const colonMatch = trimmed.match(/^([^:]{5,60}):/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }

  // Premiere phrase courte (5-60 chars terminee par . ! ou ?)
  const sentenceMatch = trimmed.match(/^([^.!?]{5,60})[.!?]/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim();
  }

  // Sinon truncate aux mots a ~55 chars + ellipse
  if (trimmed.length <= 60) return trimmed;
  const truncated = trimmed.slice(0, 60);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

/**
 * Normalise une chaine pour comparaison floue : minuscules, sans
 * accents, sans ponctuation, mots-cles significatifs uniquement.
 * Permet de detecter qu une alerte critique correspond a un pattern
 * deja remonte (ex : "Inversion industrialisation/validation critique"
 * matche "Inversion industrialisation/validation").
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3) // on garde les mots significatifs
    .slice(0, 4) // les 4 premiers mots clefs suffisent
    .join(' ');
}

export function computeTopRisks(result: any, limit: number = 3): TopRisk[] {
  const risks: TopRisk[] = [];

  // 1. Patterns d aveuglement haute intensite. Seuil abaisse de 70 a 60
  //    pour capter les patterns moderement-eleves qui meritent d apparaitre
  //    sur la couverture. Les patterns sous 60 restent visibles dans la
  //    section dediee au moteur Vigilance critique.
  const patterns = result?.blindspotAnalysis?.patterns || {};
  Object.values(patterns).forEach((p: any) => {
    if (p?.detected && (p.intensity || 0) >= 60) {
      risks.push({
        label: p.patternName || 'Pattern à risque',
        intensity: p.intensity || 0,
        evidence: (p.evidence || '').slice(0, 220),
      });
    }
  });

  // 2. Alertes critiques en fallback si pas assez de patterns ou pour
  //    completer. On deduplique celles qui correspondent deja a un
  //    pattern remonte par comparaison de label normalise. Cela evite
  //    qu un meme risque apparaisse deux fois sur la couverture avec
  //    deux intensites differentes (cas observe : "Inversion industrialisation/
  //    validation" en pattern P3 a intensity 65, ET en alerte critique a
  //    intensity 80 hardcodee, produisait deux cartouches contradictoires).
  if (risks.length < limit) {
    const alertes = result?.blindspotAnalysis?.alertesCritiques || [];
    const existingNormalized = new Set(risks.map(r => normalizeForMatch(r.label)));
    for (const a of alertes) {
      if (risks.length >= limit) break;
      const text = typeof a === 'string' ? a : '';
      if (!text) continue;
      const label = extractAlertLabel(text);
      const normalized = normalizeForMatch(label);
      const newWords = normalized.split(' ').filter(Boolean);
      // Deduplication : on ne deduplique que si le label normalise a au
      // moins 2 mots significatifs. En dessous, le signal est trop faible
      // pour comparer (cas \"Risque A\" / \"Risque B\" qui sont des risques
      // distincts mais partageraient le mot \"risque\").
      let isDuplicate = false;
      if (newWords.length >= 2) {
        if (existingNormalized.has(normalized)) {
          isDuplicate = true;
        } else {
          // Verification supplementaire par chevauchement de mots-cles
          const existingArray = Array.from(existingNormalized);
          for (const existing of existingArray) {
            const existingWords = new Set(existing.split(' ').filter(Boolean));
            const overlap = newWords.filter(w => existingWords.has(w)).length;
            // 2+ mots-cles communs sur des labels courts = meme risque
            if (overlap >= 2 && newWords.length <= 4) {
              isDuplicate = true;
              break;
            }
          }
        }
      }
      if (isDuplicate) continue;

      // Intensity 70 par defaut au lieu de 80 hardcode : signal serieux
      // mais sans pretendre a une mesure precise (le moteur Vigilance ne
      // chiffre pas l intensite des alertes critiques separement des
      // patterns). 70 reste au-dessus du seuil de gravite et coherent
      // avec les patterns detectes les plus serieux.
      risks.push({
        label,
        intensity: 70,
        evidence: text.slice(0, 220),
      });
      existingNormalized.add(normalized);
    }
  }

  risks.sort((a, b) => b.intensity - a.intensity);
  return risks.slice(0, limit);
}
