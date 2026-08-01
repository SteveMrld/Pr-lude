// ============================================================
// TESTS - LA CASCADE D UN CONTRAT TOMBE, DE BOUT EN BOUT
// ------------------------------------------------------------
// Les trois pieces du brief 21 etaient testees separement : le
// contrat au site d appel (engine-output-contract.test.ts), la garde
// de consommation sur promesse nue (meme fichier, suite 6), la
// traduction des statuts en base de score (score-calculator-basis.
// test.ts, section 7). Aucun test ne les faisait jouer ensemble, et
// c est pourtant l enchainement qui compte : team echoue son contrat,
// cinq moteurs perdent leur entree, deux dimensions sortent de
// l assiette, et le score doit se calculer sur ce qui reste sans
// qu aucun 50 de repli n entre dans la moyenne.
//
// Le montage reprend les pieces reelles du pipeline, pas des doubles :
// le recorder de production, le wrapper deadline de production, la
// garde de consommation de production, le calculateur de production.
// Seuls l appel LLM et les fenetres de temps sont simules.
//
// Deux scenarios, qui sont les deux formes que prend l echec :
//   A. le producteur leve, cas du contrat evalue au site d appel ;
//   B. le producteur rend sans lever une enveloppe non conforme, cas
//      exact du run 4e30c644 avant correctif, ou seule la garde de
//      consommation puis la finalisation avancee le rattrapent.
//
// Execution : npx tsx lib/engines/cascade-contract.test.ts
// ============================================================

import { EngineStatusRecorder } from '../orchestrator/engine-status-recorder';
import { createEngineDeadlineWrapper } from '../orchestrator/engine-deadline';
import type { EngineDeadlineWrapper } from '../orchestrator/engine-deadline';
import { requireConformingOutput, EngineContractError } from './engine-output-contract';
import { computeMechanicalScore } from './score-calculator';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// MONTAGE
// ============================================================

/** Les cinq moteurs qui recoivent l objet team en argument direct, avec
 *  les dependances que la route leur declare. */
const CONSOMMATEURS: [string, string[]][] = [
  ['patternMatching', ['team', 'market', 'macro']],
  ['blindspotAnalysis', ['team', 'market', 'macro']],
  ['contrarianAnalysis', ['team', 'market', 'macro']],
  ['causalReversal', ['team', 'market', 'macro', 'patternMatching']],
  ['referenceChecks', ['team', 'blindspotAnalysis', 'causalReversal']],
];

/** Enveloppe persistee par le run 4e30c644 : le JSON a casse sur une
 *  apostrophe et la voie de recuperation a rendu un objet indexe par
 *  position. Trois cles, aucune des trois exigees par le contrat team. */
const ENVELOPPE_RUN_A = {
  '0': 'web : Elle Cote d',
  '1': 'Ivoire',
  realData: [{ name: 'Rebecca Cathline' }],
};

function harnais() {
  const recorder = new EngineStatusRecorder();
  const wrap: EngineDeadlineWrapper = createEngineDeadlineWrapper({
    recorder,
    // Fenetres larges : aucun scenario ici ne doit sortir en timeout,
    // ce qui masquerait la cascade qu on veut lire.
    waitDeadlineMs: 30_000,
    llmDeadlineMs: 30_000,
    onTimeout: () => {},
    onDoneNull: () => {},
    onError: () => {},
  });
  return { recorder, wrap };
}

/** Rejoue la sequence de la route : team est enveloppe par le wrapper,
 *  sa sortie passe par la garde de consommation, les cinq moteurs aval
 *  attendent la sortie gardee et sont eux-memes enveloppes. Tout est
 *  construit dans le meme tick, comme dans le Promise.all central. */
async function joueCascade(teamPromise: Promise<any>) {
  const { recorder, wrap } = harnais();
  // La route emet markLLMStart pour team hors parcours growth, avant
  // la construction des wrappers. L ordre compte : un moteur qui a
  // atteint son LLM echoue pour son propre compte et n est pas promu
  // en failed-upstream.
  recorder.markLLMStart('team');

  const teamConforme = requireConformingOutput('team', teamPromise);
  teamConforme.catch(() => {});

  const enveloppes = [
    wrap('team', 'team', teamPromise),
    ...CONSOMMATEURS.map(([engine, deps]) => wrap(
      engine,
      engine,
      (async () => {
        const team = await teamConforme;
        // Jamais atteint quand la garde refuse : c est tout l objet du
        // bloc 3. La sortie serait ici fabriquee a partir d une entree
        // non conforme.
        return { consommeTeam: team };
      })(),
      deps,
    )),
  ];

  const [team, ...aval] = await Promise.all(enveloppes);
  return { recorder, team, aval };
}

// Racines conformes des trois moteurs qui restent debout.
const MARKET = { perceivedSize: 'large', organicSignals: { score: 65 }, needIntensity: { score: 65 }, defensibility: { score: 65 } } as any;
const MACRO = { cyclePosition: 'mature', contraryclicalOpportunity: { score: 55 } } as any;
const FINANCIAL = {
  hasFinancialData: true, dataSource: 'bp', tests: {},
  globalCoherenceScore: 75, alertesCritiques: [], incoherenceDeckVsBP: [],
  syntheseCoherence: '', recalculsEffectues: [],
} as any;

(async () => {
  // ============================================================
  // SCENARIO A - LE PRODUCTEUR LEVE
  // ------------------------------------------------------------
  // parseEngineOutput a evalue le contrat au site d appel et leve.
  // La promesse team rejette, le wrapper l enregistre, la garde de
  // consommation relaie le rejet aux cinq.
  // ============================================================

  console.log('\n[Scenario A] team leve son echec de contrat');

  {
    const erreur = new EngineContractError('team', 'recovered', ENVELOPPE_RUN_A, 1);
    const { recorder, team, aval } = await joueCascade(Promise.reject(erreur));
    const s = recorder.snapshot();

    check(team === null, 'team : le wrapper resout null pour ses appelants');
    check(s.team?.status === 'failed',
      'team : declare failed pour son propre compte, pas promu en cascade');
    check(s.team?.errorMessage?.includes('contrat minimal') === true,
      '  le releve porte la raison du refus (obtenu ' + s.team?.errorMessage + ')');

    check(aval.every(v => v === null),
      'les cinq consommateurs resolvent null, aucun ne rend de sortie');
    const statuts = CONSOMMATEURS.map(([e]) => s[e]?.status);
    check(statuts.every(st => st === 'failed-upstream'),
      'les cinq consommateurs sont declares failed-upstream (obtenu ' + statuts.join(', ') + ')');
    check(CONSOMMATEURS.every(([e]) => s[e]?.errorMessage?.includes('team') === true),
      '  chacun nomme team comme dependance fautive, la base est declaree');
    check(CONSOMMATEURS.every(([e]) => (s[e]?.failedDependencies ?? []).includes('team')),
      '  et la porte la en clair dans failedDependencies');

    check(recorder.computeRunStatus() === 'completed_with_gaps',
      'le run se solde en completed_with_gaps, six moteurs manquants');
    check(recorder.gaps().length === 6, '  six lacunes ouvertes, ni plus ni moins');

    // Le score lit ce meme releve. Deux des cinq consommateurs portent
    // une dimension : Aveuglement et Contrarien.
    const score = computeMechanicalScore({
      team: null, market: MARKET, macro: MACRO,
      financial: FINANCIAL, contrarian: null, blindspot: null,
      engineStatuses: s,
    });

    check(score.dimensions.team.evaluationCause === 'moteur-failed',
      'Equipe sort de l assiette sous la cause de son propre echec');
    check(score.dimensions.vigilance.evaluationCause === 'moteur-failed-upstream',
      'Vigilance sort sous la cause de cascade, pas sous un echec propre');
    check(score.dimensions.contrarian.evaluationCause === 'moteur-failed-upstream',
      'Contrarien sort sous la cause de cascade');
    check(['team', 'vigilance', 'contrarian'].every(
      k => (score.dimensions as any)[k].contribution === 0),
      'aucune des trois ne contribue, aucun 50 de repli dans la moyenne');
    check(['team', 'vigilance', 'contrarian'].every(
      k => (score.dimensions as any)[k].evaluated === false),
      '  et aucune n est declaree evaluee');
    check(score.basis.evaluatedCount === 3, 'trois dimensions evaluees sur six');
    check(score.basis.evaluatedWeight === 0.5, '  poids evalue cumule 0.5');
    check(score.basis.sufficient === true, '  socle exactement a la limite, score encore produit');
    check(score.scoreStatus === 'computed', '  scoreStatus computed');
    check(score.basis.label.includes('3 dimensions sur 6'), 'la base est declaree dans le label');
    check(score.basis.label.includes('Equipe'), '  et nomme Equipe parmi les exclues');
    check(!score.dimensions.vigilance.rationale.includes('produit par le moteur'),
      'le rationale de Vigilance n affirme pas une valeur produite par un moteur tombe');
  }

  // ============================================================
  // SCENARIO B - LE PRODUCTEUR REND SANS LEVER
  // ------------------------------------------------------------
  // Etat du run 4e30c644 : la promesse team aboutit sur l enveloppe a
  // trois cles, le wrapper y voit un succes et ecrit ok. C est la
  // contradiction que le bloc 4 ferme. Deux gardes distinctes jouent
  // ici, et il faut les deux : la garde de consommation coupe les cinq
  // moteurs aval, la finalisation avancee corrige le statut de team
  // avant que le score ne le lise.
  // ============================================================

  console.log('\n[Scenario B] team rend une enveloppe non conforme sans lever');

  {
    const { recorder, team, aval } = await joueCascade(Promise.resolve(ENVELOPPE_RUN_A));
    const avant = recorder.snapshot();

    check(team !== null, 'team : le wrapper transmet la sortie a ses appelants directs');
    check(avant.team?.status === 'ok',
      'team : le wrapper voit un succes, c est la lecture d avant le brief 21');
    check(aval.every(v => v === null),
      'la garde de consommation coupe quand meme les cinq moteurs aval');
    check(CONSOMMATEURS.every(([e]) => avant[e]?.status === 'failed-upstream'),
      '  et les declare failed-upstream avec base declaree');

    // Finalisation avancee des six moteurs de dimension, telle que la
    // route la pose desormais avant computeMechanicalScore.
    recorder.finalizeFromResult(
      { team: ENVELOPPE_RUN_A, market: MARKET, macro: MACRO, financialCoherence: FINANCIAL, contrarianAnalysis: null, blindspotAnalysis: null },
      { team: 'team', market: 'market', macro: 'macro', financialCoherence: 'financialCoherence', contrarianAnalysis: 'contrarianAnalysis', blindspotAnalysis: 'blindspotAnalysis' },
    );
    const apres = recorder.snapshot();

    check(apres.team?.status === 'empty_output',
      'finalisation avancee : le ok du wrapper devient empty_output avant le score');
    check(CONSOMMATEURS.every(([e]) => apres[e]?.status === 'failed-upstream'),
      '  et ne recouvre pas la cascade deja etablie');

    const score = computeMechanicalScore({
      team: ENVELOPPE_RUN_A as any, market: MARKET, macro: MACRO,
      financial: FINANCIAL, contrarian: null, blindspot: null,
      engineStatuses: apres,
    });

    check(score.dimensions.team.engineStatus === 'empty_output',
      'le score expose le statut du releve, pas un statut recalcule');
    check(score.dimensions.team.evaluationCause === 'moteur-empty-output',
      '  et la cause qui lui correspond, la contradiction du run A est fermee');
    check(score.dimensions.team.contribution === 0,
      '  l enveloppe a trois cles ne contribue pas au score');
    check(score.basis.evaluatedCount === 3, 'trois dimensions evaluees, les memes qu au scenario A');
    check(score.basis.label.includes('Equipe'), '  Equipe nommee parmi les exclues');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();
