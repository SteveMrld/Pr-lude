// ============================================================
// Tests deterministes de prediction-records-store
// ------------------------------------------------------------
// Ce fichier portait ce nom et ne touchait pas ce store : il testait
// le fingerprint de version stamp, qui vit maintenant sous son propre
// nom dans lib/instrumentation. Le store, cinq fonctions exportees et
// trois cent vingt lignes, n etait exerce par aucun test du depot.
//
// Ce qu il y a a verifier dans un store n est presque jamais un calcul.
// C est le choix de la table, des colonnes, des filtres et du tri, plus
// la traduction de la ligne brute en objet. Le double de client
// enregistre l appel construit, ce qui permet d affirmer ces choix
// plutot que de constater qu une valeur mockee ressort intacte.
//
// Les valeurs du jeu d essai sont discriminantes au sens de la
// discipline : chaque identifiant n existe qu a un endroit, et les
// nombres different d une colonne a l autre, sans quoi une inversion de
// deux dimensions passerait inapercue.
//
//   npx tsx lib/prediction-records-store.test.ts
// ============================================================

import { installerDoubleSupabase, type AppelEnregistre, type ReponseSupabase } from './test-support/supabase-double';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Le store lit ces variables a chaque appel. On les pose ici plutot que
// de dependre d un .env, pour que le test dise la meme chose partout.
process.env.SUPABASE_URL = 'https://double.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test-XR7742';

// Programme par chaque suite avant d appeler le store.
let repondre: (a: AppelEnregistre) => ReponseSupabase = () => ({ data: [], error: null });
const double = installerDoubleSupabase((a) => repondre(a));

/** Ligne brute telle que Postgres la rend : les numeriques arrivent en
 *  chaine, ce qui est precisement ce que mapRecord doit absorber. */
const LIGNE = {
  id: 'rec-QN8802',
  analysis_id: 'ana-XJ4417',
  user_id: 'usr-ZR1190',
  captured_at: '2026-07-14T08:30:00.000Z',
  verdict: 'reserve-forte',
  global_score: '61.5',
  success_probability: '0.42',
  dim_team: '71', dim_market: '52', dim_macro: '38',
  dim_financial: '64', dim_contrarian: '29', dim_vigilance: '83',
  version_stamp: { schemaVersion: 'v-ligne-8802' },
  stamp_commit_sha: 'sha-8802', stamp_configs_hash: 'cfg-8802',
  stamp_engines_hash: 'eng-8802', stamp_models_hash: 'mod-8802',
  stamp_inputs_hash: 'inp-8802',
  schema_version: 'v-ligne-8802',
  created_at: '2026-07-14T08:30:01.000Z',
};

// Le stamp est construit par le moteur et non ecrit a la main. Une
// fixture ecrite a la main porterait mon hypothese sur sa forme, et
// c est exactement la faute que la discipline des jeux d essai
// interdit : elle a d ailleurs jete ici au premier essai.
import { buildVersionStamp, fingerprintStamp } from './instrumentation/version-stamp';
const STAMP = buildVersionStamp({
  inputs: { deckBase64: 'UUpEWFI3NzQy', pitchText: 'temoin XR7742', bpText: null },
  capturedAt: '2026-07-14T08:30:00.000Z',
});
const EMPREINTE = fingerprintStamp(STAMP);

(async () => {
  const store = await import('./prediction-records-store');

  // ============================================================
  console.log('\n[Suite 1] insertPredictionRecord ecrit dans prediction_records');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: LIGNE, error: null });
    const r = await store.insertPredictionRecord({
      analysisId: 'ana-XJ4417', userId: 'usr-ZR1190', verdict: 'reserve-forte',
      globalScore: 61.5, successProbability: 0.42,
      dimensions: { team: 71, market: 52, macro: 38, financial: 64, contrarian: 29, vigilance: 83 },
      versionStamp: STAMP, capturedAt: '2026-07-14T08:30:00.000Z',
    });

    const a = double.dernier();
    check(a.table === 'prediction_records', 'la table est prediction_records');
    check(a.operation === 'insert', 'l operation est un insert');
    check(a.forme === 'single', 'la ligne inseree est relue en single');

    const p = a.payload as Record<string, unknown>;
    check(p.analysis_id === 'ana-XJ4417', 'analysis_id porte l identifiant du dossier');
    check(p.user_id === 'usr-ZR1190', 'user_id porte celui du porteur');
    check(p.captured_at === '2026-07-14T08:30:00.000Z', 'captured_at reprend la date fournie et n invente pas l horloge');
    // Les six dimensions portent six valeurs distinctes : une permutation
    // de deux colonnes ferait tomber ce bloc, ce qu un jeu uniforme ne
    // permettrait pas de voir.
    check(p.dim_team === 71 && p.dim_market === 52 && p.dim_macro === 38, 'les trois premieres dimensions vont dans leur colonne');
    check(p.dim_financial === 64 && p.dim_contrarian === 29 && p.dim_vigilance === 83, 'les trois suivantes aussi');
    check(p.schema_version === STAMP.schemaVersion, 'schema_version est lu dans le stamp et non ailleurs');
    check(p.version_stamp === STAMP, 'le stamp entier est persiste tel quel');

    // Les colonnes stamp_* sont celles que fingerprintStamp derive du
    // stamp, et pas une recopie de ses champs : on compare a la sortie
    // de la fonction, seule source qui puisse les produire.
    check(p.stamp_configs_hash === EMPREINTE.configsHash, 'stamp_configs_hash est l empreinte des configs');
    check(p.stamp_engines_hash === EMPREINTE.enginesHash, 'stamp_engines_hash est celle des moteurs');
    check(p.stamp_models_hash === EMPREINTE.modelsHash, 'stamp_models_hash celle des modeles');
    check(p.stamp_inputs_hash === EMPREINTE.inputsHash, 'stamp_inputs_hash celle des entrees');
    check(p.stamp_commit_sha === EMPREINTE.commitSha, 'stamp_commit_sha suit le commit du stamp');

    check(r !== null && r.globalScore === 61.5, 'le record rendu porte le score en nombre');
    check(r !== null && r.dimensions.vigilance === 83, 'et la vigilance lue en chaine devient un nombre');
    check(r !== null && r.stampFingerprint.inputsHash === 'inp-8802', 'le fingerprint rendu vient des colonnes et non du recalcul');
  }

  // ============================================================
  console.log('\n[Suite 2] une erreur Supabase ne remonte pas en exception');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: null, error: { message: 'colonne inconnue QN8802' } });
    const r = await store.insertPredictionRecord({
      analysisId: 'ana-XJ4417', userId: 'usr-ZR1190', verdict: 'reserve-forte',
      globalScore: null, successProbability: null,
      dimensions: { team: null, market: null, macro: null, financial: null, contrarian: null, vigilance: null },
      versionStamp: STAMP,
    });
    check(r === null, 'insert en erreur : rend null plutot que de jeter');
    check(double.appels.length === 1, 'et n a pas retente l ecriture');
  }

  // ============================================================
  console.log('\n[Suite 3] la lecture filtre sur le dossier ET sur le porteur');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: [LIGNE, { ...LIGNE, id: 'rec-plus-ancien', captured_at: '2026-01-02T00:00:00.000Z' }], error: null });
    const rs = await store.listPredictionRecordsForAnalysis('ana-XJ4417', 'usr-ZR1190');

    const a = double.dernier();
    check(a.table === 'prediction_records', 'la table est prediction_records');
    check(a.operation === 'select' && a.colonnes === '*', 'la lecture demande toutes les colonnes');

    const parColonne = Object.fromEntries(a.filtres.map((f) => [f.colonne, f]));
    // Les deux identifiants sont distincts : un filtre pose sur la
    // mauvaise colonne, ou la meme valeur passee deux fois, tombe ici.
    check(parColonne.analysis_id?.valeur === 'ana-XJ4417', 'le filtre analysis_id porte l identifiant du dossier');
    check(parColonne.user_id?.valeur === 'usr-ZR1190', 'le filtre user_id porte celui du porteur');
    check(a.filtres.length === 2, 'et il n y a pas de troisieme filtre silencieux');
    check(a.tris.length === 1 && a.tris[0].colonne === 'captured_at' && a.tris[0].ascendant === false,
      'le tri est captured_at decroissant, sans quoi le plus recent ne serait pas premier');
    check(rs.length === 2, 'les deux lignes sont rendues');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: null, error: { message: 'panne' } });
    const rs = await store.listPredictionRecordsForAnalysis('ana-XJ4417', 'usr-ZR1190');
    check(Array.isArray(rs) && rs.length === 0, 'lecture en erreur : liste vide, pas d exception');
  }

  // ============================================================
  console.log('\n[Suite 4] getLatestPredictionRecord depend du tri de la lecture');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: [{ ...LIGNE, id: 'rec-le-plus-recent' }, { ...LIGNE, id: 'rec-plus-ancien' }], error: null });
    const r = await store.getLatestPredictionRecord('ana-XJ4417', 'usr-ZR1190');
    check(r?.id === 'rec-le-plus-recent', 'le premier de la liste triee est rendu');
    check(double.appels.length === 1, 'sans requete supplementaire : le tri fait le travail');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: [], error: null });
    const r = await store.getLatestPredictionRecord('ana-XJ4417', 'usr-ZR1190');
    check(r === null, 'aucun record : rend null et non undefined');
  }

  // ============================================================
  console.log('\n[Suite 5] la lecture en bulk borne ce qu elle charge');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: [LIGNE], error: null });
    await store.listAllPredictionRecords();
    const a = double.dernier();
    check(a.filtres.length === 0, 'sans userId : aucun filtre, la lecture est globale');
    check(a.limite === 1000, 'la limite par defaut est posee et vaut 1000');
    check(a.tris[0]?.colonne === 'captured_at' && a.tris[0]?.ascendant === false, 'le tri reste captured_at decroissant');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: [LIGNE], error: null });
    await store.listAllPredictionRecords({ userId: 'usr-ZR1190', limit: 7 });
    const a = double.dernier();
    check(a.filtres.length === 1 && a.filtres[0].colonne === 'user_id' && a.filtres[0].valeur === 'usr-ZR1190',
      'avec userId : un filtre unique sur user_id');
    check(a.limite === 7, 'la limite demandee prime sur le defaut');
  }

  // ============================================================
  console.log('\n[Suite 6] sans configuration Supabase, le store se tait');
  // ============================================================
  {
    const url = process.env.SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    double.appels.length = 0;

    const r = await store.insertPredictionRecord({
      analysisId: 'ana-XJ4417', userId: 'usr-ZR1190', verdict: 'v',
      globalScore: null, successProbability: null,
      dimensions: { team: null, market: null, macro: null, financial: null, contrarian: null, vigilance: null },
      versionStamp: STAMP,
    });
    const l = await store.listAllPredictionRecords();

    check(r === null, 'insert sans URL : rend null');
    check(Array.isArray(l) && l.length === 0, 'lecture sans URL : liste vide');
    check(double.appels.length === 0, 'et aucune requete n a ete construite');

    if (url) process.env.SUPABASE_URL = url;
    if (pub) process.env.NEXT_PUBLIC_SUPABASE_URL = pub;
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
