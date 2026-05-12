// ============================================================
// Tests trajectory-notifications
// ------------------------------------------------------------
// Verifie le formatage des emails immediats (crans 1/2) et du
// digest hebdomadaire (cran 3) : sujet conforme a la doctrine
// editoriale Le Grand Continent, corps qui cite les transitions,
// HTML sobre, presence du lien dashboard discret.
//
// Le dispatch reel via Resend n est pas teste : ce qui compte ici
// est la qualite editoriale du payload, pas la livraison reseau.
//
// Lancement : npx tsx lib/trajectory-notifications.test.ts
// ============================================================

import {
  formatImmediateAlertEmail,
  formatWeeklyDigestEmail,
  type AlertedAnalysis,
} from './trajectory-notifications';
import type { TrajectoryAlert } from './engines/trajectory/alerts';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, cond: boolean): void {
  check(label, cond, true);
}

const ALERT_CRAN1: TrajectoryAlert = {
  cran: 1,
  tag: 'combinaison-drapeau-rouge-apparue',
  raison: 'Combinaison diagnostique drapeau-rouge nouvellement detectee : Trajectoire WeWork.',
  citations: ['combinaison apparue : Trajectoire WeWork (severite drapeau-rouge)'],
  recommandation: 'A instruire immediatement avec le partner referent.',
};

const ALERT_CRAN2: TrajectoryAlert = {
  cran: 2,
  tag: 'score-global-chute-20',
  raison: 'Score global en chute de 25 points sur la periode.',
  citations: ['score global : 75 -> 50 (-25 points)'],
  recommandation: 'Identifier la ou les dimensions qui decrochent.',
};

const ALERT_CRAN3: TrajectoryAlert = {
  cran: 3,
  tag: 'pattern-sain-vers-non-sain',
  raison: 'Le pattern growth-subsidized-model bascule de sain a attention.',
  citations: ['pattern growth-subsidized-model : sain -> attention'],
  recommandation: 'La transition merite d apparaitre dans le digest hebdomadaire.',
};

// ============================================================
// Test 1 : sujet immediat cran 1
// ============================================================
console.log('\n=== Test 1 : sujet immediat cran 1 ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a1',
    companyName: 'Acme Robotics',
    alerts: [ALERT_CRAN1],
    dossierUrl: 'https://prelude.app/dossiers/a1',
  };
  const email = formatImmediateAlertEmail('partner@fonds.com', a);
  check(
    'sujet contient nom dossier et transition',
    email.subject,
    'Trajectoire Acme Robotics : transition de verdict significative',
  );
  check('destinataire conserve', email.to, 'partner@fonds.com');
}

// ============================================================
// Test 2 : sujet immediat cran 2 sans cran 1
// ============================================================
console.log('\n=== Test 2 : sujet immediat cran 2 sans cran 1 ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a2',
    companyName: 'Helsing',
    alerts: [ALERT_CRAN2],
    dossierUrl: 'https://prelude.app/dossiers/a2',
  };
  const email = formatImmediateAlertEmail('partner@fonds.com', a);
  check(
    'sujet signal de degradation',
    email.subject,
    'Trajectoire Helsing : signal de degradation',
  );
}

// ============================================================
// Test 3 : corps texte contient raison et recommandation
// ============================================================
console.log('\n=== Test 3 : corps texte contient raison et recommandation ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a3',
    companyName: 'TestCo',
    alerts: [ALERT_CRAN1, ALERT_CRAN2],
    dossierUrl: 'https://prelude.app/dossiers/a3',
  };
  const email = formatImmediateAlertEmail('p@f.com', a);
  checkTrue(
    'cite la raison cran 1',
    email.bodyText.includes('Combinaison diagnostique drapeau-rouge nouvellement detectee'),
  );
  checkTrue(
    'cite la raison cran 2',
    email.bodyText.includes('Score global en chute de 25 points'),
  );
  checkTrue(
    'cite la recommandation cran 1',
    email.bodyText.includes('A instruire immediatement'),
  );
  checkTrue(
    'cite la citation factuelle',
    email.bodyText.includes('Trajectoire WeWork (severite drapeau-rouge)'),
  );
}

// ============================================================
// Test 4 : lien dashboard present mais discret (pas de bouton CTA)
// ============================================================
console.log('\n=== Test 4 : lien dashboard present, pas de bouton CTA gros ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a4',
    companyName: 'TestCo',
    alerts: [ALERT_CRAN1],
    dossierUrl: 'https://prelude.app/dossiers/a4',
  };
  const email = formatImmediateAlertEmail('p@f.com', a);
  checkTrue('lien dashboard present', email.bodyText.includes('https://prelude.app/dossiers/a4'));
  checkTrue('lien HTML present', email.bodyHtml.includes('https://prelude.app/dossiers/a4'));
  // Pas de bouton CTA gros : on verifie qu il n y a pas de background
  // colore proeminent type bouton (#ff... ou background: #00...)
  checkTrue(
    'pas de bouton avec background fonce',
    !/<a[^>]*background:\s*#[0-9a-f]{3,6}\s*;/i.test(email.bodyHtml),
  );
}

// ============================================================
// Test 5 : voix sobre, pas d alarmisme dans le sujet
// ============================================================
console.log('\n=== Test 5 : voix sobre, pas d alarmisme ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a5',
    companyName: 'TestCo',
    alerts: [ALERT_CRAN1, ALERT_CRAN2],
    dossierUrl: 'u',
  };
  const email = formatImmediateAlertEmail('p@f.com', a);
  // Detection des emojis usuels (sans flag u qui necessite ES6+) :
  // les blocs Misc Symbols et Dingbats couvrent ☎ ✓ ✗ etc, plus la
  // detection des surrogates pairs pour les emojis SMP.
  const hasEmoji = (s: string): boolean => {
    if (/[☀-➿]/.test(s)) return true;
    for (let i = 0; i < s.length - 1; i++) {
      const code = s.charCodeAt(i);
      if (code >= 0xd83c && code <= 0xd83f) return true;
    }
    return false;
  };
  checkTrue('pas d emoji dans le sujet', !hasEmoji(email.subject));
  checkTrue(
    'pas de majuscules de cri',
    !email.subject.includes('URGENT') && !email.subject.includes('ALERTE'),
  );
  checkTrue(
    'pas d em-dash',
    !email.subject.includes('—') && !email.bodyText.includes('—'),
  );
}

// ============================================================
// Test 6 : digest hebdomadaire, sujet date
// ============================================================
console.log('\n=== Test 6 : digest hebdomadaire sujet date ===');
{
  const weekStart = new Date('2026-05-11T00:00:00Z'); // lundi
  const analyses: AlertedAnalysis[] = [
    {
      analysisId: 'a1',
      companyName: 'Acme',
      alerts: [ALERT_CRAN3],
      dossierUrl: 'https://prelude.app/dossiers/a1',
    },
  ];
  const email = formatWeeklyDigestEmail('partner@fonds.com', analyses, weekStart);
  check(
    'sujet contient date semaine',
    email.subject,
    'Digest Trajectoire portefeuille - semaine du 11 mai 2026',
  );
}

// ============================================================
// Test 7 : digest agrege plusieurs dossiers ordres par gravite
// ============================================================
console.log('\n=== Test 7 : digest agrege par gravite ===');
{
  const weekStart = new Date('2026-05-11T00:00:00Z');
  const analyses: AlertedAnalysis[] = [
    {
      analysisId: 'a1',
      companyName: 'Zeta',
      alerts: [ALERT_CRAN3],
      dossierUrl: 'u1',
    },
    {
      analysisId: 'a2',
      companyName: 'Alpha',
      alerts: [ALERT_CRAN3, ALERT_CRAN3, ALERT_CRAN3],
      dossierUrl: 'u2',
    },
    {
      analysisId: 'a3',
      companyName: 'Beta',
      alerts: [ALERT_CRAN3, ALERT_CRAN3],
      dossierUrl: 'u3',
    },
  ];
  const email = formatWeeklyDigestEmail('p@f.com', analyses, weekStart);
  // Alpha (3) avant Beta (2) avant Zeta (1)
  const idxAlpha = email.bodyText.indexOf('Alpha :');
  const idxBeta = email.bodyText.indexOf('Beta :');
  const idxZeta = email.bodyText.indexOf('Zeta :');
  checkTrue('Alpha avant Beta', idxAlpha > 0 && idxAlpha < idxBeta);
  checkTrue('Beta avant Zeta', idxBeta > 0 && idxBeta < idxZeta);
}

// ============================================================
// Test 8 : digest tie-breaker alphabetique
// ============================================================
console.log('\n=== Test 8 : digest tie-breaker alphabetique ===');
{
  const weekStart = new Date('2026-05-11T00:00:00Z');
  const analyses: AlertedAnalysis[] = [
    {
      analysisId: 'a1',
      companyName: 'Zeta',
      alerts: [ALERT_CRAN3],
      dossierUrl: 'u1',
    },
    {
      analysisId: 'a2',
      companyName: 'Alpha',
      alerts: [ALERT_CRAN3],
      dossierUrl: 'u2',
    },
  ];
  const email = formatWeeklyDigestEmail('p@f.com', analyses, weekStart);
  const idxAlpha = email.bodyText.indexOf('Alpha :');
  const idxZeta = email.bodyText.indexOf('Zeta :');
  checkTrue('Alpha avant Zeta (alphabetique a egalite)', idxAlpha > 0 && idxAlpha < idxZeta);
}

// ============================================================
// Test 9 : digest cite les liens dossier
// ============================================================
console.log('\n=== Test 9 : digest cite les liens dossier ===');
{
  const weekStart = new Date('2026-05-11T00:00:00Z');
  const analyses: AlertedAnalysis[] = [
    {
      analysisId: 'a1',
      companyName: 'Acme',
      alerts: [ALERT_CRAN3],
      dossierUrl: 'https://prelude.app/dossiers/a1',
    },
  ];
  const email = formatWeeklyDigestEmail('p@f.com', analyses, weekStart);
  checkTrue('lien dossier dans corps', email.bodyText.includes('https://prelude.app/dossiers/a1'));
  checkTrue(
    'transition citee',
    email.bodyText.includes('Le pattern growth-subsidized-model bascule de sain a attention'),
  );
}

// ============================================================
// Test 10 : digest vide leve exception
// ============================================================
console.log('\n=== Test 10 : digest vide leve exception ===');
{
  let threw = false;
  try {
    formatWeeklyDigestEmail('p@f.com', [], new Date('2026-05-11T00:00:00Z'));
  } catch {
    threw = true;
  }
  checkTrue('exception levee', threw);
}

// ============================================================
// Test 11 : HTML papier creme, encre noire, sans em-dash
// ============================================================
console.log('\n=== Test 11 : HTML sobre Le Grand Continent ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a11',
    companyName: 'TestCo',
    alerts: [ALERT_CRAN1],
    dossierUrl: 'https://prelude.app/dossiers/a11',
  };
  const email = formatImmediateAlertEmail('p@f.com', a);
  checkTrue('fond papier creme', email.bodyHtml.includes('#f6f1e7'));
  checkTrue('encre presque-noire', email.bodyHtml.includes('#1a1714'));
  checkTrue('serif Georgia', email.bodyHtml.includes('Georgia'));
  checkTrue('pas d em-dash dans HTML', !email.bodyHtml.includes('—'));
  checkTrue(
    'header Prelude Score de Trajectoire',
    email.bodyHtml.includes('Prelude') && email.bodyHtml.includes('Score de Trajectoire'),
  );
}

// ============================================================
// Test 12 : escape HTML pour eviter injection
// ============================================================
console.log('\n=== Test 12 : escape HTML pour injection ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a12',
    companyName: '<script>alert(1)</script>',
    alerts: [
      {
        cran: 1,
        tag: 'x',
        raison: 'Avant <strong>injection</strong> apres.',
        citations: ['<img src=x>'],
        recommandation: 'OK',
      },
    ],
    dossierUrl: 'u',
  };
  const email = formatImmediateAlertEmail('p@f.com', a);
  checkTrue('pas de <script> brut en HTML', !email.bodyHtml.includes('<script>alert(1)</script>'));
  checkTrue('escape & < > en HTML', email.bodyHtml.includes('&lt;script&gt;'));
}

// ============================================================
// Test 13 : multi-alertes sur meme dossier en un seul email
// ============================================================
console.log('\n=== Test 13 : multi-alertes meme dossier un seul email ===');
{
  const a: AlertedAnalysis = {
    analysisId: 'a13',
    companyName: 'MultiAlertCo',
    alerts: [ALERT_CRAN1, ALERT_CRAN2, ALERT_CRAN1],
    dossierUrl: 'u',
  };
  const email = formatImmediateAlertEmail('p@f.com', a);
  // Verifie qu on a bien deux occurrences cran 1 et une cran 2 dans
  // le corps
  const occCran1Raison = (email.bodyText.match(/Combinaison diagnostique drapeau-rouge/g) || []).length;
  const occCran2Raison = (email.bodyText.match(/Score global en chute de 25/g) || []).length;
  check('deux mentions cran 1', occCran1Raison, 2);
  check('une mention cran 2', occCran2Raison, 1);
}

// ============================================================
// Test 14 : digest cite nombre de dossiers
// ============================================================
console.log('\n=== Test 14 : digest cite nombre de dossiers ===');
{
  const weekStart = new Date('2026-05-11T00:00:00Z');
  const analyses: AlertedAnalysis[] = [
    { analysisId: 'a1', companyName: 'A', alerts: [ALERT_CRAN3], dossierUrl: 'u1' },
    { analysisId: 'a2', companyName: 'B', alerts: [ALERT_CRAN3], dossierUrl: 'u2' },
    { analysisId: 'a3', companyName: 'C', alerts: [ALERT_CRAN3], dossierUrl: 'u3' },
  ];
  const email = formatWeeklyDigestEmail('p@f.com', analyses, weekStart);
  checkTrue('mention 3 dossiers', email.bodyText.includes('3 dossiers'));
}

// ============================================================
// FIN
// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
