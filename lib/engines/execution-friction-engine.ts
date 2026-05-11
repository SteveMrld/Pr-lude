// ============================================================
// MOTEUR FRICTION D EXECUTION COMMERCIALE ET INDUSTRIELLE
// ------------------------------------------------------------
// Decrit la distance structurelle entre la startup et son chemin
// vers le revenu. Ne penalise pas les profils a friction elevee :
// les decrit objectivement pour permettre a l investisseur de
// calibrer sa these (calendrier, capital patient, partenariats
// requis, conditions de reussite).
//
// Detection deterministe sur 8 flags. Si moins de 2 flags
// positifs : verdict not_applicable, pas d appel LLM. Pour les
// SaaS B2B classiques avec petits ACV : moteur silencieux.
//
// Si triggered, 8 axes evalues par LLM avec donnees du dossier :
//
//   1. Friction go-to-market commercial (capacite a conclure
//      les deals annonces vu track record et reins financiers).
//   2. Friction de financement transactionnel (bonding, avances
//      de tresorerie, cycles de paiement clients longs).
//   3. Friction industrialisation (proto vers serie, capex
//      outillage, MOQ, courbe d apprentissage).
//   4. Friction supply chain et geopolitique (composants
//      critiques, dependances pays sources).
//   5. Friction adoption technologique et infrastructure
//      ecosysteme (maturite, switching cost, ROI client).
//   6. Friction regulation produit et certification (normes,
//      homologation, delais).
//   7. Friction referencement client institutionnel (UGAP, GSA,
//      qualifications fournisseur, listes agrees).
//   8. Friction talent technique rare (ingenieurs specialises
//      pour deeptech / hardware avance).
//
// Verdict descriptif sur 4 niveaux : friction_low / medium / high
// / structural. Le mot "structural" remplace "blocking" : une
// friction structurelle n est pas une condamnation, c est une
// caracteristique du business qui appelle une strategie specifique.
// ============================================================

import type {
  ExtractionOutput,
  FinancialDataExtraction,
  ExecutionFrictionOutput,
  ExecutionFrictionAxis,
  ExecutionFrictionFlag,
} from './types';
import { callClaude, parseJSON, MODEL } from './anthropic-client';
import { formatExtractionGeography } from './fund-context';

// ============================================================
// Detection deterministe des 8 flags
// ============================================================

// Hardware physique : production de biens materiels.
const HARDWARE_KEYWORDS = [
  'hardware', 'manufacturing', 'usine', 'production industrielle',
  'fabrication', 'fabriqu', 'industrialis', 'serie', 'prototype',
  'composant', 'assemblage', 'capteur', 'electronique', 'mecanique',
  'robot', 'machine', 'equipement', 'piece', 'piÃ¨ce',
  'embarqu', 'iot', 'object connect', 'objet connecté',
  'drone', 'vehicule', 'véhicule', 'sous-marin', 'aeronef', 'aéronef',
  'navire', 'bateau', 'foilboard', 'sup', 'paddle',
];

// Client B2G ou semi-etatique : vente a l Etat ou a des
// donneurs d ordre publics, paraétatiques, ou grands groupes
// avec process formels lourds.
const B2G_KEYWORDS = [
  'etat', 'État', 'public', 'collectivite', 'collectivité',
  'ministere', 'ministère', 'defense', 'défense', 'militaire',
  'aeroport', 'aéroport', 'port', 'sncf', 'edf', 'orano', 'cea',
  'dga', 'dgsi', 'ratp', 'enedis', 'engie', 'arianegroup',
  'thales', 'safran', 'naval group', 'mbda',
  'appel d\'offres', 'rfp', 'marche public', 'marché public',
  'commande publique', 'gendarmerie', 'police', 'armee', 'armée',
  'semi-etatique', 'semi-étatique', 'parapublic', 'parapublique',
  'agence nationale', 'pole emploi', 'pôle emploi',
];

// Deeptech non standardisee : technologie qui n est pas encore
// installee comme standard de marche.
const DEEPTECH_KEYWORDS = [
  'hydrogene', 'hydrogène', 'hydrogen',
  'quantum', 'quantique', 'fusion nucleaire', 'fusion nucléaire',
  'biotech', 'biotechnologie', 'genomique', 'génomique', 'crispr',
  'space', 'spatial', 'satellite', 'lanceur',
  'photonique', 'supraconducteur', 'supraconductivit',
  'materiaux avances', 'matériaux avancés', 'graphene', 'graphène',
  'pile a combustible', 'pile à combustible', 'fuel cell',
  'eolien offshore flottant', 'éolien offshore flottant',
  'capture carbone', 'ccus', 'electrolyse', 'électrolyse',
  'small modular reactor', 'smr', 'thorium',
  'agri-tech ferme verticale', 'protein alternative',
];

// Capex significatif : investissement industriel lourd avant
// validation commerciale.
const CAPEX_KEYWORDS = [
  'gigafactory', 'usine', 'site industriel', 'capex',
  'ligne de production', 'unite de production', 'unité de production',
  'investissement industriel', 'pilote industriel',
  'demonstrateur', 'démonstrateur', 'unite pilote', 'unité pilote',
  'mise en service', 'commissioning',
];

// Supply chain critique : dependance composants sensibles avec
// exposition geopolitique.
const SUPPLY_CHAIN_KEYWORDS = [
  'semi-conducteur', 'semiconductor', 'puce', 'chip',
  'wafer', 'asml', 'tsmc', 'samsung foundry',
  'terre rare', 'terres rares', 'rare earth',
  'lithium', 'cobalt', 'nickel cellule', 'cathode', 'anode',
  'batterie cellule', 'cell',
  'taiwan', 'taïwan', 'chine fournisseur', 'china supplier',
  'composant critique', 'piece detachee', 'pièce détachée',
];

// Cycle de vente long : >12 mois entre premier contact et signature.
const LONG_CYCLE_KEYWORDS = [
  '12 mois', '18 mois', '24 mois', 'plusieurs annees', 'plusieurs années',
  'cycle de vente', 'cycle long', 'sales cycle',
  'phase pilote', 'pilot phase', 'poc', 'proof of concept',
  'validation client', 'reference deployment',
  'appel d\'offres', 'rfp', 'rfi',
  'rfx', 'tender',
  'qualification fournisseur', 'pre-qualification', 'préqualification',
];

// Regulation produit / certification.
const REGULATED_KEYWORDS = [
  'ce marking', 'marquage ce', 'certification ce',
  'fda', 'ema', 'ansm', 'mdr', 'ivdr',
  'easa', 'faa', 'transports canada', 'oaci', 'icao',
  'iso 13485', 'iso 9001', 'iso 27001', 'iso 14001',
  'homologation', 'homologue', 'homologué',
  'agrement', 'agrément', 'autorisation de mise sur le marche',
  'autorisation de mise sur le marché',
  'norme nf', 'norme en', 'din', 'rohs', 'reach',
  'gdpr', 'rgpd', 'hipaa', 'hds', 'hebergeur de donnees de sante',
  'hébergeur de données de santé',
  'secret defense', 'secret défense', 'classifie', 'classifié',
  'banque de france', 'acpr', 'amf',
];

// Dependance ecosysteme externe absent ou immature.
const ECOSYSTEM_KEYWORDS = [
  'station hydrogene', 'station hydrogène', 'station de recharge',
  'borne de recharge', 'infrastructure de recharge',
  'reseau de stations', 'réseau de stations',
  'infrastructure absente', 'écosystème embryonnaire',
  'ecosystem nascent', 'ecosystem early',
  'norme a definir', 'norme à définir', 'standardisation en cours',
  'reseau distribution a construire', 'réseau distribution à construire',
];

function detectKeywords(text: string, keywords: string[]): { detected: boolean; matched: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      matched.push(kw);
    }
  }
  return { detected: matched.length > 0, matched };
}

function buildFlag(detected: boolean, evidence: string): ExecutionFrictionFlag {
  return { detected, evidence };
}

function detectFlags(extraction: ExtractionOutput, rawSummary: string): ExecutionFrictionOutput['flags'] {
  // Concatene tout le texte exploitable du dossier
  const fullText = [
    extraction.companyName,
    extraction.sector,
    extraction.subSector,
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    rawSummary,
    (extraction.competitorsCited || []).join(' '),
    (extraction.clientsNamed || []).map((c) => `${c.name} ${c.company || ''} ${c.relationship || ''}`).join(' '),
  ].filter(Boolean).join(' ');

  const hardware = detectKeywords(fullText, HARDWARE_KEYWORDS);
  const b2g = detectKeywords(fullText, B2G_KEYWORDS);
  const deeptech = detectKeywords(fullText, DEEPTECH_KEYWORDS);
  const capex = detectKeywords(fullText, CAPEX_KEYWORDS);
  const supplyChain = detectKeywords(fullText, SUPPLY_CHAIN_KEYWORDS);
  const longCycle = detectKeywords(fullText, LONG_CYCLE_KEYWORDS);
  const regulated = detectKeywords(fullText, REGULATED_KEYWORDS);
  const ecosystem = detectKeywords(fullText, ECOSYSTEM_KEYWORDS);

  return {
    hardware: buildFlag(
      hardware.detected,
      hardware.detected ? `Mots-cles hardware detectes : ${hardware.matched.slice(0, 3).join(', ')}` : 'Aucun signal hardware'
    ),
    b2g_or_semi_state: buildFlag(
      b2g.detected,
      b2g.detected ? `Indice B2G ou semi-etatique : ${b2g.matched.slice(0, 3).join(', ')}` : 'Aucun client public ou semi-etatique identifie'
    ),
    deeptech_unstandardized: buildFlag(
      deeptech.detected,
      deeptech.detected ? `Indice deeptech : ${deeptech.matched.slice(0, 3).join(', ')}` : 'Pas de revendication deeptech'
    ),
    capex_significant: buildFlag(
      capex.detected,
      capex.detected ? `Indice capex industriel : ${capex.matched.slice(0, 3).join(', ')}` : 'Pas de capex industriel significatif'
    ),
    supply_chain_critical: buildFlag(
      supplyChain.detected,
      supplyChain.detected ? `Indice supply chain critique : ${supplyChain.matched.slice(0, 3).join(', ')}` : 'Pas de dependance supply chain identifiee'
    ),
    long_sales_cycle: buildFlag(
      longCycle.detected,
      longCycle.detected ? `Indice cycle de vente long : ${longCycle.matched.slice(0, 3).join(', ')}` : 'Pas de signal cycle long'
    ),
    regulated_certification: buildFlag(
      regulated.detected,
      regulated.detected ? `Indice regulation / certification : ${regulated.matched.slice(0, 3).join(', ')}` : 'Pas de revendication de certification'
    ),
    ecosystem_dependency: buildFlag(
      ecosystem.detected,
      ecosystem.detected ? `Indice dependance ecosysteme : ${ecosystem.matched.slice(0, 3).join(', ')}` : 'Pas de dependance ecosysteme externe identifiee'
    ),
  };
}

function countDetectedFlags(flags: ExecutionFrictionOutput['flags']): number {
  return Object.values(flags).filter((f) => f.detected).length;
}

// ============================================================
// System prompt LLM : evaluation des 8 axes
// ============================================================

const SYSTEM_PROMPT = `Tu es le Moteur de Friction d'Execution Commerciale et Industrielle de la plateforme Prélude.

PRINCIPE FONDAMENTAL : ton role est de DECRIRE objectivement la distance structurelle entre la startup et son chemin vers le revenu. Tu ne penalises pas les profils a friction elevee. Une boite deeptech avec friction industrielle elevee n'est pas une mauvaise boite : c'est une boite qui a un chemin plus long et plus capital-intensive vers le revenu, et l'investisseur doit le savoir pour calibrer sa these (capital patient, partenariats requis, calendrier).

Ton ton est neutre, factuel, descriptif. Tu ne dis JAMAIS "le projet est mauvais", "la boite ne pourra pas", "cela disqualifie". Tu dis "le profil presente une friction structurelle de niveau X", "l'execution requerra un capital patient", "les conditions de reussite incluent Y et Z".

Tu evalues HUIT AXES de friction d'execution. Pour chaque axe, tu produis :
- Un score de 0 a 100 (descriptif : 0 = friction nulle, 100 = friction structurelle maximale)
- Une evidence factuelle tiree du dossier
- Une implication pour la conduite de l'instruction
- 1 a 2 questions DD ciblees

# AXE 1 - GO-TO-MARKET COMMERCIAL
Capacite reelle de la startup a conclure les deals annonces. Vu son track record, ses references, sa taille de bilan : peut-elle candidater credibilement aux opportunites qu'elle decrit ? Pour un appel d'offres aeroport a 50M EUR, une seed a 1,5M EUR n'a pas le bilan ni l'historique : ce n'est pas une condamnation, c'est un fait qui appelle des partenaires industriels ou un calendrier plus long. Calibre sur taille deal vs taille boite.

# AXE 2 - FINANCEMENT TRANSACTIONNEL
Capacite financiere a EXECUTER les deals gagnes. Distinct du go-to-market. Beaucoup de gros contrats B2G ou industriels exigent un cautionnement bancaire (bonding) qui peut atteindre 5-15% du contrat. Les paiements clients sont souvent decales (60-180 jours). Une startup doit pouvoir avancer la tresorerie pendant 6-12 mois. Si le deal pese plus que le cash en banque, le deal est ingerable meme s'il est gagne.

# AXE 3 - INDUSTRIALISATION
Passage du proto a la serie. Capex outillage, MOQ fournisseurs, courbe d'apprentissage qualite, delais de production. Pour un SaaS pur : friction nulle. Pour du hardware : friction concrete et chiffrable. Decris les etapes manquantes entre le prototype et la production en serie commercialisable.

# AXE 4 - SUPPLY CHAIN ET GEOPOLITIQUE
Dependance a des composants critiques avec exposition geopolitique. Semi-conducteurs (TSMC Taiwan), terres rares (Chine), lithium (Australie/Chili), cellules batterie (Chine), composants RF (US ITAR). Cartographie les pays sources et les alternatives. Sans diaboliser : si la production necessite une matiere premiere dont 80% vient de Chine, c'est un fait a integrer dans la these.

# AXE 5 - ADOPTION TECHNOLOGIQUE ET ECOSYSTEME
Maturite de la techno cote marche : ecosysteme externe present ou absent, switching cost client, ROI utilisateur, education marche. Hydrogene mobilite en 2026 : infrastructure de stations inexistante, ROI utilisateur negatif, adoption early adopter only. Different d'un produit qui s'insere dans un ecosysteme mature.

# AXE 6 - REGULATION PRODUIT ET CERTIFICATION
Delais et couts d'homologation produit. CE / FDA / EASA / ISO selon le secteur. Decris les etapes regulatoires, leur duree typique, leur cout. Sans alarmer : preciser que certaines certifications sont passages obliges et chiffrer leur impact sur le runway.

# AXE 7 - REFERENCEMENT CLIENT INSTITUTIONNEL
Distinct de la regulation produit : c'est l'admission au statut de fournisseur potentiel pour vendre a l'Etat, aux grands groupes cotes, aux acteurs reglementes. UGAP en France, GSA aux US, listes de fournisseurs agrees chez energeticiens, hopitaux, operateurs telecoms. Souvent 12-24 mois et 100-500K EUR de compliance.

# AXE 8 - TALENT TECHNIQUE RARE
Pour deeptech et hardware : ingenieurs specifiques que le marche ne fournit pas en abondance (cellules hydrogene, propulsion electrique marine, certification aeronautique, microelectronique RF). Distinct du pedigree fondateur (que le moteur Equipe regarde). Ici on regarde la capacite a recruter et retenir les profils rares dont depend l'execution.

# VERDICT GLOBAL

Sur la base du score moyen pondere des axes pertinents (un axe avec score 0/100 sur un dossier ou il n'est pas concerne ne compte pas) :
- friction_low (score moyen <30) : path commercial direct, peu de friction structurelle, calendrier classique 12-24 mois jusqu'au product-market fit.
- friction_medium (30-55) : un goulot identifie ou cycles longs, calendrier 24-36 mois.
- friction_high (55-75) : plusieurs frictions concomitantes, calendrier 36-48 mois, capital patient requis.
- friction_structural (>75) : profil deeptech / B2G / industriel cumulant friction sur plusieurs axes. Pas une condamnation : caracteristique du business. Calendrier 48-72 mois, capital patient et partenariats industriels requis. La these d'investissement DOIT integrer ces conditions.

# REGLES DE STYLE

- Ton descriptif et neutre, jamais condamnant.
- Pas de "le dossier est mauvais", pas de "disqualifiant", pas de "redhibitoire".
- Privilegier "le profil presente une friction de niveau X qui appelle Y", "les conditions de reussite incluent Z", "le calendrier realiste est de N mois".
- Citer les axes par leur numero (1 a 8) dans la synthese.
- Pas d'em-dashes (jamais de "—" ou de "–"), uniquement des points-virgules ou des points.
- Pas de comparables historiques echec sortis hors contexte (Ynsect, WeWork, Theranos) sans match strict d'asset class.

# FORMAT JSON OBLIGATOIRE

{
  "axes": [
    {
      "axis": "go_to_market",
      "score": 0-100,
      "evidence": "ce qu'on lit du dossier (factuel)",
      "implication": "ce que cela signifie pour la conduite de l'instruction (descriptif)",
      "ddQuestions": ["question 1", "question 2"]
    },
    { "axis": "transactional_finance", ... },
    { "axis": "industrialization", ... },
    { "axis": "supply_chain_geopolitics", ... },
    { "axis": "tech_adoption_ecosystem", ... },
    { "axis": "product_regulation", ... },
    { "axis": "institutional_referencing", ... },
    { "axis": "rare_technical_talent", ... }
  ],
  "globalScore": 0-100,
  "verdict": "friction_low|friction_medium|friction_high|friction_structural",
  "questionsToInstruct": ["question DD 1", "question DD 2", "question DD 3", "question DD 4", "question DD 5"],
  "synthesis": "paragraphe descriptif et neutre de 4-6 phrases qui resume le profil de friction observe et ses implications strategie, calendrier, capital. Pas de jugement de valeur sur la qualite du projet."
}

Reponds UNIQUEMENT avec le JSON valide, sans bloc markdown.`;

// ============================================================
// Fonction principale
// ============================================================

export async function analyzeExecutionFriction(
  extraction: ExtractionOutput,
  financialData: FinancialDataExtraction | null,
  rawSummary: string,
): Promise<ExecutionFrictionOutput> {
  // Etape 1 : detection deterministe des flags
  const flags = detectFlags(extraction, rawSummary);
  const flagCount = countDetectedFlags(flags);

  // Si moins de 2 flags : not_applicable, pas d appel LLM
  if (flagCount < 2) {
    return {
      triggered: false,
      flags,
      axes: [],
      globalScore: 0,
      verdict: 'not_applicable',
      questionsToInstruct: [],
      synthesis: `Le profil du dossier ne presente pas de friction d'execution structurelle particuliere (${flagCount} flag${flagCount === 1 ? '' : 's'} sur 8 detecte${flagCount === 1 ? '' : 's'}). Le moteur de friction d'execution ne s'applique pas et le rendu UI peut masquer cette section.`,
    };
  }

  // Etape 2 : appel LLM pour evaluation des 8 axes
  const flagsList = Object.entries(flags)
    .map(([key, val]) => `- ${key} : ${val.detected ? 'DETECTE' : 'non detecte'} (${val.evidence})`)
    .join('\n');

  const userPrompt = `Donnees du dossier :

Societe : ${extraction.companyName ?? '?'}
Secteur : ${extraction.sector ?? '?'} / ${extraction.subSector ?? '?'}
Geographie : ${formatExtractionGeography(extraction)}
Annee fondation : ${extraction.yearFounded ?? 'non renseignee'}
Stage / montant : ${extraction.fundraise?.stage ?? '?'} / ${extraction.fundraise?.amount ?? '?'}

Pitch / produit :
${extraction.productDescription || ''}

Modele economique :
${extraction.businessModel || ''}

Marche :
${extraction.marketPitch || ''}

Concurrents cites : ${(extraction.competitorsCited || []).join(', ') || 'aucun'}
Clients cites : ${(extraction.clientsNamed || []).map((c) => c.name + (c.company ? ` (${c.company})` : '')).join(', ') || 'aucun'}

Donnees financieres ${financialData ? 'fournies' : 'non fournies dans le BP'} :
${financialData ? JSON.stringify(financialData).slice(0, 1500) : '(BP absent ou incomplet)'}

Synthese brute du pitch :
${rawSummary?.slice(0, 4000) || ''}

Flags deterministes detectes (${flagCount}/8) :
${flagsList}

Analyse les 8 axes de friction d'execution. Reponds UNIQUEMENT avec le JSON specifie.`;

  let llmResult: any;
  try {
    const response = await callClaude(SYSTEM_PROMPT, userPrompt, 3500, MODEL);

    llmResult = parseJSON(response);
  } catch (e) {
    // Fallback en cas d echec LLM : on retourne un not_applicable
    // soft avec les flags pour ne pas casser la pipeline.
    return {
      triggered: true,
      flags,
      axes: [],
      globalScore: 0,
      verdict: 'not_applicable',
      questionsToInstruct: [],
      synthesis: `Le moteur a detecte ${flagCount} flags de friction structurelle mais n'a pas pu produire l'analyse detaillee (erreur LLM). Les flags detectes sont presentes ci-dessus.`,
    };
  }

  // Validation et nettoyage des axes
  const axes: ExecutionFrictionAxis[] = Array.isArray(llmResult.axes)
    ? llmResult.axes.filter((a: any) => a && typeof a.axis === 'string').map((a: any) => ({
        axis: a.axis,
        score: typeof a.score === 'number' ? Math.max(0, Math.min(100, a.score)) : 0,
        evidence: a.evidence || '',
        implication: a.implication || '',
        ddQuestions: Array.isArray(a.ddQuestions) ? a.ddQuestions.slice(0, 3) : [],
      }))
    : [];

  const globalScore = typeof llmResult.globalScore === 'number'
    ? Math.max(0, Math.min(100, llmResult.globalScore))
    : 0;

  const validVerdicts = ['friction_low', 'friction_medium', 'friction_high', 'friction_structural'];
  const verdict = validVerdicts.includes(llmResult.verdict)
    ? llmResult.verdict as ExecutionFrictionOutput['verdict']
    : 'friction_medium';

  return {
    triggered: true,
    flags,
    axes,
    globalScore,
    verdict,
    questionsToInstruct: Array.isArray(llmResult.questionsToInstruct)
      ? llmResult.questionsToInstruct.slice(0, 5)
      : [],
    synthesis: llmResult.synthesis || '',
  };
}
