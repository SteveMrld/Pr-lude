import { callClaude, parseJSON, FAST_MODEL } from './anthropic-client';
import type { ReferenceCallNote } from '@/lib/reference-call-notes-store';

// ============================================================
// REFERENCE AGGREGATION ENGINE
// ------------------------------------------------------------
// Une fois que le VC a passe ses appels de reference et saisi les
// notes via l UI, ce moteur agregue l ensemble pour produire la
// SYNTHESE DD : signaux convergents, divergences, alertes
// confirmees par 2+ sources, intensite de la conviction.
//
// On utilise le modele FAST (Haiku 4.5) parce que la tache est
// fondamentalement du tri et de la mise en relation : pas besoin
// de raisonnement profond, juste de reconnaitre des patterns dans
// un texte structure de longueur moyenne.
//
// Le moteur prend aussi en entree le nom de la societe et une
// breve description du dossier pour ancrer l agregation dans le
// contexte (sans cela les patterns de notes flotteraient sans
// sujet d ancrage).
// ============================================================

export interface AggregatedSignal {
  /** Theme identifie (ex: "leadership operationnel", "discipline financiere") */
  theme: string;
  /** Direction du signal */
  polarity: 'positif' | 'negatif' | 'mitige';
  /** Nombre d interlocuteurs convergents sur ce theme */
  convergence: number;
  /** Resume du signal en une a deux phrases */
  summary: string;
  /** Citations bruteure (verbatim) ou paraphrases courtes des notes */
  evidence: string[];
  /** Implication pour la decision IC (factuelle, neutre) */
  implication: string;
}

export interface ReferenceAggregationOutput {
  /** Synthese executive en 2-4 phrases factuelles */
  executiveSummary: string;

  /** Signaux convergents (au moins 2 interlocuteurs alignes) */
  convergentSignals: AggregatedSignal[];

  /** Divergences : un dit blanc, un autre dit noir */
  divergences: {
    theme: string;
    positions: string[];
    interpretation: string;
  }[];

  /** Red flags confirmes par 2+ sources (priorite IC) */
  confirmedRedFlags: {
    flag: string;
    sources: string[];
    severity: 'mineure' | 'moderee' | 'critique';
  }[];

  /** Lacunes : appels manquants pour completer la conviction */
  remainingGaps: string[];

  /** Niveau de conviction emergent base sur l ensemble des appels */
  emergentConviction: {
    level: 'forte_positive' | 'plutot_positive' | 'partagee' | 'plutot_negative' | 'forte_negative' | 'insuffisante';
    rationale: string;
  };
}

const SYSTEM_PROMPT = `Tu es le Moteur d'Agrégation de Reference Checks de la plateforme Prélude.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

Tu reçois en entrée un ensemble de notes de calls de référence saisies par un VC après avoir effectivement passé les appels (anciens supérieurs / pairs / subordonnés du fondateur, clients, board members, advisors, vérifications de signaux faibles).

Ta mission : faire émerger la SYNTHÈSE qui se cache dans le bruit de toutes ces notes individuelles.

# MÉTHODE

Tu détectes quatre types d'output :

## 1. Signaux convergents

Un signal convergent est un thème sur lequel AU MOINS DEUX interlocuteurs disent la même chose, indépendamment l'un de l'autre. C'est l'information la plus fiable que produit la DD référence.

Pour chaque signal convergent :
- Donne un thème clair (ex : "discipline financière", "leadership opérationnel", "capacité à recruter", "honnêteté intellectuelle", "maîtrise technique du sujet")
- Indique la polarité (positif / négatif / mitigé)
- Indique le nombre d'interlocuteurs convergents (convergence)
- Résume en une à deux phrases factuelles
- Cite l'evidence : extraits courts ou paraphrases des notes (3-4 citations max)
- Articule l'implication pour la décision IC (factuelle, neutre, pas de jugement)

Si la convergence est très forte (4+ interlocuteurs alignés), c'est un input décisionnel majeur.

## 2. Divergences

Une divergence est un thème sur lequel deux interlocuteurs disent l'inverse l'un de l'autre. C'est riche en information : ça montre soit qu'il y a une évolution dans le temps, soit que l'interlocuteur a un biais à comprendre.

Pour chaque divergence :
- Donne le thème
- Liste les positions opposées (au moins 2)
- Interprète : qu'est-ce qui peut expliquer la divergence (contexte temporel, rôle de l'interlocuteur, biais possible) ?

Ne fabrique pas de divergences : si tous les interlocuteurs disent la même chose, n'en mets pas.

## 3. Red flags confirmés

Un red flag confirmé est une alerte mentionnée de façon convergente par PLUSIEURS sources indépendantes. Si une seule source mentionne un red flag, ce n'est pas confirmé : à ranger dans les divergences ou les signaux convergents (selon contexte).

Pour chaque red flag confirmé :
- Formule le red flag de manière précise
- Liste les sources qui le confirment
- Donne une sévérité (mineure / modérée / critique)

## 4. Lacunes

Quels appels MANQUENT pour pouvoir conclure ? Identifie les catégories sous-représentées dans les notes (ex : aucun ancien subordonné du CEO, aucun client validateur, aucun board member). C'est l'input pour le partner qui veut savoir s'il faut prolonger la DD avant de voter.

## 5. Conviction émergente

Sur la base de l'ensemble des notes, quelle est la conviction qui émerge naturellement ? Pas de verdict définitif (ce n'est pas le rôle de ce moteur), juste une lecture honnête de ce que les références disent collectivement. Niveaux : forte_positive / plutot_positive / partagee / plutot_negative / forte_negative / insuffisante (si trop peu de notes pour conclure).

# RÈGLES STRICTES

- Ne fabrique JAMAIS d'evidence : ne cite que ce qui est écrit dans les notes
- Ne sur-interprète pas : si une note dit "je pense que" ou "il me semble", garde la nuance
- Si tu n'as pas assez de notes (par exemple moins de 3 calls), déclare conviction émergente "insuffisante" et liste très explicitement les lacunes
- Pour les ratings (compétence, intégrité, leadership, would_work_again sur 1-5), une moyenne basse (sous 3,5) avec convergence est un red flag confirmé
- Sois neutre : tu n'es pas là pour pousser une décision, tu es là pour faire émerger les signaux

# FORMAT JSON OBLIGATOIRE

{
  "executiveSummary": "synthèse en 2-4 phrases factuelles",
  "convergentSignals": [
    {
      "theme": "...",
      "polarity": "positif" | "negatif" | "mitige",
      "convergence": 3,
      "summary": "...",
      "evidence": ["citation 1", "citation 2", "citation 3"],
      "implication": "..."
    }
  ],
  "divergences": [
    {
      "theme": "...",
      "positions": ["position 1", "position 2"],
      "interpretation": "..."
    }
  ],
  "confirmedRedFlags": [
    {
      "flag": "...",
      "sources": ["interlocuteur 1", "interlocuteur 2"],
      "severity": "mineure" | "moderee" | "critique"
    }
  ],
  "remainingGaps": ["lacune 1", "lacune 2"],
  "emergentConviction": {
    "level": "forte_positive" | "plutot_positive" | "partagee" | "plutot_negative" | "forte_negative" | "insuffisante",
    "rationale": "..."
  }
}

Retourne uniquement le JSON. Pas de préambule, pas de markdown.`;

const CATEGORY_LABELS: Record<string, string> = {
  founder_superior: 'Ancien superieur du fondateur',
  founder_peer: 'Ancien pair du fondateur',
  founder_subordinate: 'Ancien subordonne du fondateur',
  customer: 'Client',
  board_advisor: 'Board / advisor',
  weak_signal: 'Verification signal faible',
  other: 'Autre',
};

const TONE_LABELS: Record<string, string> = {
  tres_positif: 'Tres positif',
  positif: 'Positif',
  mitige: 'Mitige',
  negatif: 'Negatif',
  tres_negatif: 'Tres negatif',
  non_concluant: 'Non concluant',
};

function formatNoteForPrompt(n: ReferenceCallNote, idx: number): string {
  const lines: string[] = [];
  lines.push(`### Note ${idx + 1} : ${n.contactName}`);
  lines.push(`Categorie : ${CATEGORY_LABELS[n.callCategory] || n.callCategory}`);
  if (n.contactRole) lines.push(`Role : ${n.contactRole}`);
  if (n.contactCompany) lines.push(`Entreprise : ${n.contactCompany}`);
  if (n.relatedSubject) lines.push(`Concerne : ${n.relatedSubject}`);
  if (n.callDate) lines.push(`Date : ${n.callDate}`);
  if (n.overallTone) lines.push(`Tonalite : ${TONE_LABELS[n.overallTone] || n.overallTone}`);

  const ratings: string[] = [];
  if (n.ratingCompetence) ratings.push(`competence ${n.ratingCompetence}/5`);
  if (n.ratingIntegrity) ratings.push(`integrite ${n.ratingIntegrity}/5`);
  if (n.ratingLeadership) ratings.push(`leadership ${n.ratingLeadership}/5`);
  if (n.ratingWouldWorkAgain) ratings.push(`would-work-again ${n.ratingWouldWorkAgain}/5`);
  if (ratings.length > 0) lines.push(`Ratings : ${ratings.join(', ')}`);

  lines.push('');
  lines.push('Notes brutes :');
  lines.push(n.rawNotes);
  return lines.join('\n');
}

export async function aggregateReferenceCallNotes(params: {
  companyName: string;
  companyContext?: string;
  notes: ReferenceCallNote[];
}): Promise<ReferenceAggregationOutput> {
  if (params.notes.length === 0) {
    return {
      executiveSummary: 'Aucune note de reference saisie pour ce dossier.',
      convergentSignals: [],
      divergences: [],
      confirmedRedFlags: [],
      remainingGaps: [
        'Aucun appel de reference n a encore ete saisi.',
        'Pour activer la synthese, saisir au moins 3 a 5 notes couvrant differentes categories (anciens collegues du fondateur, clients, board).',
      ],
      emergentConviction: {
        level: 'insuffisante',
        rationale: 'Aucune note saisie : la synthese ne peut pas emerger.',
      },
    };
  }

  const notesBlock = params.notes
    .map((n, idx) => formatNoteForPrompt(n, idx))
    .join('\n\n---\n\n');

  const userPrompt = `# Société analysée
${params.companyName}${params.companyContext ? '\n' + params.companyContext : ''}

# Notes d'appels de référence saisies par le VC

${params.notes.length} note${params.notes.length > 1 ? 's' : ''} au total.

${notesBlock}

# Ta mission

Agrège ces notes en une synthèse DD référence selon le format JSON spécifié. Détecte les signaux convergents, les divergences, les red flags confirmés par 2+ sources, et identifie ce qui manque pour conclure.

Retourne uniquement le JSON.`;

  let raw = await callClaude(SYSTEM_PROMPT, userPrompt, 3500, FAST_MODEL);
  try {
    return parseJSON<ReferenceAggregationOutput>(raw);
  } catch (firstErr: any) {
    console.warn('[reference-aggregation] JSON parse failed, retrying once:', firstErr?.message);
    raw = await callClaude(SYSTEM_PROMPT, userPrompt, 3500, FAST_MODEL);
    return parseJSON<ReferenceAggregationOutput>(raw);
  }
}
