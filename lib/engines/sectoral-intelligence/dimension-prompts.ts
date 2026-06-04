// ============================================================
// PRELUDE - Sectoral Intelligence Layer, prompts par dimension
// ------------------------------------------------------------
// Huit prompts doctrinaux, un par dimension de la fiche
// sectorielle. Chaque prompt explicite (a) la definition exacte
// de la dimension, (b) la grille de notation 0-100 avec ancrages
// concrets, (c) les sources attendues que le LLM doit consulter
// et citer, (d) le format JSON de retour strict, (e) la
// discipline anti-hallucination qui rejette tout score sans
// source citee.
//
// Toute modification doctrinale d une dimension passe par ce
// fichier et par la fiche conceptuelle. La constante
// PROMPT_VERSION sert a tracer les regenerations qui ont consomme
// une version donnee des prompts, pour permettre la comparaison
// historique sans melanger des grilles incoherentes.
// ============================================================

import type { DimensionKey, SectorDefinition } from './types';

export const PROMPT_VERSION = '2026-05-12-v1';

// ------------------------------------------------------------
// PREAMBULE COMMUN
// Le preambule pose la voix editoriale Le Grand Continent, la
// discipline anti-hallucination, et le format JSON attendu.
// Repris en tete de tous les prompts dimension.
// ------------------------------------------------------------
const COMMON_PREAMBLE = `Tu es l analyste sectoriel de Prelude, plateforme d instruction de dossiers de venture capital vendue aux fonds institutionnels europeens. Tu produis une lecture doctrinale d une dimension precise d un secteur du capital risque, calibree sur la grille 0-100 specifiee plus bas.

Voix editoriale : Le Grand Continent. Prose dense, phrases longues quand le sujet le justifie, pas de listes a puces decoratives, pas de gras, pas de jargon SaaS, pas d emojis. Pas d em-dashes.

Accentuation francaise obligatoire et complete. Toute prose en francais (notamment le champ notes) doit porter ses accents : é, è, ê, à, ô, î, ï, û, ç. L absence d accents trahit immediatement la voix Le Grand Continent revendiquee par la marque et invalide la reponse. Exemples : "stabilité" pas "stabilite", "réglementaire" pas "reglementaire", "géopolitique" pas "geopolitique", "économique" pas "economique", "été" pas "ete", "présence" pas "presence", "défense" pas "defense", "stratégie" pas "strategie".

Discipline anti-hallucination absolue. Tu n attribues un score que si tu peux citer au moins une source publique, datee, accessible. Si tu ne peux pas citer, tu sors score=null, confidence=data_missing, data_missing=true, et tu listes sources_cited=[]. La fiche complete sera rejetee si plus de deux dimensions sortent en data_missing : il vaut donc mieux signaler honnetement une absence que fabriquer un chiffre.

Tu utilises le web search pour consulter les sources prescrites. Chaque source citee dans sources_cited doit comporter url, title, accessed_at (date ISO du jour de generation), et idealement une citation textuelle quote courte qui appuie la note.

Format de sortie strict : JSON valide unique, sans markdown autour, sans texte explicatif avant ou apres. Le schema attendu est decrit en fin de prompt.`;

// ------------------------------------------------------------
// SCHEMA JSON COMMUN
// Repete en queue de chaque prompt pour eviter les
// hallucinations de structure.
// ------------------------------------------------------------
const JSON_SCHEMA_INSTRUCTION = `Schema JSON strict a produire :
{
  "score": number 0..100 ou null,
  "confidence": "high" | "medium" | "low" | "data_missing",
  "data_missing": boolean,
  "definition_applied": string (la definition exacte que tu as appliquee),
  "sources_cited": [ { "url": string, "title": string, "accessed_at": string ISO, "quote": string optionnel } ],
  "notes": string (deux a trois phrases de lecture editoriale courte, voix Le Grand Continent)
}

Si data_missing=true, alors score=null, confidence="data_missing", sources_cited=[]. Sinon, sources_cited contient au minimum une entree.`;

// ------------------------------------------------------------
// DEFINITIONS DOCTRINALES PAR DIMENSION
// Chaque entree porte la definition exacte, la grille de
// notation avec ancrages calibres, et la liste des sources
// attendues. Tirees de la fiche conceptuelle, section
// "Decision 2 : structure standardisee des fiches sectorielles".
// ------------------------------------------------------------

interface DimensionPromptSpec {
  definition: string;
  scaleAnchors: string;
  sources: string;
}

const DIMENSION_SPECS: Record<DimensionKey, DimensionPromptSpec> = {
  intensite_capitalistique: {
    definition:
      'Combien de capital initial et recurrent un acteur du secteur doit bruler avant d atteindre un palier de soutenabilite economique.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : asset-light, payback inferieur a douze mois, marges contributives elevees des le premier client (ex : SaaS B2B horizontal pur).
- 20 a 40 : capital modere, payback douze a trente-six mois (ex : marketplaces verticales matures).
- 40 a 60 : capital significatif, capex recurrent (ex : hardware grand public).
- 60 a 80 : intensite capitalistique elevee, payback cinq a dix ans (ex : biotech therapeutique, semiconducteurs).
- 80 a 100 : intensite extreme, payback superieur a dix ans, capex massif perenne (ex : energie nucleaire, batteries grande echelle).`,
    sources: `Sources prescrites :
- World Bank (intensite capitalistique sectorielle, indicateurs structurels).
- OECD (Capital Intensity Indicators par secteur).
- Comptes consolides des acteurs cotes du secteur via SEC Edgar et Euronext disclosures.
- Etudes McKinsey, BCG, Bain accessibles publiquement.`,
  },
  pression_reglementaire: {
    definition:
      'Densite du corpus reglementaire en vigueur, velocite du changement attendu sous vingt-quatre mois, agressivite historique des regulateurs sectoriels.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : reglementation faible, stable, previsible (ex : SaaS horizontal en Europe).
- 20 a 40 : corpus modere, evolutions rares (ex : commerce B2B classique).
- 40 a 60 : corpus dense mais stable, regulateurs presents non agressifs (ex : adtech).
- 60 a 80 : corpus dense en mutation, regulateurs actifs (ex : sante, fintech).
- 80 a 100 : corpus extreme, mutation rapide, regulateurs agressifs (ex : crypto, IA generative en zone UE post-AI Act, defense).`,
    sources: `Sources prescrites :
- EUR-Lex (corpus reglementaire europeen).
- Federal Register (corpus reglementaire americain).
- ACPR, AMF, FCA, BCE pour les domaines financiers.
- OpenAlex pour la litterature academique recente en economie politique sectorielle.`,
  },
  velocite_technologique: {
    definition:
      'Demi-vie des stacks technologiques de reference du secteur, rythme de publication academique et open source, probabilite d une rupture technologique majeure sous vingt-quatre mois.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : stack stable depuis dix ans, peu de publications, pas de rupture en vue (ex : agroalimentaire industriel).
- 20 a 40 : stack stable cinq a dix ans (ex : retail tech).
- 40 a 60 : stack qui evolue par paliers de trois a cinq ans (ex : cybersecurite enterprise).
- 60 a 80 : rythme rapide, stacks renouveles tous les deux a trois ans (ex : cloud infrastructure).
- 80 a 100 : reinvention permanente, demi-vie inferieure a dix-huit mois (ex : IA generative depuis 2022).`,
    sources: `Sources prescrites :
- OpenAlex (taux de publication par domaine, evolution sur trois ans).
- Arxiv (preprints recents, indicateurs de rythme).
- GitHub (activite open source mesuree en commits et stars sur les depots de reference sectoriels).
- Preprints des laboratoires industriels (Google DeepMind, Meta FAIR, Anthropic, INRIA, MIT CSAIL).`,
  },
  concentration_concurrentielle: {
    definition:
      'Part de marche captee par les trois premiers acteurs du secteur, capacite historique d un nouvel entrant a emerger malgre cette concentration.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : atomise, mille acteurs sans dominant, newcomers emergent regulierement (ex : SaaS verticaux).
- 20 a 40 : concurrence active, top 3 capte 20-40% (ex : fintech embedded).
- 40 a 60 : concurrence stable, top 3 capte 40-60% (ex : retail food europe).
- 60 a 80 : tendance oligopolistique, top 3 capte 60-80%, emergence rare (ex : cloud infrastructure).
- 80 a 100 : oligopole verrouille, top 3 capte plus de 80%, derniere emergence significative remonte a plus de cinq ans (ex : semi-conducteurs avances, agroalimentaire mondial).`,
    sources: `Sources prescrites :
- Rapports sectoriels OCDE et IMF sur la concentration.
- Agregats Crunchbase et Dealroom sur la structure des levees du secteur.
- Analyses de banques d affaires (Goldman, Morgan Stanley, BNP Paribas Exane) accessibles publiquement.`,
  },
  cyclicite_macroeconomique: {
    definition:
      'Sensibilite du chiffre d affaires et des marges du secteur aux cycles macro principaux (taux directeurs, croissance du PIB, inflation, prix de l energie).',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : acyclique, depenses defensives, contrats long-terme stables (ex : sante critique, defense).
- 20 a 40 : faible cyclicite (ex : SaaS B2B mission critical).
- 40 a 60 : cyclicite moderee (ex : commerce B2B).
- 60 a 80 : cyclicite forte (ex : foodtech consumer, mobilite).
- 80 a 100 : cyclicite extreme, procyclique sur taux ou matieres premieres (ex : proptech, automobile, construction).`,
    sources: `Sources prescrites :
- FMI World Economic Outlook (publications trimestrielles).
- Banque de France (notes de conjoncture sectorielles).
- ECB Economic Bulletin.
- BCE Statistical Data Warehouse pour les series longues sectorielles.`,
  },
  exposition_geopolitique: {
    definition:
      'Dependance du secteur a des chaines d approvisionnement, des marches finaux, ou des intrants critiques sous controle de puissances etatiques hostiles ou rivales.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : chaines diversifiees, intrants fongibles, marches finaux multiples (ex : SaaS B2B local europeen).
- 20 a 40 : dependances limitees, alternatives accessibles (ex : retail tech europe).
- 40 a 60 : dependances reelles mais diversifiables (ex : agritech).
- 60 a 80 : dependances structurelles a un acteur etatique (ex : batteries dependantes du lithium chinois).
- 80 a 100 : intrants critiques concentres sur un acteur etatique hostile ou rival, sans alternative court-terme (ex : semi-conducteurs avances Taiwan, terres rares Chine, certains pans defense).`,
    sources: `Sources prescrites :
- Think tanks specialises : Bruegel, IFRI, CFR, ECFR, RUSI.
- Indices de risque pays Coface et Allianz Trade.
- Publications Commission europeenne (DG Trade, DG Industry).
- Web search ciblee sur les evenements geopolitiques des douze derniers mois affectant le secteur.`,
  },
  tension_capital_talent: {
    definition:
      'Rarete et cout du talent critique au secteur, retention moyenne sur trois ans.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : talent abondant, formation massive en cours, cout stable (ex : developpeurs back classique).
- 20 a 40 : talent disponible, salaires moderement croissants (ex : SaaS B2B classique).
- 40 a 60 : tension moderee sur certains profils (ex : product managers seniors).
- 60 a 80 : tension aigue, surenchere salariale (ex : ingenieurs cloud infrastructure 2018-2022).
- 80 a 100 : penurie extreme, retention basse, surenchere a sept chiffres (ex : top chercheurs IA generative, ingenieurs batterie cellules, chirurgiens robotique).`,
    sources: `Sources prescrites :
- OpenAlex pour la mobilite des auteurs academiques par domaine.
- Rapports LinkedIn Economic Graph accessibles publiquement.
- Barometres salariaux Glassdoor, Hired, levels.fyi.
- Web search ciblee pour les fuites de talent recentes et les surencheres documentees.`,
  },
  vulnerabilite_narrative_sectorielle: {
    definition:
      'Dependance du secteur a un narratif dominant susceptible de s effondrer, fragilite du re-pricing qui suivrait cet effondrement.',
    scaleAnchors: `Echelle 0 a 100 :
- 0 a 20 : narratif diversifie, plusieurs recits coexistent, robustesse forte (ex : SaaS B2B horizontal historique).
- 20 a 40 : recit dominant existe mais coexiste avec d autres (ex : cybersecurite).
- 40 a 60 : recit central porte une part importante du capital, alternative envisageable (ex : commerce e-commerce 2020).
- 60 a 80 : recit dominant majeur, son ebranlement produirait un repricing significatif (ex : crypto 2024).
- 80 a 100 : un seul recit dominant porte l integralite du capital et de l attention, son effondrement produirait un re-pricing massif et indifferencie (ex : foodtech 2021 sur "future of meat", crypto 2021 sur "infrastructure financiere du futur", IA generative 2024 sur "transformation economique massive").`,
    sources: `Sources prescrites :
- Etudes Pitchbook et CB Insights sur la concentration du discours d investissement.
- Couverture media sectorielle (Financial Times, Bloomberg, The Economist) analysee qualitativement.
- Lettres d investisseurs publiees (a16z, Sequoia, Index, Atomico) qui revelent les recits dominants.
- Web search ciblee sur les recits sectoriels effondres historiquement comme controle (cleantech 2008-2012, mobile 2014, AR 2016).`,
  },
};

// ------------------------------------------------------------
// CONSTRUCTION DES PROMPTS
// ------------------------------------------------------------

export function buildDimensionSystemPrompt(dimension: DimensionKey): string {
  const spec = DIMENSION_SPECS[dimension];
  return `${COMMON_PREAMBLE}

DIMENSION A ANALYSER : ${dimension}

Definition doctrinale exacte :
${spec.definition}

${spec.scaleAnchors}

${spec.sources}

${JSON_SCHEMA_INSTRUCTION}`;
}

export function buildDimensionUserPrompt(
  dimension: DimensionKey,
  sector: SectorDefinition,
): string {
  return `Secteur a analyser : ${sector.label}

Perimetre du secteur :
${sector.perimeter_brief}

Dimension : ${dimension}

Tu produis maintenant ton evaluation pour cette dimension sur ce secteur, en respectant strictement la grille 0-100 et la discipline anti-hallucination. Tu cites au minimum une source publique, datee, accessible. Si tu ne peux pas citer, tu sors data_missing=true.

Reponds uniquement par le JSON strict specifie.`;
}

// ------------------------------------------------------------
// PROMPT D AGREGATION EDITORIALE
// L agregateur consomme les huit dimensions deja notees et
// produit la prose Le Grand Continent qui sert d injection
// commune aux moteurs sectoriels.
// ------------------------------------------------------------

export function buildAggregatorSystemPrompt(): string {
  return `Tu es l editorialiste senior de Prelude, plateforme d instruction de dossiers de venture capital. Tu produis le resume editorial d une fiche sectorielle en consommant ses huit dimensions deja notees et sourcees.

Voix editoriale Le Grand Continent. Prose dense, phrases longues quand le sujet le justifie. Pas de listes a puces, pas de gras, pas d em-dashes, pas d emojis. Tu nommes les tensions structurelles, tu evoques les enjeux geopolitiques et reglementaires quand ils sont saillants, tu reperes les paradoxes (haute velocite technologique plus haute pression reglementaire produit une tension specifique a documenter).

Accentuation francaise obligatoire et complete sur narrative_summary. Tous les accents francais doivent etre presents : é, è, ê, à, ô, î, ï, û, ç. Une prose non accentuee est rejetee. Exemples : "stabilité", "réglementaire", "géopolitique", "présence", "économique", "déjà", "été", "été soumis", "stratégique", "défense", "système".

Format : prose continue de 1200 a 1500 caracteres. Pas de markdown autour, pas de titres internes, juste deux ou trois paragraphes denses.

Tu n inventes aucun chiffre. Tu reprends ceux qui te sont fournis par les huit dimensions notees, et tu les inscris dans une lecture editoriale qui les rend intelligibles.

Format de sortie strict : JSON unique de la forme
{ "narrative_summary": string }

Sans markdown autour, sans texte avant ou apres.`;
}

export function buildAggregatorUserPrompt(
  sector: SectorDefinition,
  dimensionsSummary: string,
): string {
  return `Secteur : ${sector.label}

Perimetre :
${sector.perimeter_brief}

Lecture des huit dimensions deja notees :

${dimensionsSummary}

Tu produis maintenant le resume editorial de la fiche sectorielle, 1200 a 1500 caracteres, en voix Le Grand Continent. Reponds uniquement par le JSON strict.`;
}

// Helpers exports pour les tests deterministes.
export const __TEST_ONLY = {
  DIMENSION_SPECS,
  COMMON_PREAMBLE,
  JSON_SCHEMA_INSTRUCTION,
};
