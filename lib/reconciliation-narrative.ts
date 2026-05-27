// ============================================================
// PRELUDE - Prose de calibration (miroir agrege fonds)
// ------------------------------------------------------------
// Fonctions pures qui composent les paragraphes argumentes du
// miroir de reconciliation : ce que la pratique d instruction du
// fonds donne a voir une fois confrontee a la realite. Le ton
// est descriptif (constat avec chiffres), pas prescriptif (jamais
// "vous devriez").
//
// Extraites de reconciliation-aggregator pour permettre des tests
// deterministes sans dependance Supabase ni 'server-only'. Le
// aggregator se contente desormais d appeler ces fonctions.
//
// Les paragraphes systemiques ne sont emis qu au-dessus du seuil
// PORTFOLIO_RECONCILIATION_THRESHOLD dossiers reconcilies. Sous
// ce seuil, seul le narratif d avancement est rendu (pas de faux
// signal sur 15 dossiers qui ne sont pas statistiquement parlants).
// ============================================================

import type { Decision } from './reconciliation-store';

export interface DimensionPortfolioPerformanceLite {
  dimensionName: string;
  averagePredictedSuccess: number;
  confirmedDrivers: number;
  confirmedRisks: number;
  contradictedDrivers: number;
  contradictedRisks: number;
  predictionAccuracy: 'high' | 'medium' | 'low' | 'insufficient_data';
}

export interface GlobalAlignmentLite {
  confirmsDriver: number;
  confirmsRisk: number;
  contradictsDriver: number;
  contradictsRisk: number;
  unforeseenPositive: number;
  unforeseenNegative: number;
  total: number;
}

/**
 * Compose les paragraphes argumentes du miroir. Chaque paragraphe
 * est un constat structurel, ancre dans des chiffres precis, et rendu
 * en prose dense de 3 a 5 phrases. Aucun pattern n est emis sous le
 * seuil parce que la lecture serait statistiquement defendable.
 */
export function detectSystemicPatterns(
  byDimension: DimensionPortfolioPerformanceLite[],
  globalAlignment: GlobalAlignmentLite,
  totalReconciled: number,
  byDecision: Record<Decision, number>,
  threshold: number,
): string[] {
  const patterns: string[] = [];
  if (totalReconciled < threshold) return patterns;

  const namesOf = (arr: DimensionPortfolioPerformanceLite[]) =>
    arr.map((d) => d.dimensionName).join(', ');

  // Pattern 1 : dimensions ou la prediction sous-performe systematiquement
  const lowAccuracyDims = byDimension.filter((d) => d.predictionAccuracy === 'low');
  if (lowAccuracyDims.length > 0) {
    const total = lowAccuracyDims.reduce(
      (s, d) => s + d.confirmedDrivers + d.confirmedRisks + d.contradictedDrivers + d.contradictedRisks,
      0,
    );
    const correct = lowAccuracyDims.reduce((s, d) => s + d.confirmedDrivers + d.confirmedRisks, 0);
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    patterns.push(
      `Sur ${lowAccuracyDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(lowAccuracyDims)}, la prédiction du fonds se confirme dans ${pct} pour cent des cas instruits, en deçà du seuil ${lowAccuracyDims.length === 1 ? 'qui marquerait une calibration robuste' : 'qui marquerait une calibration robuste sur cet axe'}. Cela ne dit pas que ces dimensions sont mal analysées, mais que la lecture du fonds sur cet angle précis se confronte mal à la réalité post-décision. C'est l'axe où l'écart entre instruction et résultat est le plus systématique, ${lowAccuracyDims.length === 1 ? 'et où il y a sans doute le plus à apprendre' : 'et où se concentrent probablement les angles morts les plus structurants'}.`,
    );
  }

  // Pattern 2 : dimensions ou les drivers sont sur-evalues
  const overpromisingDims = byDimension.filter(
    (d) => d.contradictedDrivers > d.confirmedDrivers
      && d.confirmedDrivers + d.contradictedDrivers >= 3,
  );
  if (overpromisingDims.length > 0) {
    patterns.push(
      `Les drivers positifs identifiés à l'instruction sur ${overpromisingDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(overpromisingDims)} se contredisent plus souvent qu'ils ne se confirment dans la réalité post-décision. Le fonds tend à voir des leviers de création de valeur sur cet axe qui ne se matérialisent pas. ${overpromisingDims.length === 1 ? "C'est" : 'Ce sont'} le genre d'écart qui revient sous des formes variées : un produit qui devait scaler et qui plafonne, une équipe qui devait s'entendre et qui se brouille, un partenariat qui devait s'ouvrir et qui ferme. Le pattern mérite d'être regardé en face avant la prochaine instruction sur un dossier comparable.`,
    );
  }

  // Pattern 3 : dimensions ou les risques predits ne se confirment pas (sur-cautionneux)
  const overcautiousDims = byDimension.filter(
    (d) => d.contradictedRisks > d.confirmedRisks * 2
      && d.confirmedRisks + d.contradictedRisks >= 3,
  );
  if (overcautiousDims.length > 0) {
    patterns.push(
      `À l'inverse, sur ${overcautiousDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(overcautiousDims)}, les risques alertés à l'instruction se matérialisent rarement : ils sont plus de deux fois plus souvent contredits qu'ils ne se confirment. Le fonds est calibré comme prudent sur cet axe, et cette prudence n'est pas validée par la réalité portfolio. Si certains de ces refus reposaient principalement sur ces risques-là, ils ont possiblement coûté au fonds des dossiers qui auraient dû passer. La question n'est pas de relâcher la vigilance mais de noter où se loge l'excédent de défiance.`,
    );
  }

  // Pattern 4 : dimensions a haute precision (signal positif, calibration solide)
  const highAccuracyDims = byDimension.filter((d) => d.predictionAccuracy === 'high');
  if (highAccuracyDims.length > 0) {
    patterns.push(
      `Sur ${highAccuracyDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(highAccuracyDims)}, la calibration du fonds tient : drivers et risques identifiés à l'instruction se confirment dans plus de deux tiers des cas réconciliés. ${highAccuracyDims.length === 1 ? "C'est" : 'Ce sont'} l'axe où le jugement du fonds est le plus aligné avec la réalité, et ${highAccuracyDims.length === 1 ? 'celui' : 'ceux'} sur lequel l'écart entre verdict et outcome est le plus faible. Une bonne base de confiance pour les prochaines instructions sur ce type de dossier.`,
    );
  }

  // Pattern 5 : imprevus negatifs structurels (Prelude rate des risques majeurs)
  if (globalAlignment.unforeseenNegative >= 5
      && globalAlignment.unforeseenNegative > globalAlignment.confirmsRisk * 0.5) {
    const ratio = globalAlignment.total > 0
      ? Math.round((globalAlignment.unforeseenNegative / globalAlignment.total) * 100)
      : 0;
    patterns.push(
      `${globalAlignment.unforeseenNegative} milestones négatifs ${globalAlignment.unforeseenNegative > 1 ? 'ont surgi' : 'a surgi'} sans qu'aucun risque ne les ait anticipés à l'instruction, soit ${ratio} pour cent des milestones alignés. Le fonds ne voit pas venir une part significative des problèmes qui finissent par compter. Ces angles morts sont les plus intéressants à relire : ils ne signalent pas une mauvaise lecture, mais une dimension absente du cadre d'analyse. Une lecture par cas peut suggérer ce que le cadre devrait intégrer.`,
    );
  }

  // Pattern 6 : biais distribution decisions (trop d invested ou trop de passed)
  const decisionTotal = byDecision.invested + byDecision.passed + byDecision.declined + byDecision.waitlisted;
  if (decisionTotal >= 20) {
    const investedRatio = byDecision.invested / decisionTotal;
    if (investedRatio >= 0.40) {
      patterns.push(
        `Sur les ${decisionTotal} dossiers décidés du portefeuille réconcilié, ${Math.round(investedRatio * 100)} pour cent ont été investis. C'est un taux élevé pour un fonds early ou growth, et cela mérite d'être confronté avec la qualité des outcomes observés : si la calibration des drivers tient sur les dossiers investis, l'agressivité paye ; si les imprévus négatifs y sont concentrés, le fonds confond peut-être conviction et appétence au risque.`,
      );
    } else if (investedRatio <= 0.10 && byDecision.passed + byDecision.declined > byDecision.invested * 5) {
      patterns.push(
        `Sur les ${decisionTotal} dossiers décidés du portefeuille réconcilié, ${Math.round(investedRatio * 100)} pour cent seulement ont été investis. Un ratio aussi bas peut traduire une vraie discipline ou une défiance systématique. La question utile n'est pas la quantité mais la qualité : parmi les passés et refus, combien ont continué à performer publiquement après la décision, et que disent ces matérialisations sur l'angle où le fonds a peut-être trop filtré.`,
      );
    }
  }

  return patterns;
}

/**
 * Compose le narratif d avancement vers le seuil de reconciliation,
 * ou le replacement contextuel au-dessus du seuil. Toujours en prose,
 * pas de chiffres en colonnes. Le ton est neutre : on raconte ou en
 * est le fonds, sans vendre ni rassurer.
 */
export function buildProgressNarrative(
  totalAnalyzed: number,
  totalWithDecision: number,
  totalReconciled: number,
  threshold: number,
): string {
  if (totalAnalyzed === 0) {
    return `Aucun dossier n'a encore été instruit avec Prelude. Le miroir du fonds se construit à partir de l'accumulation : chaque dossier analysé puis suivi nourrit une lecture progressive de vos angles morts. La calibration commence à partir de ${threshold} dossiers réconciliables, c'est-à-dire décidés et accompagnés d'au moins un milestone post-décision confirmé.`;
  }

  if (totalReconciled >= threshold) {
    return `Le fonds a franchi le seuil de ${threshold} dossiers réconciliables. Sur ${totalAnalyzed} dossiers instruits, ${totalWithDecision} portent une décision posée et ${totalReconciled} disposent d'au moins un milestone confirmé. Le miroir qui suit interprète ces ${totalReconciled} dossiers : ce qui a été vu juste, ce qui a été vu de travers, et ce qui n'a pas été vu du tout. Aucun de ces paragraphes n'est prescriptif. Ils décrivent ce que la pratique du fonds donne à voir une fois confrontée à la réalité post-décision.`;
  }

  const remaining = threshold - totalReconciled;
  const lines: string[] = [];
  lines.push(
    `Vous êtes à ${totalReconciled} dossiers réconciliables sur les ${threshold} qui déclenchent la calibration agrégée. ${totalAnalyzed} dossiers ont été instruits dans Prelude, dont ${totalWithDecision} portent une décision posée.`,
  );
  if (totalWithDecision < totalAnalyzed) {
    const undecided = totalAnalyzed - totalWithDecision;
    lines.push(
      `${undecided} ${undecided > 1 ? 'dossiers attendent encore' : 'dossier attend encore'} une décision : le passage du Kanban vers signé ou refusé pré-remplit automatiquement la fiche, il reste ensuite à préciser les conditions d'entrée dans la note d'instruction.`,
    );
  }
  if (totalWithDecision > totalReconciled) {
    const decisionWithoutMilestone = totalWithDecision - totalReconciled;
    lines.push(
      `${decisionWithoutMilestone} ${decisionWithoutMilestone > 1 ? 'dossiers ont' : 'dossier a'} une décision posée mais pas encore de milestone confirmé. La détection web automatique tourne tous les matins sur les dossiers décidés depuis plus de six mois et propose des milestones à confirmer en un clic.`,
    );
  }
  lines.push(
    `Il manque ${remaining} dossier${remaining > 1 ? 's' : ''} pour que la lecture agrégée soit statistiquement défendable. Avant ce seuil, des paragraphes affirmatifs seraient un faux signal : un fonds avec quinze dossiers peut sembler systématiquement biaisé sur un axe simplement parce que trois cas tirent l'agrégat. C'est l'accumulation qui rend la calibration lisible.`,
  );
  return lines.join(' ');
}
