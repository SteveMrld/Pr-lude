// ============================================================
// Tests deterministes de la portee d un tag de source
// ------------------------------------------------------------
// Ce que ces tests prouvent : une affirmation suivie de son tag de
// source n est pas signalee comme non sourcee, quelle que soit la
// longueur du tag, et une affirmation qui n en porte pas l est.
//
// Le defaut ferme est du run early stage du 4 aout 2026, dossier gele.
// La prose du moteur de coherence financiere y ecrit un montant en
// dollars suivi de son tag web, le tag ouvre soixante caracteres apres
// le montant et ferme cent treize apres lui, et la fenetre de
// quatre-vingts caracteres coupait le tag avant son crochet fermant.
// Le motif exigeant ce crochet, un montant correctement source
// ressortait signale comme non source, en premiere page de la note.
//
// Les textes des suites 1 et 2 sont copies du run persiste et non
// rediges pour le test : une fixture ecrite dans la meme hypothese que
// le code mesure leur accord et non la justesse.
//
// Execution : npx tsx lib/engines/assertion-validator-tag.test.ts
// ============================================================

import {
  finDeSegment,
  tagEnglobant,
  porteUnTagDeSource,
  findCurrencyMismatch,
  findInventedDates,
  findUnknownNames,
} from './assertion-validator';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Copie du run a5e69c94, financialCoherence.tests.crosseHockeySuspecte.evidence.
const PHRASE_DU_RUN =
  "À titre de comparaison, la médiane de croissance des SaaS publics à scale "
  + "($100M+ ARR) était de 12% en 2023 et projetée à 29% pour 2024 "
  + "[web : benchmarkit.ai, 2024 SaaS Performance Metrics]. "
  + "Braincube projette une croissance 1.5x à 3.5x supérieure à cette médiane.";

console.log('\n[Suite 1] le tag du run est vu, quelle que soit sa longueur');
{
  const idx = PHRASE_DU_RUN.indexOf('$');
  // La mesure qui a etabli le defaut : le tag ferme au-dela de la
  // fenetre que le code appliquait.
  const ouverture = PHRASE_DU_RUN.indexOf('[web', idx) - idx;
  const fermeture = PHRASE_DU_RUN.indexOf(']', idx) - idx;
  check(ouverture < 80 && fermeture > 80,
    `le tag ouvre a ${ouverture} et ferme a ${fermeture}, donc a cheval sur l ancienne fenetre`);
  check(porteUnTagDeSource(PHRASE_DU_RUN, idx), 'le montant est reconnu comme source');
  const w = findCurrencyMismatch(PHRASE_DU_RUN, 'EUR', 'test');
  check(w.length === 0, `aucun signalement de devise sur la phrase du run (${w.length})`);
}

console.log('\n[Suite 2] ce qui n est pas source reste signale');
{
  // Meme phrase, tag retire. Le verrou doit voir la faute quand on la
  // lui donne, sans quoi il est vert pour la mauvaise raison.
  const sansTag = PHRASE_DU_RUN.replace(/\[web[^\]]*\]/, '');
  const w = findCurrencyMismatch(sansTag, 'EUR', 'test');
  check(w.length === 1, `le meme montant sans tag est signale (${w.length})`);
}
{
  // Un tag qui gouverne la phrase suivante ne couvre pas celle-ci.
  const t = "La marge brute atteint $12M sur l exercice. "
    + "La mediane du secteur est de 68% [web : benchmarkit.ai, 2024].";
  const w = findCurrencyMismatch(t, 'EUR', 'test');
  check(w.length === 1, 'un tag de la phrase suivante ne couvre pas la precedente');
}

console.log('\n[Suite 3] ce qui termine un segment, et ce qui n en termine pas');
{
  const t = "un montant de $12M [web : benchmarkit.ai, 2024]. Suite.";
  check(finDeSegment(t, 0) === t.indexOf('. Suite'),
    'le point d un nom de domaine dans un tag ne termine pas le segment');
}
{
  const t = "croissance de 12.5% puis $8M [web : source]. Suite.";
  check(finDeSegment(t, 0) === t.indexOf('. Suite'),
    'une decimale ne termine pas le segment');
}
{
  const t = "les SaaS a scale ($100M+ ARR) etaient a 12% [web : x]. Suite.";
  check(finDeSegment(t, 0) === t.indexOf('. Suite'),
    'une parenthese fermante ne termine pas le segment');
}
{
  const t = "premier segment ; second segment [web : x].";
  check(finDeSegment(t, 0) === t.indexOf(' ;') + 1,
    'un point-virgule termine le segment');
  check(!porteUnTagDeSource(t, 0),
    'et un tag du segment suivant ne couvre pas le premier');
}
{
  const t = "une phrase sans ponctuation forte ni tag";
  check(finDeSegment(t, 0) === t.length, 'a defaut de ponctuation, le segment va jusqu au bout');
}

console.log('\n[Suite 4] la famille de tags est celle du controle, et pas une seule');
{
  // Une annee tagguee [pitch] est declaree lue dans le document, ce qui
  // est la reponse attendue par ce controle.
  const t = "Le plan porte jusqu en 2035 [pitch], ce qui depasse l horizon habituel.";
  const w = findInventedDates(t, new Set([2024]), 'test');
  check(w.length === 0, 'une annee tagguee pitch n est pas signalee');
}
{
  // Le meme tag ne couvre pas un montant, puisque ce qu on lui reproche
  // serait justement d etre absent du pitch.
  const t = "Le ticket ressort a $12M [pitch] sur cette operation.";
  const w = findCurrencyMismatch(t, 'EUR', 'test');
  check(w.length === 1, 'un montant tagge pitch reste signale');
}

console.log('\n[Suite 5] ce qui est ecrit dans un tag est le nom de la source');
{
  // Copie du run 5eb2ee0a, market.marketSizing.sam.methodology, ou le
  // nom flagge n existe que dans le tag qui le declare.
  const t = "Le nombre d acheteurs est estime a 4 millions "
    + "[web : Points de Vente, oct. 2024], taux de penetration applique ensuite.";
  const idx = t.indexOf('Points');
  check(tagEnglobant(t, idx) === '[web : Points de Vente, oct. 2024]',
    'la position dans le tag rend le tag qui l englobe');
  check(porteUnTagDeSource(t, idx), 'et elle est donc source');
  const w = findUnknownNames(t, new Set(['acheteurs']), 'test');
  check(w.length === 0, `aucun nom propre signale dans le tag (${w.length})`);
}
{
  const t = "Le parcours est documente [web : Viadeo]. Il co-fonde ensuite Kolibri.";
  check(tagEnglobant(t, t.indexOf('Viadeo')) === '[web : Viadeo]',
    'le nom lu dans son propre tag est reconnu comme designation de source');
  check(tagEnglobant(t, t.indexOf('Kolibri')) === null,
    'et un nom ecrit apres la fermeture du tag ne l est pas');
  const w = findUnknownNames(t, new Set(['parcours']), 'test');
  check(w.some((x) => /Kolibri/.test(x.message)),
    'le nom hors tag du segment suivant reste signale');
  check(!w.some((x) => /Viadeo/.test(x.message)),
    'et le nom du tag ne l est pas');
}
{
  const t = "une phrase sans aucun crochet";
  check(tagEnglobant(t, 5) === null, 'sans crochet, aucun tag englobant');
  check(tagEnglobant("[web : x] du texte apres", 15) === null,
    'apres la fermeture, aucun tag englobant');
  check(tagEnglobant("du texte avant [web : x]", 3) === null,
    'avant l ouverture non plus');
  // La lecture est structurelle, la decision est de famille, et les deux
  // ne vivent pas au meme endroit : `tagEnglobant` rend le groupe de
  // crochets quel qu il soit, et « c est source » se tranche a un seul
  // endroit, celui qui connait les familles.
  const q = "un [libelle quelconque] du texte";
  check(tagEnglobant(q, 8) === '[libelle quelconque]',
    'un crochet qui n ouvre pas un tag de source est rendu tel quel');
  check(!porteUnTagDeSource(q, 8),
    'et il ne vaut pas declaration de source');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
