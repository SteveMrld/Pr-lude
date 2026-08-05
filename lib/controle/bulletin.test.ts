// ============================================================
// Tests deterministes du bulletin de fiabilite
// ------------------------------------------------------------
// Ce que ces tests prouvent : le bulletin nomme chaque lacune avec ce
// qu elle empeche d affirmer, il distingue un moteur tombe d un moteur
// sans objet, il ne rend aucune reserve sur une note complete, et il
// n attribue jamais de note de confiance.
//
// La derniere assertion n est pas cosmetique. Un chiffre unique
// cacherait ce qu il resume, et une note qui se decerne une bonne note
// est exactement ce qu un fonds ne peut pas utiliser. Le test le
// verrouille pour qu on ne l ajoute pas un jour par commodite
// d affichage.
//
// Execution : npx tsx lib/controle/bulletin.test.ts
// ============================================================

import { construireBulletin, enTeteDuBulletin } from './bulletin';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Une note sans reserve : tout evalue, tout abouti, tout adosse. */
const NOTE_COMPLETE = {
  extraction: { sector: 'SaaS' },
  relevanceMatrix: { assetClass: 'saas-b2b' },
  mechanicalScore: {
    globalScore: 66,
    basis: { evaluated: ['team', 'market', 'macro', 'financial', 'contrarian', 'vigilance'], totalCount: 6, notEvaluated: [] },
    verdictComparability: { comparable: true, marge: 6, mention: null },
  },
  finalRecommendation: { verdict: 'investir avec conditions', decisionDrivers: ['la traction contractee'] },
  assertionAudit: { totalWarnings: 0, bySeverity: {}, byCategory: {} },
  meta: {
    sourceCapture: { pages: 4, citees: 3, sources: [] },
    engineStatuses: { team: { status: 'ok' }, market: { status: 'ok' } },
    sourceHarvest: { failedSources: [] },
    llmLedger: { totalCalls: 20, totalCacheWriteTokens: 236457, totalCacheReadTokens: 0 },
  },
};

function reserve(b: ReturnType<typeof construireBulletin>, motif: string) {
  return b.reserves.find((r) => r.titre.includes(motif));
}

console.log('\n[Suite 1] une note complete ne porte aucune reserve');
{
  const b = construireBulletin(NOTE_COMPLETE);
  check(b.reserves.length === 0, `aucune reserve (${b.reserves.map((r) => r.titre).join(' | ') || 'aucune'})`);
  check(b.proprietesEnDefaut.length === 0,
    `aucune propriete du catalogue en defaut (${b.proprietesEnDefaut.map((p) => p.id).join(', ') || 'aucune'})`);
  check(enTeteDuBulletin(b).includes('aucune reserve'), 'l en-tete le dit en clair');
}

console.log('\n[Suite 2] chaque lacune est nommee avec ce qu elle empeche');
{
  const sansCapture = { ...NOTE_COMPLETE, meta: { ...NOTE_COMPLETE.meta, sourceCapture: undefined } };
  const b1 = construireBulletin(sansCapture);
  const r1 = reserve(b1, 'aucune capture de sources');
  check(!!r1, 'l absence de capture est signalee');
  check(r1?.gravite === 'majeure', 'elle est majeure');
  check((r1?.portee ?? '').includes('opposable') || (r1?.portee ?? '').includes('verifiable'),
    'sa portee dit ce qu elle empeche d affirmer et non ce qui manque');

  const captureVide = { ...NOTE_COMPLETE, meta: { ...NOTE_COMPLETE.meta, sourceCapture: { pages: 0, citees: 0 } } };
  const b2 = construireBulletin(captureVide);
  check(!!reserve(b2, 'aucune page exterieure'),
    'une capture ouverte mais vide se distingue d une capture absente');
  check(reserve(b2, 'aucune capture de sources') === undefined,
    'et elle ne declenche pas la reserve de l absence : les deux cas ne se confondent pas');

  const revendications = {
    ...NOTE_COMPLETE,
    assertionAudit: { totalWarnings: 12, bySeverity: { critical: 12 }, byCategory: { source_non_capturee: 12 } },
    meta: { ...NOTE_COMPLETE.meta, sourceCapture: { pages: 0, citees: 0 } },
  };
  const b3 = construireBulletin(revendications);
  check(!!reserve(b3, '12 affirmation(s) renvoient'),
    'les revendications sans capture sont comptees et nommees');
}

console.log('\n[Suite 3] un moteur tombe ne se confond pas avec un moteur sans objet');
{
  // C est la distinction a laquelle la doctrine consacre une section :
  // l incident est une lacune du dispositif, l absence une lacune du
  // dossier, et le partner ne doit jamais lire l une pour l autre.
  const note = {
    ...NOTE_COMPLETE,
    meta: {
      ...NOTE_COMPLETE.meta,
      engineStatuses: {
        team: { status: 'ok' },
        market: { status: 'failed' },
        macro: { status: 'timeout' },
        narrativeDrift: { status: 'skipped_not_applicable' },
      },
    },
  };
  const b = construireBulletin(note);
  check(b.production.moteursEnIncident === 2, `deux incidents (${b.production.moteursEnIncident})`);
  check(b.production.moteursSansObjet === 1, `un moteur sans objet (${b.production.moteursSansObjet})`);
  check(b.production.moteursAboutis === 1, `un moteur abouti (${b.production.moteursAboutis})`);
  const inc = reserve(b, 'panne(s)');
  const abs = reserve(b, 'moteur(s) sans objet');
  check(inc?.gravite === 'majeure' && abs?.gravite === 'mineure',
    'l incident est majeur, l absence est mineure : ce sont deux choses differentes');
  check((inc?.portee ?? '').includes('ne dit rien de la societe'),
    'la portee de l incident dit explicitement qu il ne renseigne pas sur le dossier');
  check(b.production.moteursEnPanne.length === 2 && b.production.moteursParCascade === 0,
    'deux pannes propres et aucune cascade quand rien n est failed-upstream');
  check((inc?.titre ?? '').includes('market') && (inc?.titre ?? '').includes('macro'),
    'et les moteurs tombes sont nommes plutot que comptes');
}

console.log('\n[Suite 3 bis] une panne et huit consequences ne font pas neuf pannes');
{
  // Le releve exact du run b8d0e9ac du 5 aout 2026, recopie et non
  // reconstruit : Marche tombe sur son contrat de sortie, et les huit
  // moteurs qui l attendent derriere la porte partent en
  // failed-upstream. Le bulletin annoncait « 9 moteur(s) en incident »,
  // ce qui decrit un dispositif qui s effondre la ou il y a un point
  // unique a reparer.
  const note = {
    ...NOTE_COMPLETE,
    meta: {
      ...NOTE_COMPLETE.meta,
      engineStatuses: {
        team: { status: 'ok' },
        macro: { status: 'ok' },
        market: { status: 'failed' },
        causalReversal: { status: 'failed-upstream' },
        patternMatching: { status: 'failed-upstream' },
        referenceChecks: { status: 'failed-upstream' },
        blindspotAnalysis: { status: 'failed-upstream' },
        contrarianAnalysis: { status: 'failed-upstream' },
        financialCoherence: { status: 'failed-upstream' },
        fragiliteStructurelle: { status: 'failed-upstream' },
        narrativeDrift: { status: 'failed-upstream' },
      },
    },
  };
  const b = construireBulletin(note);
  check(b.production.moteursEnPanne.length === 1, `une seule panne propre (${b.production.moteursEnPanne.length})`);
  check(b.production.moteursEnPanne[0] === 'market', 'et elle est nommee : market');
  check(b.production.moteursParCascade === 8, `huit consequences (${b.production.moteursParCascade})`);
  check(b.production.moteursEnIncident === 9,
    'le total reste neuf : il ne ment pas, il ne suffisait pas');

  const r = reserve(b, 'panne(s)');
  check((r?.titre ?? '').includes('1 panne(s) : market'), 'la reserve nomme la panne et non le total');
  check((r?.titre ?? '').includes('8 moteur(s) tombe(s) avec'), 'et elle compte les consequences a part');
  check((r?.portee ?? '').includes('point unique a reparer'),
    'la portee dit que c est un point unique et non une defaillance generale');
}

console.log('\n[Suite 3 ter] une cascade sans panne relevee se declare');
{
  // Cas limite reel : le run b8d0e9ac ne renseigne failedDependencies
  // sur aucune de ses huit entrees en cascade. Si la panne racine
  // manquait aussi du releve, le bulletin n aurait rien a nommer, et
  // c est ce silence-la qu il doit dire plutot que de compter.
  const note = {
    ...NOTE_COMPLETE,
    meta: {
      ...NOTE_COMPLETE.meta,
      engineStatuses: {
        team: { status: 'ok' },
        blindspotAnalysis: { status: 'failed-upstream' },
        contrarianAnalysis: { status: 'failed-upstream' },
      },
    },
  };
  const b = construireBulletin(note);
  check(b.production.moteursEnPanne.length === 0 && b.production.moteursParCascade === 2,
    'aucune panne propre, deux cascades');
  const r = reserve(b, 'cascade sans qu aucune panne amont');
  check(r?.gravite === 'majeure', 'la cascade orpheline reste une reserve majeure');
  check((r?.portee ?? '').includes('ne nomme pas la cause'),
    'et elle dit que le releve ne nomme pas la cause, au lieu de laisser croire a une panne');
}

console.log('\n[Suite 4] l assiette partielle et la comparabilite');
{
  // La forme de notEvaluated est copiee du corpus et non inventee : le
  // premier jet du bulletin la traitait comme un tableau de chaines et
  // rendait « [object Object] » sur cinq notes reelles. Une fixture
  // ecrite dans mon hypothese aurait reconduit l erreur en silence.
  const partielle = {
    ...NOTE_COMPLETE,
    mechanicalScore: {
      globalScore: 59,
      basis: {
        evaluated: ['team', 'market', 'macro', 'contrarian'],
        totalCount: 6,
        sufficient: true,
        evaluatedWeight: 0.87,
        minimumWeight: 0.5,
        notEvaluated: [
          { cause: 'moteur-failed', label: 'Modele economique', dimension: 'financial', engineStatus: 'failed' },
          { cause: 'sous-champs-absents', label: 'Vigilance critique', dimension: 'vigilance', engineStatus: 'ok' },
        ],
      },
      verdictComparability: { comparable: false, marge: 1, mention: 'Assiette partielle.' },
    },
  };
  const b = construireBulletin(partielle);
  check(b.couverture.dimensionsEvaluees === 4 && b.couverture.dimensionsTotal === 6, 'la couverture est rendue');
  const inc = reserve(b, 'perdue(s) par incident');
  const abs = reserve(b, 'faute de matiere');
  check(!!inc && !!abs, 'les deux causes de non-evaluation sont signalees separement');
  check((inc?.titre ?? '').includes('Modele economique') && !(inc?.titre ?? '').includes('[object'),
    `la dimension perdue est nommee et non serialisee (${inc?.titre})`);
  check((abs?.titre ?? '').includes('Vigilance critique'), 'la dimension sans matiere est nommee');
  check(inc?.gravite === 'majeure', 'une dimension perdue par incident est une reserve majeure');
  check(!!reserve(b, 'n est pas comparable'), 'la non-comparabilite est signalee a part');
  check((reserve(b, 'n est pas comparable')?.portee ?? '').includes('seuil'),
    'sa portee nomme le franchissement de seuil, qui est ce qui la fonde');

  const socle = {
    ...partielle,
    mechanicalScore: { ...partielle.mechanicalScore, basis: { ...partielle.mechanicalScore.basis, sufficient: false, evaluatedWeight: 0.37 } },
  };
  check(!!reserve(construireBulletin(socle), 'socle insuffisant'),
    'un socle insuffisant se declare comme tel, avec son poids et son minimum');
}

console.log('\n[Suite 5] le bulletin ne se decerne aucune note');
{
  const b = construireBulletin(NOTE_COMPLETE);
  const champs = JSON.stringify(b).toLowerCase();
  const interdits = ['"score"', '"note"', '"confiance"', '"fiabilite":', '"niveau"', '"grade"'];
  const trouves = interdits.filter((x) => champs.includes(x));
  check(trouves.length === 0, `aucun champ de notation globale (${trouves.join(', ') || 'aucun'})`);
  check(!enTeteDuBulletin(b).match(/\d+\s*%/), 'l en-tete ne rend aucun pourcentage de confiance');
}

console.log('\n[Suite 6] les reserves sont ordonnees par gravite');
{
  const note = {
    ...NOTE_COMPLETE,
    meta: {
      ...NOTE_COMPLETE.meta,
      sourceCapture: undefined,
      engineStatuses: { a: { status: 'skipped_not_applicable' } },
      sourceHarvest: { failedSources: ['openalex'] },
    },
  };
  const b = construireBulletin(note);
  const rangs = { majeure: 0, notable: 1, mineure: 2 } as const;
  const suite = b.reserves.map((r) => rangs[r.gravite]);
  check(suite.every((v, i) => i === 0 || suite[i - 1] <= v),
    `les reserves vont du plus lourd au plus leger (${b.reserves.map((r) => r.gravite).join(' > ')})`);
}

console.log('\n[Suite 7] aucune levee sur une note degeneree');
{
  let leves = 0;
  for (const n of [{}, { meta: {} }, { mechanicalScore: {} }, { meta: { engineStatuses: null } }]) {
    try { construireBulletin(n); } catch { leves++; }
  }
  check(leves === 0, 'le bulletin se construit sur une note vide sans lever');
}

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail > 0 ? 1 : 0);
