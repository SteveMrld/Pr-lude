// ============================================================
// Tests deterministes du catalogue de proprietes
// ------------------------------------------------------------
// Ce que ces tests prouvent : chaque propriete voit la faute quand on la
// lui donne et se tait quand on ne la lui donne pas, aucune ne leve sur
// une note vide, et les garde-fous du catalogue tiennent.
//
// CE QU ILS NE PROUVENT PAS
//
// Ils n etablissent pas le taux de faux positifs. Ce taux se mesure sur
// le corpus persiste et nulle part ailleurs, parce qu une fixture ecrite
// ici porterait mon hypothese sur la forme des notes au lieu de la
// lecture des notes. Le releve du corpus est la preuve, ces tests sont
// le verrou : ils empechent qu une propriete cesse de detecter sans que
// rien ne rougisse. La demonstration de leur complementarite est dans le
// catalogue lui-meme, ou deux proprietes portent le compte de faux
// positifs que le corpus leur a inflige avant leur entree.
//
// Execution : npx tsx lib/controle/proprietes.test.ts
// ============================================================

import { PROPRIETES, propriete, type Propriete } from './proprietes';
import { MOTEURS_LLM } from '../../scripts/replay-partial';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Une propriete voit-elle la faute, et se tait-elle sans elle. */
function mutation(id: string, fautive: any, saine: any): void {
  const p = propriete(id);
  const porteFautive = p.porte(fautive);
  const porteSaine = p.porte(saine);
  check(porteFautive, `${id} : la note fautive est portee`);
  check(porteSaine, `${id} : la note saine est portee`);
  check(porteFautive && p.constats(fautive).length > 0, `${id} : la faute est vue`);
  check(porteSaine && p.constats(saine).length === 0, `${id} : la note saine ne rougit pas`);
}

console.log('\n[Suite 1] garde-fous du catalogue');
{
  const ids = PROPRIETES.map((p) => p.id);
  check(new Set(ids).size === ids.length, `les ${ids.length} identifiants sont distincts`);
  check(PROPRIETES.every((p) => p.origine.trim().length > 40),
    'chaque propriete nomme le defaut dont elle est nee');
  // Une propriete sans releve de corpus n entre pas : c est l exigence
  // que la sonde du 5 aout a rendue non negociable.
  check(PROPRIETES.every((p) => p.eprouvee.trim().length > 60),
    'chaque propriete porte ce que le corpus lui a rendu avant son entree');
  check(PROPRIETES.every((p) => p.lit.length > 0), 'chaque propriete declare ce qu elle lit');

  // Verrou de famille. Une propriete declaree de structure qui lirait
  // une sortie de moteur LLM rendrait un taux qu on croirait porter sur
  // le code actuel alors qu il porterait sur la prose d un run ancien.
  // La liste des moteurs LLM n est pas recopiee ici, elle est importee
  // de la ou elle sert deja de frontiere au rejeu partiel.
  const llm = new Set<string>(MOTEURS_LLM as readonly string[]);
  const mal = PROPRIETES.filter((p) => p.famille === 'structure'
    && p.lit.some((c) => llm.has(c.split('.')[0])));
  check(mal.length === 0,
    `aucune propriete de structure ne lit une sortie de moteur LLM (${mal.map((p) => p.id).join(', ') || 'aucune'})`);

  const proseSansLlm = PROPRIETES.filter((p) => p.famille === 'prose'
    && !p.lit.some((c) => llm.has(c.split('.')[0])));
  check(proseSansLlm.length === 0,
    `aucune propriete de prose ne lit que du deterministe (${proseSansLlm.map((p) => p.id).join(', ') || 'aucune'})`);
}

console.log('\n[Suite 2] aucune propriete ne leve sur une note degeneree');
{
  const degenerees: any[] = [{}, { meta: {} }, { extraction: {} }, { meta: { versionStamp: null } }];
  let leves = 0;
  for (const p of PROPRIETES) {
    for (const n of degenerees) {
      try { if (p.porte(n)) p.constats(n); } catch { leves++; console.error(`      ${p.id} leve`); }
    }
  }
  check(leves === 0, `aucune levee sur ${degenerees.length} notes degenerees x ${PROPRIETES.length} proprietes`);
}

console.log('\n[Suite 3] chaque propriete voit la faute qu on lui donne');

mutation('revendication-adossee-a-une-capture',
  { extraction: { sector: 'SaaS' }, team: { rationale: 'La mediane sectorielle atteint douze pour cent [web : benchmarkit.ai].' }, meta: {} },
  { extraction: { sector: 'SaaS' }, team: { rationale: 'La mediane sectorielle atteint douze pour cent [web : benchmarkit.ai].' }, meta: { sourceCapture: { pages: 3 } } });

mutation('statuts-moteurs-persistes',
  { meta: { analyzedAt: 'x' } },
  { meta: { engineStatuses: { team: { status: 'ok' } } } });

mutation('cout-du-run-exact',
  { meta: { llmLedger: { totalCalls: 22, totalInputTokens: 156000 } } },
  { meta: { llmLedger: { totalCalls: 22, totalInputTokens: 156000, totalCacheWriteTokens: 236457, totalCacheReadTokens: 0 } } });

mutation('classe-actif-resolue',
  { relevanceMatrix: { assetClass: 'unclassified' } },
  { relevanceMatrix: { assetClass: 'saas-b2b' } });

mutation('verdict-suit-le-score',
  { mechanicalScore: { globalScore: 82 }, finalRecommendation: { verdict: 'refuser' } },
  { mechanicalScore: { globalScore: 82 }, finalRecommendation: { verdict: 'investir avec conditions' } });

mutation('fourchette-de-valorisation-ordonnee',
  { valuation: { ranges: [{ nature: 'pre-money', min: 40e6, max: 12e6 }] } },
  { valuation: { ranges: [{ nature: 'pre-money', min: 12e6, max: 40e6 }] } });

mutation('drivers-hors-repli-degrade',
  { finalRecommendation: { verdict: 'approfondir', decisionDrivers: [] } },
  { finalRecommendation: { verdict: 'approfondir', decisionDrivers: ['la dependance a un client unique'] } });

mutation('comparabilite-declaree',
  { mechanicalScore: { verdictComparability: { comparable: false, marge: 1, mention: null } } },
  { mechanicalScore: { verdictComparability: { comparable: false, marge: 1, mention: 'Assiette partielle : verdict non comparable.' } } });

mutation('pattern-applicable-instruit',
  { fragiliteStructurelle: { patterns: { 'fixed-cost-trap': { verdict: 'attention', applicabilite: 'partial', axis1: { rationale: 'trop court' } } } } },
  { fragiliteStructurelle: { patterns: { 'fixed-cost-trap': { verdict: 'attention', applicabilite: 'partial', axis1: { rationale: 'x'.repeat(240) } } } } });

mutation('annee-non-prise-pour-un-montant',
  { assertionAudit: { warnings: [{ category: 'currency_mismatch', field: 'marketSizing', excerpt: 'Le TAM 500 Mds$ 2025 est confirme par les sources web' }] } },
  { assertionAudit: { warnings: [{ category: 'currency_mismatch', field: 'marketSizing', excerpt: 'un TAM de 500 Mds$ annonce pour 2025' }] } });

const alerte = (nom: string, champ = 'team.rationale') => ({
  category: 'unknown_name', field: champ,
  message: `Nom propre "${nom}" cite sans tag de source et absent des donnees extraites du pitch.`,
  excerpt: `... ${nom} ...`, severity: 'warning',
});

mutation('sigle-non-pris-pour-un-nom-propre',
  { assertionAudit: { warnings: [alerte('B2B'), alerte('Doctolib')] } },
  { assertionAudit: { warnings: [alerte('Doctolib')] } });

mutation('nom-documente-par-le-dossier-non-signale',
  { extraction: { rawSummary: 'La societe sert Carrefour depuis 2021.' }, assertionAudit: { warnings: [alerte('Carrefour')] } },
  { extraction: { rawSummary: 'La societe sert Auchan depuis 2021.' }, assertionAudit: { warnings: [alerte('Carrefour')] } });

mutation('nom-non-tronque-par-une-lettre',
  { extraction: { rawSummary: 'Contrat cadre avec Nestlé signe en 2023.' }, assertionAudit: { warnings: [alerte('Nestl')] } },
  { extraction: { rawSummary: 'Contrat cadre avec Nestlé signe en 2023.' }, assertionAudit: { warnings: [alerte('Nestlé')] } });

mutation('frozen-coupe-la-recherche-web',
  { meta: { versionStamp: { runMode: { frozen: true }, webSearchEnabled: true } } },
  { meta: { versionStamp: { runMode: { frozen: true }, webSearchEnabled: false } } });

console.log('\n[Suite 4] le repli degrade sort du perimetre, il ne le viole pas');
{
  // C est la clause dont l absence coutait cent pour cent de faux
  // positifs. Une note degradee ne doit pas etre PORTEE, et non pas
  // etre portee puis absoute : la difference se voit au denominateur.
  const p = propriete('drivers-hors-repli-degrade');
  const degradee = { finalRecommendation: { verdict: 'approfondir', degraded: true, degradedReason: 'orchestrate en echec', decisionDrivers: [] } };
  check(p.porte(degradee) === false, 'une recommandation degradee n entre pas dans le denominateur');
}

console.log('\n[Suite 5] la note qui ne revendique rien ne rougit pas');
{
  // TOLSON du 12 juillet est la seule note du corpus a passer cette
  // propriete, et son cas est reproduit ici : une note complete, sans
  // capture, qui ne revendique aucune lecture exterieure.
  const p = propriete('revendication-adossee-a-une-capture');
  const sansRevendication = {
    extraction: { sector: 'SaaS' },
    team: { rationale: 'Le fondateur a dirige une equipe de trente personnes [pitch p.12], ce que le dossier documente.' },
    market: { rationale: 'Le raisonnement se tient sur le seul document instruit [inference], sans lecture exterieure.' },
    meta: {},
  };
  check(p.porte(sansRevendication) && p.constats(sansRevendication).length === 0,
    'une note sans capture mais sans revendication exterieure passe a bon droit');
}

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail > 0 ? 1 : 0);
