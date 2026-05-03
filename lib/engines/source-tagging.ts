// Helper de tagging des sources pour les moteurs avec web search active.
//
// Probleme adresse : sur le rapport UP&CHARGE, plusieurs assertions
// factuelles ('Marin rejoint en 2021', 'Seed 1.65M$ aout 2024',
// 'Refactory Bpifrance partagee') etaient presentees avec la meme
// autorite narrative que les faits du pitch, alors qu elles provenaient
// soit du web search soit d une inference du LLM. Resultat : un VC qui
// verifie le pitch et constate l absence de ces faits perd confiance
// dans tout le rapport.
//
// Solution : imposer au LLM un tagging systematique a la fin de chaque
// assertion factuelle, avec validation post-LLM qui flagge les outputs
// faiblement tagges.

export const SOURCE_TAGGING_INSTRUCTION = `
# CONTRAINTE STRICTE DE TAGGING DES SOURCES (NIVEAU 2.B)

Toute assertion factuelle dans tes textes (rationale, evidence, signaux,
red flags, green flags, gaps, drivers, comparables, narratifs) DOIT
etre suivie d un tag de source entre crochets.

Trois tags autorises et trois seulement :

- [pitch] : l information vient du dossier (pitch deck, document fourni
  par la societe). Tu peux preciser la page si pertinent : [pitch p.4].

- [web] : l information vient d une recherche web effectuee pendant
  cette analyse. Mentionne brievement la source si tu peux la
  reconstituer : [web : crunchbase], [web : presse], [web : openalex],
  [web : github], [web : registres entreprises]. Si la source exacte
  est imprecise, tagger simplement [web] reste acceptable.

- [inference] : l information est une deduction logique a partir du
  pitch ou du web, mais elle n est pas DIRECTEMENT extraite. Exemple :
  'le ratio levee / CA atteint 20:1 [inference], superieur au pattern
  Ynsect [web]'. Le ratio est une inference, le benchmark vient du web.

REGLES OPERATIONNELLES :

1. Si tu ne peux PAS tagger une assertion (parce que tu ne sais plus
   d ou elle vient), tu dois la SUPPRIMER. Mieux vaut un texte plus
   court avec sources tracees qu un texte dense mais non auditable.

2. Les CHIFFRES sont les plus critiques a tagger. Tout chiffre (montant
   de levee, valuation, marge, ratio, taille de marche, score de
   benchmark) doit etre tagge.

3. Les NOMS PROPRES (personnes, entreprises, fonds, partenaires) qui
   ne sont pas dans le pitch doivent etre [web] ou [inference]. Si tu
   ne sais pas, ne les cite pas.

4. Les DATES qui ne sont pas dans le pitch doivent etre [web] ou
   supprimees. JAMAIS d invention de date.

5. Une affirmation generique sans donnee precise (ex : 'le marche est
   competitif') n a pas besoin de tag, mais elle a peu de valeur. Ton
   travail est de produire des assertions DENSES, donc traçables.

6. Les comparables historiques (Doctolib, Theranos, Stripe etc.) que
   tu cites avec un benchmark de proximite ou un outcome chiffre
   doivent etre tagges. Tu peux te referer au corpus interne avec
   [corpus] (synonyme acceptable de [pitch] pour les benchmarks).

EXEMPLE NEGATIF (a ne pas reproduire) :
"Marin et Anthony rejoignent l aventure ulterieurement, sans precision
sur les modalites." → date 'ulterieurement' inventee, modalites pas
dans le pitch, aucun tag. Cette phrase doit etre supprimee ou taggee
[inference] si elle reste, et reformulee : "Le pitch ne precise pas
les dates d entree de Marin et Anthony [pitch p.22]."

EXEMPLE POSITIF :
"Le ratio levee cumulee sur CA demontre atteint 20:1 [inference :
1.5M EUR seed + 15M EUR Series A annoncee / 0.8M EUR CA prevu 2024
[pitch p.21]], superieur au seuil critique de 16:1 observe sur le
pattern Ynsect 2020 [corpus]."
`;

// Categorise une chaine de texte selon la densite de tags de sources.
// Sert au monitoring : si une analyse a < 30% d assertions taggees,
// on peut decider de re-prompter ou de logger un warning.
export interface TaggingStats {
  totalAssertions: number;
  tagged: number;
  pitchTagged: number;
  webTagged: number;
  inferenceTagged: number;
  corpusTagged: number;
  taggingRatio: number;
}

export function analyzeTagging(text: string): TaggingStats {
  if (!text || text.length === 0) {
    return {
      totalAssertions: 0, tagged: 0, pitchTagged: 0, webTagged: 0,
      inferenceTagged: 0, corpusTagged: 0, taggingRatio: 0,
    };
  }

  // Heuristique d assertion : on compte les phrases (split sur . ! ?)
  // qui contiennent au moins un verbe conjugue ou un chiffre. Approche
  // simple, pas linguistique : sert au monitoring, pas a une mesure
  // exacte.
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  const assertionLike = sentences.filter(s => /\d|\b(est|sont|a|ont|fait|font|cible|vise|annonce|deploie|leve|leve|atteint|signale|montre|indique|valid|porte|capture|domine|couvre|requiert|impose)\b/i.test(s));

  const pitchTagged = (text.match(/\[pitch[^\]]*\]/gi) || []).length;
  const webTagged = (text.match(/\[web[^\]]*\]/gi) || []).length;
  const inferenceTagged = (text.match(/\[inf[ée]rence[^\]]*\]/gi) || []).length;
  const corpusTagged = (text.match(/\[corpus[^\]]*\]/gi) || []).length;
  const tagged = pitchTagged + webTagged + inferenceTagged + corpusTagged;

  const totalAssertions = assertionLike.length || 1;
  return {
    totalAssertions,
    tagged,
    pitchTagged,
    webTagged,
    inferenceTagged,
    corpusTagged,
    taggingRatio: Math.min(1, tagged / totalAssertions),
  };
}

// Parcourt recursivement un objet JSON et collecte tous les champs
// string > 60 caracteres pour analyser leur tagging. Sert a evaluer
// globalement un output d engine.
export function analyzeOutputTagging(output: unknown): TaggingStats {
  const texts: string[] = [];
  const collect = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.length >= 60) texts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach(collect);
    }
  };
  collect(output);
  return analyzeTagging(texts.join(' '));
}

// Renvoie un avertissement structure si le tagging est faible.
// taggingRatio < 0.20 = output suspect (a re-prompter ou a flagger en UI).
// taggingRatio < 0.50 = output mediocre (a flagger en UI mais utilisable).
// taggingRatio >= 0.50 = OK.
export interface TaggingAuditWarning {
  level: 'critical' | 'warning' | 'ok';
  message: string;
  stats: TaggingStats;
}

export function auditTagging(output: unknown, engineName: string): TaggingAuditWarning {
  const stats = analyzeOutputTagging(output);
  if (stats.taggingRatio < 0.20) {
    return {
      level: 'critical',
      message: `[${engineName}] tagging des sources faible (${Math.round(stats.taggingRatio * 100)}% des assertions taggees, ${stats.tagged}/${stats.totalAssertions}). Risque eleve d hallucinations factuelles non tracees.`,
      stats,
    };
  }
  if (stats.taggingRatio < 0.50) {
    return {
      level: 'warning',
      message: `[${engineName}] tagging des sources partiel (${Math.round(stats.taggingRatio * 100)}% taggees). Verification manuelle recommandee.`,
      stats,
    };
  }
  return {
    level: 'ok',
    message: `[${engineName}] tagging des sources correct (${Math.round(stats.taggingRatio * 100)}% taggees).`,
    stats,
  };
}
