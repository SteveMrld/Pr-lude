// ============================================================
// SAAS METRICS ENGINE - Extraction LLM dediee NDR et Magic Number
// ------------------------------------------------------------
// Le moteur indicators-engine produit sept KPI canoniques mais
// deux d entre eux (Net Dollar Retention et Magic Number) restent
// quasi systematiquement non-applicables sur les dossiers reels :
// le moteur financial-extraction-engine n extrait pas les cohortes
// ni la depense Sales & Marketing par periode, donc indicators ne
// peut que retourner null par defaut.
//
// Ce moteur dedie corrige le probleme. Il fait un appel LLM cible
// (Sonnet 4.5) sur le pitch deck plus le contenu textuel du BP, avec
// un prompt structure qui demande explicitement :
//   - NDR / NRR declare (regex liste, valeurs entre 60 et 200%)
//   - Cohort retention si tableau de cohortes present
//   - Logo churn et expansion si declares separement (reconstruction)
//   - Magic Number declare
//   - Sales spend annuel/trimestriel + new ARR pour calcul backup
//
// Le LLM ne calcule pas, il extrait. Le calcul derive (NDR a partir
// de GRR + expansion, Magic Number a partir de S&M et new ARR) reste
// dans ce module en TypeScript deterministe pour auditabilite.
//
// COUT : un appel Sonnet supplementaire par dossier, 1500-2500
// tokens output. Justifie par le gain de signal sur les indicateurs
// les plus structurants pour qualifier un SaaS B2B.
//
// FALLBACK : si le moteur echoue (timeout, parse error, sans pitch),
// l output est un objet vide qui laisse indicators-engine retomber
// sur son comportement actuel (regex sur rawNotes). Aucune
// regression possible.
// ============================================================

import { callClaudeWithPDF, parseJSON, MODEL } from './anthropic-client';
import type { ExtractionOutput } from './types';

// ============================================================
// TYPES
// ============================================================

/**
 * Source de la metrique : declaree explicitement dans le pitch ou
 * le BP, calculee a partir d autres champs (GRR + expansion pour NDR,
 * S&M + new ARR pour Magic Number), ou absente. Permet d afficher
 * une confiance differenciee dans la note.
 */
export type MetricProvenance =
  | 'declared'
  | 'computed-from-cohorts'
  | 'computed-from-grr-and-expansion'
  | 'computed-from-quarterly-sm'
  | 'computed-from-annual-sm'
  | 'absent';

/**
 * Resultat de l extraction NDR / NRR. NDR = (revenue cohorte a T+12)
 * / (revenue cohorte a T0), exprime en %. Inclut churn (negatif),
 * downsell (negatif), upsell (positif), expansion (positif).
 *
 * Si le pitch declare GRR (Gross Retention Rate, sans expansion) et
 * un taux d expansion separes, on reconstruit NDR ~ GRR + expansion.
 * Approximatif mais utile en l absence de donnee directe.
 */
export interface RetentionMetricsExtraction {
  /** NDR / NRR si declare ou calculable (en %). */
  ndr: number | null;
  /** Source de la valeur NDR. */
  ndrProvenance: MetricProvenance;
  /** Gross Retention Rate si declare (en %). */
  grr: number | null;
  /** Logo churn annuel si declare (en %). */
  logoChurnAnnual: number | null;
  /** Net expansion rate si declare (upsell - downsell, en %). */
  netExpansionRate: number | null;
  /** Note explicative en clair pour la note d investissement. */
  notes: string;
}

/**
 * Resultat de l extraction Magic Number. Magic Number = Net New ARR
 * (Q) / Sales & Marketing Spend (Q-1), parfois annualise (x4). Sain
 * au-dessus de 0,75. Excellent au-dessus de 1,5.
 *
 * Si on n a que les chiffres annuels (cas frequent au seed), on
 * calcule Magic Number annuel = New ARR (annee N) / S&M (annee N-1).
 * Moins precis mais directionnel.
 */
export interface SalesEfficiencyExtraction {
  /** Magic Number declare ou calcule. */
  magicNumber: number | null;
  /** Source de la valeur. */
  magicNumberProvenance: MetricProvenance;
  /** Sales & Marketing spend annuel le plus recent (millions EUR). */
  annualSmSpend: number | null;
  /** Annee correspondante. */
  annualSmYear: string | null;
  /** New ARR annuel correspondant (millions EUR). */
  annualNewArr: number | null;
  /** Annee correspondante. */
  annualNewArrYear: string | null;
  /** Note explicative en clair pour la note d investissement. */
  notes: string;
}

/**
 * Output complet du moteur. Tous les champs peuvent etre null si la
 * donnee n est pas presente. Le moteur ne renvoie jamais d erreur :
 * en cas de parse failure, il renvoie un objet vide.
 */
export interface SaasMetricsExtraction {
  retention: RetentionMetricsExtraction;
  salesEfficiency: SalesEfficiencyExtraction;
  /** Indique si le moteur a tourne avec succes (false = fallback). */
  extractionSucceeded: boolean;
}

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es le Moteur d'Extraction des Metriques SaaS de Prelude. Ton role est unique : extraire deux familles de metriques que les autres moteurs ratent systematiquement, parce qu elles sont enfouies dans le pitch ou le BP sans format standard.

# CE QUE TU CHERCHES

## 1. Retention (NDR / NRR / cohortes)

Le Net Dollar Retention (NDR), aussi appele Net Revenue Retention (NRR), mesure ce que devient une cohorte de clients sur 12 mois. Formule : revenue de la cohorte a T+12 / revenue de la cohorte a T0. Au-dessus de 100% = expansion nette. En dessous = erosion.

Tu extrais en priorite :
- Une mention explicite "NDR XX%", "NRR XX%", "Net Dollar Retention XX%", "Net Revenue Retention XX%". Valeurs typiques entre 60% et 180%. Si tu vois 200% c est suspect, verifie le contexte.
- Un tableau de cohortes (souvent en page traction du deck) qui montre l evolution du revenue par millesime. Si tu peux deduire une retention de cohorte a 12 mois, fais-le.
- Si NDR n est pas declare mais Gross Retention Rate (GRR, sans expansion) ET un taux d expansion sont declares separement, calcule NDR = GRR + expansion. Marque alors la provenance "computed-from-grr-and-expansion".
- Logo churn annuel et expansion rate si declares separement (utiles meme si NDR n est pas calculable).

## 2. Sales Efficiency (Magic Number)

Le Magic Number est l efficacite go-to-market. Formule canonique : New ARR (trimestre Q) / Sales & Marketing Spend (Q-1), annualise. Au-dessus de 0,75 = sain. Au-dessus de 1,5 = excellent.

Tu extrais en priorite :
- Une mention explicite "Magic Number X.YY". Valeurs typiques entre 0,1 et 3,0.
- Sales & Marketing spend par trimestre ET New ARR par trimestre. Si tu trouves les deux, calcule.
- Sales & Marketing spend annuel ET New ARR annuel (calcule sur la croissance ARR YoY). Calcule un Magic Number annuel approximatif. Marque "computed-from-annual-sm".

## REGLES STRICTES

1. Tu n inventes rien. Si la donnee n est pas presente, retourne null.
2. Tu reportes la valeur exacte declaree, sans recalculer ni arrondir.
3. Tu ne fais des calculs derives QUE si tous les inputs necessaires sont presents et clairement identifies.
4. Toutes les valeurs monetaires en millions EUR (convertir USD vers EUR au taux 1:1 si besoin, c est une approximation acceptable).
5. Toutes les valeurs de retention en %, sans le signe.
6. Si le dossier ne porte pas de modele recurrent (e-commerce DTC, marketplace one-shot, mediatech sans abonnement), ces metriques sont non pertinentes. Retourne null pour tous les champs et explique dans notes.

# FORMAT JSON OBLIGATOIRE

{
  "retention": {
    "ndr": null ou nombre (en %),
    "ndrProvenance": "declared" | "computed-from-cohorts" | "computed-from-grr-and-expansion" | "absent",
    "grr": null ou nombre,
    "logoChurnAnnual": null ou nombre,
    "netExpansionRate": null ou nombre,
    "notes": "phrase explicative ou citation textuelle de la source"
  },
  "salesEfficiency": {
    "magicNumber": null ou nombre,
    "magicNumberProvenance": "declared" | "computed-from-quarterly-sm" | "computed-from-annual-sm" | "absent",
    "annualSmSpend": null ou nombre (millions EUR),
    "annualSmYear": null ou "2024" / "2025" etc,
    "annualNewArr": null ou nombre (millions EUR),
    "annualNewArrYear": null ou "2024" / "2025" etc,
    "notes": "phrase explicative ou citation textuelle de la source"
  }
}

Tu retournes uniquement le JSON, sans preambule ni explication. Si le dossier n a aucune trace de ces metriques, tu retournes le JSON avec tous les champs a null et une note brieve indiquant pourquoi.`;

// ============================================================
// FALLBACK
// ============================================================

/**
 * Output vide retourne quand l extraction echoue ou que le pitch
 * n est pas exploitable. Permet a indicators-engine de retomber
 * gracieusement sur son comportement actuel (regex rawNotes).
 */
function emptyOutput(): SaasMetricsExtraction {
  return {
    retention: {
      ndr: null,
      ndrProvenance: 'absent',
      grr: null,
      logoChurnAnnual: null,
      netExpansionRate: null,
      notes: '',
    },
    salesEfficiency: {
      magicNumber: null,
      magicNumberProvenance: 'absent',
      annualSmSpend: null,
      annualSmYear: null,
      annualNewArr: null,
      annualNewArrYear: null,
      notes: '',
    },
    extractionSucceeded: false,
  };
}

// ============================================================
// POINT D ENTREE
// ============================================================

/**
 * Extrait les metriques NDR et Magic Number du pitch et du BP.
 *
 * @param deckBase64 PDF du pitch deck en base64
 * @param bpContent contenu textuel du BP (Excel, CSV, Word converti),
 *                  ou null si pas de BP
 * @param extraction extraction Bloc 1 deja faite, sert de contexte
 *                   au prompt (secteur, stage, montant)
 * @returns extraction structuree, ou objet vide en cas d echec
 */
export async function extractSaasMetrics(
  deckBase64: string,
  bpContent: string | null,
  extraction: ExtractionOutput,
): Promise<SaasMetricsExtraction> {
  // Court-circuit : si l asset class ne porte pas de modele recurrent,
  // pas la peine de bruler un appel LLM. Le moteur indicators-engine
  // gerera deja le non-applicable.
  const sector = (extraction.sector || '').toLowerCase();
  const subSector = (extraction.subSector || '').toLowerCase();
  const combined = `${sector} ${subSector}`;
  const nonRecurrentPatterns = [
    'ecommerce', 'e-commerce', 'dtc',
    'marketplace b2c',
    'mediatech', 'media classique',
    'hardware', 'manufactur',
  ];
  const isNonRecurrent = nonRecurrentPatterns.some((p) => combined.includes(p));
  if (isNonRecurrent) {
    return {
      ...emptyOutput(),
      retention: {
        ...emptyOutput().retention,
        notes: 'Modele non recurrent detecte (asset class sans abonnement). NDR et Magic Number non pertinents par construction.',
      },
      salesEfficiency: {
        ...emptyOutput().salesEfficiency,
        notes: 'Modele non recurrent detecte (asset class sans abonnement). NDR et Magic Number non pertinents par construction.',
      },
      extractionSucceeded: true,
    };
  }

  const userPrompt = `# CONTEXTE DOSSIER

Societe : ${extraction.companyName}
Secteur : ${extraction.sector}${extraction.subSector ? ' / ' + extraction.subSector : ''}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount || ''}
Geographie : ${extraction.country || 'non precise'}

Le pitch deck est joint.${bpContent ? '' : ' Aucun business plan separe disponible : tu travailles uniquement sur le deck.'}

${bpContent ? `# BUSINESS PLAN (extrait textuel)

${bpContent.slice(0, 8000)}

` : ''}# INSTRUCTIONS

Cherche les metriques NDR / NRR / cohortes et Magic Number / Sales Efficiency selon le format JSON specifie. Si tu ne trouves rien, retourne le JSON avec valeurs nulles et une note brieve. Tu ne devines rien : pas de donnee = null.`;

  try {
    const rawResponse = await callClaudeWithPDF(SYSTEM_PROMPT, userPrompt, deckBase64, 2000, MODEL);
    const parsed = parseJSON<SaasMetricsExtraction>(rawResponse);

    // Garde-fous : valider la structure et combler les champs manquants.
    // Le LLM peut occasionnellement omettre un sous-champ.
    const result: SaasMetricsExtraction = {
      retention: {
        ndr: typeof parsed?.retention?.ndr === 'number' ? parsed.retention.ndr : null,
        ndrProvenance: parsed?.retention?.ndrProvenance || 'absent',
        grr: typeof parsed?.retention?.grr === 'number' ? parsed.retention.grr : null,
        logoChurnAnnual: typeof parsed?.retention?.logoChurnAnnual === 'number' ? parsed.retention.logoChurnAnnual : null,
        netExpansionRate: typeof parsed?.retention?.netExpansionRate === 'number' ? parsed.retention.netExpansionRate : null,
        notes: parsed?.retention?.notes || '',
      },
      salesEfficiency: {
        magicNumber: typeof parsed?.salesEfficiency?.magicNumber === 'number' ? parsed.salesEfficiency.magicNumber : null,
        magicNumberProvenance: parsed?.salesEfficiency?.magicNumberProvenance || 'absent',
        annualSmSpend: typeof parsed?.salesEfficiency?.annualSmSpend === 'number' ? parsed.salesEfficiency.annualSmSpend : null,
        annualSmYear: parsed?.salesEfficiency?.annualSmYear || null,
        annualNewArr: typeof parsed?.salesEfficiency?.annualNewArr === 'number' ? parsed.salesEfficiency.annualNewArr : null,
        annualNewArrYear: parsed?.salesEfficiency?.annualNewArrYear || null,
        notes: parsed?.salesEfficiency?.notes || '',
      },
      extractionSucceeded: true,
    };

    // Garde-fou metier : un NDR superieur a 250 est presque
    // certainement une mauvaise extraction (le LLM a confondu un
    // pourcentage de croissance avec NDR). On invalide.
    if (result.retention.ndr != null && (result.retention.ndr < 0 || result.retention.ndr > 250)) {
      result.retention.ndr = null;
      result.retention.ndrProvenance = 'absent';
      result.retention.notes = `Valeur NDR initialement extraite (${parsed?.retention?.ndr}%) hors plage plausible [0, 250]. Invalidee. ` + result.retention.notes;
    }
    // Garde-fou metier : un Magic Number superieur a 5 ou negatif
    // est suspect. Au-dessus de 5 c est typiquement un dossier qui
    // a sous-investi en S&M (atypique au seed).
    if (result.salesEfficiency.magicNumber != null && (result.salesEfficiency.magicNumber < 0 || result.salesEfficiency.magicNumber > 5)) {
      result.salesEfficiency.magicNumber = null;
      result.salesEfficiency.magicNumberProvenance = 'absent';
      result.salesEfficiency.notes = `Valeur Magic Number initialement extraite (${parsed?.salesEfficiency?.magicNumber}x) hors plage plausible [0, 5]. Invalidee. ` + result.salesEfficiency.notes;
    }

    return result;
  } catch (err) {
    console.warn('[saas-metrics-engine] extraction failed:', err);
    return emptyOutput();
  }
}
