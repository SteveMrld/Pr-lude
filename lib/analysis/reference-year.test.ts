// ============================================================
// Tests deterministes reference-year.ts (refonte brique 11)
// ------------------------------------------------------------
// La primitive ne consomme QUE financialData.lastActualYear avec
// evidence textuelle. Aucun fallback. Suite reduite mais stricte.
// ============================================================

import {
  deriveDossierReferenceYear,
  deriveDossierReferenceYearWithReason,
} from './reference-year';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Regle unique : lastActualYear + evidence
// ============================================================

console.log('\n[Suite 1] Regle unique lastActualYear + evidence');

{
  const dossier = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'P&L 2024A audite par Mazars, cloture au 31/12/2024',
    },
  };
  check(deriveDossierReferenceYear(dossier) === 2024, 'lastActualYear + evidence => valeur retenue');
}

{
  // evidence absente
  const dossier = { financialData: { lastActualYear: 2024, lastActualYearEvidence: null } };
  check(deriveDossierReferenceYear(dossier) === null, 'lastActualYear sans evidence => null');
}

{
  // evidence chaine vide
  const dossier = { financialData: { lastActualYear: 2024, lastActualYearEvidence: '   ' } };
  check(deriveDossierReferenceYear(dossier) === null, 'lastActualYear avec evidence vide => null');
}

// ============================================================
// SUITE 2 - Echec silencieux, jamais deviner
// ============================================================

console.log('\n[Suite 2] Echec silencieux, jamais deviner');

{
  check(deriveDossierReferenceYear({}) === null, 'dossier vide : null');
  check(deriveDossierReferenceYear({ financialData: {} }) === null, 'financialData sans lastActualYear : null');
  check(deriveDossierReferenceYear({ financialData: { lastActualYear: null } }) === null, 'lastActualYear explicitement null : null');
  check(deriveDossierReferenceYear({ financialData: { lastActualYear: 2024 } }) === null, 'lastActualYear sans evidence (champ absent) : null');
  check(deriveDossierReferenceYear(null) === null, 'null : null');
  check(deriveDossierReferenceYear(undefined) === null, 'undefined : null');
}

{
  // Bornes de sanite : annee hors plage rejetee
  const before = { financialData: { lastActualYear: 1999, lastActualYearEvidence: 'faux' } };
  const after = { financialData: { lastActualYear: 2101, lastActualYearEvidence: 'faux' } };
  check(deriveDossierReferenceYear(before) === null, 'annee 1999 hors plage : null');
  check(deriveDossierReferenceYear(after) === null, 'annee 2101 hors plage : null');
}

// ============================================================
// SUITE 3 - Aucun consumer legacy ne subsiste
// ============================================================

console.log('\n[Suite 3] Aucun fallback legacy');

{
  // Meme avec un as_of dans les vieux formats, la primitive ignore
  const dossier = {
    financialData: { rawNotes: '2024A confirmed by auditors 2024A everywhere' },
    extraction: { rawSummary: 'CA 2024A 1.5M' },
  };
  // Ces signaux etaient consommes en cascade 2 dans l ancienne version
  check(deriveDossierReferenceYear(dossier) === null, 'signaux narratifs sans lastActualYear : null (fallback narrative supprime)');
}

{
  // Ancienne signature avec meta (asOf, sourceFilename) : arguments ignores
  const dossier = { financialData: { lastActualYear: 2024, lastActualYearEvidence: 'note interne' } };
  check(deriveDossierReferenceYear(dossier) === 2024, 'signature reduite : primitive accepte seulement le dossier');
}

// ============================================================
// SUITE 4 - Absence sur les 28 dossiers actuels (comportement acquis)
// ============================================================

console.log('\n[Suite 4] Documentation du comportement corpus');

{
  // Snapshots existants n ont ni lastActualYear ni evidence. Attendu : null.
  const legacySnapshot = {
    financialData: {
      revenueProjection: [{ year: '2024', value: 1.5, source: 'bp' }],
      rawNotes: 'EBITDA 2024A 305k€',
    },
    extraction: { rawSummary: 'TOLSON fondee 2011, CA 2024 1.6M' },
  };
  check(deriveDossierReferenceYear(legacySnapshot) === null, 'snapshot legacy sans lastActualYear : null (acquis, aucun backfill)');
}

// ============================================================
// SUITE 5 - Vraisemblance : garde contre l ecart projections
// ------------------------------------------------------------
// Une annee de reference qui ecarterait de plus de trois ans la
// derniere annee des projections du dossier est un signal
// d anomalie. Ce test aurait attrape le fallback filename qui
// remontait 2013 sur des dossiers dont les projections vont
// jusqu a 2026. La primitive n a plus de fallback filename mais
// la garde reste utile comme regle doctrinale sur les futurs
// dossiers avec lastActualYear extrait par le LLM.
// ============================================================

console.log('\n[Suite 5] Vraisemblance vs projections');

function maxYearInProjection(proj: any[]): number | null {
  if (!Array.isArray(proj)) return null;
  const ys = proj.map(p => parseInt(String(p?.year), 10)).filter(y => Number.isFinite(y));
  return ys.length > 0 ? Math.max(...ys) : null;
}

{
  // Cas conforme : refYear a l interieur de la fenetre projections
  const dossier = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'P&L 2024A audit Deloitte',
      revenueProjection: [
        { year: '2022', value: 1 },
        { year: '2024', value: 1.6 },
        { year: '2026', value: 2.5 },
      ],
    },
  };
  const y = deriveDossierReferenceYear(dossier);
  const maxProj = maxYearInProjection(dossier.financialData.revenueProjection);
  const gap = maxProj !== null && y !== null ? maxProj - y : null;
  check(y === 2024 && gap !== null && gap <= 3, `refYear ${y} < 3 ans de max projection ${maxProj}, ecart ${gap}`);
}

{
  // Cas anormal 2013 vs projections 2021-2026 : la primitive rejette
  // par la garde d appartenance (2013 n est pas dans les projections),
  // sans passer par un seuil numerique d ecart.
  const suspect = {
    financialData: {
      lastActualYear: 2013,
      lastActualYearEvidence: 'faux, 2013 mentionne dans un vieux benchmark',
      revenueProjection: [
        { year: '2021', value: 1 },
        { year: '2024', value: 2 },
        { year: '2026', value: 3 },
      ],
    },
  };
  const y = deriveDossierReferenceYear(suspect);
  check(y === null, 'primitive REJETTE lastActualYear=2013 face a projections 2021-2026 (annee absente des projections)');
  const res = deriveDossierReferenceYearWithReason(suspect);
  check(res.rejectionReason === 'year-not-in-projections', 'motif de rejet = year-not-in-projections');
  check(res.rejectionDetail !== null && res.rejectionDetail.includes('2013'), 'motif detail cite l annee absente 2013');
}

{
  // BP a cinq ans : refYear=2024, projections 2021 a 2029. Ce cas
  // etait rejete par l ancienne garde d ecart (2029 - 2024 = 5 > 3),
  // il doit passer avec la garde d appartenance.
  const bpFiveYears = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'exercice 2024A audit Mazars, cloture 31/12/2024',
      revenueProjection: [
        { year: '2021', value: 1.0 },
        { year: '2022', value: 1.3 },
        { year: '2023', value: 1.6 },
        { year: '2024', value: 2.0 },
        { year: '2025', value: 2.7 },
        { year: '2026', value: 3.5 },
        { year: '2027', value: 4.5 },
        { year: '2028', value: 5.8 },
        { year: '2029', value: 7.2 },
      ],
    },
  };
  const y = deriveDossierReferenceYear(bpFiveYears);
  check(y === 2024, 'BP a 5 ans, refYear 2024 dans projections 2021-2029 : ACCEPTE (echouait avec l ancienne garde d ecart)');
}

{
  // Garde de posteriorite : lastActualYear apres derniere projection
  const overshoot = {
    financialData: {
      lastActualYear: 2027,
      lastActualYearEvidence: 'evidence',
      revenueProjection: [
        { year: '2022', value: 1 },
        { year: '2024', value: 2 },
        { year: '2026', value: 3 },
      ],
    },
  };
  const y = deriveDossierReferenceYear(overshoot);
  check(y === null, 'lastActualYear 2027 posterieur a max projection 2026 : rejete');
  const res = deriveDossierReferenceYearWithReason(overshoot);
  check(res.rejectionReason === 'year-after-last-projection', 'motif = year-after-last-projection');
}

{
  // Garde d appartenance : refYear entre deux projections mais pas
  // present. Rejet malgre l ecart faible.
  const gap = {
    financialData: {
      lastActualYear: 2023,
      lastActualYearEvidence: 'evidence',
      revenueProjection: [
        { year: '2022', value: 1 },
        { year: '2024', value: 2 },
        { year: '2026', value: 3 },
      ],
    },
  };
  const y = deriveDossierReferenceYear(gap);
  check(y === null, 'refYear 2023 absent des projections meme si ecart faible : rejete');
  const res = deriveDossierReferenceYearWithReason(gap);
  check(res.rejectionReason === 'year-not-in-projections', 'motif = year-not-in-projections');
}

// ============================================================
// SUITE 6 - Exposition du motif de rejet
// ============================================================

console.log('\n[Suite 6] Exposition du motif de rejet');

{
  const r = deriveDossierReferenceYearWithReason(null);
  check(r.rejectionReason === 'no-dossier', 'no-dossier');
  check(r.rejectionDetail !== null, '  detail expose');
}

{
  const r = deriveDossierReferenceYearWithReason({});
  check(r.rejectionReason === 'no-financial-data', 'no-financial-data');
}

{
  const r = deriveDossierReferenceYearWithReason({ financialData: {} });
  check(r.rejectionReason === 'last-actual-year-absent', 'last-actual-year-absent');
}

{
  const r = deriveDossierReferenceYearWithReason({ financialData: { lastActualYear: 1999, lastActualYearEvidence: 'x' } });
  check(r.rejectionReason === 'last-actual-year-out-of-bounds', 'last-actual-year-out-of-bounds');
}

{
  const r = deriveDossierReferenceYearWithReason({ financialData: { lastActualYear: 2024 } });
  check(r.rejectionReason === 'evidence-absent', 'evidence-absent');
}

{
  const r = deriveDossierReferenceYearWithReason({ financialData: { lastActualYear: 2024, lastActualYearEvidence: '   ' } });
  check(r.rejectionReason === 'evidence-empty', 'evidence-empty');
}

{
  const r = deriveDossierReferenceYearWithReason({
    financialData: { lastActualYear: 2024, lastActualYearEvidence: 'clos 2024', revenueProjection: [{ year: '2024', value: 1 }] },
  });
  check(r.year === 2024 && r.rejectionReason === null, 'valeur acceptee : year rempli, rejectionReason null');
}

{
  // Sans revenueProjection, la primitive accepte la valeur : elle
  // ne peut pas verifier l appartenance faute de reference. C est
  // le contrat : les gardes sont conditionnees a la presence de
  // projections structurees.
  const r = deriveDossierReferenceYearWithReason({
    financialData: { lastActualYear: 2024, lastActualYearEvidence: 'clos 2024' },
  });
  check(r.year === 2024, 'sans projections, la valeur passe (garde d appartenance conditionnee aux projections)');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
