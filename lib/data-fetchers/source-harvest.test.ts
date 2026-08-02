// ============================================================
// Tests deterministes du journal de recolte des sources
// ------------------------------------------------------------
// Ce que ces tests prouvent : la portee est le run et non un etat
// global qu il faudrait penser a reinitialiser, la cause derive de
// l issue sans jamais etre posee a la main, et un journal muet se
// detecte au lieu de passer pour un run sans source.
//
// Le defaut ferme : trackedSource distinguait deja le hit du miss et
// du timeout, et rien n en sortait. Le mecanisme passait par un
// opts?.emit qu aucun appelant du depot ne fournissait, le moteur
// Equipe passant explicitement undefined a cette position. Six
// evenements cables, aucun emetteur, depuis l origine. Un fondateur
// dont les recherches echouaient produisait le meme realData vide
// qu un fondateur reellement absent des sources.
//
// La forme retenue tire la lecon de cet echec : pas un parametre
// optionnel que l appelant doit penser a passer, mais un journal a
// portee de run alimente par la couche elle-meme.
// ============================================================

import {
  withSourceHarvest,
  recordSourceOutcome,
  readSourceHarvest,
  sourceCause,
  harvestIsSilent,
  harvestIsOpen,
  OUTCOME_TO_CAUSE,
} from './source-harvest';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

(async () => {
  // ============================================================
  console.log('\n[Suite 1] la correspondance issue vers cause');
  // ============================================================

  {
    check(OUTCOME_TO_CAUSE.hit === null, 'hit : aucune cause');
    check(OUTCOME_TO_CAUSE.empty === 'absence', 'empty : absence, la source a repondu sans rien trouver');
    check(OUTCOME_TO_CAUSE.failed === 'incident', 'failed : incident, il y a a reparer');
    check(OUTCOME_TO_CAUSE.skipped === 'doctrine', 'skipped : doctrine, la source est desactivee par configuration');
    check(Object.keys(OUTCOME_TO_CAUSE).length === 4, 'quatre issues, pas davantage');
  }

  {
    // La cause n est jamais posee a la main : elle derive de l issue.
    // Un site d appel ne peut donc pas se tromper de cause.
    await withSourceHarvest(async () => {
      recordSourceOutcome({ engine: 'team', source: 'openalex', outcome: 'failed', elapsedMs: 5000 });
      const h = readSourceHarvest();
      check(h.entries[0].cause === 'incident', 'la cause est derivee, pas fournie');
    });
  }

  // ============================================================
  console.log('\n[Suite 2] la portee est le run, il n y a rien a reinitialiser');
  // ============================================================

  {
    await withSourceHarvest(async () => {
      recordSourceOutcome({ engine: 'team', source: 'github', outcome: 'hit', elapsedMs: 120 });
      check(readSourceHarvest().entries.length === 1, 'premier run : une entree');
    });
    await withSourceHarvest(async () => {
      check(readSourceHarvest().entries.length === 0, 'second run : journal vierge sans remise a zero explicite');
    });
  }

  {
    // Deux runs concurrents ne se voient pas. C est la propriete que
    // n aurait pas eue un singleton de module, et elle compte : le
    // pipeline peut tourner plusieurs fois dans le meme processus.
    const [a, b] = await Promise.all([
      withSourceHarvest(async () => {
        recordSourceOutcome({ engine: 'A', source: 'wikipedia', outcome: 'hit', elapsedMs: 10 });
        await new Promise((r) => setTimeout(r, 20));
        recordSourceOutcome({ engine: 'A', source: 'github', outcome: 'empty', elapsedMs: 10 });
        return readSourceHarvest();
      }),
      withSourceHarvest(async () => {
        await new Promise((r) => setTimeout(r, 10));
        recordSourceOutcome({ engine: 'B', source: 'openalex', outcome: 'failed', elapsedMs: 10 });
        return readSourceHarvest();
      }),
    ]);
    check(a.entries.length === 2, `run A voit ses deux entrees (obtenu ${a.entries.length})`);
    check(b.entries.length === 1, `run B voit la sienne (obtenu ${b.entries.length})`);
    check(a.entries.every((e) => e.engine === 'A'), 'aucune fuite de B vers A');
    check(b.entries.every((e) => e.engine === 'B'), 'aucune fuite de A vers B');
  }

  {
    // Hors run, l ecriture est un no-op silencieux : un test unitaire
    // qui appelle une source sans ouvrir de run ne doit pas echouer.
    check(harvestIsOpen() === false, 'hors run, aucune portee ouverte');
    recordSourceOutcome({ engine: 'orphelin', source: 'github', outcome: 'hit', elapsedMs: 1 });
    check(readSourceHarvest().entries.length === 0, 'hors run, ecriture sans effet et sans erreur');
  }

  // ============================================================
  console.log('\n[Suite 3] un journal muet se detecte');
  // ============================================================

  {
    // Exigence du brief 26 : un journal vide en fin de run est
    // indiscernable d une couche qui n a rien fait, ce qui est
    // exactement la faute corrigee. Le cas doit se voir.
    await withSourceHarvest(async () => {
      check(harvestIsSilent() === true, 'run ouvert et journal vide : silence detecte');
      recordSourceOutcome({ engine: 'team', source: 'github', outcome: 'empty', elapsedMs: 30 });
      check(harvestIsSilent() === false, 'des la premiere entree, plus de silence');
    });
    check(harvestIsSilent() === false, 'hors run, aucun silence a signaler : il n y a pas de run');
  }

  // ============================================================
  console.log('\n[Suite 4] agregats et lecture par source');
  // ============================================================

  {
    await withSourceHarvest(async () => {
      recordSourceOutcome({ engine: 'team', source: 'openalex', outcome: 'hit', elapsedMs: 100 });
      recordSourceOutcome({ engine: 'team', source: 'openalex', outcome: 'failed', elapsedMs: 5000, detail: 'AbortError' });
      recordSourceOutcome({ engine: 'team', source: 'github', outcome: 'empty', elapsedMs: 200 });
      recordSourceOutcome({ engine: 'team', source: 'hackernews', outcome: 'skipped', elapsedMs: 0 });
      const h = readSourceHarvest();

      check(h.counts.hit === 1 && h.counts.failed === 1 && h.counts.empty === 1 && h.counts.skipped === 1, 'les quatre compteurs');
      check(h.hasIncident === true, 'un echec suffit a lever hasIncident');
      check(h.failedSources.join(',') === 'openalex', 'les sources en echec sont listees et dedupliquees');
      check(h.entries[1].detail === 'AbortError', 'le message d erreur est conserve');

      // Une source interrogee plusieurs fois est en incident des qu une
      // interrogation echoue : le moteur doit savoir que sa couverture
      // est trouee, pas qu elle l est en moyenne.
      check(sourceCause('openalex') === 'incident', 'openalex : incident malgre un hit');
      check(sourceCause('github') === 'absence', 'github : absence');
      check(sourceCause('hackernews') === 'doctrine', 'hackernews : doctrine');
      check(sourceCause('wikipedia') === null, 'source jamais interrogee : aucune cause');
    });
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
