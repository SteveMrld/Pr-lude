// ============================================================
// Tests deterministes de l insert tolerant a une colonne inconnue
// ------------------------------------------------------------
// Ce que ces tests prouvent : l insert retire les colonnes que le
// schema ne connait pas encore, il journalise chacune, il ne touche
// pas aux erreurs metier, et il refuse de tolerer une divergence trop
// large.
//
// Le defaut ferme : en deploiement continu le code precede
// regulierement le schema, et PostgREST rejette l insert entier sur
// une colonne inconnue. Cas mesure le 2 aout 2026 :
// createPendingAnalysis ecrivait as_of_source avant que la migration
// ne cree la colonne, l insert echouait, et la ligne d analyse
// n existait qu en fin de pipeline par le chemin de secours, sans
// as_of, sans frozen, sans started_at. Pendant les 625 secondes du
// run, aucune reprise apres coupure SSE n etait possible, aucune
// progression n etait ecrite, et le balayage des mort-nees n avait
// rien a balayer.
//
// L exigence qui accompagne la tolerance compte autant qu elle : une
// ligne amputee en silence serait pire que l echec qu elle remplace.
// ============================================================

import { insertTolerant, extractUnknownColumn } from './analysis-store';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/**
 * Faux client PostgREST. Rejette toute colonne hors de sa liste
 * connue, avec le message exact que rend Supabase, puis accepte.
 */
function fakeClient(colonnesConnues: string[], opts: { erreurMetier?: string } = {}) {
  const tentatives: Array<Record<string, any>> = [];
  return {
    tentatives,
    from() {
      return {
        insert(payload: Record<string, any>) {
          tentatives.push({ ...payload });
          return {
            select() {
              return {
                async single() {
                  if (opts.erreurMetier) {
                    return { data: null, error: { message: opts.erreurMetier } };
                  }
                  const inconnue = Object.keys(payload).find((c) => !colonnesConnues.includes(c));
                  if (inconnue) {
                    return {
                      data: null,
                      error: { message: `column analyses.${inconnue} does not exist` },
                    };
                  }
                  return { data: { id: 'ok-id' }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

// Le harnais du depot est CJS : pas de top-level await, tout le
// corps vit dans une IIFE asynchrone, comme sectoral-injection.test.ts.
(async () => {
  // ============================================================
  console.log('\n[Suite 1] extraction du nom de colonne depuis le message');
  // ============================================================

  {
    check(extractUnknownColumn('column analyses.as_of_source does not exist') === 'as_of_source', 'forme prefixee par la relation');
    check(extractUnknownColumn('column as_of_source does not exist') === 'as_of_source', 'forme nue');
    check(extractUnknownColumn("Could not find the 'as_of_source' column of 'analyses'") === 'as_of_source', 'forme PostgREST a guillemets');
    check(extractUnknownColumn('duplicate key value violates unique constraint') === null, 'erreur metier : aucun nom extrait');
    check(extractUnknownColumn(null) === null, 'message null');
    check(extractUnknownColumn('') === null, 'message vide');
  }

  // ============================================================
  console.log('\n[Suite 2] le cas mesure : une colonne en retard de migration');
  // ============================================================

  {
    const connues = ['user_id', 'company_name', 'status', 'as_of'];
    const client = fakeClient(connues);
    const r = await insertTolerant(client, 'analyses', {
      user_id: 'u', company_name: 'X', status: 'running', as_of: '2026-08-02',
      as_of_source: 'deck-receipt',
    });

    check(r.error === null, 'l insert finit par passer');
    check((r.data as any)?.id === 'ok-id', 'la ligne est creee');
    check(r.droppedColumns.length === 1, `une seule colonne retiree (obtenu ${r.droppedColumns.length})`);
    check(r.droppedColumns[0] === 'as_of_source', 'et c est la colonne inconnue');
    check(client.tentatives.length === 2, `deux tentatives, pas plus (obtenu ${client.tentatives.length})`);
    check(!('as_of_source' in client.tentatives[1]), 'la seconde tentative ne porte plus la colonne fautive');
    check(client.tentatives[1].as_of === '2026-08-02', 'les autres colonnes sont preservees');
  }

  {
    // Cas nominal : rien a retirer, une seule tentative, journal vide.
    const client = fakeClient(['user_id', 'status']);
    const r = await insertTolerant(client, 'analyses', { user_id: 'u', status: 'running' });
    check(r.error === null && r.droppedColumns.length === 0, 'schema a jour : aucune colonne retiree');
    check(client.tentatives.length === 1, 'une seule tentative');
  }

  // ============================================================
  console.log('\n[Suite 3] les erreurs metier ne sont jamais toleree');
  // ============================================================

  {
    // Une violation de contrainte, un refus RLS ou une erreur de type
    // doivent continuer d echouer : ce sont des erreurs legitimes et le
    // silence sur elles serait bien pire que sur une colonne manquante.
    const client = fakeClient(['user_id'], { erreurMetier: 'new row violates row-level security policy for table "analyses"' });
    const r = await insertTolerant(client, 'analyses', { user_id: 'u' });
    check(r.error !== null, 'l erreur RLS remonte');
    check(r.droppedColumns.length === 0, 'aucune colonne retiree sur une erreur metier');
    check(client.tentatives.length === 1, 'aucune re-tentative');
  }

  {
    const client = fakeClient(['user_id'], { erreurMetier: 'duplicate key value violates unique constraint "analyses_pkey"' });
    const r = await insertTolerant(client, 'analyses', { user_id: 'u' });
    check(r.error !== null && r.droppedColumns.length === 0, 'violation de contrainte : echec franc');
  }

  // ============================================================
  console.log('\n[Suite 4] la tolerance est bornee');
  // ============================================================

  {
    // Au-dela de quelques colonnes, ce n est plus une dette de migration
    // ponctuelle mais une divergence de schema, et il vaut mieux echouer
    // bruyamment que d ecrire une ligne vidée de sa substance.
    const client = fakeClient(['user_id']);
    const r = await insertTolerant(client, 'analyses', {
      user_id: 'u', a: 1, b: 2, c: 3, d: 4, e: 5, f: 6,
    });
    check(r.error !== null, 'divergence trop large : echec');
    check(r.data === null, 'aucune ligne ecrite');
    check(
      /divergence de schema/.test(String(r.error?.message)),
      'le motif nomme la divergence plutot qu une colonne',
    );
    check(
      String(r.error?.message).includes('a, b, c, d'),
      'et liste ce qui avait ete retire avant l abandon',
    );
  }

  // ============================================================
  console.log('\n[Suite 5] une colonne absente du payload n entraine aucune boucle');
  // ============================================================

  {
    // Message d erreur nommant une colonne que le payload ne porte pas :
    // retirer serait sans effet et la boucle tournerait pour rien. On
    // echoue au premier tour.
    const client = {
      tentatives: [] as any[],
      from() {
        return {
          insert(p: any) {
            this_tentatives.push(p);
            return { select: () => ({ single: async () => ({ data: null, error: { message: 'column analyses.colonne_fantome does not exist' } }) }) };
          },
        };
      },
    } as any;
    const this_tentatives: any[] = client.tentatives;
    const r = await insertTolerant(client, 'analyses', { user_id: 'u' });
    check(r.error !== null, 'echec immediat');
    check(r.droppedColumns.length === 0, 'aucune colonne retiree');
    check(this_tentatives.length === 1, 'une seule tentative, pas de boucle');
  }


  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
