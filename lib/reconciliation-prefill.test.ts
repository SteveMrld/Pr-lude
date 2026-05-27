// ============================================================
// Test deterministe : pre-fill outcome depuis transition Kanban
// ------------------------------------------------------------
// Lance avec :
//   npx tsx lib/reconciliation-prefill.test.ts
// ============================================================

import {
  deriveDecisionFromStage,
  parseEurAmount,
  parseValuationBasis,
  humanizeRoundType,
  buildKanbanOutcomePrefill,
} from './reconciliation-prefill';

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
// deriveDecisionFromStage
// ============================================================
check('signed -> invested', deriveDecisionFromStage('signed') === 'invested');
check('declined -> passed', deriveDecisionFromStage('declined') === 'passed');
check('deposited -> null', deriveDecisionFromStage('deposited') === null);
check('in_review -> null', deriveDecisionFromStage('in_review') === null);
check('dd_field -> null', deriveDecisionFromStage('dd_field') === null);
check('ic_review -> null', deriveDecisionFromStage('ic_review') === null);
check('stage inconnu -> null', deriveDecisionFromStage('foobar') === null);

// ============================================================
// parseEurAmount
// ============================================================
check('5M EUR', parseEurAmount('5M EUR') === 5_000_000);
check('12 millions EUR', parseEurAmount('12 millions EUR') === 12_000_000);
check('12 millions €', parseEurAmount('12 millions €') === 12_000_000);
check('1.5 millions', parseEurAmount('1.5 millions') === 1_500_000);
check('1,5 millions (virgule francaise)', parseEurAmount('1,5 millions') === 1_500_000);
check('$10M (devise differente mais ordre de grandeur OK)',
  parseEurAmount('$10M') === 10_000_000);
check('500k', parseEurAmount('500k') === 500_000);
check('500 K', parseEurAmount('500 K') === 500_000);
check('1.2 milliard', parseEurAmount('1.2 milliard') === 1_200_000_000);
check('2 milliards EUR', parseEurAmount('2 milliards EUR') === 2_000_000_000);
check('nombre brut 5000000 (>= 100k assume EUR)',
  parseEurAmount('5000000') === 5000000);
check('nombre brut 50 (ambigu, rejette)',
  parseEurAmount('50') === null);
check('string vide', parseEurAmount('') === null);
check('null entre, null sort', parseEurAmount(null) === null);
check('undefined entre, null sort', parseEurAmount(undefined) === null);
check('phrase libre sans nombre', parseEurAmount('non renseigne') === null);
check('amount mixe : on prend le premier nombre',
  parseEurAmount('Tour de 8M EUR sur valo 32M') === 8_000_000);

// ============================================================
// parseValuationBasis
// ============================================================
check('post-money detecte', parseValuationBasis('Valo 32M post-money') === 'post_money');
check('postmoney sans tiret', parseValuationBasis('postmoney') === 'post_money');
check('post money espace', parseValuationBasis('post money 50M') === 'post_money');
check('pre-money detecte', parseValuationBasis('30M pre-money') === 'pre_money');
check('premoney sans tiret', parseValuationBasis('premoney') === 'pre_money');
check('basis non specifie', parseValuationBasis('Valo 50M') === null);
check('null entre, null sort', parseValuationBasis(null) === null);

// ============================================================
// humanizeRoundType
// ============================================================
check('series-A-early', humanizeRoundType('series-A-early') === 'Series A');
check('series-A-late', humanizeRoundType('series-A-late') === 'Series A');
check('series-B', humanizeRoundType('series-B') === 'Series B');
check('seed', humanizeRoundType('seed') === 'Seed');
check('pre-seed', humanizeRoundType('pre-seed') === 'Pre-Seed');
check('growth', humanizeRoundType('growth') === 'Growth');
check('stage inconnu retombe sur trim',
  humanizeRoundType('   bridge   ') === 'bridge');
check('null entre, null sort', humanizeRoundType(null) === null);

// ============================================================
// buildKanbanOutcomePrefill - integration
// ============================================================
{
  const result = {
    extraction: {
      fundraise: {
        stage: 'series-A-early',
        amount: '8 millions EUR',
        valuation: '32 millions post-money',
      },
    },
  };
  const out = buildKanbanOutcomePrefill('a1', 'u1', 'signed', result);
  check('build signed : payload non null', out !== null);
  check('build signed : decision invested', out?.decision === 'invested');
  check('build signed : source kanban_auto', out?.source === 'kanban_auto');
  check('build signed : analysisId propage', out?.analysisId === 'a1');
  check('build signed : userId propage', out?.userId === 'u1');
  check('build signed : entryRoundType Series A',
    out?.entryRoundType === 'Series A');
  check('build signed : entryRoundSizeEur 8M',
    out?.entryRoundSizeEur === 8_000_000);
  check('build signed : entryValuationEur 32M',
    out?.entryValuationEur === 32_000_000);
  check('build signed : entryValuationBasis post_money',
    out?.entryValuationBasis === 'post_money');
}

{
  const out = buildKanbanOutcomePrefill('a2', 'u1', 'declined', {
    extraction: { fundraise: {} },
  });
  check('build declined : decision passed', out?.decision === 'passed');
  check('build declined : source kanban_auto', out?.source === 'kanban_auto');
  check('build declined : entryRoundType null sans donnees',
    out?.entryRoundType === null);
}

{
  const out = buildKanbanOutcomePrefill('a3', 'u1', 'in_review', {});
  check('build in_review : null (stage intermediaire)', out === null);
}

{
  // result_json absent : pas de crash, pre-fill minimal
  const out = buildKanbanOutcomePrefill('a4', 'u1', 'signed', null);
  check('build signed avec result null : payload non null', out !== null);
  check('build signed avec result null : decision invested',
    out?.decision === 'invested');
  check('build signed avec result null : tous champs entry null',
    out?.entryRoundType === null
    && out?.entryRoundSizeEur === null
    && out?.entryValuationEur === null
    && out?.entryValuationBasis === null);
}

console.log(`\n=== reconciliation-prefill ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
