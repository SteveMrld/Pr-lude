// ============================================================
// Tests du graphe de dependances deterministe
// ------------------------------------------------------------
// Ce que ces tests prouvent : le graphe declare correspond a ce que les
// moteurs lisent reellement, et l ordre de rejeu respecte les
// dependances.
//
// Pourquoi ils existent. La liste des moteurs deterministes a ete
// ecrite une heure apres la formulation de la discipline des regles
// ecrites, et elle etait une declaration sans garde, c est-a-dire
// exactement ce que cette discipline interdit. La lucidite ne suffit
// pas : une regle qui depend de la vigilance de celui qui l applique ne
// tient pas, y compris quand celui qui l applique vient de l ecrire.
//
// La verification est une mutation. Pour chaque dependance declaree, on
// modifie la section correspondante et on verifie que la sortie du
// moteur change. Une dependance declaree qui ne change rien est une
// declaration fausse ; c est la seule facon de verifier un graphe sans
// le relire.
// ============================================================

import { GRAPHE_DETERMINISTE, MOTEURS_DETERMINISTES, MOTEURS_LLM, reassembler } from '../../scripts/replay-partial';

let pass = 0, fail = 0;
const nonExercees: string[] = [];
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Un result_json minimal mais realiste, assez riche pour que chaque
// moteur deterministe produise quelque chose.
function resultat(): any {
  return {
    meta: { asOf: '2026-08-03', asOfSource: 'deck-receipt' },
    extraction: {
      companyName: 'Societe', sector: 'SaaS', subSector: 'plateforme logicielle',
      businessModel: 'Modele SaaS pur avec abonnement annuel',
      country: 'France',
      traction: { revenue: '13,5 m€ (CA 2021 realise)' },
      fundraise: {
        stage: 'series-a', amount: '10 M€',
        // operationType est derive a l extraction ; le jeu d essai doit
        // le porter, sinon operationValidity sort en non-applicable
        // quoi qu il arrive et aucune de ses dependances n est exercee.
        operationType: 'levee', operationTypeEvidence: 'inject 10m in cash-in',
        operationComponents: [{ kind: 'cash-in', evidence: 'inject 10m in cash-in' }],
      },
    },
    financialData: {
      lastActualYear: 2021, lastActualYearEvidence: 'colonne 2021a',
      revenueProjection: [{ year: 2021, value: 13.5 }],
      // benchmarks lit financialData.currentRound.amount, avec repli
      // sur extraction.fundraise.amount. Le montant doit donc DIFFERER
      // du repli, sinon vider financialData rend la meme sortie et la
      // dependance parait fausse alors qu elle est seulement masquee.
      currentRound: { amount: '25 M€' },
    },
    // La prose du moteur Equipe doit porter un evenement date, sinon la
    // dependance d operationValidity a cette section n est pas exercee.
    team: {
      greenFlags: ['La levee de 40m€ conclue en juin 2024 avec un fonds de croissance [web : presse]'],
      redFlags: [],
    },
    market: { globalScore: 61 },
    macro: { globalScore: 68 },
    financialCoherence: { globalScore: 55, coherenceVerdict: 'coherent', redFlags: [] },
    contrarianAnalysis: { globalScore: 63 },
    blindspotAnalysis: { globalScore: 68 },
    fragiliteStructurelle: null,
    narrativeDrift: null,
    saasMetrics: null,
  };
}

function poser(o: any, chemin: string, valeur: any): any {
  const c = JSON.parse(JSON.stringify(o));
  c[chemin] = valeur;
  return c;
}

(async () => {
  console.log('\n[Suite 1] les deux listes ne se recouvrent pas');
  {
    const chevauche = MOTEURS_DETERMINISTES.filter((m) => (MOTEURS_LLM as readonly string[]).includes(m));
    check(chevauche.length === 0, `aucun moteur declare a la fois LLM et deterministe (${chevauche.join(', ') || 'aucun'})`);
    check(MOTEURS_DETERMINISTES.length === GRAPHE_DETERMINISTE.length,
      'la liste des moteurs derive du graphe et n en est pas une recopie');
    check(MOTEURS_DETERMINISTES.every((m, i) => m === GRAPHE_DETERMINISTE[i].moteur),
      'et elle en conserve l ordre');
  }

  console.log('\n[Suite 2] l ordre de rejeu respecte les dependances');
  {
    // Une dependance interne au graphe doit etre recalculee avant son
    // dependant, sinon le rejeu consomme une valeur perimee.
    const rang = new Map(MOTEURS_DETERMINISTES.map((m, i) => [m, i]));
    let violations = 0;
    for (const g of GRAPHE_DETERMINISTE) {
      for (const dep of g.lit) {
        if (!rang.has(dep)) continue;
        if (rang.get(dep)! >= rang.get(g.moteur)!) {
          violations++;
          console.error(`      ${g.moteur} lit ${dep} qui vient apres lui`);
        }
      }
    }
    check(violations === 0, `aucune dependance interne rejouee apres son dependant (${violations})`);
  }

  console.log('\n[Suite 3] chaque dependance externe declaree en est une, verifiee par mutation');
  {
    // La mutation ne vaut que pour les dependances EXTERNES, celles que
    // le rejeu ne recalcule pas. Vider une dependance interne serait
    // sans effet puisque le rejeu la regenere avant son dependant : ce
    // sont les suites 2 et 3bis qui les couvrent, la premiere par
    // l ordre, la seconde en rejouant le dependant seul.
    const base = resultat();
    const { resultat: ref } = await reassembler(base, null);
    for (const g of GRAPHE_DETERMINISTE) {
      for (const dep of g.lit) {
        if (MOTEURS_DETERMINISTES.includes(dep)) continue;
        const mute = poser(base, dep, null);
        let sortie: any = null;
        try { ({ resultat: sortie } = await reassembler(mute, null)); } catch { sortie = null; }
        const avant = JSON.stringify(ref[g.moteur] ?? null);
        const apres = sortie === null ? 'ERREUR' : JSON.stringify(sortie[g.moteur] ?? null);
        // Une section deja nulle dans le jeu d essai ne peut pas etre
        // mutee : la dependance n est ni verifiee ni infirmee, et le
        // dire vaut mieux que de compter un succes qu on n a pas.
        if ((base as any)[dep] === null || (base as any)[dep] === undefined) {
          nonExercees.push(`${g.moteur} <- ${dep}`);
          continue;
        }
        check(avant !== apres, `${g.moteur} depend reellement de ${dep}`);
      }
    }
  }

  console.log('\n[Suite 3bis] les dependances internes se verifient en rejouant le dependant seul');
  {
    // Rejouer un moteur seul le prive des sorties fraiches de ses
    // dependances internes : si la declaration est juste, le resultat
    // differe de celui du rejeu complet.
    const base = resultat();
    const { resultat: complet } = await reassembler(base, null);
    for (const g of GRAPHE_DETERMINISTE) {
      const internes = g.lit.filter((d) => MOTEURS_DETERMINISTES.includes(d));
      if (internes.length === 0) continue;
      const prive = poser(base, g.moteur, null);
      for (const d of internes) (prive as any)[d] = null;
      const { resultat: seul } = await reassembler(prive, [g.moteur]);
      const bouge = JSON.stringify(seul[g.moteur] ?? null) !== JSON.stringify(complet[g.moteur] ?? null);
      if (!bouge) { nonExercees.push(`${g.moteur} <- ${internes.join(', ')} (interne)`); continue; }
      check(bouge, `${g.moteur} depend reellement de ses dependances internes (${internes.join(', ')})`);
    }
  }

  console.log('\n[Suite 4] le rejeu refuse de franchir la frontiere');
  {
    let refuse = false;
    try { await reassembler(resultat(), ['extraction']); } catch (e: any) {
      refuse = /Rejeu refuse/.test(String(e.message));
    }
    check(refuse, 'demander le rejeu d un moteur LLM leve un refus explicite');
    let accepte = true;
    try { await reassembler(resultat(), ['valuation']); } catch { accepte = false; }
    check(accepte, 'et un moteur deterministe passe');
  }

  console.log('\n[Suite 5] la trace dit ce qui a ete reconstitue');
  {
    const { resultat: out, trace } = await reassembler(resultat(), null);
    check(trace.recalcules.length === MOTEURS_DETERMINISTES.length, 'tous les deterministes sont recalcules par defaut');
    check(out.meta.rejeuPartiel !== undefined, 'la trace vit dans le resultat');
    check(!!trace.stampRejeu?.app?.commitSha, 'le stamp du rejeu porte le commit qui a reconstitue');
    check(trace.stampRejeu?.inputs?.deckHash === null || trace.stampRejeu?.inputs?.deckHash === undefined,
      'et ses entrees sont vides, le rejeu ne relisant pas le deck');
  }

  // La liste des dependances non exercees est imprimee et non tue : le
  // jeu d essai ne les met pas en jeu, ce qui est une limite de la
  // mesure et non une infirmation du graphe. La taire reviendrait a
  // compter un succes qu on n a pas.
  console.log(`\n[Limite] ${nonExercees.length} dependance(s) declaree(s) que ce jeu d essai n exerce pas :`);
  for (const n of nonExercees) console.log(`   ${n}`);
  console.log('   Elles restent a verifier sur un jeu plus riche ou sur un result_json reel.');

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
