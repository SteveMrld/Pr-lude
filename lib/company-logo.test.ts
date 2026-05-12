// ============================================================
// Tests CompanyLogo helpers
// ------------------------------------------------------------
// Couvre la derivation de domaine et la generation d initiales.
// Cas couverts :
//   - noms simples une et deux mots
//   - accents, casse, ponctuation
//   - suffixes legaux (SAS, GmbH, Inc, Ltd, etc.)
//   - chaines vides, null, undefined
//   - noms exclusivement non alphanumeriques
//   - noms tres longs (initiales tronquees a 3)
//
// Lancement : npx tsx lib/company-logo.test.ts
// ============================================================

import { deriveDomainFromName, getInitials, clearbitLogoUrl } from './company-logo';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

console.log('\n=== deriveDomainFromName ===');

check('nom simple un mot', deriveDomainFromName('Klarna'), 'klarna.com');
check('nom simple casse mixte', deriveDomainFromName('Stripe'), 'stripe.com');
check('deux mots concatenes', deriveDomainFromName('Mistral AI'), 'mistralai.com');
check('trois mots concatenes', deriveDomainFromName('Acme Sons Industry'), 'acmesonsindustry.com');
check('accent retire', deriveDomainFromName('L Étoffe'), 'letoffe.com');
check('cedille retiree', deriveDomainFromName('Façade'), 'facade.com');
check('ponctuation retiree', deriveDomainFromName('Acme & Sons'), 'acmesons.com');
check('suffixe SAS', deriveDomainFromName('Le Robot SAS'), 'lerobot.com');
check('suffixe Inc point', deriveDomainFromName('Acme Inc.'), 'acme.com');
check('suffixe GmbH', deriveDomainFromName('Northvolt GmbH'), 'northvolt.com');
check('suffixe Ltd', deriveDomainFromName('Britishvolt Ltd'), 'britishvolt.com');
check('suffixe SARL', deriveDomainFromName('Atelier SARL'), 'atelier.com');
check('suffixe Holdings', deriveDomainFromName('SoftBank Holdings'), 'softbank.com');
check('null', deriveDomainFromName(null), null);
check('undefined', deriveDomainFromName(undefined), null);
check('chaine vide', deriveDomainFromName(''), null);
check('whitespace pur', deriveDomainFromName('   '), null);
check('uniquement ponctuation', deriveDomainFromName('!!! ???'), null);
check('chiffres autorises', deriveDomainFromName('Box 42'), 'box42.com');
// Cas degenere : si on retire le suffixe et qu il ne reste rien,
// on retombe sur le nom brut au lieu de retourner null.
check('nom uniquement suffixe legal', deriveDomainFromName('SAS'), 'sas.com');

console.log('\n=== getInitials ===');

check('un mot court', getInitials('Klarna'), 'KL');
check('un mot deux lettres', getInitials('IA'), 'IA');
check('deux mots', getInitials('Mistral AI'), 'MA');
check('trois mots', getInitials('Acme Sons Industry'), 'ASI');
check('quatre mots tronque', getInitials('Acme Sons Industry Group'), 'ASI');
check('suffixe SAS ignore', getInitials('Le Robot SAS'), 'LR');
check('suffixe GmbH ignore', getInitials('Northvolt GmbH'), 'NO');
check('suffixe Inc point ignore', getInitials('Acme Sons Inc.'), 'AS');
check('accent preserve majuscule', getInitials('Étoffe'), 'ÉT');
check('accent preserve deux mots', getInitials('Étoile Filante'), 'ÉF');
check('separateur tiret', getInitials('Cap-Industries'), 'CI');
check('separateur middle dot', getInitials('Alpha · Beta'), 'AB');
check('chaine vide', getInitials(''), '?');
check('null', getInitials(null), '?');
check('undefined', getInitials(undefined), '?');
check('whitespace pur', getInitials('   '), '?');
check('uniquement ponctuation', getInitials('!!!'), '?');
check('avec chiffres', getInitials('Box 42'), 'B4');

console.log('\n=== clearbitLogoUrl ===');

check('domaine standard', clearbitLogoUrl('klarna.com'), 'https://logo.clearbit.com/klarna.com');
check('domaine sous-extension', clearbitLogoUrl('mistral.ai'), 'https://logo.clearbit.com/mistral.ai');

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) {
  process.exit(1);
}
