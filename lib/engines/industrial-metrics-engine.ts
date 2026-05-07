// ============================================================
// INDUSTRIAL METRICS ENGINE - Extraction LLM dediee aux metriques
// industrielles, projet et B2G
// ------------------------------------------------------------
// Le moteur indicators-engine a desormais un set polymorphique
// (SaaS canonique vs industriel) selectionne par la matrice de
// pertinence. Pour les dossiers industriels, sept indicateurs
// cibles (marge unite, cycle commercial, carnet de commandes,
// working capital ratio, capex projet, capacite industrielle,
// taux de gain appels d offres) etaient majoritairement marques
// non-applicable parce que les donnees ne sont pas extractibles
// du BP standard.
//
// Ce moteur dedie corrige le probleme. Appel LLM cible (Sonnet)
// sur le pitch et le contenu textuel du BP, prompt structure qui
// demande explicitement les metriques industrielles. Le LLM
// n a pas a calculer, juste a extraire et qualifier la
// provenance (declared / inferred / absent).
//
// COUT : un appel Sonnet supplementaire par dossier industriel
// (typiquement 10 a 20% du flow), 2000 a 3000 tokens output.
// Justifie par le gain de signal sur les indicateurs cles d un
// dossier industriel.
//
// FALLBACK : si le moteur echoue, l output est un objet vide qui
// laisse indicators-engine retomber sur ses non-applicable
// rationalisees. Aucune regression.
// ============================================================

import { callClaudeWithPDF, parseJSON, MODEL } from './anthropic-client';
import type { ExtractionOutput } from './types';

// ============================================================
// TYPES
// ============================================================

export type IndustrialMetricProvenance = 'declared' | 'inferred' | 'absent';

/**
 * Resultat global de l extraction des metriques industrielles.
 * Les valeurs nulles signifient que le moteur n a pas pu extraire
 * la metrique : le BP ne la contient pas explicitement et elle
 * n est pas inferable de maniere robuste.
 */
export interface IndustrialMetricsExtraction {
  /** Cycle commercial moyen en mois, du premier contact a la signature.
   *  Hors phase de production. */
  commercialCycleMonths: number | null;
  commercialCycleProvenance: IndustrialMetricProvenance;

  /** Taille moyenne d un contrat ou d un projet, en EUR. */
  averageContractValueEur: number | null;
  averageContractValueProvenance: IndustrialMetricProvenance;

  /** Carnet de commandes : valeur totale signee non encore livree, EUR. */
  orderBacklogEur: number | null;
  orderBacklogProvenance: IndustrialMetricProvenance;

  /** Taux de gain sur appels d offres soumis (%). */
  tenderWinRatePct: number | null;
  tenderWinRateProvenance: IndustrialMetricProvenance;

  /** Capacite industrielle annuelle au stade actuel (unites par an). */
  annualProductionCapacityUnits: number | null;
  annualProductionCapacityProvenance: IndustrialMetricProvenance;

  /** Capex moyen par projet, en EUR. */
  capexPerProjectEur: number | null;
  capexPerProjectProvenance: IndustrialMetricProvenance;

  /** Working capital sur le dernier exercice, en EUR. Permet de
   *  calculer le ratio working capital / revenue. */
  workingCapitalEur: number | null;
  workingCapitalProvenance: IndustrialMetricProvenance;

  /** Marge brute par unite vendue (%). Confirme la valeur deja
   *  extraite par financial-extraction-engine si presente, ou
   *  l ajoute si elle manquait. */
  unitGrossMarginPct: number | null;
  unitGrossMarginProvenance: IndustrialMetricProvenance;

  /** Note synthetique en clair pour la note d investissement. */
  notes: string;

  /** True si l appel LLM a abouti, false en cas d erreur. */
  extractionSucceeded: boolean;
}

// ============================================================
// PROMPT SYSTEM
// ============================================================

const SYSTEM_PROMPT = `Tu es le Moteur d Extraction Metriques Industrielles de la plateforme Prelude. Tu extrais des metriques precises et structurees a partir d un pitch deck et d un business plan, pour un dossier dont le modele economique releve de la fabrication-vente, du projet long, ou du contrat B2G.

Ton role est d EXTRAIRE et de QUALIFIER, pas de calculer ni d inventer. Si une metrique n est pas presente dans les documents fournis, tu retournes null. Tu ne devines pas une capacite industrielle a partir de la taille de l equipe, tu ne calcules pas un cycle commercial a partir du sector. Tu prends uniquement ce qui est dit explicitement (declared) ou tres directement inferable d une donnee adjacente (inferred), et tu marques le reste absent.

# METRIQUES CIBLES

## Cycle commercial (commercialCycleMonths)
Duree moyenne du cycle commercial, du premier contact qualifie a la signature du contrat. Hors phase de production. Souvent declare en phrases : "cycle de vente 6 mois", "12 mois pour signer un contrat type", "appel d offre + negociation = 18 mois". Si plage donnee (6 a 12 mois), prendre la mediane.

## Taille moyenne contrat ou projet (averageContractValueEur)
Valeur moyenne d un contrat signe ou d un projet livre, en EUR. Variantes : ARR moyen par client (deguisé), facturation moyenne par projet, ticket moyen par mission, contrat type. Convertir en EUR si autre devise.

## Carnet de commandes (orderBacklogEur)
Valeur totale des contrats signes ou commandes fermes non encore facturees ou livrees, en EUR. Termes equivalents : pipeline ferme, backlog, carnet d ordres, contrats sous main. Ne pas confondre avec le pipeline commercial (LOI, discussions avancees) qui n est pas un carnet ferme.

## Taux de gain appels d offres (tenderWinRatePct)
Pourcentage des appels d offres soumis qui sont gagnes, sur les 24 derniers mois ou sur la duree de l existence de l entreprise. Souvent declare en phrase : "taux de gain 30%", "1 appel sur 3 gagne", "win rate 40%". Si exprimee comme ratio (1/3, 2/5), convertir en %.

## Capacite industrielle annuelle (annualProductionCapacityUnits)
Nombre maximal d unites que l entreprise peut produire par an au stade actuel. Pertinent pour fabrication unitaire (drones, machines, batiments modulaires). Souvent declare en phrase : "capacite annuelle 50 unites", "produit jusqu a 200 vehicules par an au max actuel". Si declare uniquement par mois ou trimestre, multiplier (12 ou 4) pour annualiser.

## Capex moyen par projet (capexPerProjectEur)
Investissement en capital moyen par projet livre, en EUR. Pertinent pour modeles SPV (special purpose vehicle), infrastructure, energie. Souvent declare en phrase : "capex projet type 5M EUR", "investissement par installation 3 a 8 millions". Convertir en EUR si autre devise.

## Working capital (workingCapitalEur)
Besoin en fonds de roulement sur le dernier exercice clos, en EUR. Souvent dans le BP financier : actifs circulants moins passifs circulants, ou directement BFR. Critique pour les modeles a cycle long ou les paiements clients tardent.

## Marge brute par unite (unitGrossMarginPct)
Pourcentage de marge brute sur une unite vendue : (prix unitaire moins cout direct unitaire) / prix unitaire. Hors overheads et frais de structure. Souvent declare en phrase : "marge brute 35%", "cout de revient 65% du prix de vente". Confirme ou complete la valeur extraite par financial-extraction-engine.

# FORMAT JSON OBLIGATOIRE

{
  "commercialCycleMonths": number ou null,
  "commercialCycleProvenance": "declared" | "inferred" | "absent",
  "averageContractValueEur": number ou null,
  "averageContractValueProvenance": "declared" | "inferred" | "absent",
  "orderBacklogEur": number ou null,
  "orderBacklogProvenance": "declared" | "inferred" | "absent",
  "tenderWinRatePct": number ou null,
  "tenderWinRateProvenance": "declared" | "inferred" | "absent",
  "annualProductionCapacityUnits": number ou null,
  "annualProductionCapacityProvenance": "declared" | "inferred" | "absent",
  "capexPerProjectEur": number ou null,
  "capexPerProjectProvenance": "declared" | "inferred" | "absent",
  "workingCapitalEur": number ou null,
  "workingCapitalProvenance": "declared" | "inferred" | "absent",
  "unitGrossMarginPct": number ou null,
  "unitGrossMarginProvenance": "declared" | "inferred" | "absent",
  "notes": "synthese 2-3 phrases sur ce qui a ete trouve et ce qui manque"
}

# REGLES STRICTES

1. Pas de devinette. Si une metrique n est pas dans le pitch ou le BP, retourne null + absent.
2. Plage plausible. Cycle commercial entre 1 et 60 mois. Win rate entre 0 et 100. Capacite annuelle positive. Marge brute entre -50 et 90.
3. Pas de pourcentage exprime en decimal (35% pas 0.35).
4. Conversion en EUR pour les montants (utiliser 1 USD = 0.92 EUR par defaut, 1 GBP = 1.16 EUR).
5. Si la donnee est presente dans une plage, prendre la mediane.
6. provenance = declared si la valeur est ecrite noir sur blanc dans les documents. inferred si elle est tres directement deductible (par exemple capacity mensuelle declare, on annualise). absent dans tous les autres cas.`;

// ============================================================
// HELPERS
// ============================================================

function emptyOutput(): IndustrialMetricsExtraction {
  return {
    commercialCycleMonths: null,
    commercialCycleProvenance: 'absent',
    averageContractValueEur: null,
    averageContractValueProvenance: 'absent',
    orderBacklogEur: null,
    orderBacklogProvenance: 'absent',
    tenderWinRatePct: null,
    tenderWinRateProvenance: 'absent',
    annualProductionCapacityUnits: null,
    annualProductionCapacityProvenance: 'absent',
    capexPerProjectEur: null,
    capexPerProjectProvenance: 'absent',
    workingCapitalEur: null,
    workingCapitalProvenance: 'absent',
    unitGrossMarginPct: null,
    unitGrossMarginProvenance: 'absent',
    notes: '',
    extractionSucceeded: false,
  };
}

function validateProvenance(raw: unknown): IndustrialMetricProvenance {
  if (raw === 'declared' || raw === 'inferred' || raw === 'absent') return raw;
  return 'absent';
}

/**
 * Garde-fou sur les ranges plausibles. Hors plage = invalide la
 * valeur (null + absent) plutot que de propager un chiffre fantaisiste.
 */
function applyPlausibilityGuards(r: IndustrialMetricsExtraction): IndustrialMetricsExtraction {
  if (r.commercialCycleMonths != null && (r.commercialCycleMonths < 1 || r.commercialCycleMonths > 60)) {
    r.commercialCycleMonths = null;
    r.commercialCycleProvenance = 'absent';
  }
  if (r.tenderWinRatePct != null && (r.tenderWinRatePct < 0 || r.tenderWinRatePct > 100)) {
    r.tenderWinRatePct = null;
    r.tenderWinRateProvenance = 'absent';
  }
  if (r.annualProductionCapacityUnits != null && r.annualProductionCapacityUnits < 0) {
    r.annualProductionCapacityUnits = null;
    r.annualProductionCapacityProvenance = 'absent';
  }
  if (r.unitGrossMarginPct != null && (r.unitGrossMarginPct < -50 || r.unitGrossMarginPct > 90)) {
    r.unitGrossMarginPct = null;
    r.unitGrossMarginProvenance = 'absent';
  }
  if (r.averageContractValueEur != null && r.averageContractValueEur < 0) {
    r.averageContractValueEur = null;
    r.averageContractValueProvenance = 'absent';
  }
  if (r.orderBacklogEur != null && r.orderBacklogEur < 0) {
    r.orderBacklogEur = null;
    r.orderBacklogProvenance = 'absent';
  }
  if (r.capexPerProjectEur != null && r.capexPerProjectEur < 0) {
    r.capexPerProjectEur = null;
    r.capexPerProjectProvenance = 'absent';
  }
  return r;
}

// ============================================================
// POINT D ENTREE
// ============================================================

/**
 * Extrait les metriques industrielles du pitch et du BP.
 *
 * @param deckBase64 PDF du pitch deck en base64
 * @param bpContent contenu textuel du BP
 * @param extraction extraction Bloc 1 deja faite, contexte du dossier
 * @returns extraction structuree, ou objet vide en cas d echec
 */
export async function extractIndustrialMetrics(
  deckBase64: string,
  bpContent: string | null,
  extraction: ExtractionOutput,
): Promise<IndustrialMetricsExtraction> {
  const userPrompt = `# CONTEXTE DOSSIER

Societe : ${extraction.companyName}
Secteur : ${extraction.sector}${extraction.subSector ? ' / ' + extraction.subSector : ''}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount || ''}
Geographie : ${extraction.country || 'non precise'}

Le pitch deck est joint.${bpContent ? '' : ' Aucun business plan separe disponible : tu travailles uniquement sur le deck.'}

${bpContent ? `# BUSINESS PLAN (extrait textuel)

${bpContent.slice(0, 8000)}

` : ''}# INSTRUCTIONS

Cherche les metriques industrielles selon le format JSON specifie : cycle commercial, taille moyenne contrat, carnet de commandes, taux de gain appels d offres, capacite industrielle annuelle, capex moyen par projet, working capital, marge brute par unite. Si une metrique n est pas trouvee, retourne null + absent. Tu ne devines pas, tu n inventes pas. Pas de donnee = null.`;

  try {
    const rawResponse = await callClaudeWithPDF(SYSTEM_PROMPT, userPrompt, deckBase64, 2500, MODEL);
    const parsed = parseJSON<IndustrialMetricsExtraction>(rawResponse);

    const result: IndustrialMetricsExtraction = {
      commercialCycleMonths: typeof parsed?.commercialCycleMonths === 'number' ? parsed.commercialCycleMonths : null,
      commercialCycleProvenance: validateProvenance(parsed?.commercialCycleProvenance),
      averageContractValueEur: typeof parsed?.averageContractValueEur === 'number' ? parsed.averageContractValueEur : null,
      averageContractValueProvenance: validateProvenance(parsed?.averageContractValueProvenance),
      orderBacklogEur: typeof parsed?.orderBacklogEur === 'number' ? parsed.orderBacklogEur : null,
      orderBacklogProvenance: validateProvenance(parsed?.orderBacklogProvenance),
      tenderWinRatePct: typeof parsed?.tenderWinRatePct === 'number' ? parsed.tenderWinRatePct : null,
      tenderWinRateProvenance: validateProvenance(parsed?.tenderWinRateProvenance),
      annualProductionCapacityUnits: typeof parsed?.annualProductionCapacityUnits === 'number' ? parsed.annualProductionCapacityUnits : null,
      annualProductionCapacityProvenance: validateProvenance(parsed?.annualProductionCapacityProvenance),
      capexPerProjectEur: typeof parsed?.capexPerProjectEur === 'number' ? parsed.capexPerProjectEur : null,
      capexPerProjectProvenance: validateProvenance(parsed?.capexPerProjectProvenance),
      workingCapitalEur: typeof parsed?.workingCapitalEur === 'number' ? parsed.workingCapitalEur : null,
      workingCapitalProvenance: validateProvenance(parsed?.workingCapitalProvenance),
      unitGrossMarginPct: typeof parsed?.unitGrossMarginPct === 'number' ? parsed.unitGrossMarginPct : null,
      unitGrossMarginProvenance: validateProvenance(parsed?.unitGrossMarginProvenance),
      notes: typeof parsed?.notes === 'string' ? parsed.notes : '',
      extractionSucceeded: true,
    };

    return applyPlausibilityGuards(result);
  } catch (err) {
    console.warn('[industrial-metrics-engine] extraction failed:', err);
    return emptyOutput();
  }
}
