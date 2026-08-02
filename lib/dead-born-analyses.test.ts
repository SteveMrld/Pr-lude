// ============================================================
// Tests deterministes du predicat d analyse mort-nee
// ------------------------------------------------------------
// Ce que ces tests prouvent : le balayage ne cible que les lignes
// restees au stade initial sans qu aucun moteur ait demarre, et il
// s abstient sur tout ce qu il ne sait pas lire.
//
// Le defaut ferme : createPendingAnalysis insere une ligne en
// status='running' avant que le moindre moteur ne demarre. Quand le
// pipeline ne demarre jamais, connexion fermee aussitot, soumission en
// double supplantee, requete abandonnee, la ligne reste running avec
// progress.stage='started' et engines vide, et rien ne la distingue
// d une analyse qui travaille. Cas mesure le 2 aout 2026 : une ligne
// figee 241 millisecondes apres sa creation, restee running et
// occupant un des trois slots de concurrence de l organisation
// jusqu au balayage a trente minutes.
//
// La garde est courte et etroite, et le cron existant n est pas
// touche : les deux ne traitent pas le meme defaut. Celui-ci porte sur
// les mort-nees, celui-la sur les pipelines interrompus en cours
// d execution, et ils n ont pas de raison de partager un seuil.
// ============================================================

import { isDeadBornProgress, DEAD_BORN_THRESHOLD_MINUTES } from './analysis-store';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
console.log('\n[Suite 1] le cas mesure et ses variantes');
// ============================================================

{
  // La forme exacte relevee sur la ligne 0f1f231f du 2 aout 2026.
  check(
    isDeadBornProgress({ stage: 'started', engines: {} }) === true,
    'stade initial et engines vide : mort-nee',
  );
  check(
    isDeadBornProgress({ stage: 'started' }) === true,
    'stade initial sans cle engines : mort-nee',
  );
  check(
    isDeadBornProgress({ stage: 'started', engines: null }) === true,
    'stade initial avec engines null : mort-nee',
  );
}

// ============================================================
console.log('\n[Suite 2] une analyse qui travaille n est jamais balayee');
// ============================================================

{
  // Un seul moteur enregistre suffit a prouver que le pipeline a
  // demarre, meme s il n a pas fini.
  check(
    isDeadBornProgress({ stage: 'started', engines: { team: { status: 'running' } } }) === false,
    'un moteur enregistre, meme au stade initial : pas mort-nee',
  );
  check(
    isDeadBornProgress({ stage: 'running', engines: {} }) === false,
    'stade running : pas mort-nee, le pipeline a avance',
  );
  check(
    isDeadBornProgress({
      stage: 'running',
      engines: { team: { status: 'done', durationMs: 153232 }, macro: { status: 'done' } },
    }) === false,
    'pipeline en cours avec moteurs termines : pas mort-nee',
  );
  check(
    isDeadBornProgress({ stage: 'completed', engines: { team: { status: 'done' } } }) === false,
    'pipeline termine : pas mort-nee',
  );
}

// ============================================================
console.log('\n[Suite 3] conservateur sur ce qu il ne sait pas lire');
// ============================================================

{
  // Le predicat s abstient plutot que de basculer une ligne dont la
  // forme lui echappe. Le cron a trente minutes reste le filet.
  check(isDeadBornProgress(null) === false, 'progress null : abstention');
  check(isDeadBornProgress(undefined) === false, 'progress absent : abstention');
  check(isDeadBornProgress({}) === false, 'objet vide sans stade : abstention');
  check(isDeadBornProgress('started') === false, 'progress non objet : abstention');
  check(isDeadBornProgress(42) === false, 'progress numerique : abstention');
  check(isDeadBornProgress([]) === false, 'tableau sans stade : abstention');
  check(
    isDeadBornProgress({ stage: 'started', engines: 'aucun' }) === false,
    'engines d un type inattendu : abstention plutot que bascule',
  );
  check(
    isDeadBornProgress({ etape: 'started' }) === false,
    'forme ancienne aux cles differentes : abstention',
  );
}

// ============================================================
console.log('\n[Suite 4] le seuil est plus court que celui du cron');
// ============================================================

{
  // Le cron cleanup-stale-running balaie a trente minutes et passe
  // toutes les quinze. La garde mort-nee doit agir bien avant, sinon
  // elle ne libere aucun slot que le cron n aurait pas libere.
  check(
    DEAD_BORN_THRESHOLD_MINUTES > 0 && DEAD_BORN_THRESHOLD_MINUTES < 15,
    `seuil de ${DEAD_BORN_THRESHOLD_MINUTES} minutes, sous le passage du cron`,
  );
  check(
    DEAD_BORN_THRESHOLD_MINUTES >= 3,
    'seuil superieur ou egal a trois minutes : un pipeline lent au demarrage n est pas balaye',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
