// Logique de selection des risques critiques d un dossier.
//
// Reutilise dans plusieurs vues : dashboard synthese (Top 3 sous l argumentation)
// et Pack IC (page deliberation). Centraliser ici evite la divergence entre
// vues et garantit que le comite voit les memes risques que le partner principal.
//
// Strategie :
// 1. On remonte les patterns d aveuglement detectes avec intensite >= 70.
// 2. Si insuffisant, on complete avec les alertesCritiques bruts du moteur 8.
// 3. Tri par intensite decroissante, on retourne les N premiers (default 3).

export type TopRisk = {
  label: string;
  intensity: number;
  evidence: string;
};

export function computeTopRisks(result: any, limit: number = 3): TopRisk[] {
  const risks: TopRisk[] = [];

  // 1. Patterns d aveuglement haute intensite
  const patterns = result?.blindspotAnalysis?.patterns || {};
  Object.values(patterns).forEach((p: any) => {
    if (p?.detected && (p.intensity || 0) >= 70) {
      risks.push({
        label: p.patternName || 'Pattern d aveuglement',
        intensity: p.intensity || 0,
        evidence: (p.evidence || '').slice(0, 220),
      });
    }
  });

  // 2. Alertes critiques brutes si pas assez de patterns
  if (risks.length < limit) {
    const alertes = result?.blindspotAnalysis?.alertesCritiques || [];
    for (const a of alertes.slice(0, limit - risks.length)) {
      risks.push({
        label: 'Alerte critique',
        intensity: 80,
        evidence: typeof a === 'string' ? a.slice(0, 220) : '',
      });
    }
  }

  risks.sort((a, b) => b.intensity - a.intensity);
  return risks.slice(0, limit);
}
