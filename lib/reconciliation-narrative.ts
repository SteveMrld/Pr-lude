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
      `Sur ${lowAccuracyDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(lowAccuracyDims)}, la prediction du fonds se confirme dans ${pct} pour cent des cas instruits, en dessous du seuil ${lowAccuracyDims.length === 1 ? 'qui marquerait une calibration robuste' : 'qui marquerait une calibration robuste sur cet axe'}. Cela ne dit pas que ces dimensions sont mal analysees, mais que la lecture du fonds sur cet angle precis se confronte mal a la realite post-decision. C est l axe ou l ecart entre instruction et resultat est le plus systematique, ${lowAccuracyDims.length === 1 ? 'et ou il y a sans doute le plus a apprendre' : 'et ou se concentrent probablement les angles morts les plus structurants'}.`,
    );
  }

  // Pattern 2 : dimensions ou les drivers sont sur-evalues
  const overpromisingDims = byDimension.filter(
    (d) => d.contradictedDrivers > d.confirmedDrivers
      && d.confirmedDrivers + d.contradictedDrivers >= 3,
  );
  if (overpromisingDims.length > 0) {
    patterns.push(
      `Les drivers positifs identifies a l instruction sur ${overpromisingDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(overpromisingDims)} se contredisent plus souvent qu ils ne se confirment dans la realite post-decision. Le fonds tend a voir des leviers de creation de valeur sur cet axe qui ne se materialisent pas. ${overpromisingDims.length === 1 ? 'C est' : 'Ce sont'} le genre d ecart qui revient sous des formes variees : un produit qui devait scaler et qui plafonne, une equipe qui devait s entendre et qui se brouille, un partenariat qui devait s ouvrir et qui ferme. Le pattern merite d etre regarde en face avant la prochaine instruction sur un dossier comparable.`,
    );
  }

  // Pattern 3 : dimensions ou les risques predits ne se confirment pas (sur-cautionneux)
  const overcautiousDims = byDimension.filter(
    (d) => d.contradictedRisks > d.confirmedRisks * 2
      && d.confirmedRisks + d.contradictedRisks >= 3,
  );
  if (overcautiousDims.length > 0) {
    patterns.push(
      `A l inverse, sur ${overcautiousDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(overcautiousDims)}, les risques alertes a l instruction se materialisent rarement : ils sont plus de deux fois plus souvent contredits qu ils ne se confirment. Le fonds est calibre comme prudent sur cet axe, et cette prudence n est pas validee par la realite portfolio. Si certains de ces refus reposaient principalement sur ces risques-la, ils ont possiblement coute au fonds des dossiers qui auraient du passer. La question n est pas de relacher la vigilance mais de noter ou se loge l excedent de defiance.`,
    );
  }

  // Pattern 4 : dimensions a haute precision (signal positif, calibration solide)
  const highAccuracyDims = byDimension.filter((d) => d.predictionAccuracy === 'high');
  if (highAccuracyDims.length > 0) {
    patterns.push(
      `Sur ${highAccuracyDims.length === 1 ? 'la dimension' : 'les dimensions'} ${namesOf(highAccuracyDims)}, la calibration du fonds tient : drivers et risques identifies a l instruction se confirment dans plus de deux tiers des cas reconcilies. ${highAccuracyDims.length === 1 ? 'C est' : 'Ce sont'} l axe ou le jugement du fonds est le plus aligne avec la realite, et ${highAccuracyDims.length === 1 ? 'celui' : 'ceux'} sur lequel l ecart entre verdict et outcome est le plus faible. Une bonne base de confiance pour les prochaines instructions sur ce type de dossier.`,
    );
  }

  // Pattern 5 : imprevus negatifs structurels (Prelude rate des risques majeurs)
  if (globalAlignment.unforeseenNegative >= 5
      && globalAlignment.unforeseenNegative > globalAlignment.confirmsRisk * 0.5) {
    const ratio = globalAlignment.total > 0
      ? Math.round((globalAlignment.unforeseenNegative / globalAlignment.total) * 100)
      : 0;
    patterns.push(
      `${globalAlignment.unforeseenNegative} milestones negatifs ${globalAlignment.unforeseenNegative > 1 ? 'ont surgi' : 'a surgi'} sans qu aucun risque ne les ait anticipes a l instruction, soit ${ratio} pour cent des milestones aligned. Le fonds ne voit pas venir une part significative des problemes qui finissent par compter. Ces angles morts sont les plus interessants a relire : ils ne signalent pas une mauvaise lecture, mais une dimension absente du cadre d analyse. Une lecture par cas peut suggerer ce que le cadre devrait integrer.`,
    );
  }

  // Pattern 6 : biais distribution decisions (trop d invested ou trop de passed)
  const decisionTotal = byDecision.invested + byDecision.passed + byDecision.declined + byDecision.waitlisted;
  if (decisionTotal >= 20) {
    const investedRatio = byDecision.invested / decisionTotal;
    if (investedRatio >= 0.40) {
      patterns.push(
        `Sur les ${decisionTotal} dossiers decides du portefeuille reconcilie, ${Math.round(investedRatio * 100)} pour cent ont ete investis. C est un taux eleve pour un fonds early ou growth, et cela merite d etre confronte avec la qualite des outcomes observes : si la calibration des drivers tient sur les dossiers investis, l agressivite paye ; si les imprevus negatifs y sont concentres, le fonds confond peut-etre conviction et appetence au risque.`,
      );
    } else if (investedRatio <= 0.10 && byDecision.passed + byDecision.declined > byDecision.invested * 5) {
      patterns.push(
        `Sur les ${decisionTotal} dossiers decides du portefeuille reconcilie, ${Math.round(investedRatio * 100)} pour cent seulement ont ete investis. Un ratio aussi bas peut traduire une vraie discipline ou une defiance systematique. La question utile n est pas la quantite mais la qualite : parmi les passes et refus, combien ont continue a performer publiquement apres la decision, et que disent ces materialisations sur l angle ou le fonds a peut-etre trop filtre.`,
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
    return `Aucun dossier n a encore ete instruit avec Prelude. Le miroir du fonds se construit a partir de l accumulation : chaque dossier analyse puis suivi nourrit une lecture progressive de vos angles morts. La calibration commence a partir de ${threshold} dossiers reconciliables, c est-a-dire decides et accompagnes d au moins un milestone post-decision confirme.`;
  }

  if (totalReconciled >= threshold) {
    return `Le fonds a franchi le seuil de ${threshold} dossiers reconciliables. Sur ${totalAnalyzed} dossiers instruits, ${totalWithDecision} portent une decision posee et ${totalReconciled} disposent d au moins un milestone confirme. Le miroir qui suit interprete ces ${totalReconciled} dossiers : ce qui a ete vu juste, ce qui a ete vu de travers, et ce qui n a pas ete vu du tout. Aucun de ces paragraphes n est prescriptif. Ils decrivent ce que la pratique du fonds donne a voir une fois confrontee a la realite post-decision.`;
  }

  const remaining = threshold - totalReconciled;
  const lines: string[] = [];
  lines.push(
    `Vous etes a ${totalReconciled} dossiers reconciliables sur les ${threshold} qui declenchent la calibration agregee. ${totalAnalyzed} dossiers ont ete instruits dans Prelude, dont ${totalWithDecision} portent une decision posee.`,
  );
  if (totalWithDecision < totalAnalyzed) {
    const undecided = totalAnalyzed - totalWithDecision;
    lines.push(
      `${undecided} ${undecided > 1 ? 'dossiers attendent encore' : 'dossier attend encore'} une decision : le passage du Kanban vers signe ou refuse pre-remplit automatiquement la fiche, il reste ensuite a preciser les conditions d entree dans la note d instruction.`,
    );
  }
  if (totalWithDecision > totalReconciled) {
    const decisionWithoutMilestone = totalWithDecision - totalReconciled;
    lines.push(
      `${decisionWithoutMilestone} ${decisionWithoutMilestone > 1 ? 'dossiers ont' : 'dossier a'} une decision posee mais pas encore de milestone confirme. La detection web automatique tourne tous les matins sur les dossiers decides depuis plus de six mois et propose des milestones a confirmer en un clic.`,
    );
  }
  lines.push(
    `Il manque ${remaining} dossier${remaining > 1 ? 's' : ''} pour que la lecture agregee soit statistiquement defendable. Avant ce seuil, des paragraphes affirmatifs seraient un faux signal : un fonds avec quinze dossiers peut sembler systematiquement biaise sur un axe simplement parce que trois cas tirent l agregat. C est l accumulation qui rend la calibration lisible.`,
  );
  return lines.join(' ');
}
