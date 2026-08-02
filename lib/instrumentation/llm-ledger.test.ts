// ============================================================
// Tests deterministes du registre des appels au modele
// ------------------------------------------------------------
// Ce que ces tests prouvent : un appel au modele est enregistre sans
// qu aucun site d appel n ait rien a transmettre, la portee est le run
// et non un etat global, un echec ne disparait pas du registre, et un
// registre muet en fin de run se detecte.
//
// Le defaut ferme : sur quarante-quatre sites d appel au modele,
// quatorze deposaient une mesure et trente n en deposaient aucune.
// addCall commence par if (!sink) return et measure est optionnel sur
// les onze signatures qui l acceptent : un moteur est mesure si et
// seulement si quelqu un a pense a lui passer un collecteur. La
// discipline a tenu onze fois et cede trente fois en six briefs.
//
// C est la meme forme que le FetcherOpts de la grappe 5, dont on avait
// etabli qu il ne tenait pas. La solution est celle qui a marche la :
// une collecte a portee de run alimentee depuis le point de passage
// unique, getClient, par lequel passent aussi bien les trois helpers
// exportes que le callClaudeMultiDocs local du DD technique.
// ============================================================

import {
  withLlmLedger,
  recordLlmCall,
  readLlmLedger,
  ledgerIsSilent,
  ledgerIsOpen,
} from './llm-ledger';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const appel = (over: Partial<Parameters<typeof recordLlmCall>[0]> = {}) => ({
  model: 'claude-sonnet-4-6', durationMs: 1200, inputTokens: 900,
  outputTokens: 400, maxTokens: 4000, failed: false, ...over,
});

(async () => {
  // ============================================================
  console.log('\n[Suite 1] la portee est le run');
  // ============================================================

  {
    await withLlmLedger(async () => {
      recordLlmCall(appel());
      check(readLlmLedger().totalCalls === 1, 'premier run : un appel');
    });
    await withLlmLedger(async () => {
      check(readLlmLedger().totalCalls === 0, 'second run : registre vierge, sans remise a zero explicite');
    });
  }

  {
    // Deux runs concurrents ne se voient pas. Sur un plafond de trois
    // pipelines simultanes par organisation, ce n est pas theorique.
    const [a, b] = await Promise.all([
      withLlmLedger(async () => {
        recordLlmCall(appel({ model: 'A' }));
        await new Promise((r) => setTimeout(r, 20));
        recordLlmCall(appel({ model: 'A' }));
        return readLlmLedger();
      }),
      withLlmLedger(async () => {
        await new Promise((r) => setTimeout(r, 10));
        recordLlmCall(appel({ model: 'B' }));
        return readLlmLedger();
      }),
    ]);
    check(a.totalCalls === 2 && b.totalCalls === 1, `A voit 2 appels, B en voit 1 (${a.totalCalls}, ${b.totalCalls})`);
    check(Object.keys(a.byModel).join() === 'A', 'aucune fuite de B vers A');
    check(Object.keys(b.byModel).join() === 'B', 'aucune fuite de A vers B');
  }

  {
    check(ledgerIsOpen() === false, 'hors run, aucune portee ouverte');
    recordLlmCall(appel());
    check(readLlmLedger().totalCalls === 0, 'hors run, ecriture sans effet et sans erreur');
  }

  // ============================================================
  console.log('\n[Suite 2] un appel hors collecte se voit');
  // ============================================================

  {
    // Exigence du brief 27, sur le modele de harvestIsSilent. Un
    // pipeline appelle forcement le modele : un registre muet en fin
    // de run signale une instrumentation debranchee, ce qui est
    // exactement la faute corrigee.
    await withLlmLedger(async () => {
      check(ledgerIsSilent() === true, 'run ouvert et registre vide : silence detecte');
      recordLlmCall(appel());
      check(ledgerIsSilent() === false, 'des le premier appel, plus de silence');
    });
    check(ledgerIsSilent() === false, 'hors run, aucun silence a signaler');
  }

  // ============================================================
  console.log('\n[Suite 3] un echec ne disparait pas du registre');
  // ============================================================

  {
    // L ancienne mesure par addCall n etait appelee qu apres un retour
    // reussi : un appel qui levait sortait du compte, et le run
    // paraissait moins couteux qu il ne l avait ete.
    await withLlmLedger(async () => {
      recordLlmCall(appel());
      recordLlmCall(appel({ failed: true, inputTokens: 0, outputTokens: 0, error: 'overloaded_error' }));
      const l = readLlmLedger();
      check(l.totalCalls === 2, 'les deux appels comptent');
      check(l.failedCalls === 1, 'un echec compte comme echec');
      check(l.calls[1].error === 'overloaded_error', 'le message d erreur est conserve');
      check(l.totalOutputTokens === 400, 'un echec n ajoute aucun token');
    });
  }

  // ============================================================
  console.log('\n[Suite 4] agregats');
  // ============================================================

  {
    await withLlmLedger(async () => {
      recordLlmCall(appel({ model: 'claude-sonnet-4-6', durationMs: 1000, inputTokens: 100, outputTokens: 50 }));
      recordLlmCall(appel({ model: 'claude-sonnet-4-6', durationMs: 2000, inputTokens: 200, outputTokens: 80 }));
      recordLlmCall(appel({ model: 'claude-haiku-4-5-20251001', durationMs: 300, inputTokens: 50, outputTokens: 20 }));
      const l = readLlmLedger();
      check(l.totalCalls === 3, 'trois appels');
      check(l.totalDurationMs === 3300, `duree cumulee 3300 (obtenu ${l.totalDurationMs})`);
      check(l.totalInputTokens === 350 && l.totalOutputTokens === 150, 'tokens cumules');
      check(l.byModel['claude-sonnet-4-6'] === 2, 'deux appels sur le modele principal');
      check(l.byModel['claude-haiku-4-5-20251001'] === 1, 'un appel sur le modele rapide');
    });
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
