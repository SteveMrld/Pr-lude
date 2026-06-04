// ============================================================
// PRELUDE - Bloc 3 : prompt du moteur Structuration a l entree
// ------------------------------------------------------------
// Le system prompt fixe la doctrine. Le user prompt assemble les
// signaux pertinents du result_json en six blocs lisibles par
// Claude Sonnet, qui produit en retour la recommandation typee.
//
// Discipline de citation : on injecte explicitement, dans le user
// prompt, les drivers / risques / conditions / comparables disponibles
// avec leurs intensites. Le system prompt impose que chaque champ
// anchors cite verbatim ces signaux, sans paraphrase generique.
// ============================================================

export const STRUCTURATION_SYSTEM_PROMPT = `Tu es l analyste de structuration de Prélude, plateforme d instruction de dossiers de venture capital. Tu interviens en aval de l instruction Bloc 1, parfois apres la DD Bloc 2. Tu ne re-instruis pas le dossier. Tu reponds a une question precise : etant donne ce que l analyse a revele, comment structurer l entree du fonds dans ce deal.

Tu n es PAS un moteur de gestion post-investissement. Tu ne parles pas de timing de sortie, de continuation, de restructuration de dette. Tu ne parles pas de synergies portefeuille. Ton perimetre est strictement la structuration du term sheet a l entree.

Voix editoriale : Le Grand Continent. Prose dense, phrases longues quand le sujet le justifie. Pas de listes a puces dans les recommendations (sauf les anchors). Pas de gras, pas de jargon SaaS, pas d emojis. Pas d em-dashes. Français correctement accentué : é, è, ê, à, ô, î, ï, û, ç. Une prose non accentuée est rejetée.

DISCIPLINE DE CITATION ABSOLUE. C est le point qui distingue ce moteur d un template de term sheet generique. Chaque rubrique doit citer dans son champ anchors le signal precis de l analyse qui la motive : tel decisionDriver verbatim, tel risque avec son intensite, telle keyCondition, tel pattern de fragilite avec son score, tel comparable cite par patternMatching, tel point de la fourchette de valorisation. Pas de generique. Si tu n as pas de signal a citer pour une rubrique, tu sors status=data-missing et tu nommes le signal qui manquerait.

Tu reflechis a la posture globale d abord : un dossier a verdict refuser ne devrait pas etre la (la route bloque en amont), mais un verdict approfondir avec fragilites cumulees commande une protection forte, un verdict investir avec dialectique resolue contrarian-justifies commande plutot une posture souple. C est ton postureGenerale.

PRINCIPE DE STRUCTURATION par rubrique.

a. Gouvernance et board. Siege ou observateur selon le stade et le profil de risque. Un dossier seed avec equipe non eprouvee + fragilite cap table active demande un siege avec droits de veto specifiques. Un dossier Series B avec gouvernance deja structuree et verdict serein demande plutot un observateur avec droits d information renforces.

b. Clauses protectrices. Droits de veto et de consentement deduits directement des risques majeurs cites dans dimensionProbabilities.keyRisks et dans la dialectique blindspotsVsContrarian. Une fragilite cap table active commande un veto sur tout nouveau tour, sur la creation de pref shares, sur la modification de la term sheet existante. Une fragilite reglementaire datee commande un veto sur les pivots produit en zone regulee.

c. Tranching conditionne aux milestones. Les drivers decisifs binaires du dossier (decisionDrivers + keyConditions de l instruction) deviennent les milestones de liberation de la levee en tranches. Une condition cle de type valider la certification CE devient une tranche de 30 a 50 pourcent du tour conditionnee a la certification. Tu cites le driver / la condition concerne.

d. Preference de liquidation et anti-dilution. Decoule de la fourchette de valorisation et de la failureProbability. Une failureProbability haute (>=50) avec valorisation tendue commande 1x non-participating preferred plus full ratchet anti-dilution. Une failureProbability basse (<25) avec valorisation defendable commande 1x non-participating preferred plus weighted-average broad-based anti-dilution. Tu cites le chiffre.

e. Droits d information et reporting. Cadence et exigences derivees des zones d opacite que l analyse a relevees. Si narrativeDrift a remonte un signal d opacite progressive, tu commandes un reporting mensuel detaille avec audit annuel obligatoire. Si l analyse a montre que les KPI extraits par indicators-engine etaient majoritairement absents, tu exiges la mise en place d un dashboard KPI dans les 90 jours post-closing.

f. Cadrage des scenarios de sortie a l entree. Tu ne fais PAS de timing de sortie. Tu cadres les implications de structuration du scenario de base identifie par les comparables (patternMatching.comparables.scenarioSortie). Un comparable historique a sortie strategique a 5-7 ans commande une clause de cooperation a la sortie strategique. Un comparable a IPO commande des droits d enregistrement et un drag-along calibre. Tu cites le comparable.

FORMAT JSON STRICT. Tu produis exactement ce schema, rien de plus :

{
  "postureGenerale": "protection-forte" | "standard" | "souple",
  "postureRationale": "une ou deux phrases qui motivent la posture",
  "preambule": "trois a cinq phrases denses, voix Le Grand Continent, qui posent la lecture globale de structuration de ce deal",
  "gouvernanceBoard": {
    "status": "applicable" | "data-missing",
    "recommendation": "prose dense Le Grand Continent, 3-6 phrases",
    "anchors": ["signal cite verbatim", "autre signal", ...],
    "missingReason": "si data-missing, raison sobre"
  },
  "clausesProtectrices": { meme schema },
  "tranchingMilestones": { meme schema },
  "preferenceLiquidationAntiDilution": { meme schema },
  "droitsInformationReporting": { meme schema },
  "cadrageScenariosSortie": { meme schema }
}

Si une rubrique est en data-missing, recommendation peut etre une phrase sobre qui nomme le signal manquant, anchors reste un tableau vide, et missingReason donne la raison. Pas de boilerplate type "non applicable" sans precision.`;

/**
 * Helpers pour serialiser proprement les objets imbriques en prose
 * structuree dans le user prompt. Limite les profondeurs aberrantes
 * et truncate les chaines geantes pour respecter le budget tokens.
 */
function truncate(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

/**
 * Assemble le user prompt a partir du result_json complet. Le format
 * est volontairement structure en sections nommees pour que Claude
 * sache exactement de quel signal vient chaque element a citer dans
 * anchors.
 *
 * Aucun em-dash dans le prompt. Tous les separateurs sont des deux-points
 * ou des sauts de ligne.
 */
export function buildStructurationUserPrompt(resultJson: any): string {
  const reco = obj(resultJson?.finalRecommendation);
  const ext = obj(resultJson?.extraction);
  const valuation = obj(resultJson?.valuation);
  const patternMatching = obj(resultJson?.patternMatching);
  const fragilite = obj(resultJson?.fragiliteStructurelle);
  const narrativeDrift = obj(resultJson?.narrativeDrift);
  const indicators = obj(resultJson?.indicators);
  const conflict = obj(resultJson?.conflictOfInterest);

  const lines: string[] = [];

  lines.push('# DOSSIER A STRUCTURER');
  lines.push('');
  lines.push(`Societe : ${truncate(ext.companyName || resultJson?.companyName || 'non precisee', 200)}`);
  lines.push(`Tour : ${truncate(ext.fundraise?.roundType || 'non precise', 100)}`);
  lines.push(`Montant : ${truncate(ext.fundraise?.amount || 'non precise', 100)}`);
  lines.push(`Valorisation declaree : ${truncate(ext.fundraise?.valuation || 'non precisee', 200)}`);
  lines.push(`Pays : ${truncate(ext.country || 'non precise', 100)}`);
  lines.push('');

  lines.push('# VERDICT ET SCORES DE L INSTRUCTION');
  lines.push('');
  lines.push(`Verdict : ${reco.verdict || 'non disponible'}`);
  lines.push(`globalScore : ${reco.globalScore ?? 'n/a'} / 100`);
  lines.push(`successProbability : ${reco.successProbability ?? 'n/a'} / 100`);
  lines.push(`failureProbability : ${reco.failureProbability ?? 'n/a'} / 100`);
  const tension = obj(reco.blindspotsVsContrarian);
  if (tension.tensionResolved) {
    lines.push(`Resolution dialectique : ${tension.tensionResolved}. ${truncate(tension.resolution, 400)}`);
  }
  if (typeof reco.argumentation === 'string' && reco.argumentation.length > 0) {
    lines.push('');
    lines.push('Argumentation du verdict :');
    lines.push(truncate(reco.argumentation, 1500));
  }
  lines.push('');

  lines.push('# DRIVERS DECISIFS');
  lines.push('');
  const drivers = arr(reco.decisionDrivers);
  if (drivers.length === 0) {
    lines.push('(aucun driver decisif explicite)');
  } else {
    for (const d of drivers) lines.push(`- ${truncate(d, 400)}`);
  }
  lines.push('');

  lines.push('# CONDITIONS CLES DE L INSTRUCTION');
  lines.push('');
  const conditions = arr(reco.keyConditions);
  if (conditions.length === 0) {
    lines.push('(aucune condition cle explicite)');
  } else {
    for (const c of conditions) lines.push(`- ${truncate(c, 400)}`);
  }
  lines.push('');

  lines.push('# RISQUES MAJEURS PAR DIMENSION');
  lines.push('');
  const dimProbs = arr(reco.dimensionProbabilities);
  if (dimProbs.length === 0) {
    lines.push('(dimensionProbabilities absent)');
  } else {
    for (const d of dimProbs) {
      const name = d?.dimensionName || 'dimension';
      const risk = d?.riskScore ?? 'n/a';
      const success = d?.successProbability ?? 'n/a';
      const risks = arr(d?.keyRisks).map((r: any) => truncate(String(r), 250)).join(' ; ');
      const driversD = arr(d?.keyDrivers).map((r: any) => truncate(String(r), 250)).join(' ; ');
      lines.push(`- ${name} (success ${success}, risk ${risk}). Drivers : ${driversD || 'n/a'}. Risques : ${risks || 'n/a'}.`);
    }
  }
  lines.push('');

  lines.push('# VALORISATION CALCULEE PAR LE PIPELINE');
  lines.push('');
  const range = obj(valuation.range);
  if (range.min || range.max) {
    lines.push(`Fourchette : ${range.min ?? '?'} a ${range.max ?? '?'} ${range.currency || 'EUR'}.`);
    if (range.central) lines.push(`Point central : ${range.central}.`);
  } else {
    lines.push('(fourchette non calculee)');
  }
  const warnings = arr(valuation.warnings);
  if (warnings.length > 0) {
    lines.push('Avertissements valorisation :');
    for (const w of warnings) lines.push(`- ${truncate(w, 350)}`);
  }
  lines.push('');

  lines.push('# FRAGILITE STRUCTURELLE');
  lines.push('');
  if (fragilite && typeof fragilite === 'object' && Object.keys(fragilite).length > 0) {
    lines.push(`Verdict global : ${fragilite.verdict || 'n/a'}. Score : ${fragilite.globalScore ?? 'n/a'} / 100.`);
    const patterns = arr(fragilite.patterns);
    const remontes = patterns.filter((p: any) => (p?.globalScore ?? 0) >= 55);
    if (remontes.length > 0) {
      lines.push('Patterns remontes (score >= 55) :');
      for (const p of remontes) {
        lines.push(`- ${p.patternId} : score ${p.globalScore}, verdict ${p.verdict}. ${truncate(p.resumeEditorial, 250)}`);
      }
    }
    const combos = arr(fragilite.combinaisons || fragilite.combinaisonsDiagnostiques);
    if (combos.length > 0) {
      lines.push('Combinaisons diagnostiques :');
      for (const c of combos) {
        lines.push(`- ${c?.name || c?.id || 'combinaison'} (severite ${c?.severity || c?.severite || 'n/a'})`);
      }
    }
  } else {
    lines.push('(non applique sur ce dossier)');
  }
  lines.push('');

  lines.push('# LECTURE DU LANGAGE (NARRATIVE DRIFT)');
  lines.push('');
  if (narrativeDrift && typeof narrativeDrift === 'object' && Object.keys(narrativeDrift).length > 0) {
    lines.push(`Verdict : ${narrativeDrift.verdict || 'n/a'}. Score : ${narrativeDrift.globalScore ?? 'n/a'} / 100.`);
    const counter = obj(narrativeDrift.counterArchetype);
    if (counter.closest) {
      lines.push(`Archetype de pattern le plus proche : ${counter.closest} (${counter.direction || 'n/a'}). ${truncate(counter.rationale, 250)}`);
    }
  } else {
    lines.push('(non applique sur ce dossier)');
  }
  lines.push('');

  lines.push('# PATTERN MATCHING ET COMPARABLES');
  lines.push('');
  if (patternMatching && typeof patternMatching === 'object' && Object.keys(patternMatching).length > 0) {
    lines.push(`Archetype dominant : ${patternMatching.archetypeDominant || 'n/a'}.`);
    if (patternMatching.archetypeRationale) {
      lines.push(truncate(patternMatching.archetypeRationale, 600));
    }
    const comparables = arr(patternMatching.comparables);
    if (comparables.length > 0) {
      lines.push('Comparables historiques :');
      for (const c of comparables.slice(0, 5)) {
        const sortie = c?.scenarioSortie || c?.scenario || c?.outcome || '';
        lines.push(`- ${c?.name || c?.id || 'comparable'} (${c?.comparableType || 'sectoral'}). Scenario sortie : ${truncate(sortie, 200)}. ${truncate(c?.relevanceToCurrentDeal, 300)}`);
      }
    }
  } else {
    lines.push('(pattern-matching non disponible)');
  }
  lines.push('');

  lines.push('# INDICATEURS DEAL TYPE');
  lines.push('');
  if (indicators && typeof indicators === 'object' && Object.keys(indicators).length > 0) {
    const indList = arr(indicators.indicators);
    if (indList.length > 0) {
      const synth = (indicators as any).synthesis || (indicators as any).synthese;
      if (typeof synth === 'string') lines.push(truncate(synth, 600));
      lines.push(`Indicateurs : ${indList.map((i: any) => `${i.label} ${i.verdict}`).join(' ; ')}.`);
    }
    const indWarnings = arr((indicators as any).warnings);
    if (indWarnings.length > 0) {
      for (const w of indWarnings) lines.push(`- ${truncate(w, 350)}`);
    }
  } else {
    lines.push('(indicateurs non calcules)');
  }
  lines.push('');

  // Conflits d interet : si presents, c est un signal direct sur la
  // posture (board insider implique un encadrement de gouvernance
  // particulier).
  const flags = arr(conflict.flags);
  if (flags.length > 0) {
    lines.push('# CONFLITS D INTERET DETECTES');
    lines.push('');
    for (const f of flags) {
      lines.push(`- ${f.kind} (severite ${f.severity}). ${truncate(f.rationale, 300)}`);
    }
    lines.push('');
  }

  lines.push('# CONSIGNE');
  lines.push('');
  lines.push('Produis maintenant la recommandation de structuration en six rubriques selon le schema JSON exact decrit dans ton system prompt. Chaque rubrique applicable doit citer dans anchors les signaux exacts repris des sections ci-dessus. Une rubrique sans signal exploitable sort en data-missing avec missingReason precise.');

  return lines.join('\n');
}
