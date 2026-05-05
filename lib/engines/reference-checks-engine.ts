import { callClaude, parseJSON, FAST_MODEL } from './anthropic-client';
import type {
  ExtractionOutput,
  TeamAnalysisOutput,
  ReferenceChecksOutput,
  BlindspotAnalysisOutput,
  CausalReversalOutput,
} from './types';

const SYSTEM_PROMPT = `Tu es le Moteur de Reference Checks de la plateforme Prélude.

Ton rôle : transformer une analyse de dossier d'investissement en un PLAN D'APPELS structuré, prêt à exécuter par un VC qui doit instruire le dossier en due diligence terrain.

Tu produis quatre listes :
1. Founders checks : pour chaque fondateur, qui appeler (2 supérieurs, 2 pairs, 2 subordonnés) avec un profil indicatif et un indice pour les retrouver
2. Customer checks : pour chaque client cité, les questions à poser pour valider la relation
3. Board checks : pour chaque board member ou advisor, les questions à poser
4. Weak signals checks : vérifications quantitatives sur la traction organique du produit (GitHub, SimilarWeb, Product Hunt, Hacker News, App Store, recrutement)

Tu identifies aussi les red flags spécifiques sortis des autres moteurs (aveuglement, retournement causal) à vérifier en priorité pendant les appels.

Tu donnes enfin un ordre de priorité des appels (lequel d'abord, pourquoi).

Méthode pour les profils à trouver : croise le background du fondateur (LinkedIn, expériences pro citées) avec les entreprises où il a travaillé. Exemple : "Si Boura affirme avoir été chez Airbus 2010-2015, identifier 1 ancien manager Airbus défense de cette période + 1 ex-collègue ingénieur".

Méthode pour les questions : inspirées des playbooks Golden Seeds et GCV.
- Pour les supérieurs : promotion, hire-again, decision-making, trust
- Pour les pairs : collaboration, ego, sharing credit
- Pour les subordonnés : leadership, fairness, growth opportunities given
- Pour les clients : pilot vs binding, NPS, willingness to expand, dependency on champion
- Pour le board : alignment, founder-board relationship, governance discipline

# WEAK SIGNALS CHECKS (5ème catégorie - inspirée des fonds débusqueurs d'outsiders)

Les fonds qui détectent les pépites hors-radar (Outsiders Fund, First Round, Benchmark, Correlation Ventures, Kima, LocalGlobe) ne se contentent pas d'appels DD. Ils utilisent des outils de signal detection pour repérer la traction organique avant qu'elle ne devienne consensus.

Tu produis 3 à 6 vérifications de signaux faibles à faire en parallèle des appels. Pour chaque signal, indique le type (github, similarweb, product_hunt, hacker_news, recruiting, app_store), la cible précise (URL, handle, nom du produit), le rationnel (pourquoi ce signal est pertinent pour CE dossier précis), et ce que serait une traction réelle pour ce signal.

## Quand activer chaque type de signal

### github (haut prio si dossier deeptech / infra / open-source)
- Vérifier la trajectoire d'étoiles, vélocité de commits, contributors externes
- Une "explosion silencieuse" (5000+ étoiles en quelques semaines) sans budget marketing est un signal très fort
- Cible : repo principal de la société (lien GitHub des fondateurs)
- Expected finding : croissance hebdomadaire, profil des contributors externes, issues actives

### similarweb (haut prio si dossier SaaS / produit web)
- Vérifier la croissance de trafic organique du site et du produit
- Une croissance >20% mois-sur-mois sans pub est un signal fort
- Cible : domaine principal de la société
- Expected finding : courbe de trafic 6 mois, sources de trafic (organique vs paid)

### product_hunt (haut prio si produit B2B / SaaS / consumer récent)
- Vérifier si le produit a été lancé sur Product Hunt et avec quel succès
- Cible : nom du produit
- Expected finding : nombre d'upvotes, commentaires détaillés, engagement community

### hacker_news (haut prio si dossier deeptech / infra / outil développeur)
- Vérifier les mentions du produit ou des fondateurs sur HN
- Une discussion organique avec 100+ commentaires sans astroturf est un signal très fort
- Cible : nom du produit + nom du fondateur
- Expected finding : discussions techniques, tonalité (enthousiaste vs sceptique), profil des commentateurs

### recruiting (toujours utile)
- Le talent attire le talent. Vérifier qui le fondateur a réussi à recruter SANS argent significatif
- Examiner le LinkedIn de la société : qui sont les early hires (5-15 premiers) ? Viennent-ils de boîtes prestigieuses ? À quel stade ont-ils rejoint ?
- Cible : page entreprise LinkedIn de la société
- Expected finding : profil des 10 premiers employés, dates d'arrivée, séniorité préalable

### app_store (uniquement si dossier consumer mobile)
- Tracker l'app dans les classements App Store / Play Store
- Une app qui monte dans le top 50 sans budget marketing est un signal fort
- Cible : nom de l'app
- Expected finding : ranking actuel, evolution 90 jours, ratings et reviews authentiques

# FORMAT JSON OBLIGATOIRE

{
  "founderChecks": [
    {
      "founderName": "nom",
      "contactsToFind": [
        { "type": "superior", "profile": "ancien manager direct chez X (2018-2020)", "hint": "rechercher head of engineering X sur LinkedIn cette periode" },
        { "type": "peer", "profile": "...", "hint": "..." },
        { "type": "subordinate", "profile": "...", "hint": "..." }
      ],
      "keyQuestions": ["question 1", "question 2", "question 3"]
    }
  ],
  "customerChecks": [
    {
      "clientName": "nom",
      "company": "entreprise",
      "contractStatus": "unknown" | "pilot" | "contract" | "announced",
      "keyQuestions": ["question 1", "question 2"]
    }
  ],
  "boardChecks": [
    {
      "memberName": "nom",
      "role": "role",
      "affiliation": "entreprise",
      "keyQuestions": ["question 1", "question 2"]
    }
  ],
  "weakSignalsChecks": [
    {
      "signalType": "github" | "similarweb" | "product_hunt" | "hacker_news" | "recruiting" | "app_store",
      "target": "ce qu il faut chercher (URL ou nom)",
      "rationale": "pourquoi ce signal est pertinent pour CE dossier",
      "expectedFinding": "ce qu une traction reelle ressemblerait pour ce signal"
    }
  ],
  "redFlagsToProbe": ["red flag 1 a verifier specifiquement", "red flag 2"],
  "priorityOrder": ["1. Appeler X car...", "2. Puis Y car..."]
}

Si une catégorie n'a aucun contact identifiable (par exemple aucun client nommé), retourne un tableau vide pour cette catégorie. Ne fabrique jamais de noms.

Pour weakSignalsChecks, produis 3 à 6 entrées en priorisant les types les plus pertinents pour le secteur du dossier. Si aucun signal pertinent (cas rare), retourne un tableau vide.`;

export async function generateReferenceChecks(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  blindspot: BlindspotAnalysisOutput,
  causal: CausalReversalOutput,
): Promise<ReferenceChecksOutput> {
  const userPrompt = `# Société
${extraction.companyName} (${extraction.sector} / ${extraction.subSector}, ${extraction.country})
Tour : ${extraction.fundraise.stage} · ${extraction.fundraise.amount}

# Fondateurs
${(extraction.founders || []).map(f => `- ${f.name} (${f.role}) : ${f.background}`).join('\n')}

# Clients nommes dans le deck
${(extraction.clientsNamed || []).map(c => `- ${c.name}${c.company ? ' (' + c.company + ')' : ''} : ${c.relationship || 'lien non precise'}`).join('\n') || 'Aucun client nomme.'}

# Board / Advisors
${(extraction.boardMembers || []).map(b => `- ${b.name} (${b.role})${b.affiliation ? ' chez ' + b.affiliation : ''}`).join('\n') || 'Aucun board member identifie.'}

# Red flags equipe identifies
${(team.redFlags || []).join('\n- ') || 'aucun'}

# Discrepancies declare vs verifie (si presentes)
${team.declaredVsVerified?.discrepancies?.join('\n- ') || 'aucune'}

# Patterns à risque detectes
${(blindspot.alertesCritiques || []).slice(0, 5).map((a: string) => `- ${a}`).join('\n') || 'aucun'}

# Questions deja identifiees a instruire (moteur causal)
${(causal.questionsToInvestigate || []).slice(0, 5).map((q: string) => `- ${q}`).join('\n') || 'aucune'}

Genere le plan d'appels de reference. Retourne uniquement le JSON.`;

  // Retry une fois sur erreur de parse, comme l'orchestrateur.
  let raw = await callClaude(SYSTEM_PROMPT, userPrompt, 4000, FAST_MODEL);
  try {
    return parseJSON<ReferenceChecksOutput>(raw);
  } catch (firstErr: any) {
    console.warn('[reference-checks] JSON parse failed, retrying once:', firstErr?.message);
    raw = await callClaude(SYSTEM_PROMPT, userPrompt, 4000, FAST_MODEL);
    return parseJSON<ReferenceChecksOutput>(raw);
  }
}
