// ============================================================
// Tests deterministes de reference-dossiers-store
// ------------------------------------------------------------
// Ce fichier portait ce nom et n exercait que le vocabulaire controle,
// desormais teste sous son propre nom. Le store, huit fonctions
// exportees, n etait couvert par rien.
//
// Trois choses s y verifient et aucune n est un calcul. La table et les
// filtres, parce que chercher un dossier par le nom de fichier quand on
// croit le chercher par la societe est une faute muette. Le filtrage du
// vocabulaire a la lecture, qui protege l aval d un motif inconnu entre
// en base par un autre chemin. Et la forme du patch de mise a jour, qui
// ne doit ecrire que les champs presents : un champ absent d une
// requete n est pas un champ a vider, et confondre les deux effacerait
// le travail du partner.
//
//   npx tsx lib/reference-dossiers-store.test.ts
// ============================================================

import { installerDoubleSupabase, type AppelEnregistre, type ReponseSupabase } from './test-support/supabase-double';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

process.env.SUPABASE_URL = 'https://double.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test-ZR1190';

let repondre: (a: AppelEnregistre) => ReponseSupabase = () => ({ data: [], error: null });
const double = installerDoubleSupabase((a) => repondre(a));

const LIGNE = {
  id: 'dos-XJ4417',
  analysis_id: 'ana-QN8802',
  source_pdf_filename: 'memo-XJ4417.pdf',
  company_name: 'Societe temoin XJ4417',
  deck_received_at: '2026-03-11',
  partner_verdict: 'pass',
  partner_reasoning: 'motivation temoin ZR1190',
  decision_motifs: [] as string[],
  post_investment_deviations: null,
  ingestion_status: 'human_layer_pending',
  created_at: '2026-03-11T09:00:00.000Z',
  updated_at: '2026-03-12T09:00:00.000Z',
};

(async () => {
  const store = await import('./reference-dossiers-store');
  const vocab = await import('./reference-dossiers-vocabulary');

  // ============================================================
  console.log('\n[Suite 1] creation : table, payload, defaut de statut');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: LIGNE, error: null });
    await store.createReferenceDossier({
      analysisId: 'ana-QN8802',
      sourcePdfFilename: 'memo-XJ4417.pdf',
      companyName: 'Societe temoin XJ4417',
      deckReceivedAt: '2026-03-11',
    });
    const a = double.dernier();
    check(a.table === 'reference_dossiers', 'la table est reference_dossiers');
    check(a.operation === 'insert' && a.forme === 'single', 'insert relu en single');
    const p = a.payload as Record<string, unknown>;
    // Les trois chaines sont distinctes deux a deux : une permutation
    // de deux colonnes tombe ici, ce qu un jeu uniforme cacherait.
    check(p.analysis_id === 'ana-QN8802', 'analysis_id a sa colonne');
    check(p.source_pdf_filename === 'memo-XJ4417.pdf', 'source_pdf_filename a la sienne');
    check(p.company_name === 'Societe temoin XJ4417', 'company_name aussi');
    check(p.ingestion_status === 'human_layer_pending', 'le statut par defaut est human_layer_pending');
    check(vocab.INGESTION_STATUS_VALUES.includes(p.ingestion_status as any),
      'et ce defaut appartient au vocabulaire declare, il n est pas une chaine libre');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: { ...LIGNE, ingestion_status: 'complete' }, error: null });
    await store.createReferenceDossier({
      analysisId: 'ana-QN8802', sourcePdfFilename: 'memo-XJ4417.pdf',
      companyName: 'Societe temoin XJ4417', deckReceivedAt: '2026-03-11',
      ingestionStatus: 'complete',
    });
    check((double.dernier().payload as any).ingestion_status === 'complete', 'un statut fourni prime sur le defaut');
  }

  // ============================================================
  console.log('\n[Suite 2] les trois recherches ne cherchent pas au meme endroit');
  // ============================================================
  {
    // Chaque valeur cherchee est unique dans le jeu : si les fonctions
    // se confondaient, le filtre porterait la mauvaise colonne et
    // l assertion tomberait. Un jeu ou nom de fichier et societe
    // seraient egaux ne pourrait pas les distinguer.
    const cas: Array<[string, () => Promise<unknown>, string, string]> = [
      ['par nom de fichier', () => store.findReferenceDossierBySourceFilename('memo-XJ4417.pdf'), 'source_pdf_filename', 'memo-XJ4417.pdf'],
      ['par societe', () => store.findReferenceDossierByCompany('Societe temoin XJ4417'), 'company_name', 'Societe temoin XJ4417'],
      ['par analyse', () => store.findReferenceDossierByAnalysisId('ana-QN8802'), 'analysis_id', 'ana-QN8802'],
    ];
    for (const [libelle, appel, colonne, valeur] of cas) {
      double.appels.length = 0;
      repondre = () => ({ data: LIGNE, error: null });
      await appel();
      const a = double.dernier();
      check(a.filtres.length === 1 && a.filtres[0].colonne === colonne && a.filtres[0].valeur === valeur,
        `recherche ${libelle} : filtre unique sur ${colonne}`);
      check(a.forme === 'maybeSingle', `recherche ${libelle} : maybeSingle, l absence n est pas une erreur`);
    }
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: null, error: null });
    const r = await store.findReferenceDossierBySourceFilename('inexistant-ZZ0000.pdf');
    check(r === null, 'aucune ligne : rend null sans jeter');
  }

  // ============================================================
  console.log('\n[Suite 3] l idempotence tente le fichier avant la societe');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = (a) => (a.filtres[0]?.colonne === 'source_pdf_filename' ? { data: LIGNE, error: null } : { data: null, error: null });
    const r = await store.findReferenceDossierForIngestion({
      sourcePdfFilename: 'memo-XJ4417.pdf', companyName: 'Societe temoin XJ4417',
    });
    check(r?.id === 'dos-XJ4417', 'le dossier trouve par fichier est rendu');
    check(double.appels.length === 1, 'et la recherche par societe n est pas lancee : le fichier a suffi');
  }

  {
    double.appels.length = 0;
    repondre = (a) => (a.filtres[0]?.colonne === 'company_name' ? { data: LIGNE, error: null } : { data: null, error: null });
    const r = await store.findReferenceDossierForIngestion({
      sourcePdfFilename: 'inexistant-ZZ0000.pdf', companyName: 'Societe temoin XJ4417',
    });
    check(r?.id === 'dos-XJ4417', 'sans correspondance de fichier, la societe est interrogee');
    check(double.appels.length === 2, 'les deux recherches ont eu lieu, dans cet ordre');
    check(double.appels[0].filtres[0].colonne === 'source_pdf_filename', 'le fichier en premier');
  }

  // ============================================================
  console.log('\n[Suite 4] la lecture rejette un motif hors vocabulaire');
  // ============================================================
  {
    const valide = vocab.DECISION_MOTIFS[0];
    double.appels.length = 0;
    repondre = () => ({ data: { ...LIGNE, decision_motifs: [valide, 'motif-invente-QN8802'] }, error: null });
    const r = await store.findReferenceDossierByAnalysisId('ana-QN8802');
    check(r?.decisionMotifs.includes(valide) === true, 'le motif du vocabulaire est conserve');
    check(r?.decisionMotifs.includes('motif-invente-QN8802' as any) === false,
      'le motif inconnu entre en base par un autre chemin est ecarte a la lecture');
    check(r?.decisionMotifs.length === 1, 'et il ne reste que lui');
  }

  // ============================================================
  console.log('\n[Suite 5] la liste borne et filtre sur le statut demande');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: [LIGNE], error: null });
    await store.listReferenceDossiers();
    const a = double.dernier();
    check(a.filtres.length === 0, 'sans statut : aucun filtre');
    check(a.limite === 500, 'la limite par defaut vaut 500');
    check(a.tris[0]?.colonne === 'deck_received_at' && a.tris[0]?.ascendant === false,
      'le tri est deck_received_at decroissant');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: [LIGNE], error: null });
    await store.listReferenceDossiers({ status: 'complete', limit: 3 });
    const a = double.dernier();
    check(a.filtres.length === 1 && a.filtres[0].colonne === 'ingestion_status' && a.filtres[0].valeur === 'complete',
      'avec statut : filtre unique sur ingestion_status');
    check(a.limite === 3, 'la limite demandee prime');
  }

  // ============================================================
  console.log('\n[Suite 6] le patch n ecrit que ce qui lui est donne');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: LIGNE, error: null });
    await store.updateHumanLayer('ana-QN8802', { partnerVerdict: 'invest' });
    const a = double.dernier();
    check(a.operation === 'update', 'l operation est un update');
    check(a.filtres.length === 1 && a.filtres[0].colonne === 'analysis_id' && a.filtres[0].valeur === 'ana-QN8802',
      'la cible est designee par analysis_id');
    const p = a.payload as Record<string, unknown>;
    check(p.partner_verdict === 'invest', 'le champ fourni est ecrit');
    // Le point qui compte : un champ absent de la requete ne doit pas
    // apparaitre dans le patch, sinon Postgres le mettrait a null et le
    // travail du partner disparaitrait sans que personne le demande.
    check(!('partner_reasoning' in p), 'un champ non fourni est absent du patch, il n est pas nullifie');
    check(!('decision_motifs' in p), 'les motifs non fournis ne sont pas effaces');
    check(!('ingestion_status' in p), 'le statut non fourni non plus');
    check(typeof p.updated_at === 'string', 'updated_at est pose a chaque patch');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: LIGNE, error: null });
    // null est une valeur, pas une absence : il doit s ecrire.
    await store.updateHumanLayer('ana-QN8802', { postInvestmentDeviations: null });
    const p = double.dernier().payload as Record<string, unknown>;
    check('post_investment_deviations' in p && p.post_investment_deviations === null,
      'un null explicite est ecrit, la distinction avec l absence est tenue');
  }

  // ============================================================
  console.log('\n[Suite 7] suppression et pannes');
  // ============================================================
  {
    double.appels.length = 0;
    repondre = () => ({ data: null, error: null });
    const ok = await store.deleteReferenceDossier('ana-QN8802');
    const a = double.dernier();
    check(a.operation === 'delete', 'l operation est un delete');
    check(a.filtres.length === 1 && a.filtres[0].colonne === 'analysis_id',
      'et elle est bornee a un dossier, pas a la table entiere');
    check(ok === true, 'la suppression rend true');
  }

  {
    double.appels.length = 0;
    repondre = () => ({ data: null, error: { message: 'panne ZR1190' } });
    check(await store.deleteReferenceDossier('ana-QN8802') === false, 'delete en erreur : rend false');
    check(await store.createReferenceDossier({
      analysisId: 'a', sourcePdfFilename: 'b', companyName: 'c', deckReceivedAt: '2026-01-01',
    }) === null, 'insert en erreur : rend null');
    check(await store.updateHumanLayer('ana-QN8802', { partnerVerdict: 'pass' }) === null, 'update en erreur : rend null');
    check((await store.listReferenceDossiers()).length === 0, 'liste en erreur : vide');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
