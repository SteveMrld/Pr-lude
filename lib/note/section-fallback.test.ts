// ============================================================
// Tests deterministes section-fallback.ts + contrat de rendu
// ------------------------------------------------------------
// Suite 1 : sectionFallbackCopy retourne le texte attendu par
//           kind, la specificite prime sur le default, la copie
//           market est bien la formulation longue nouvelle.
// Suite 2 : formulations conservees pour Lecture du langage,
//           Fragilite structurelle, Facteurs decisifs (kind
//           orchestrator, fallback long).
// Suite 3 : sanitizeNarrative laisse passer un texte propre,
//           remplace integralement un texte sentinel d echec.
// Suite 4 : point d entree futur enginesStatus n altere pas la
//           copie aujourd hui (retrocompatibilite).
// ============================================================

import {
  sectionFallbackCopy,
  sectionFallbackTitle,
  sanitizeNarrative,
  sanitizeNarrativeList,
  looksLikeFailureCopy,
  type SectionKind,
} from './section-fallback';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - sectionFallbackCopy par kind
// ============================================================

console.log('\n[Suite 1] sectionFallbackCopy retourne le texte attendu par kind');

{
  // Le kind market est desormais la formulation specifique longue
  const market = sectionFallbackCopy('market');
  check(market.includes('L’analyse de marché'), 'market : formulation specifique longue');
  check(market.includes('DD Bloc 2'), '  market : mentionne DD Bloc 2');
  check(market.includes('TAM/SAM/SOM'), '  market : mentionne le dimensionnement');
  check(market.includes('déterministes qui ont abouti'), '  market : affirme que le score reste opposable');
  check(!market.includes('529'), '  market : aucune mention technique');
  check(!market.includes('Anthropic'), '  market : aucune mention Anthropic');
  check(!market.includes('Relancer'), '  market : aucun imperatif');
}

{
  // Les kinds par defaut retournent la formulation courte
  const def = sectionFallbackCopy('default');
  check(def.startsWith('Cette dimension n’a pas pu être instruite'), 'default : formulation courte standard');
  check(def.includes('DD Bloc 2'), '  default : mentionne DD Bloc 2');
}

{
  // Kind inconnu (cast force) retombe sur default
  const unknown = sectionFallbackCopy('kind-qui-existe-pas' as SectionKind);
  check(unknown === sectionFallbackCopy('default'), 'kind inconnu retombe sur default');
}

{
  // Titre neutre pour market
  check(sectionFallbackTitle('market') === 'Marché', 'sectionFallbackTitle market = Marché');
  check(sectionFallbackTitle('narrative-drift') === 'Lecture du langage', 'sectionFallbackTitle narrative-drift');
  check(sectionFallbackTitle('fragility-structurelle') === 'Fragilité structurelle', 'sectionFallbackTitle fragilite');
}

// ============================================================
// SUITE 2 - Formulations conservees (elles etaient bonnes)
// ============================================================

console.log('\n[Suite 2] Formulations conservees pour les sections existantes');

{
  const narrDrift = sectionFallbackCopy('narrative-drift');
  check(narrDrift === 'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.', 'Lecture du langage : formulation exacte conservee');
}

{
  const frag = sectionFallbackCopy('fragility-structurelle');
  check(frag === 'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.', 'Fragilite structurelle : formulation exacte conservee');
}

{
  // Facteurs decisifs utilise le kind orchestrator (verifie dans InvestmentNoteView L3110)
  const orch = sectionFallbackCopy('orchestrator');
  check(orch.includes('La synthèse narrative finale'), 'Facteurs decisifs (kind orchestrator) : formulation longue conservee');
  check(orch.includes('Le score et le verdict restent véridiques et opposables'), '  affirme que score et verdict restent opposables');
  check(orch.includes('moteurs d’instruction qui ont abouti'), '  precise fondes sur moteurs deterministes');
  check(orch.includes('DD Bloc 2'), '  positionne la reprise en DD Bloc 2');
}

// ============================================================
// SUITE 3 - sanitizeNarrative discipline anti fuite
// ============================================================

console.log('\n[Suite 3] sanitizeNarrative laisse passer les textes propres, filtre les fuites');

{
  const clean = 'Le dossier presente une trajectoire coherente sur trois ans.';
  check(sanitizeNarrative(clean) === clean, 'texte propre passe sans alteration');
}

{
  // Texte avec sentinel marker => remplacement complet par fallback
  const dirty = 'Erreur 529 Anthropic, relancer l analyse pour ce dossier.';
  const cleaned = sanitizeNarrative(dirty, 'orchestrator');
  check(cleaned === sectionFallbackCopy('orchestrator'), 'texte sentinel remplace par fallback orchestrator');
  check(!cleaned.includes('529'), '  aucune fuite 529');
  check(!cleaned.includes('Anthropic'), '  aucune fuite Anthropic');
}

{
  // Chaine vide ou non-string retourne chaine vide
  check(sanitizeNarrative('') === '', 'chaine vide');
  check(sanitizeNarrative(null as any) === '', 'null');
  check(sanitizeNarrative(undefined as any) === '', 'undefined');
  check(sanitizeNarrative(42 as any) === '', 'nombre');
}

{
  check(looksLikeFailureCopy('') === false, 'looksLikeFailureCopy chaine vide false');
  check(looksLikeFailureCopy('texte narratif normal') === false, 'texte normal false');
  check(looksLikeFailureCopy('erreur 529') === true, 'chaine 529 true');
  check(looksLikeFailureCopy('surcharge Anthropic transitoire') === true, 'surcharge Anthropic true');
}

{
  // sanitizeNarrativeList filtre les elements vides
  const list = ['driver 1', '', 'driver 2', 'erreur 529 relancer'];
  const cleaned = sanitizeNarrativeList(list, 'orchestrator');
  check(cleaned.length === 3, 'liste : 3 elements gardes (2 propres + 1 nettoye par fallback)');
  check(cleaned.includes('driver 1'), '  driver 1 preserve');
  check(cleaned.includes('driver 2'), '  driver 2 preserve');
  check(!cleaned.some(s => s.includes('529')), '  aucune fuite technique');
}

// ============================================================
// SUITE 4 - Point d entree enginesStatus, retrocompatibilite
// ============================================================

console.log('\n[Suite 4] Point d entree enginesStatus (branchement futur)');

{
  const base = sectionFallbackCopy('market');
  const withStatus = sectionFallbackCopy('market', {
    enginesStatus: { market: { status: 'empty_output', durationMs: 0, attempts: 1 } },
    engineKey: 'market',
  });
  check(base === withStatus, 'enginesStatus n altere pas la copie aujourd hui (branchement reserve)');
}

{
  const base = sectionFallbackCopy('narrative-drift');
  const withStatus = sectionFallbackCopy('narrative-drift', {
    enginesStatus: { narrativeDrift: { status: 'timeout', durationMs: 120000, attempts: 1, errorMessage: 'deadline-exceeded' } },
    engineKey: 'narrativeDrift',
  });
  check(base === withStatus, 'narrative-drift : idem, futur non consomme');
}

{
  // enginesStatus null / undefined ne casse pas
  check(sectionFallbackCopy('default', { enginesStatus: null }).length > 0, 'enginesStatus null OK');
  check(sectionFallbackCopy('default', { enginesStatus: undefined }).length > 0, 'enginesStatus undefined OK');
  check(sectionFallbackCopy('default', {}).length > 0, 'opts vide OK');
}

// ============================================================
// SORTIE
// ============================================================

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
