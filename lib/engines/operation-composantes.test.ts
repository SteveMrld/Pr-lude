// ============================================================
// Tests deterministes de la representation composite
// ------------------------------------------------------------
// Ce que ces tests prouvent : une operation peut porter plusieurs
// composantes, chacune est retenue ou refusee pour elle-meme, et la
// regle de domaine passe de « ce type neutralise cette methode » a
// « cette methode s applique a cette composante ».
//
// Le defaut ferme, etabli hors ligne le 3 aout 2026 : deux passes de
// l extraction sur le meme memorandum ont rendu `levee` sur l une et
// `lbo` sur l autre, les deux avec une citation reelle. Le document
// organise a la fois la sortie de deux fonds et un cash-in de
// croissance ; le modele choisissait entre deux verites parce qu on ne
// lui laissait pas dire les deux.
// ============================================================

import { appliquerGardesExtraction } from './extraction-engine';
import { deriverTypeDepuisComposantes, composantesDepuisTypeHerite } from './operation-components';
import { computeValuation } from './valuation-engine';
import { evaluerValiditeOperation, detecterEvenementsDansLaProse } from './operation-validity';
import { composantesDe, estMixte, estCession, libelleMontant, libelleNature, libelleContrepartie } from '../note/operation-vocabulary';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Les deux citations reelles, l une et l autre du meme document.
const MIXTE = {
  operationComponents: [
    { kind: 'cession', evidence: 'Provide liquidity to Iris Capital and Next47', perimetre: 'totalite des parts' },
    { kind: 'cash-in', evidence: 'Inject 10-15m in cash-in to support the next growth phase', perimetre: '10-15 M EUR' },
    { kind: 'dette', evidence: 'Structure the transaction with a limited debt component', perimetre: null },
  ],
} as any;

console.log('\n[Suite 1] la garde s applique composante par composante');
{
  const r: any = appliquerGardesExtraction({
    companyName: 'B', sector: '', fundraise: {
      operationComponents: [
        { kind: 'cession', evidence: 'citation reelle' },
        { kind: 'cash-in', evidence: '   ' },
        { kind: 'dette', evidence: 'autre citation' },
        { kind: 'cession', evidence: 'doublon' },
        { kind: 'inconnu', evidence: 'x' },
      ],
    },
  } as any);
  const kinds = r.fundraise.operationComponents.map((c: any) => c.kind);
  check(kinds.join(',') === 'cession,dette', `seules les composantes citees et connues survivent (${kinds.join(',')})`);
  check(r.fundraise.operationComponents.every((c: any) => c.evidence.length > 0), 'chacune porte sa citation');
}
{
  const vide: any = appliquerGardesExtraction({ companyName: 'B', sector: '', fundraise: { operationComponents: [], seller: 'X', stakeForSale: '100%' } } as any);
  check(vide.fundraise.operationType === 'non-etabli', 'aucune composante : type non etabli');
  check(vide.fundraise.seller === '' && vide.fundraise.stakeForSale === '',
    'et les cases propres aux cessions sont videes');
}

console.log('\n[Suite 2] le type derive ne remplace pas les composantes');
{
  check(deriverTypeDepuisComposantes(MIXTE.operationComponents).type === 'lbo',
    'une operation mixte se derive en lbo pour les consommateurs non migres');
  check(deriverTypeDepuisComposantes([{ kind: 'cash-in', evidence: 'a' }]).type === 'levee', 'cash-in seul : levee');
  check(deriverTypeDepuisComposantes([{ kind: 'cession', evidence: 'a', perimetre: '100%' }]).type === 'cession-totale',
    'cession a 100% : cession totale');
  check(deriverTypeDepuisComposantes([]).type === 'non-etabli', 'aucune composante : non etabli');
  // L adaptateur des analyses anterieures ne fabrique rien de neuf.
  check(composantesDepuisTypeHerite('lbo', 'cit').map((c) => c.kind).join(',') === 'cession,dette',
    'un lbo herite se relit en cession plus dette');
  check(composantesDepuisTypeHerite('levee', null).length === 0,
    'un type herite sans citation ne produit aucune composante');
}

console.log('\n[Suite 3] la note dit operation mixte');
{
  check(estMixte(MIXTE), 'l operation est reconnue mixte');
  check(estCession(MIXTE), 'elle comporte bien une cession');
  check(libelleNature(MIXTE) === 'Operation mixte avec effet de levier', `nature : ${libelleNature(MIXTE)}`);
  check(libelleMontant(MIXTE).includes('Cash-in') && libelleMontant(MIXTE).includes('titres'),
    `le libelle du montant nomme les deux natures : ${libelleMontant(MIXTE)}`);
  check(libelleContrepartie(MIXTE) === 'Conseil vendeur et investisseur entrant',
    'la contrepartie nomme les deux cotes');
  // Les analyses anterieures restent lisibles.
  const herite = { operationType: 'cession-totale', operationTypeEvidence: 'cession de 100% du capital' };
  check(composantesDe(herite).length === 1 && libelleNature(herite) === 'Cession',
    'une analyse anterieure se relit sans composantes persistees');
}

console.log('\n[Suite 4] cette methode s applique a cette composante');
{
  // La taille du dossier est ici volontairement coherente avec la sortie
  // mediane de saas-b2b. Le jeu d essai portait 13,5 M EUR de chiffre
  // d affaires, ce qui place la valeur d entreprise trente fois au-dessus
  // de cette sortie et fait tomber la garde de taille, laquelle ne
  // repond pas a la question que cette suite pose. Ce qu on verrouille
  // ici est la composante et non la taille : le chiffre descend donc
  // sous la mediane pour que la seule variable restante soit la presence
  // ou l absence d un cash-in.
  const base: any = {
    extraction: { sector: 'SaaS', fundraise: { stage: 'series-a', amount: '10 M€' }, traction: { revenue: '1,2 m€ (CA 2021 realise)' } },
    financialData: { lastActualYear: 2021, lastActualYearEvidence: '2021a', revenueProjection: [{ year: 2021, value: 1.2 }] },
    relevanceMatrix: { assetClass: 'saas-b2b', assetClassArbitration: null },
    asOf: '2026-08-03', teamScore: 70, marketScore: 61,
  };
  const mixte = computeValuation({ ...base, operationComponents: MIXTE.operationComponents });
  const vcMixte = mixte.methods.find((m) => m.method === 'vc-method');
  check(vcMixte?.applicable === true, 'sur une operation mixte, la VC inverse s applique a la composante cash-in');
  check(vcMixte?.notApplicableGuard === null, 'et aucune garde ne l a retiree');
  check(!!mixte.dilutionAnalysis, 'et la dilution redevient calculable');

  const cession = computeValuation({ ...base, operationComponents: [{ kind: 'cession', evidence: 'a' }] });
  const vcCession = cession.methods.find((m) => m.method === 'vc-method');
  check(vcCession?.applicable === false && vcCession?.notApplicableCause === 'doctrine',
    'sans composante cash-in, la VC inverse reste hors domaine');
  check(vcCession?.notApplicableGuard === 'domaine-operation',
    'et c est la garde de type d operation qui l a retiree, nommement');
  check(!cession.dilutionAnalysis && cession.dilutionNotComputableCause === 'doctrine',
    'et la dilution aussi');

  // L autre cas, celui que la suite ne posait pas : la composante
  // cash-in est bien la, et c est la taille du dossier qui met la
  // methode hors domaine. Les deux gardes repondent a deux questions,
  // une methode peut etre dans son domaine par le type et hors domaine
  // par la taille, et la sortie doit permettre de le lire.
  const gros: any = {
    ...base,
    extraction: { ...base.extraction, traction: { revenue: '13,5 m€ (CA 2021 realise)' } },
    financialData: { ...base.financialData, revenueProjection: [{ year: 2021, value: 13.5 }] },
  };
  const trop = computeValuation({ ...gros, operationComponents: MIXTE.operationComponents });
  const vcTrop = trop.methods.find((m) => m.method === 'vc-method');
  check(vcTrop?.applicable === false, 'meme avec un cash-in, la taille peut mettre la methode hors domaine');
  check(vcTrop?.notApplicableGuard === 'domaine-taille',
    'et la garde nommee est celle de la taille, pas celle du type');
  check(vcTrop?.notApplicableGuard !== vcCession?.notApplicableGuard,
    'les deux gardes se distinguent dans la sortie et pas seulement dans la prose');
  check(vcTrop?.notApplicableCause === vcCession?.notApplicableCause,
    'alors qu elles partagent la meme cause de non-production, ce qui est la raison d etre du champ');
  check(/taille du dossier/.test(String(vcTrop?.notApplicableReason)),
    'le motif de la garde de taille ne parle pas de composante');
  check(/composante de cash-in/.test(String(vcCession?.notApplicableReason)),
    'et celui de la garde de type ne parle pas de taille');
}

console.log('\n[Suite 5] la reserve porte sur la composante mise en cause');
{
  const ev = detecterEvenementsDansLaProse(['La levee de 83m€ finalement conclue en novembre 2023 [web : ladn.eu]']);
  const mixte = evaluerValiditeOperation({
    operationType: 'lbo', operationComponents: MIXTE.operationComponents,
    documentDate: null, millesimeReference: 2021, evenements: ev,
  });
  check(mixte.mention!.includes('le cash-in demande'), 'la mention nomme la composante contestee');
  check(mixte.mention!.includes('non sur l operation entiere'), 'et dit qu elle ne porte pas sur le reste');
  check(mixte.interditLaDiscussionDePrix === false,
    'une levee posterieure ne suspend pas le prix des titres cedes');
  check(mixte.mention!.includes('peut rester d actualite'), 'la cession est explicitement laissee ouverte');

  const cessionSeule = evaluerValiditeOperation({
    operationType: 'cession-totale', operationComponents: [{ kind: 'cession', evidence: 'a' }],
    documentDate: null, millesimeReference: 2021, evenements: ev,
  });
  check(cessionSeule.interditLaDiscussionDePrix === true,
    'sans composante cash-in, la meme levee suspend bien le prix');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
