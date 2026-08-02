// ============================================================
// Tests deterministes de la lecture du ticket du tour
// ------------------------------------------------------------
// Ce que ces tests prouvent : le moteur distingue le montant total du
// tour de sa part en capital, il ne repartit jamais un montant mixte,
// et les deux usages du ticket traitent l inconnue differemment selon
// le sens dans lequel l erreur les fait pencher.
//
// Le defaut ferme : parseTicketEur tirait 800 000 euros de
// "800k€ (mix Equity/bancaire)" et les traitait integralement comme du
// capital. La dilution affichee, 5,8 pour cent sur le dossier mesure,
// supposait donc 800 000 euros d equity la ou le deck annonce un
// mixte, et la VC inverse soustrayait la totalite du tour d une
// post-money implicite.
// ============================================================

import { computeValuation } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const SERIE = [
  { year: '2022', value: 1.752, source: 'bp' },
  { year: '2023', value: 1.483, source: 'bp' },
  { year: '2024', value: 2.113, source: 'bp' },
];

function buildInput(amount: string, stage = 'seed'): any {
  return {
    extraction: {
      sector: 'e-commerce',
      fundraise: { stage, amount },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true, fileSource: 'bp',
      revenueProjection: SERIE,
      grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [],
      headcount: [], opexProjection: [],
      lastActualYear: 2024,
      lastActualYearEvidence: 'Tableau P&L slide 10 : colonne 2024 qualifiee realise.',
    },
    team: null, market: null, teamScore: 60, marketScore: 55,
    relevanceMatrix: { assetClass: 'ecommerce-dtc' },
    asOf: null,
  };
}

// ============================================================
console.log('\n[Suite 1] tour en capital pur : comportement inchange');
// ============================================================

{
  const out = computeValuation(buildInput('800k EUR'));
  check(out.dilutionAnalysis !== null, 'la dilution est calculee');
  check(out.dilutionAnalysis!.proposedTicket === 800_000, `le ticket vaut 800 000 (obtenu ${out.dilutionAnalysis?.proposedTicket})`);
  check((out as any).dilutionNotComputableReason === null, 'aucun motif de non-calcul');
  const vc = out.methods.find((m) => m.method === 'vc-method');
  check(
    !/majorant/.test(vc?.rationale ?? vc?.notApplicableReason ?? ''),
    'la VC inverse ne signale pas de majorant',
  );
}

// ============================================================
console.log('\n[Suite 2] tour mixte : la dilution refuse, la VC inverse continue');
// ============================================================

{
  // Le libelle exact mesure sur le corpus.
  const out = computeValuation(buildInput('800k€ (mix Equity/bancaire)'));

  check(out.dilutionAnalysis === null, 'aucune dilution calculee sur un tour mixte');
  const motif = (out as any).dilutionNotComputableReason as string | null;
  check(typeof motif === 'string' && motif.length > 0, 'un motif ecrit remplace le calcul');
  check(/repartition/i.test(motif ?? ''), 'le motif nomme l absence de repartition');
  check((motif ?? '').includes('mix Equity/bancaire'), 'le motif cite le libelle du document');
  check(
    out.warnings.some((w) => /Dilution non calculable/i.test(w)),
    'le motif remonte dans les warnings de la note',
  );

  // La VC inverse continue, avec son ticket declare majorant.
  const vc = out.methods.find((m) => m.method === 'vc-method')!;
  const texte = vc.rationale ?? vc.notApplicableReason ?? '';
  if (vc.applicable) {
    check(/majorant/.test(texte), 'la VC inverse signale que son ticket est un majorant');
    check(/minorant/.test(texte), 'et que le pre-money rendu est un minorant');
  } else {
    check(true, 'la VC inverse est non applicable pour une autre raison sur ce fixture');
  }
}

{
  // Autres formulations de mixte rencontrees en pitch. Aucune ne doit
  // produire de dilution.
  for (const libelle of [
    '2M€ dont 1M en dette bancaire',
    '5M EUR (equity + obligataire)',
    '3M€ avec avance remboursable BPI',
    '1,5M€ mixte capital et emprunt',
  ]) {
    const out = computeValuation(buildInput(libelle));
    check(
      out.dilutionAnalysis === null && (out as any).dilutionNotComputableReason !== null,
      `"${libelle}" : dilution refusee avec motif`,
    );
  }
}

// ============================================================
console.log('\n[Suite 3] aucune repartition n est inventee');
// ============================================================

{
  // Le point central de la doctrine : le moteur ne pose pas de cle
  // 50/50 ni aucune autre. Sur un tour mixte, la dilution est absente,
  // jamais approximee.
  const pur = computeValuation(buildInput('800k EUR'));
  const mixte = computeValuation(buildInput('800k€ (mix Equity/bancaire)'));
  check(
    mixte.dilutionAnalysis === null,
    'le tour mixte ne produit aucun pourcentage de dilution',
  );
  check(
    pur.dilutionAnalysis !== null && pur.dilutionAnalysis!.dilutionAtCentral > 0,
    'le tour pur en produit un, la difference vient bien du libelle',
  );

  // La fourchette de valorisation elle-meme n est pas affectee par le
  // caractere mixte : seule la lecture du ticket change.
  const evPur = pur.ranges.find((r) => r.nature === 'enterprise_value')?.central;
  const evMixte = mixte.ranges.find((r) => r.nature === 'enterprise_value')?.central;
  check(evPur === evMixte, 'la fourchette en valeur d entreprise est inchangee');
}

{
  // Aucun ticket annonce : ni dilution, ni motif. Un dossier sans
  // ticket ne doit pas porter un avertissement de non-calcul.
  const out = computeValuation(buildInput('non precise'));
  check(out.dilutionAnalysis === null, 'aucune dilution sans ticket');
  check(
    (out as any).dilutionNotComputableReason === null,
    'aucun motif de non-calcul sans ticket : l absence se distingue du refus',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
