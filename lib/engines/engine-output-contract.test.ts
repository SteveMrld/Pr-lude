// ============================================================
// Tests deterministes engine-output-contract.ts
// ------------------------------------------------------------
// Suite 1 : le mode de parse est rendu a l appelant.
// Suite 2 : le contrat est evalue au moment de l appel.
// Suite 3 : le cas de reference team du run 4e30c644.
// Suite 4 : reprise sur echec de contrat.
// Suite 5 : le mode de parse ne decide rien a lui seul.
// ============================================================

import {
  parseJSONWithMode,
  parseEngineOutput,
  EngineContractError,
  isParseFidele,
  PARSE_MODES_FIDELES,
  requireConformingOutput,
} from './engine-output-contract';
import type { ParseMode } from './engine-budget';
import { passesMinimalContract } from '../orchestrator/engine-status-recorder';
import {
  buildSkippedTeamOutput,
  buildSkippedBlindspotOutput,
  buildSkippedPatternMatchingOutput,
  buildSkippedCausalOutput,
} from './skipped-outputs';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Le mode de parse est rendu a l appelant
// ============================================================

console.log('\n[Suite 1] Le mode de parse est rendu a l appelant');

{
  const r = parseJSONWithMode<{ a: number }>('{"a":1}');
  check(r.value.a === 1, 'JSON propre : valeur rendue');
  check(r.parseMode === 'direct', '  mode direct rendu, pas seulement depose');
}

{
  const r = parseJSONWithMode<{ a: number }>('Voici le resultat :\n{"a":1}\nFin.');
  check(r.value.a === 1, 'JSON enrobe de prose : valeur rendue');
  check(r.parseMode === 'extracted', '  mode extracted rendu');
}

{
  // Structure non refermee : la voie de recuperation la complete.
  const r = parseJSONWithMode<any>('{"a":1,"b":{"c":2}');
  check(r.value?.a === 1, 'structure coupee : valeur reconstruite');
  check(r.parseMode === 'recovered' || r.parseMode === 'repaired',
    '  mode de reconstruction rendu (obtenu ' + r.parseMode + ')');
}

{
  // Le puits de trace continue de recevoir le mode, pour que
  // pipeline_engines_status garde sa colonne parseMode.
  const trace: { parseMode?: ParseMode } = {};
  parseJSONWithMode('{"a":1}', trace);
  check(trace.parseMode === 'direct', 'le puits de trace recoit toujours le mode');
}

{
  check(isParseFidele('direct') && isParseFidele('extracted'),
    'direct et extracted sont fideles');
  check(!isParseFidele('recovered') && !isParseFidele('repaired'),
    'recovered et repaired sont des reconstructions');
  check(!isParseFidele(undefined), 'un mode absent n est pas fidele');
  check(PARSE_MODES_FIDELES.length === 2, 'deux modes fideles, pas davantage');
}

// ============================================================
// SUITE 2 - Le contrat est evalue au moment de l appel
// ============================================================

console.log('\n[Suite 2] Le contrat est evalue au moment de l appel');

(async () => {
  {
    const v = await parseEngineOutput<any>('market', async () => '{"perceivedSize":"large"}');
    check(v.perceivedSize === 'large', 'contrat satisfait : la valeur passe');
  }

  {
    let leve: any = null;
    try {
      await parseEngineOutput('market', async () => '{"autreChose":1}');
    } catch (e) { leve = e; }
    check(leve instanceof EngineContractError, 'contrat non satisfait : leve EngineContractError');
    check(leve?.engine === 'market', '  l erreur nomme le moteur');
    check(leve?.parseMode === 'direct', '  l erreur porte le mode de parse');
    check(Array.isArray(leve?.keys) && leve.keys.includes('autreChose'),
      '  l erreur porte les cles reellement rendues');
    check(typeof leve?.message === 'string' && leve.message.includes('market'),
      '  le message est lisible sans rejouer le run');
  }

  {
    // Moteur absent de la table : contrat generique, non-null non-vide.
    let leve: any = null;
    try {
      await parseEngineOutput('moteur-inconnu', async () => '{}');
    } catch (e) { leve = e; }
    check(leve instanceof EngineContractError,
      'moteur hors table : le contrat generique refuse un objet vide');

    const v = await parseEngineOutput<any>('moteur-inconnu', async () => '{"x":1}');
    check(v.x === 1, 'moteur hors table : un objet non vide passe');
  }

  // ============================================================
  // SUITE 3 - Le cas de reference team du run 4e30c644
  // ============================================================

  console.log('\n[Suite 3] Cas de reference team, run 4e30c644');

  {
    // Enveloppe exacte persistee par le run : le JSON a casse sur une
    // apostrophe, la voie de recuperation a rendu un objet indexe par
    // position. Trois cles, aucune des trois exigees par le contrat.
    const enveloppe = JSON.stringify({
      '0': 'web : Elle Cote d',
      '1': 'Ivoire',
      realData: [{ name: 'Rebecca Cathline' }, { name: 'Autre' }],
    });
    let leve: any = null;
    try {
      await parseEngineOutput('team', async () => enveloppe);
    } catch (e) { leve = e; }
    check(leve instanceof EngineContractError,
      'enveloppe team du run A : le moteur declare son echec');
    check(leve?.keys.length === 3, '  trois cles rendues, releve dans l erreur');
    check(!leve?.keys.includes('foundersCount'),
      '  aucune des cles exigees par le contrat team');
  }

  {
    const complet = JSON.stringify({
      foundersCount: 2,
      founderMarketFit: [{ score: 70 }],
      systemicCoverage: { score: 52 },
      realData: [],
    });
    const v = await parseEngineOutput<any>('team', async () => complet);
    check(v.foundersCount === 2, 'sortie team conforme : passe sans lever');
  }

  // ============================================================
  // SUITE 4 - Reprise sur echec de contrat
  // ============================================================

  console.log('\n[Suite 4] Reprise sur echec de contrat');

  {
    let appels = 0;
    const v = await parseEngineOutput<any>('team', async () => {
      appels++;
      return appels === 1
        ? '{"realData":[]}'
        : '{"foundersCount":2}';
    }, { contractRetries: 1 });
    check(appels === 2, 'reprise : l appel est rejoue, pas le parse');
    check(v.foundersCount === 2, '  la seconde tentative est rendue');
  }

  {
    let appels = 0;
    try {
      await parseEngineOutput('team', async () => { appels++; return '{"realData":[]}'; },
        { contractRetries: 1 });
    } catch { /* attendu */ }
    check(appels === 2, 'reprise epuisee : deux tentatives, pas trois');
  }

  {
    let appels = 0;
    let leve: any = null;
    try {
      await parseEngineOutput('team', async () => { appels++; return '{"realData":[]}'; });
    } catch (e) { leve = e; }
    check(appels === 1, 'defaut sans reprise : une seule tentative');
    check(leve?.attempts === 1, '  l erreur porte le nombre de tentatives');
  }

  {
    // Une erreur reseau n est pas un echec de contrat : elle remonte
    // sans etre rejouee ici.
    let appels = 0;
    let msg = '';
    try {
      await parseEngineOutput('team', async () => {
        appels++;
        throw new Error('ECONNRESET');
      }, { contractRetries: 2 });
    } catch (e: any) { msg = e?.message; }
    check(appels === 1, 'erreur d appel : aucune reprise de contrat');
    check(msg === 'ECONNRESET', '  l erreur d origine remonte telle quelle');
  }

  {
    let vus: number[] = [];
    await parseEngineOutput<any>('team', async (attempt) => {
      vus.push(attempt);
      return attempt === 1 ? '{"realData":[]}' : '{"foundersCount":1}';
    }, { contractRetries: 1, onRetry: () => {} });
    check(vus.join(',') === '1,2', 'le rang de tentative est passe au producteur');
  }

  // ============================================================
  // SUITE 5 - Le mode de parse ne decide rien a lui seul
  // ============================================================

  console.log('\n[Suite 5] Le mode de parse ne decide rien a lui seul');

  {
    // Parse direct, enveloppe vide : refuse. C est la doctrine du
    // brief 21, un parse syntaxiquement valide ne prouve rien.
    let leve: any = null;
    try {
      await parseEngineOutput('blindspotAnalysis', async () => '{"patterns":{}}');
    } catch (e) { leve = e; }
    check(leve instanceof EngineContractError,
      'parse direct sur enveloppe vide : refuse quand meme');
    check(leve?.parseMode === 'direct', '  le mode fidele est trace, sans absoudre');
  }

  {
    // Le coeur de la doctrine : la reparation ne vaut pas succes. Le
    // texte est coupe, la voie de recuperation en tire un objet valide,
    // et cet objet ne porte aucune des cles exigees. C est le chemin
    // exact du run 4e30c644, reproduit depuis le texte brut et non
    // depuis l enveloppe deja parsee : le JSON casse sur l apostrophe de
    // "Cote d Ivoire", la recuperation indexe par position, et le
    // contrat tombe. Sans cette assertion, rien ne verifiait qu une
    // reconstruction non conforme est refusee, seulement qu une
    // enveloppe deja reconstruite l est.
    const brut = '{"0":"web : Elle Cote d","1":"Ivoire","realData":[{"name":"Rebecca Cathline"}';
    let leve: any = null;
    try {
      await parseEngineOutput('team', async () => brut);
    } catch (e) { leve = e; }
    check(leve instanceof EngineContractError,
      'reconstruction non conforme : refusee, la reparation ne vaut pas succes');
    check(leve?.parseMode === 'recovered' || leve?.parseMode === 'repaired',
      '  l erreur porte le mode de reconstruction (obtenu ' + leve?.parseMode + ')');
    check(leve?.keys.length === 3, '  trois cles rendues par la reparation');
  }

  {
    // Meme chemin, avec reprise ouverte : le moteur declare son echec de
    // contrat, rejoue son appel, et la seconde fenetre rend une sortie
    // conforme. Le mode de la tentative fautive est bien une
    // reconstruction, celui de la tentative retenue un parse fidele.
    const modes: (ParseMode | undefined)[] = [];
    let appels = 0;
    const trace: { parseMode?: ParseMode } = {};
    const v = await parseEngineOutput<any>('team', async () => {
      appels++;
      return appels === 1
        ? '{"0":"web : Elle Cote d","1":"Ivoire","realData":[{"name":"X"}'
        : '{"foundersCount":2,"systemicCoverage":{"score":52}}';
    }, {
      contractRetries: 1,
      trace,
      onRetry: (_a, err) => { modes.push(err.parseMode); },
    });
    check(appels === 2, 'reparation non conforme : le moteur rejoue son appel');
    check(v.foundersCount === 2, '  la seconde tentative conforme est rendue');
    check(modes[0] === 'recovered' || modes[0] === 'repaired',
      '  la tentative fautive est declaree comme reconstruction (obtenu ' + modes[0] + ')');
    check(trace.parseMode === 'direct',
      '  le releve porte le mode de la tentative retenue, pas celui de la fautive');
  }

  {
    // Reconstruction qui satisfait le contrat : acceptee. Le mode est
    // trace, il ne condamne pas a lui seul.
    const trace: { parseMode?: ParseMode } = {};
    const v = await parseEngineOutput<any>('blindspotAnalysis',
      async () => '{"patterns":{"P1":{"score":40}}',
      { trace });
    check(v?.patterns?.P1?.score === 40, 'reconstruction conforme au contrat : acceptee');
    check(trace.parseMode === 'recovered' || trace.parseMode === 'repaired',
      '  le releve garde la trace de la reconstruction (obtenu ' + trace.parseMode + ')');
  }

  // ============================================================
  // SUITE 6 - Garde cote consommateur
  // ============================================================

  console.log('\n[Suite 6] Garde cote consommateur');

  {
    const v = await requireConformingOutput('team',
      Promise.resolve({ foundersCount: 2 }));
    check((v as any).foundersCount === 2, 'sortie amont conforme : transmise telle quelle');
  }

  {
    let leve: any = null;
    try {
      await requireConformingOutput('team', Promise.resolve({ '0': 'web : Elle Cote d', '1': 'Ivoire', realData: [] }));
    } catch (e) { leve = e; }
    check(leve instanceof EngineContractError,
      'enveloppe team du run A : refusee a ses consommateurs');
    check(leve?.engine === 'team', '  l erreur nomme la dependance fautive');
  }

  {
    // Une sortie ecartee par la matrice passe : le moteur n a pas
    // echoue, il n avait pas lieu de tourner.
    const v = await requireConformingOutput('team', Promise.resolve({ __skipped: true }));
    check((v as any).__skipped === true, 'sortie ecartee par la matrice : transmise sans refus');
  }

  {
    // Le rejet du producteur traverse la garde sans etre transforme.
    let msg = '';
    try {
      await requireConformingOutput('team', Promise.reject(new Error('boom amont')));
    } catch (e: any) { msg = e?.message; }
    check(msg === 'boom amont', 'rejet amont : traverse la garde inchange');
  }

  // ------------------------------------------------------------
  // Chemin nominal des six moteurs gardes. Une garde de consommation
  // ne vaut que si elle ne refuse rien de legitime : un contrat calibre
  // sur des noms de champs fantomes couperait le pipeline sur des
  // sorties completes, ce qui est exactement l accident qu avait connu
  // fragiliteStructurelle avec overallScore et combinations. Les six
  // cles gardees par la route sont donc exercees sur des sortants de
  // forme reelle, dont les deux voies de patternMatching et de
  // causalReversal.
  // ------------------------------------------------------------
  {
    const nominaux: [string, any][] = [
      ['team', { foundersCount: 2, founderMarketFit: [{ score: 70 }], systemicCoverage: { score: 52 }, realData: [] }],
      ['market', { perceivedSize: 'large', needIntensity: { score: 61 }, defensibility: { score: 44, moats: [] } }],
      ['macro', { cyclePosition: 'mature', structuralTrends: [{ label: 'consolidation' }], regulatoryEnvironment: { score: 50 } }],
      ['patternMatching', { comparables: [{ name: 'Doctolib', score: 62 }] }],
      ['patternMatching', { retrospectiveBenchmark: { averageScore: 58, insights: ['x'] } }],
      ['blindspotAnalysis', { patterns: { survivorship: { score: 40 } } }],
      ['causalReversal', { reversalNarrative: 'La these tient si et seulement si.' }],
      ['causalReversal', { blindspotsScores: { execution: 55 } }],
    ];
    let refuses = 0;
    for (const [engine, sortie] of nominaux) {
      try {
        const v = await requireConformingOutput(engine, Promise.resolve(sortie));
        if (v !== sortie) refuses++;
      } catch { refuses++; }
    }
    check(refuses === 0,
      'chemin nominal des six moteurs gardes : aucun faux positif sur huit sortants de forme reelle');
  }

  // ------------------------------------------------------------
  // Parcours growth : les moteurs ecartes rendent une enveloppe neutre
  // marquee __skipped qui ne satisfait pas toujours le contrat de leur
  // cle. Le skip est teste avant le contrat, et c est ce qui permet au
  // parcours growth de traverser la garde sans que rien ne soit
  // fabrique : le moteur n a pas echoue, il n avait pas lieu de tourner.
  // ------------------------------------------------------------
  {
    const ecartes: [string, any][] = [
      ['team', buildSkippedTeamOutput()],
      ['blindspotAnalysis', buildSkippedBlindspotOutput()],
      ['patternMatching', buildSkippedPatternMatchingOutput()],
      ['causalReversal', buildSkippedCausalOutput()],
    ];
    let refuses = 0;
    for (const [engine, sortie] of ecartes) {
      try { await requireConformingOutput(engine, Promise.resolve(sortie)); }
      catch { refuses++; }
    }
    check(refuses === 0, 'parcours growth : les quatre sorties ecartees traversent la garde');
    check(!passesMinimalContract('patternMatching', buildSkippedPatternMatchingOutput()),
      '  et l une d elles echoue bien son contrat : c est le skip qui la sauve, pas le contenu');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();
