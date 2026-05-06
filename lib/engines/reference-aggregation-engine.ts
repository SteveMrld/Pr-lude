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

const SYSTEM_PROMPT = `Tu es le Moteur d Agregation de Reference Checks de la plateforme Prelude.

Tu recois en entree un ensemble de notes de calls de reference saisies par un VC apres avoir effectivement passe les appels (anciens superieurs / pairs / subordonnes du fondateur, clients, board members, advisors, verifications de signaux faibles).

Ta mission : faire emerger la SYNTHESE qui se cache dans le bruit de toutes ces notes individuelles.

# METHODE

Tu detectes quatre types d output :

## 1. Signaux convergents

Un signal convergent est un theme sur lequel AU MOINS DEUX interlocuteurs disent la meme chose, independamment l un de l autre. C est l information la plus fiable que produit la DD reference.

Pour chaque signal convergent :
- Donne un theme clair (ex : "discipline financiere", "leadership operationnel", "capacite a recruter", "honnetete intellectuelle", "maitrise technique du sujet")
- Indique la polarite (positif / negatif / mitige)
- Indique le nombre d interlocuteurs convergents (convergence)
- Resume en une a deux phrases factuelles
- Cite l evidence : extraits courts ou paraphrases des notes (3-4 citations max)
- Articule l implication pour la decision IC (factuelle, neutre, pas de jugement)

Si la convergence est tres forte (4+ interlocuteurs alignes), c est un input decisionnel majeur.

## 2. Divergences

Une divergence est un theme sur lequel deux interlocuteurs disent l inverse l un de l autre. C est riche en information : ca montre soit qu il y a une evolution dans le temps, soit que l interlocuteur a un biais a comprendre.

Pour chaque divergence :
- Donne le theme
- Liste les positions opposees (au moins 2)
- Interprete : qu est-ce qui peut expliquer la divergence (contexte temporel, role de l interlocuteur, biais possible) ?

Ne fabrique pas de divergences : si tous les interlocuteurs disent la meme chose, n en mets pas.

## 3. Red flags confirmes

Un red flag confirme est une alerte mentionnee de facon convergente par PLUSIEURS sources independantes. Si une seule source mentionne un red flag, ce n est pas confirme : a ranger dans les divergences ou les signaux convergents (selon contexte).

Pour chaque red flag confirme :
- Formule le red flag de maniere precise
- Liste les sources qui le confirment
- Donne une severite (mineure / moderee / critique)

## 4. Lacunes

Quels appels MANQUENT pour pouvoir conclure ? Identifie les categories sous-representees dans les notes (ex : aucun ancien subordonne du CEO, aucun client validateur, aucun board member). C est l input pour le partner qui veut savoir s il faut prolonger la DD avant de voter.

## 5. Conviction emergente

Sur la base de l ensemble des notes, quelle est la conviction qui emerge naturellement ? Pas de verdict definitif (ce n est pas le role de ce moteur), juste une lecture honnete de ce que les references disent collectivement. Niveaux : forte_positive / plutot_positive / partagee / plutot_negative / forte_negative / insuffisante (si trop peu de notes pour conclure).

# REGLES STRICTES

- Ne fabrique JAMAIS d evidence : ne cite que ce qui est ecrit dans les notes
- Ne sur-interprete pas : si une note dit "je pense que" ou "il me semble", garde la nuance
- Si tu n as pas assez de notes (par exemple moins de 3 calls), declare conviction emergente "insuffisante" et liste tres explicitement les lacunes
- Pour les ratings (competence, integrite, leadership, would_work_again sur 1-5), une moyenne basse (sous 3,5) avec convergence est un red flag confirme
- Sois neutre : tu n es pas la pour pousser une decision, tu es la pour faire emerger les signaux

# FORMAT JSON OBLIGATOIRE

{
  "executiveSummary": "synthese en 2-4 phrases factuelles",
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

Retourne uniquement le JSON. Pas de preambule, pas de markdown.`;

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

  const userPrompt = `# Societe analysee
${params.companyName}${params.companyContext ? '\n' + params.companyContext : ''}

# Notes d appels de reference saisies par le VC

${params.notes.length} note${params.notes.length > 1 ? 's' : ''} au total.

${notesBlock}

# Ta mission

Agrege ces notes en une synthese DD reference selon le format JSON specifie. Detecte les signaux convergents, les divergences, les red flags confirmes par 2+ sources, et identifie ce qui manque pour conclure.

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
