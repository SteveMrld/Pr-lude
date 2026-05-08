// Logique de selection des risques critiques d un dossier.
//
// Reutilise dans plusieurs vues : dashboard synthese (Top 3 sous l argumentation),
// page de couverture de la note d instruction (cartouche RISQUES MAJEURS),
// et Pack IC (page deliberation). Centraliser ici evite la divergence entre
// vues et garantit que le comite voit les memes risques que le partner principal.
//
// Strategie :
// 1. On remonte les patterns à risque detectes avec intensite >= 70.
// 2. Si insuffisant, on complete avec les alertesCritiques bruts du moteur 8.
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

export function computeTopRisks(result: any, limit: number = 3): TopRisk[] {
  const risks: TopRisk[] = [];

  // 1. Patterns d aveuglement haute intensite
  const patterns = result?.blindspotAnalysis?.patterns || {};
  Object.values(patterns).forEach((p: any) => {
    if (p?.detected && (p.intensity || 0) >= 70) {
      risks.push({
        label: p.patternName || 'Pattern à risque',
        intensity: p.intensity || 0,
        evidence: (p.evidence || '').slice(0, 220),
      });
    }
  });

  // 2. Alertes critiques brutes si pas assez de patterns. Le label
  //    est extrait depuis le texte de l alerte plutot que hardcode :
  //    chaque alerte a maintenant son propre label discriminant.
  if (risks.length < limit) {
    const alertes = result?.blindspotAnalysis?.alertesCritiques || [];
    for (const a of alertes.slice(0, limit - risks.length)) {
      const text = typeof a === 'string' ? a : '';
      risks.push({
        label: extractAlertLabel(text),
        intensity: 80,
        evidence: text.slice(0, 220),
      });
    }
  }

  risks.sort((a, b) => b.intensity - a.intensity);
  return risks.slice(0, limit);
}
