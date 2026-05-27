// ============================================================
// Test deterministe : parsing + dedup du runner detection auto
// ------------------------------------------------------------
// N appelle pas le LLM. Exerce uniquement les helpers internes
// exposes via __test. Lance avec :
//   npx tsx lib/cron/milestone-detection-runner.test.ts
// ============================================================

import {
  parseDetectedEvents,
  dedupAgainstExisting,
  normalizeForDedup,
} from './milestone-detection-utils';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

// ============================================================
// parseDetectedEvents
// ============================================================
{
  const raw = `[
    {"date": "2025-12-10", "type": "fundraise", "title": "Series B 30M EUR",
     "description": "Round mene par Sequoia.", "impact": "positive",
     "thesisAlignment": "confirms_driver", "sourceUrl": "https://example.com/x"}
  ]`;
  const out = parseDetectedEvents(raw);
  check('parse : 1 evenement bien forme', out.length === 1);
  check('parse : date conservee', out[0].date === '2025-12-10');
  check('parse : type fundraise', out[0].type === 'fundraise');
  check('parse : title preserve', out[0].title === 'Series B 30M EUR');
  check('parse : alignement confirms_driver', out[0].thesisAlignment === 'confirms_driver');
}

// Tolerance bruit autour du JSON
{
  const raw = 'Voici les evenements detectes :\n```json\n[{"date":"2025-08-01","type":"exit","title":"Acquisition par Microsoft","description":"Annonce officielle","impact":"positive","thesisAlignment":"confirms_driver","sourceUrl":"https://x.com"}]\n```\nFin.';
  const out = parseDetectedEvents(raw);
  check('parse : tolere bruit + markdown', out.length === 1 && out[0].type === 'exit');
}

// Date corrompue rejetee
{
  const raw = `[{"date": "pas-une-date", "type": "fundraise", "title": "X", "sourceUrl": "https://x.com"}]`;
  const out = parseDetectedEvents(raw);
  check('parse : date invalide rejetee', out.length === 0);
}

// Type invalide retombe sur other
{
  const raw = `[{"date": "2025-06-01", "type": "explosion-nucleaire", "title": "X", "sourceUrl": "https://x.com"}]`;
  const out = parseDetectedEvents(raw);
  check('parse : type inconnu retombe sur other', out.length === 1 && out[0].type === 'other');
}

// sourceUrl non http rejetee
{
  const raw = `[{"date": "2025-06-01", "type": "fundraise", "title": "X", "sourceUrl": "javascript:alert(1)"}]`;
  const out = parseDetectedEvents(raw);
  check('parse : sourceUrl non http nullifiee', out.length === 1 && out[0].sourceUrl === null);
}

// Reponse vide
{
  const out = parseDetectedEvents('[]');
  check('parse : tableau vide', out.length === 0);
}

// Reponse non JSON
{
  const out = parseDetectedEvents('Aucun evenement trouve.');
  check('parse : pas de JSON renvoie tableau vide', out.length === 0);
}

// Alignement invalide nullifie
{
  const raw = `[{"date": "2025-06-01", "type": "fundraise", "title": "X",
                 "thesisAlignment": "invente", "sourceUrl": "https://x.com"}]`;
  const out = parseDetectedEvents(raw);
  check('parse : alignment invalide null', out.length === 1 && out[0].thesisAlignment === null);
}

// ============================================================
// normalizeForDedup
// ============================================================
check('normalize : accents retires',
  normalizeForDedup('Levee Series B menee par Sequoia !') === 'levee series b menee par sequoia');
check('normalize : casse uniformisee',
  normalizeForDedup('SERIES A') === 'series a');
check('normalize : ponctuation collapsee',
  normalizeForDedup('Pivot,    strategique;') === 'pivot strategique');

// ============================================================
// dedupAgainstExisting
// ============================================================
{
  const detected = [
    { date: '2025-10-10', type: 'fundraise' as const, title: 'Series B 30M',
      description: '', impact: null, thesisAlignment: null,
      sourceUrl: 'https://a.com/x' },
    { date: '2025-11-15', type: 'team_change' as const, title: 'Depart CTO',
      description: '', impact: null, thesisAlignment: null, sourceUrl: 'https://b.com/y' },
  ];
  const existing = [
    { milestoneDate: '2025-10-12', title: 'series b 30m', sourceUrl: null },
  ];
  const out = dedupAgainstExisting(detected, existing);
  check('dedup : titre normalise + date proche rejete', out.length === 1);
  check('dedup : conserve celui non duplique', out[0].title === 'Depart CTO');
}

{
  const detected = [
    { date: '2025-10-10', type: 'fundraise' as const, title: 'Levee paraphrasee',
      description: '', impact: null, thesisAlignment: null,
      sourceUrl: 'https://a.com/x' },
  ];
  const existing = [
    { milestoneDate: '2020-01-01', title: 'Tout autre titre', sourceUrl: 'https://a.com/x' },
  ];
  const out = dedupAgainstExisting(detected, existing);
  check('dedup : meme source_url rejete meme avec dates lointaines', out.length === 0);
}

{
  const detected = [
    { date: '2025-10-10', type: 'fundraise' as const, title: 'Series B',
      description: '', impact: null, thesisAlignment: null,
      sourceUrl: 'https://a.com/x' },
  ];
  const existing = [
    { milestoneDate: '2024-01-01', title: 'series b', sourceUrl: null },
  ];
  const out = dedupAgainstExisting(detected, existing);
  check('dedup : meme titre mais dates lointaines (>14j) conserve',
    out.length === 1);
}

console.log(`\n=== milestone-detection-runner (parsing) ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
