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

Tu produis trois listes :
1. Founders checks : pour chaque fondateur, qui appeler (2 supérieurs, 2 pairs, 2 subordonnés) avec un profil indicatif et un indice pour les retrouver
2. Customer checks : pour chaque client cité, les questions à poser pour valider la relation
3. Board checks : pour chaque board member ou advisor, les questions à poser

Tu identifies aussi les red flags spécifiques sortis des autres moteurs (aveuglement, retournement causal) à vérifier en priorité pendant les appels.

Tu donnes enfin un ordre de priorité des appels (lequel d'abord, pourquoi).

Méthode pour les profils à trouver : croise le background du fondateur (LinkedIn, expériences pro citées) avec les entreprises où il a travaillé. Exemple : "Si Boura affirme avoir été chez Airbus 2010-2015, identifier 1 ancien manager Airbus défense de cette période + 1 ex-collègue ingénieur".

Méthode pour les questions : inspirées des playbooks Golden Seeds et GCV.
- Pour les supérieurs : promotion, hire-again, decision-making, trust
- Pour les pairs : collaboration, ego, sharing credit
- Pour les subordonnés : leadership, fairness, growth opportunities given
- Pour les clients : pilot vs binding, NPS, willingness to expand, dependency on champion
- Pour le board : alignment, founder-board relationship, governance discipline

Format JSON pur OBLIGATOIRE :

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
  "redFlagsToProbe": ["red flag 1 a verifier specifiquement", "red flag 2"],
  "priorityOrder": ["1. Appeler X car...", "2. Puis Y car..."]
}

Si une catégorie n'a aucun contact identifiable (par exemple aucun client nommé), retourne un tableau vide pour cette catégorie. Ne fabrique jamais de noms.`;

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

# Patterns d'aveuglement detectes
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
