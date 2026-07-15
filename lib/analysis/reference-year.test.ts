// ============================================================
// Tests deterministes reference-year.ts
// ------------------------------------------------------------
// Suite 1 : la regle en une phrase, chaque source de derivation.
// Suite 2 : cas d echec, silence.
// Suite 3 : aucune lecture d horloge (invariance a Date.now).
// Suite 4 : compatibilite avec la derivation historique de
//           label-calculation-contradictions.ts.
// ============================================================

import { deriveDossierReferenceYear } from './reference-year';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Chaque source de derivation
// ============================================================

console.log('\n[Suite 1] Chaque source de derivation dans l ordre attendu');

{
  // Override prioritaire
  const y = deriveDossierReferenceYear({}, { refYearOverride: 2019 });
  check(y === 2019, 'refYearOverride en tete de precedence');
}

{
  // as_of prioritaire sur les autres si present
  const y = deriveDossierReferenceYear(
    { financialData: { rawNotes: '2024A 2025A' } },
    { asOf: '2022-06-15' },
  );
  check(y === 2022, 'as_of prioritaire sur rawNotes A/B (2022)');
}

{
  // rawNotes qualifier A / B, max retenu
  const y = deriveDossierReferenceYear(
    { financialData: { rawNotes: 'EBITDA 2021A 2022A 2023A 2024A 2025E 2026E' } },
    {},
  );
  check(y === 2024, 'max des qualifiers A dans rawNotes = 2024');
}

{
  // rawSummary A/B compte comme source
  const y = deriveDossierReferenceYear(
    { extraction: { rawSummary: 'CA 2023A soit 1M€' } },
    {},
  );
  check(y === 2023, 'rawSummary qualifier A = 2023');
}

{
  // Combinaison A et B, max des deux qualifiers
  const y = deriveDossierReferenceYear(
    { financialData: { rawNotes: 'chiffre 2023A puis budget 2024B' } },
    {},
  );
  check(y === 2024, 'max A ou B = 2024B');
}

{
  // Qualifier E / F ignorés (projections)
  const y = deriveDossierReferenceYear(
    { financialData: { rawNotes: '2024A puis 2026E projete' } },
    {},
  );
  check(y === 2024, 'qualifier E ignore, 2024A retenu');
}

{
  // Filename YYYY.MM.DD
  const y = deriveDossierReferenceYear(
    {},
    { sourceFilename: 'Deck - 2023.11.25 - vF.pdf' },
  );
  check(y === 2023, 'source_filename YYYY.MM.DD = 2023');
}

{
  // Filename YYYY brut
  const y = deriveDossierReferenceYear(
    {},
    { sourceFilename: 'Memorandum-Project-2022-vF.pdf' },
  );
  check(y === 2022, 'source_filename premier YYYY = 2022');
}

// ============================================================
// SUITE 2 - Echec silencieux
// ============================================================

console.log('\n[Suite 2] Echec silencieux : jamais deviner');

{
  const y = deriveDossierReferenceYear({}, {});
  check(y === null, 'aucun signal : null');
}

{
  // Prose sans qualifier, filename sans annee
  const y = deriveDossierReferenceYear(
    { extraction: { rawSummary: 'texte sans annee qualifiee' } },
    { sourceFilename: 'prelude-mistral-ai.pdf' },
  );
  check(y === null, 'prose sans qualifier + filename sans YYYY : null');
}

{
  // Cas JNAN Hotels reproduit : filename avec 260504 (non YYYY 20xx)
  const y = deriveDossierReferenceYear(
    { extraction: { yearFounded: 2001, rawSummary: 'hotellerie boutique' } },
    { sourceFilename: 'JNANHotelsPMV2_260504_212718_compressed.pdf' },
  );
  check(y === null, 'JNAN Hotels : aucune source valide, null');
}

{
  // yearFounded n est PAS une source de reference (age de la boite,
  // pas reference d instruction)
  const y = deriveDossierReferenceYear(
    { extraction: { yearFounded: 2011 } },
    {},
  );
  check(y === null, 'yearFounded ignore comme source doctrinale');
}

{
  check(deriveDossierReferenceYear(null, {}) === null, 'dossier null : null');
  check(deriveDossierReferenceYear(undefined, {}) === null, 'dossier undefined : null');
}

// ============================================================
// SUITE 3 - Aucune lecture d horloge (invariance temporelle)
// ============================================================

console.log('\n[Suite 3] Invariance a l horloge systeme');

{
  const dossier = { financialData: { rawNotes: '2024A' } };
  // Sauvegarde et monkey-patch de Date pour prouver que la primitive
  // ne lit jamais l horloge. Deux runs a deux Date.now differents
  // doivent produire strictement la meme valeur.
  const originalNow = Date.now;
  try {
    Date.now = () => new Date('2020-01-01T00:00:00Z').getTime();
    const y1 = deriveDossierReferenceYear(dossier, {});
    Date.now = () => new Date('2030-12-31T23:59:59Z').getTime();
    const y2 = deriveDossierReferenceYear(dossier, {});
    check(y1 === y2 && y1 === 2024, `deux horloges systeme differentes = meme sortie (2024/2024)`);
  } finally {
    Date.now = originalNow;
  }
}

// ============================================================
// SUITE 4 - Compatibilite avec label-calc historique
// ============================================================

console.log('\n[Suite 4] Compatibilite retour label-calc');

{
  // Fixture TOLSON reproduit fidelement le comportement historique
  const tolson = {
    financialData: {
      rawNotes: "L'EBITDA 2024A (305k€/19,0%) dans le BP differe du chiffre 2024B du deck (293k€/18,3%). Marge 2021A 14,8% jusque 2026E 33,3%.",
    },
    extraction: {
      rawSummary: 'TOLSON fondee en 2011. CA 2024 estime a 1,6 M€. EBITDA 293 k€ (18,3%) en 2024B projete a 915 k€ en 2026.',
    },
  };
  const y = deriveDossierReferenceYear(tolson, {
    asOf: null,
    sourceFilename: 'TOLSON (codename Project Tagora) - Information Memorandum - 2024.11.25 - vF.pdf',
  });
  check(y === 2024, 'TOLSON reproduit fidelement : refYear = 2024');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
