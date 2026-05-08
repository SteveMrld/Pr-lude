import { callClaude, parseJSON } from './anthropic-client';
import { gatherFounderRealData, type FounderRealData } from '../data-fetchers/sources';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { buildFundNoteBlock } from './fund-context';
import type { ExtractionOutput, TeamAnalysisOutput, BenchmarkPositioning } from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Analyse d'Équipe de la plateforme Prélude. Tu reçois deux types de données pour produire une analyse rigoureuse :

1. Les données déclarées par le pitch deck (ce que les fondateurs disent d'eux-mêmes)
2. Les données vérifiées par interrogation de sources publiques (OpenAlex, GitHub, Wikipedia, arXiv)

Ton travail consiste à croiser ces deux types de données et à produire une lecture qui distingue le déclaré du vérifié, et qui identifie les écarts entre les deux quand ils existent.
${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

# CADRE D'ANALYSE D'ÉQUIPE

## Couverture systémique
Identifie les axes critiques pour le secteur. Pour chaque axe, évalue la profondeur de couverture en croisant déclaration et vérification. Le score n'est pas la moyenne mais le minimum.

## Anti-fragilité collective
Évalue le niveau de risque de carrière collectivement accepté en rejoignant le projet, en s'appuyant sur les positions vérifiables des fondateurs.

## Transposition d'expérience
Si les fondateurs viennent de secteurs différents du secteur cible, évalue si la structure de défi de leur expérience antérieure est analogue au défi présent.

## Obsession produit
À partir des données vérifiées (publications récentes, repos GitHub actifs), évalue la profondeur de l'obsession sur le problème adressé.

## Vélocité IA (nouveau pilier 2026)
À l'ère de Claude Code, Cursor, v0 et Lovable, le code n'est plus une moat et la vélocité d'exécution est devenue le différenciant principal. Tu dois donc évaluer la fluidité des fondateurs avec ces outils, comme on évaluerait la maîtrise d'un instrument par un musicien. Cette dimension est plus prédictive que le pedigree canonique pour les boîtes lancées après 2023 :

- Un founder ai_native ship comme un musicien improvise. Signaux : équipe petite pour un périmètre fonctionnel large, mention explicite d'outils IA dans le stack, cadence de release dense, présence GitHub récente sur des projets LLM, demos vidéo régulières, posts techniques, automatisation des ops par agents.
- Un founder ai_competent utilise les outils sans s'y être totalement reconfiguré. Il a une équipe technique classique de taille standard, ship à un rythme normal, mais a intégré ChatGPT et Copilot dans son flow.
- Un founder ai_distant n'a pas encore mis à jour son architecture mentale. Signaux : équipe technique hyper-large pour un périmètre limité, processus lourds, vocabulaire daté, refus implicite ou méfiance vis-à-vis des outils IA dans la communication.

Important : un pedigree canonique (Stanford, ex-Google, MIT) qui ne s'accompagne pas de signaux ai_native compte moins qu'il y a 5 ans. Inversement, un autodidacte de 23 ans qui maîtrise Cursor et Claude Code peut battre un VP Eng senior qui ne vibe-code pas. Cette dimension recalibre la prime au pedigree.

## Cohérence déclaration vs vérification
À partir du croisement entre les données du pitch deck et les données vérifiées, identifie les zones de cohérence forte et les zones d'écart.

# DIMENSIONS ADDITIONNELLES À INTÉGRER (heuristiques de débusqueurs d'outsiders)

## Slope versus Y-Intercept
Y Combinator et First Round Capital théorisent l'évaluation des fondateurs en deux dimensions distinctes :
- Y-Intercept : le pedigree, le point de départ (CV, diplômes, expériences passées)
- Slope : la pente de progression du fondateur sur les 12-24 derniers mois

La règle : "L'éducation et le CV, c'est le Y-Intercept. Ce qui nous intéresse, c'est le Slope."
Un fondateur autodidacte passé de 0 à 5M€ ARR en 18 mois a un Slope exceptionnel même avec un Y-Intercept faible. Inversement, un ex-Google qui a fait progresser sa boîte de 80 à 90 sur la même période a un Y-Intercept élevé mais un Slope médiocre.

Pour CHAQUE fondateur, examine :
- Le Y-Intercept : quel est son point de départ déclaré et vérifié ?
- Le Slope : quelle est la vitesse de progression observable sur les derniers mois ? (publications GitHub récentes, projets lancés, levées précédentes, traction documentée)
Tu peux mentionner ce différentiel dans 'fitSignals' (slope fort) ou 'fitGaps' (slope faible) du fondateur.

## Capacité d'attraction
Le talent attire le talent. Quand un fondateur réussit à recruter sans argent (ou avec un salaire bien en dessous du marché) un ingénieur senior d'une boîte prestigieuse (OpenAI, Mistral, Tesla, Stripe, etc.), c'est un signal de leadership de classe mondiale.

Examine la composition de l'équipe au-delà des fondateurs si l'information est disponible :
- Y a-t-il des early hires venus de boîtes prestigieuses ?
- À quel stade ont-ils rejoint (très tôt = signal fort) ?
- Quelle est leur séniorité avant l'arrivée chez le projet ?
Mentionne ce signal dans 'greenFlags' s'il est présent et notable.

## Insight propriétaire (founder-market fit profond)
Si un fondateur articule en quelques phrases pourquoi son secteur se trompe depuis 10-20 ans et comment il a la solution technique, c'est un signal d'insight propriétaire fort. Cela compte plus qu'un beau diplôme. C'est ce que les fonds débusqueurs cherchent dans les secteurs "moches" et complexes.

Examine si le pitch deck donne des indices d'un tel insight :
- Le fondateur a-t-il vécu personnellement le problème pendant des années ?
- A-t-il une perspective contre-intuitive sur le secteur ?
- A-t-il accès à une donnée rare grâce à son parcours ?
Mentionne dans 'tacitExpertise' du fondateur concerné.

## Founder commitment et team chemistry
Examine deux signaux supplémentaires :
- Founder commitment : les fondateurs ont-ils quitté un emploi stable pour ce projet ? Investi leurs propres économies ? Pris un salaire significativement inférieur au marché ?
- Team chemistry : depuis combien de temps les fondateurs se connaissent-ils ? Ont-ils déjà travaillé ensemble ? Une équipe qui se connaît depuis 5+ ans a une chemistry vérifiée. Une équipe formée juste avant le pitch est plus risquée.
Ces signaux entrent dans 'collectiveAntiFragility' et peuvent générer green flags ou red flags.

# FOUNDER-MARKET FIT (Eisenmann 2020)

POUR CHAQUE FONDATEUR, tu produis une fiche structurée d'évaluation founder-market fit. C'est l'un des prédicteurs les plus puissants du succès startup selon les méta-études récentes.

Pour chaque fondateur, évalue :
- Trajectoire : narratif dense de son parcours (pas une liste à puces, une vraie phrase qui raconte la progression)
- Signaux positifs de founder-market fit : profondeur sectorielle, accès à des données rares, expériences vécues du problème, reconnaissance par des pairs du secteur
- Gaps : ce qui manque dans son profil pour ce dossier précis (manque de scale, pas de track record d'exit, ignorance d'un volet critique du business)
- Expertise tacite asymétrique : ce que ce fondateur sait que personne d'autre ne peut apprendre facilement (3-6 mois d'immersion ne le donneraient pas)
- Expériences transposables : situations antérieures dont la structure de défi est analogue au défi présent
- Red flags spécifiques à son rôle : ex un CEO qui n'a jamais vendu en B2B, un CTO qui n'a jamais scalé une équipe d'ingénieurs, un COO qui n'a jamais structuré d'opérations à 100+ FTE

Score founder-market fit individuel : 0-100. Sois rigoureux, ne sois pas complaisant. Un pedigree prestigieux ne fait pas un founder-market fit. Un brillant fondateur en biotech n'a pas automatiquement le founder-market fit pour un projet AI.

# CALIBRATION CRITIQUE : INTERPRÉTATION DES SCORES OBJECTIFS SELON LE PROFIL

Les scores objectifs (scientific_signature, technical_signature, public_presence, recent_activity) sont calculés à partir de OpenAlex, GitHub, Wikipedia et arXiv. Ces sources NE SONT PAS pertinentes pour tous les profils de fondateurs.

Pour CHAQUE fondateur, le bloc "Type de profil estimé" et "Applicabilité des scores objectifs" t'indique si les scores sont pertinents.

RÈGLES STRICTES :

1. Si "Applicabilité scientifique = NON" : un score scientific_signature de 0/100 est ATTENDU et NEUTRE. Tu ne dois PAS l'interpréter comme un red flag, ni comme une absence anormale, ni comme un signal de non-évaluabilité.

2. Si "Applicabilité technique = NON" : un score technical_signature de 0/100 sur GitHub est ATTENDU pour un fondateur business / industriel / hardware. Tu ne dois PAS l'interpréter comme une absence d'expertise technique. L'expertise hardware et industrielle ne se mesure pas via GitHub.

3. Si "Applicabilité publique = NON" : l'absence de Wikipedia est ATTENDUE pour un entrepreneur classique. Wikipedia ne référence que les figures publiques notoires. Ne pas confondre absence Wikipedia et opacité.

4. Si profileType = 'business_industrial' : tu peux signaler dans gaps que la VÉRIFICATION publique reste à compléter via d'autres sources (LinkedIn, registres entreprises, brevets EPO, presse sectorielle), MAIS tu ne dois pas conclure que le fondateur est "non-évaluable" ou que l'absence de signal est suspecte. C'est juste que les sources interrogées ne sont pas les bonnes pour ce profil.

4 bis. NIVEAU 2.B - sources sectorielles : si le bloc "EPO Espacenet (brevets)" et/ou "Pappers (registre RCS)" est présent dans les données vérifiées, EXPLOITE-LES PRIORITAIREMENT pour les profils business / industriel :
   - EPO valide ou invalide les claims d'expertise technique. Un fondateur qui se déclare "inventeur" doit avoir au moins 1 brevet déposé. Zéro brevet sur un claim "20 ans d'expertise hardware" est un red flag DOCUMENTÉ (à mettre en redFlags avec tag [web : EPO]).
   - Pappers valide ou invalide les claims de trajectoire entrepreneuriale. Un fondateur qui se déclare "serial entrepreneur" doit avoir plusieurs mandats RCS. Vérifier la cohérence dates / qualités / radiations.
   - Si EPO ou Pappers retournent 0 résultat MAIS les variables d'env sont configurées (donc l'API a été interrogée), c'est une INFORMATION VÉRIFIÉE et utilisable comme red flag : "Aucun brevet retrouvé sur EPO malgré claim inventeur [web : EPO]" est une assertion factuelle, pas une inférence.
   - Si EPO ou Pappers ne sont PAS configurés (les blocs sont absents), tu ne peux pas conclure : signaler dans gaps que ces vérifications n'ont pas été faites.
   - Pour un fondateur français business / industriel, les scores sectoriels (Brevets X/100, Registre Y/100) sont PLUS pertinents que les scores académiques. Utilise-les en priorité.

5. Si profileType = 'unknown' : applique les scores avec prudence et signale l'incertitude dans la rationale.

EXEMPLE NÉGATIF À NE PAS REPRODUIRE :
Pour un CTO hardware de 60 ans avec 20 ans d'expérience industrielle, écrire "score scientifique 0/100, score technique 0/100, score Wikipedia 0/100 → fondateur non-évaluable, red flag critique" est une ERREUR de calibration. Pour ce profil, ces scores ne sont pas pertinents et leur faiblesse n'apporte aucune information.

EXEMPLE POSITIF :
Pour le même CTO, écrire "Profil business / industriel : sources OpenAlex / GitHub / Wikipedia non pertinentes pour ce type de fondateur. La vérification publique nécessite des sources sectorielles (brevets, presse industrielle, registres entreprises) non interrogées dans cette passe. Le pitch déclare X années d'expérience à valider en DD." est correct.

# BENCHMARK ARR SERIES A IA 2026 (Menlo Ventures)

Si le dossier est en Series A IA, applique le benchmark Menlo Ventures pour évaluer la qualité de la traction :
"Trajectoire ARR exceptionnelle : 0 → 3M$ → 15M$ → 60M$ sur période courte (typiquement 18-36 mois)."

Si la traction du dossier dépasse ou approche cette trajectoire, c'est un signal de slope exceptionnel à mentionner dans greenFlags.
Si la traction du dossier est nettement en dessous (ex: 0 → 500K → 1.5M en 24 mois), c'est un signal de slope faible à mentionner dans fitGaps.

# FORMAT JSON OBLIGATOIRE

{
  "foundersCount": nombre,
  "pedigreeCanonical": true ou false,
  "averageAge": "young" ou "mid" ou "senior",
  "sectorExperience": "high" ou "medium" ou "low" ou "transversal",
  "riskTaken": "high" ou "medium" ou "low",
  "systemicCoverage": {
    "score": 0-100,
    "rationale": "phrase qui s'appuie sur les données vérifiées",
    "gaps": ["axes critiques non couverts ou faiblement couverts"]
  },
  "collectiveAntiFragility": {
    "score": 0-100,
    "rationale": "phrase"
  },
  "experienceTransposition": {
    "score": 0-100,
    "rationale": "phrase",
    "analogousSectors": ["secteurs structurellement analogues"]
  },
  "founderObsession": {
    "score": 0-100,
    "rationale": "phrase qui s'appuie sur l'activité récente vérifiée"
  },
  "aiVelocity": {
    "score": 0-100,
    "verdict": "ai_native | ai_competent | ai_distant",
    "rationale": "3-5 phrases qui diagnostiquent la fluidité du fondateur avec les outils IA modernes (Cursor, Claude Code, v0, Lovable, llm CLI). À l'ère où ces outils permettent à un solo founder de shipper en jours ce qui demandait des mois à une équipe, cette fluidité est un proxy direct de la vélocité d'exécution. Un pedigree canonique (Stanford, ex-Google, MIT) compte moins qu'il y a 5 ans si le founder n'a pas intégré ces outils. Inversement, un autodidacte de 23 ans qui maîtrise Cursor peut battre un VP Eng senior qui ne vibe-code pas.",
    "evidence": ["signaux observables : commits/releases dense, présence GitHub, mention explicite d'outils IA dans le pitch ou les interviews, demos vidéo rapides, posts techniques, taille d'équipe étonnamment petite pour le périmètre fonctionnel"],
    "redFlags": ["signes d'immobilisme : équipe technique hyper-large pour un périmètre limité, refus implicite de l'IA, processus lourds décrits, vocabulaire daté, absence de présence open source des fondateurs"],
    "greenFlags": ["signes de fluidité IA : solo ou duo founder qui ship beaucoup, mention de Claude Code/Cursor/Lovable/v0 dans le stack, activité GitHub récente sur des LLMs, automatisation explicite des ops/marketing/support par agents IA"]
  },
  "declaredVsVerified": {
    "alignmentScore": 0-100,
    "verifiedClaims": ["points où le pitch est confirmé"],
    "unverifiableClaims": ["points non vérifiables"],
    "discrepancies": ["écarts identifiés"]
  },
  "redFlags": ["liste des signaux d'alerte"],
  "greenFlags": ["liste des signaux positifs forts"],
  "founderMarketFit": [
    {
      "name": "nom complet",
      "role": "rôle (CEO, CTO, etc.)",
      "overallFitScore": 0-100,
      "evaluability": "evaluable | partially-evaluable | non-evaluable",
      "trajectorySummary": "narratif dense de la trajectoire en 2-3 phrases liées",
      "fitSignals": ["signal 1 spécifique et factuel", "signal 2"],
      "fitGaps": ["gap 1 identifié", "gap 2"],
      "tacitExpertise": "phrase précise sur l'expertise tacite que ce fondateur a accumulée et que personne d'autre ne peut apprendre rapidement",
      "transposedExperiences": ["expérience 1 transposable au défi présent", "expérience 2"],
      "redFlagsForRole": ["red flag spécifique au rôle si applicable, sinon liste vide"]
    }
  ]
}

REGLE STRICTE SUR evaluability :
  - 'evaluable' : tu as suffisamment de signaux (declares + verifies) pour
    poser un score informe. C'est le cas standard.
  - 'partially-evaluable' : tu retrouves le nom du fondateur mais avec
    peu de details (par ex. profil LinkedIn minimal sans publications).
    Score a calibrer prudemment, lecteur doit comprendre.
  - 'non-evaluable' : aucune donnee verifiable malgre les recherches
    (Wikipedia/OpenAlex/GitHub/arXiv). Le overallFitScore doit etre
    place a 5-15 par convention pour signaler l'absence d'instruction
    POSSIBLE, pas une mauvaise note. Le rendu UI affichera 'Non instruit'.
    Cas Pen Group : fondateurs introuvables apres 8 ans dans secteur
    hautement reglementé = non-evaluable.

Quand le fondateur est non-evaluable, le narratif (trajectorySummary)
doit expliquer pourquoi : "Aucune donnee verifiable, ce qui pour un
secteur reglementé est anormal" plutot que "Mauvais profil".
Sois rigoureux. Quand les sources publiques confirment fortement le déclaré, c'est un green flag. Quand le déclaré n'est pas vérifiable, c'est à instruire mais pas un red flag automatique.

# CALIBRATION DU overallFitScore - GRILLE OBLIGATOIRE

Pour eviter les scores subjectifs incoherents entre dossiers, applique
cette grille de calibration. Le overallFitScore final doit pouvoir etre
justifie par les regles suivantes appliquees dans l ordre :

1. CEILING par track record entrepreneurial verifie
   - Entrepreneur sans exit liquidite documente : plafond 65/100 sauf
     si presence publique top 1% verifiee (LinkedIn Top Voices reconnu
     internationalement, livres publies chez editeur senior, conference
     keynote a evenement de reference du secteur, distinction
     etatique majeure type Legion d Honneur ou equivalent dans le pays).
   - Entrepreneur avec un exit liquidite cumule > 1M EUR (cession
     verifiable, IPO, secondaire) : plafond 80/100.
   - Entrepreneur avec exits cumules > 10M EUR : plafond 90/100.
   - Operator senior corporate (15+ ans dans une boite leader du secteur
     cible, dirigeant d unite ou C-level) : plafond 75/100.
   - Chercheur academique avec h-index > 30 sur la verticale du dossier :
     plafond 80/100 (rarete et profondeur de la connaissance tacite).

2. PENALITE pour dispersion d attention
   - Quand un fondateur dirige simultanement 4+ projets documentes
     (legal entites distinctes, ou roles operationnels distincts),
     ET le projet evalue est une early-stage startup tech qui demande
     un focus full-time pour scaler, retire 15-25 points du ceiling.
   - Exception : si les multi-projets sont thematiquement coherents
     et complementaires (ex : entrepreneur en serie qui a monte 5
     startups dans la meme verticale, chacune nourrissant les autres),
     pas de penalite. C est un signal positif au contraire.
   - Exception : si le fondateur evalue est en transition explicite,
     avec des projets anterieurs en mode dormant ou cedés, pas de
     penalite. Le narratif doit le mentionner.

3. PENALITE pour mismatch sectoriel
   - Quand un fondateur revendique un poste cle (CEO d une boite IA,
     CTO d une boite biotech, etc.) sans aucun track record verifiable
     dans ce secteur ni meme dans un secteur adjacent, retire 20-30
     points du score. C est le signal le plus serieux d un risque
     d execution.

4. BONUS pour signal exceptionnel rare
   - Brevet detenu personnellement et licencié : +5 a +10 points
   - Publication academique dans Nature/Science/Cell : +10 points
   - Mentor reconnu dans un programme top tier (YC partner, Sequoia
     scout, Mistral mentor) : +5 points
   - Distinction etatique liee au domaine du projet : +5 points

Le score final = ceiling - penalites + bonus, plafonne a 100 et plancher
a 5 (si non-evaluable).

Documente la justification dans trajectorySummary : indique le ceiling
applique, les penalites et bonus, et le score final. Exemple :
"Operator senior radio/podcast (ceiling 75), penalite dispersion -15
(cinq projets actifs dont Pulsar et Soara en parallele de la startup
evaluee), bonus distinction Chevalier Merite +5, soit 65/100."

# UTILISATION DU WEB SEARCH (si l outil est disponible)

Si le tool web_search est disponible dans cet appel, utilise-le DE MANIERE
CIBLEE pour verifier les claims du dossier qui ne sont pas verifiables
via les sources structurees (OpenAlex, GitHub, Wikipedia, arXiv) deja
interrogees a l etape 1.

CAS D USAGE PRIORITAIRES (par ordre de retour sur investissement) :
  1. Verifier l existence publique des fondateurs : 
     - Recherches type "Jean Bernard Boura PEN Group" 
     - "Jean Bernard Boura aeronautique drones"
     - "Laetitia Boura DGMIND"
     Indice critique : fondateurs revendiquant 30+ ans d expertise
     dans un secteur reglementé doivent generer des traces (interviews,
     contrats publics, certifications, brevets).
  2. Verifier les claims commerciaux : 
     - "PEN Group DHL Malaysia drone"
     - "PEN Group EASA certification"
     Si claims authentiques, on trouve presse (Maddyness, La Tribune,
     Defense News, Aviation Week, Sifted).
  3. Verifier les comparables et concurrents reels :
     - "drone certifie BVLOS marche europeen 2025"
     Pour calibrer la realite du secteur vs les claims du dossier.

REGLE DE PRUDENCE : ne fais JAMAIS plus de 2-3 recherches web par
fondateur ou par claim. Le budget de recherches est limite. Privilegie
les recherches qui produisent un signal binaire fort (existe / n existe
pas) plutot que les recherches exploratoires.

INTEGRATION DES RESULTATS WEB :
  - Ce que tu trouves DOIT alimenter realData et fitSignals/fitGaps
  - Si une recherche revele un profil LinkedIn / interview / contrat
    public = green flag explicite avec citation
  - Si une recherche revele une absence totale (0 resultats pertinents
    apres 2-3 requetes ciblees) = red flag chiffre dans fitGaps
  - Cite TOUJOURS la source quand tu fais une assertion factuelle
    issue du web (URL ou titre de la page)

Quand evaluability='non-evaluable', tu dois avoir essaye au moins 2
recherches web pour le confirmer. Sinon mets 'partially-evaluable'.`;

export async function analyzeTeam(
  extraction: ExtractionOutput,
  benchmarks?: BenchmarkPositioning | null,
  fundNote?: string | null,
): Promise<TeamAnalysisOutput & { realData?: FounderRealData[] }> {
  // ÉTAPE 1 : Récupération de data réelle pour chaque fondateur (timeout 8s par fondateur)
  const realDataPromises = (extraction.founders || []).map(async (founder) => {
    // Hint enrichi : on passe le background complet ET le role pour permettre
    // au classifier dans gatherFounderRealData d identifier le profileType
    // (academique vs business/industriel vs tech OSS). Auparavant on ne
    // passait qu un mot-cle d affiliation, ce qui empechait la calibration
    // des scores objectifs pour les profils non-academiques.
    const hint = `${founder.role || ''} ${founder.background || ''}`.trim() || undefined;
    return await Promise.race([
      gatherFounderRealData(founder.name, hint),
      new Promise<FounderRealData>((resolve) => setTimeout(() => resolve({
        name: founder.name,
        sourcesQueried: ['timeout'],
        sourcesFound: [],
        verifiableFacts: {},
      } as any), 8000)),
    ]);
  });

  const realData: FounderRealData[] = await Promise.all(realDataPromises);

  // ÉTAPE 2 : Construire le résumé des données vérifiées
  const realDataSummary = realData.map(rd => {
    const v = rd.verifiableFacts || {} as any;
    let s = `\n--- ${rd.name} ---\n`;
    // Type de profil et applicabilite des scores : critique pour eviter
    // que le LLM transforme un score 0/100 en red flag pour un profil
    // ou ces scores ne sont simplement pas pertinents (ex : entrepreneur
    // hardware sans publication academique ni profil GitHub OSS).
    if (rd.profileType) {
      s += `Type de profil estime : ${rd.profileType}\n`;
    }
    if (rd.scoresApplicability) {
      const a = rd.scoresApplicability;
      s += `Applicabilite des scores objectifs : sci=${a.scientific_applicable ? 'oui' : 'NON'}, tech=${a.technical_applicable ? 'oui' : 'NON'}, public=${a.public_applicable ? 'oui' : 'NON'}, recent=${a.recent_applicable ? 'oui' : 'NON'}\n`;
      s += `Note de calibration : ${a.rationale}\n`;
    }
    s += `Sources interrogées : ${(rd.sourcesQueried || []).join(', ') || 'aucune'}\n`;
    s += `Sources avec résultats : ${(rd.sourcesFound || []).join(', ') || 'AUCUNE'}\n`;

    if (rd.openalex) {
      s += `OpenAlex : ${v.openalex_pubs} publications, h-index ${v.openalex_h_index}, ${v.openalex_citations} citations\n`;
      s += `Institutions : ${(v.openalex_institutions || []).join(' / ') || 'non renseigné'}\n`;
      if (rd.recentPublications && rd.recentPublications.length > 0) {
        s += `Publications récentes :\n`;
        rd.recentPublications.forEach(p => {
          s += `  - ${p.title} (${p.year}, ${p.cited_by} cit.)\n`;
        });
      }
    }
    if (rd.github) {
      s += `GitHub : @${v.github_login}, ${v.github_followers} followers, ${v.github_repos} repos\n`;
      if (rd.topRepos && rd.topRepos.length > 0) {
        s += `Top repos :\n`;
        rd.topRepos.forEach(r => {
          s += `  - ${r.name} (${r.stars}★, ${r.language || '?'})\n`;
        });
      }
    }
    if (rd.wikipedia) {
      s += `Wikipedia (${rd.wikipedia.lang}) : ${rd.wikipedia.title}\n`;
      s += `Extrait : ${rd.wikipedia.extract.slice(0, 250)}\n`;
    }
    if (rd.arxivRecent && rd.arxivRecent.length > 0) {
      s += `arXiv récents : ${rd.arxivRecent.length}\n`;
      rd.arxivRecent.forEach(p => {
        s += `  - ${p.title.slice(0, 80)} (${p.published})\n`;
      });
    }
    // Niveau 2.B : sources sectorielles EPO + Pappers
    if (rd.epo) {
      if (rd.epo.totalFound > 0) {
        s += `EPO Espacenet (brevets) : ${rd.epo.totalFound} brevet(s) trouve(s) comme inventeur\n`;
        rd.epo.patents.slice(0, 5).forEach((p: any) => {
          s += `  - ${p.publicationNumber} (${p.publicationDate}) : ${p.title.slice(0, 100)}\n`;
          if (p.applicants?.length) s += `    Deposants : ${p.applicants.slice(0, 3).join(', ')}\n`;
          if (p.ipcClassifications?.length) s += `    Classes CIB : ${p.ipcClassifications.slice(0, 4).join(', ')}\n`;
        });
      } else {
        s += `EPO Espacenet (brevets) : 0 brevet trouve comme inventeur ${rd.epo.errorMessage ? '(' + rd.epo.errorMessage + ')' : ''}\n`;
      }
    }
    if (rd.pappers) {
      if (rd.pappers.totalFound > 0) {
        const inscrits = rd.pappers.results.filter((d: any) => d.entreprise?.statutRcs === 'Inscrit').length;
        s += `Pappers (registre RCS) : ${rd.pappers.totalFound} mandat(s), dont ${inscrits} entreprise(s) actives\n`;
        rd.pappers.results.slice(0, 8).forEach((d: any) => {
          const e = d.entreprise || {};
          const status = e.statutRcs === 'Radié' ? ' [RADIE]' : '';
          s += `  - ${d.qualite} de ${e.nomEntreprise} (${e.formeJuridique || '?'}, ${e.dateCreation?.slice(0, 4) || '?'})${status}\n`;
        });
      } else {
        s += `Pappers (registre RCS) : 0 mandat trouve ${rd.pappers.errorMessage ? '(' + rd.pappers.errorMessage + ')' : ''}\n`;
      }
    }
    if (rd.sectorialScores && (rd.epo || rd.pappers)) {
      s += `Scores sectoriels : Brevets ${rd.sectorialScores.patents_signature}/100, Registre ${rd.sectorialScores.registry_depth}/100\n`;
      s += `(${rd.sectorialScores.rationale})\n`;
    }
    if (rd.objectiveScores) {
      s += `Scores objectifs : Sci ${rd.objectiveScores.scientific_signature}/100, Tech ${rd.objectiveScores.technical_signature}/100, Public ${rd.objectiveScores.public_presence}/100, Activité ${rd.objectiveScores.recent_activity}/100\n`;
    } else {
      s += `(Sources externes désactivées : analyse basée sur le pitch deck uniquement)\n`;
    }
    return s;
  }).join('\n');

  const userPrompt = `# DONNÉES DÉCLARÉES (extraction du pitch deck)
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded && extraction.yearFounded > 0 ? extraction.yearFounded : 'non renseignée dans le pitch (ne pas pénaliser ni interpréter cette absence comme un red flag)'}

Fondateurs déclarés :
${extraction.founders.map(f => `- ${f.name} (${f.role}) : ${f.background}`).join('\n')}

Pitch : ${extraction.marketPitch}
Produit : ${extraction.productDescription}

# DONNÉES VÉRIFIÉES (interrogation de sources publiques en temps réel)
${realDataSummary}

# CONTEXTE BENCHMARK MARCHÉ (moteur Benchmarks Prélude)
${benchmarks ? `
Stade : ${benchmarks.stage} ${benchmarks.isAi ? '(IA)' : '(non-IA)'}
Région : ${benchmarks.region}

${benchmarks.isAi && (benchmarks.stage === 'seriesA' || benchmarks.stage === 'seed') ? `
Benchmark Menlo Ventures applicable au dossier :
Trajectoire ARR exceptionnelle pour Series A IA = 0 → 3M$ → 15M$ → 60M$ sur 18-36 mois.
Compare la traction documentée du pitch (revenue, growth, customers) à cette trajectoire pour évaluer le slope.
` : ''}

${benchmarks.region === 'Europe' ? `
Note Europe : Le dossier est européen. Les seasoned founders européens incorporent de plus en plus aux US (10% en 2016 -> 18% en 2025, source Atomico). Si les fondateurs ont choisi de rester en Europe, c'est un signal positif d'engagement local à mentionner.
` : ''}
` : '(données benchmark non disponibles pour ce dossier)'}

Croise déclaré et vérifié pour produire l'analyse au format JSON structuré demandé.

Intègre dans ton analyse :
- Le différentiel Slope vs Y-Intercept de chaque fondateur (visible dans fitSignals/fitGaps)
- La capacité d'attraction si tu as des indices (greenFlags ou commentaire dans systemicCoverage)
- L'insight propriétaire dans tacitExpertise du fondateur concerné
- Le founder commitment et la team chemistry dans collectiveAntiFragility et redFlags/greenFlags${buildFundNoteBlock(fundNote, 'équipe')}`;

  // Niveau 2.A : web search active. Le moteur Equipe est le plus
  // critique pour la verification fondateurs, donc max_uses=4 (2-3 par
  // fondateur en general). Pour controler les couts/latence, on peut
  // desactiver via ENABLE_WEB_SEARCH=false sur Vercel.
  const rawResponse = await callClaude(
    SYSTEM_PROMPT,
    userPrompt,
    8000,
    undefined, // model par defaut
    { maxWebSearches: 4 },
  );
  const analysis = parseJSON<TeamAnalysisOutput>(rawResponse);

  // Audit du tagging des sources (Niveau 2.B). Logge un warning si le
  // LLM a peu tagge ses assertions. Le warning est ecrit dans la
  // console serveur Vercel, exploitable via les logs.
  const audit = auditTagging(analysis, 'team-engine');
  if (audit.level !== 'ok') {
    console.warn('[team-engine] tagging audit:', audit.message);
  }

  return { ...analysis, realData };
}
