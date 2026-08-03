// ============================================================
// Tests deterministes de la derivation de la fourchette
// ------------------------------------------------------------
// Ce que ces tests prouvent : un lecteur peut refaire le calcul. Les
// deux regles qui separaient les bornes brutes des bornes affichees
// s ecrivent desormais, avec leurs facteurs et leurs deux resultats.
//
// Le defaut ferme, releve sur la note Braincube du 3 aout 2026 : la
// methode rendait 13 488 000 a 67 440 000 et la note affichait
// 20 421 001 a 66 832 366, avec une seule contribution au poids 1. Une
// enveloppe bornait les extremes a central x [0,55 ; 1,80] sans que
// rien ne le dise, et le plancher etait releve de 51 pour cent. Le
// central affiche n etait pas davantage le milieu de la plage mais un
// ajuste par un signal de qualite.
//
// Deux regles invisibles sur le chiffre le plus visible du produit.
// ============================================================

import { computeValuation } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Le dossier reel, reduit a ce que le moteur de valorisation consomme.
function entree(sur: Record<string, any> = {}): any {
  return {
    extraction: {
      companyName: 'Societe', sector: 'Industrie', subSector: 'equipement',
      fundraise: { stage: 'series-a', amount: '' },
      traction: { revenue: '13,488 m€ (CA 2021 realise)' },
      financials: { lastActualYear: 2021, lastActualYearEvidence: 'CA 2021 realise' },
    },
    financialData: {
      lastActualYear: 2021,
      lastActualYearEvidence: 'CA 2021 realise',
      // Les projections sont exprimees en millions d euros.
      revenueProjection: [{ year: 2021, value: 13.488 }],
    },
    relevanceMatrix: { assetClass: 'industrial-hardware', assetClassArbitration: null },
    asOf: '2026-08-03',
    teamScore: 70, marketScore: 61,
    ...sur,
  };
}

console.log('\n[Suite 1] la fourchette affichee porte sa derivation');
{
  const v = computeValuation(entree());
  const r = v.ranges[0];
  check(!!r, 'une fourchette est produite');
  const d = r?.derivation;
  check(!!d, 'elle porte sa derivation');
  check(d?.brut.min !== undefined && d?.brut.max !== undefined, 'les bornes brutes sont conservees');
  check(typeof d?.explication === 'string' && d!.explication.length > 60,
    'l explication est redigee pour un lecteur');
}

console.log('\n[Suite 2] les bornes brutes sont refaisables a la main');
{
  const v = computeValuation(entree());
  const m = v.methods.find((x) => x.method === 'sector-multiples');
  const d = v.ranges[0]?.derivation;
  const base = (m as any)?.inputs?.baseMetric;
  const plage = String((m as any)?.inputs?.multipleRange || '');
  const bas = Number(plage.split('x')[0]);
  check(!!base && !!bas, `base ${base} et multiple bas ${bas} lisibles dans la methode`);
  check(Math.round(base * bas) === d?.brut.min,
    `base x multiple bas donne la borne brute (${Math.round(base * bas)} contre ${d?.brut.min})`);
}

console.log('\n[Suite 3] l enveloppe se declare quand elle deplace une borne');
{
  const v = computeValuation(entree());
  const r = v.ranges[0];
  const d = r!.derivation!;
  if (d.enveloppeAppliquee) {
    check(r!.min !== d.brut.min || r!.max !== d.brut.max,
      'une borne a bien bouge quand la derivation le declare');
    check(d.explication.includes('enveloppe'), 'l explication nomme l enveloppe');
    check(Math.round(r!.central * d.enveloppe.planchier) === r!.min
      || Math.round(r!.central * d.enveloppe.minimum) === r!.min,
      `le plancher affiche se recalcule depuis le central et un facteur declare (${r!.min})`);
    check(v.synthesis.includes('Bornes brutes'),
      'la synthese porte la derivation, pas seulement un champ technique');
  } else {
    check(r!.min === d.brut.min && r!.max === d.brut.max,
      'aucune enveloppe declaree, donc bornes identiques aux brutes');
  }
}

console.log('\n[Suite 4] le central declare qu il n est pas le milieu');
{
  const v = computeValuation(entree());
  const m = v.methods.find((x) => x.method === 'sector-multiples');
  const base = (m as any)?.inputs?.baseMetric;
  const q = (m as any)?.inputs?.qualitySignal;
  const dit = String(m?.rationale || '');
  if (q !== 0.5) {
    check(dit.includes('n est pas le milieu de la plage'), 'le rationale dit que le central n est pas le milieu');
    check(dit.includes(String(q)), `il donne le signal de qualite employe (${q})`);
    check(dit.includes('60 pour cent'), 'et la fraction de deplacement');
  } else {
    check(!dit.includes('n est pas le milieu'), 'signal neutre : rien a declarer');
  }
  check(!!base, 'la base reste lisible');
}

console.log('\n[Suite 5] symetrie, un signal neutre ne deplace rien');
{
  const v = computeValuation(entree({ teamScore: 50, marketScore: 50 }));
  const m = v.methods.find((x) => x.method === 'sector-multiples');
  check((m as any)?.inputs?.qualitySignal === 0.5, 'signal de qualite neutre');
  check(!String(m?.rationale || '').includes('n est pas le milieu'),
    'et le rationale ne declare aucun deplacement');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
