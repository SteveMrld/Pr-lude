// ============================================================
// Tests deterministes du comparatif de notes
// ------------------------------------------------------------
// Ce que ces tests prouvent : un champ calcule qui bouge sans que ses
// entrees bougent est une anomalie, le meme ecart avec une entree qui
// bouge ne l est pas, un changement de code retire toute anomalie, et
// un champ hors des deux listes est imprime et non tu.
//
// Le defaut constate dont ils naissent : trois incoherences entre deux
// notes du meme dossier, entre le 3 et le 6 aout 2026, toutes trouvees
// par un lecteur humain qui se souvenait du run precedent, aucune par un
// dispositif. Une note lue seule est toujours coherente avec elle-meme.
//
// Execution : npx tsx lib/controle/comparatif.test.ts
// ============================================================

import {
  comparerAnalyses,
  comparerLeCode,
  feuillesQuiDifferent,
} from './comparatif';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/**
 * Une note minimale, avec un stamp de la forme reelle.
 *
 * Le stamp porte les cinq sections que `fingerprintStamp` consomme, et
 * non un champ `enginesHash` tout fait. C est le point que la premiere
 * version du jeu d essai avait manque : elle inventait un champ que la
 * production n ecrit pas, donc elle mesurait l accord du comparatif avec
 * une hypothese sur la forme des donnees au lieu de la forme des
 * donnees. Le comparatif est sorti « empreinte absente » sur les
 * cinquante-quatre notes du corpus pendant que les tests etaient verts.
 *
 * `promptVersion` porte la variation : c est ce qui fait diverger
 * l empreinte de moteurs entre deux jeux d essai, et il faut qu une
 * valeur discriminante distingue les deux, sinon le test mesure leur
 * identite.
 */
function note(o: any = {}, engines = 'HASH-A'): any {
  return {
    meta: { versionStamp: {
      app: { commitSha: 'aaaaaaa', runtimeNode: 'v24', runtimePlatform: 'linux' },
      engines: { team: { model: 'm', temperature: 'api-default', systemPromptHashes: ['h'], promptVersion: engines, sourceFileHash: 'f' } },
      configs: { runMode: { hash: 'c1', value: {} } },
      inputs: { deckHash: 'd1' },
      models: { primary: 'm' },
      doctrineHash: 'doc',
    } },
    extraction: { companyName: 'Societe', sector: 'SaaS' },
    valuation: { ranges: [{ central: 100 }] },
    team: { prose: 'un texte' },
    ...o,
  };
}

console.log('\n[Suite 1] les feuilles qui different donnent une magnitude');
{
  check(feuillesQuiDifferent(1, 1).length === 0, 'deux scalaires egaux ne different pas');
  check(feuillesQuiDifferent({ a: 1 }, { a: 2 })[0] === 'a', 'le chemin nomme la feuille');
  check(feuillesQuiDifferent({ a: { b: 1 } }, { a: { b: 2 } })[0] === 'a.b', 'et il descend');
  check(feuillesQuiDifferent([1, 2], [1, 3])[0] === '[1]', 'l indice de tableau aussi');
  // Une longueur differente rend un ecart par element manquant : c est
  // le « de combien » et non un booleen.
  check(feuillesQuiDifferent([1], [1, 2, 3]).length === 2, 'un tableau rallonge rend deux ecarts');
  check(feuillesQuiDifferent(null, null).length === 0, 'deux absences ne different pas');
  check(feuillesQuiDifferent({ a: 1 }, { a: 1, b: 2 }).length === 1, 'une clef ajoutee est un ecart');
}

console.log('\n[Suite 2] un champ calcule qui bouge seul est une anomalie');
{
  // valuation est declare calcule dans GRAPHE_DETERMINISTE. Ses entrees
  // sont identiques ici, donc rien n explique son deplacement.
  const c = comparerAnalyses(note(), note({ valuation: { ranges: [{ central: 250 }] } }));
  check(c.code.memeCode === true, 'meme empreinte de moteurs, donc deux tirages du meme systeme');
  check(c.anomalies.length === 1, 'une anomalie');
  check(c.anomalies[0].champ === 'valuation', 'et c est la valorisation');
  check(c.anomalies[0].feuillesDifferentes === 1, 'une feuille en cause');
}

console.log('\n[Suite 3] la meme sortie avec une entree qui bouge n est pas une anomalie');
{
  // `valuation` lit `extraction`. Quand l extraction bouge aussi, le
  // deplacement est explique et le comparatif le nomme, plutot que de
  // le taire ou de l accuser.
  const c = comparerAnalyses(
    note(),
    note({ extraction: { companyName: 'Societe', sector: 'Fintech' }, valuation: { ranges: [{ central: 250 }] } }),
  );
  check(c.anomalies.length === 0, 'aucune anomalie');
  const v = c.ecarts.find((e) => e.champ === 'valuation')!;
  check(v.verdict === 'explique-par-entree', 'le verdict nomme la cause');
  check(v.entreesQuiOntBouge.includes('extraction'), 'et il nomme l entree qui a bouge');
}

console.log('\n[Suite 4] un changement de code retire toute anomalie');
{
  // C est la regle qui passe avant toutes les autres : deux runs a des
  // empreintes differentes ne sont pas deux tirages, et un ecart mesure
  // alors le diff et non la variance.
  const c = comparerAnalyses(note(), note({ valuation: { ranges: [{ central: 250 }] } }, 'HASH-B'));
  check(c.code.memeCode === false, 'les empreintes different');
  check(c.anomalies.length === 0, 'donc aucune anomalie n est prononcee');
  check(c.ecarts.find((e) => e.champ === 'valuation')!.verdict === 'explique-par-code',
    'l ecart est declare explique par le code, et non tu');
}

console.log('\n[Suite 5] l empreinte de moteurs prime sur le sha');
{
  // La discipline de conformite : un sha date le depot entier,
  // documentation comprise, et deux commits de prose ne changent pas ce
  // qui s execute. C est l empreinte qui dit si le code est le meme.
  const a = note();
  const b = note();
  b.meta.versionStamp.app.commitSha = 'zzzzzzz';
  // Le sha differe, l empreinte de moteurs non : c est le cas du commit
  // qui ne touche que `docs/`, et il ne doit pas faire lire un diff.
  const c = comparerLeCode(a, b);
  check(c.memeCode === true, 'sha different mais meme enginesHash : c est le meme code');
  check(/enginesHash/.test(c.motif), 'et le motif dit sur quoi le verdict repose');

  // Sans empreinte, le sha sert de repli et le motif l annonce, pour
  // que personne ne prenne l approximation pour la mesure.
  const sansA = { meta: { versionStamp: { app: { commitSha: 'aaaaaaa' } } } };
  const sansB = { meta: { versionStamp: { app: { commitSha: 'aaaaaaa' } } } };
  const r = comparerLeCode(sansA, sansB);
  check(r.memeCode === true, 'deux shas identiques suffisent a defaut d empreinte');
  check(/repli sur le sha/.test(r.motif), 'et le repli est declare comme tel');

  // Aucune empreinte du tout : le comparatif ne conclut a rien.
  const rien = comparerLeCode({}, {});
  check(rien.memeCode === false, 'sans empreinte, le code n est pas declare identique');
  const c2 = comparerAnalyses({ valuation: 1 }, { valuation: 2 });
  check(c2.anomalies.length === 0, 'et aucune anomalie ne se prononce sur un couple sans empreinte');
}

console.log('\n[Suite 6] un champ hors des deux listes est imprime, jamais tu');
{
  // Le defaut que cette suite ferme : `assertionAudit` n est ni dans le
  // graphe deterministe ni dans la liste des moteurs de modele. C est
  // pourtant lui dont le compte est passe de 90 a 123 sans que rien ne
  // le signale. Un comparatif qui le rangerait en silence du cote libre
  // donnerait l air de fermer un perimetre qu il ne couvre pas.
  const c = comparerAnalyses(
    note({ assertionAudit: { totalWarnings: 90 } }),
    note({ assertionAudit: { totalWarnings: 123 } }),
  );
  check(c.nonClasses.includes('assertionAudit'), 'assertionAudit sort en non-classe');
  const e = c.ecarts.find((x) => x.champ === 'assertionAudit')!;
  check(e.nature === 'non-classe', 'sa nature est nommee');
  check(e.verdict === 'non-classe', 'et son verdict ne tranche pas');
  check(c.anomalies.length === 0, 'il n est pas compte comme anomalie, faute de savoir ce qu il lit');
}

console.log('\n[Suite 7] une sortie de modele qui bouge ne fait pas de bruit');
{
  const c = comparerAnalyses(note(), note({ team: { prose: 'un autre texte' } }));
  const t = c.ecarts.find((e) => e.champ === 'team')!;
  check(t.nature === 'llm', 'team est une sortie de modele');
  check(t.verdict === 'libre', 'donc son deplacement est libre');
  check(c.anomalies.length === 0, 'et il ne remonte pas en anomalie');
}

console.log('\n[Suite 8] le delta signe se lit quand les deux valeurs sont des nombres');
{
  const c = comparerAnalyses({ score: 61 }, { score: 74 });
  const s = c.ecarts.find((e) => e.champ === 'score')!;
  check(s.delta === 13, 'le delta est rendu signe');
  const d = comparerAnalyses({ score: 74 }, { score: 61 });
  check(d.ecarts.find((e) => e.champ === 'score')!.delta === -13, 'et dans l autre sens');
}

console.log('\n[Suite 9] deux notes identiques ne rendent rien');
{
  const c = comparerAnalyses(note(), note());
  check(c.anomalies.length === 0, 'aucune anomalie');
  check(c.ecarts.every((e) => e.verdict === 'stable'), 'et tous les champs sont stables');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
