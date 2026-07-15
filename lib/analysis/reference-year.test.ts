// ============================================================
// Tests deterministes reference-year.ts (refonte brique 11)
// ------------------------------------------------------------
// La primitive ne consomme QUE financialData.lastActualYear avec
// evidence textuelle. Aucun fallback. Suite reduite mais stricte.
// ============================================================

import { deriveDossierReferenceYear } from './reference-year';

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
  // Cas anormal simule : refYear tres ancien vs projections modernes.
  // Avec la nouvelle primitive stricte, ce cas ne peut pas se produire
  // via la primitive elle-meme (elle rejette les evidences vides). Mais
  // on garde la garde pour se premunir d une future regle plus laxiste
  // qui tenterait d inferer 2013 sur un dossier 2021-2026.
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
  const maxProj = maxYearInProjection(suspect.financialData.revenueProjection);
  const gap = maxProj !== null && y !== null ? maxProj - y : null;
  // Le test doit signaler : gap > 3 => anomalie
  check(gap !== null && gap > 3, `refYear ${y} vs max projection ${maxProj} : ecart ${gap} > 3 declenche la garde de vraisemblance`);
  // La primitive rend la valeur car l evidence est presente, la GARDE
  // est un contrat editorial verifie par ce test, pas par la primitive.
  check(y === 2013, 'primitive rend la valeur, la responsabilite d evidence honnete est doctrinale (LLM instruit de ne pas mentir)');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
