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
  debutDeSegment,
  tagEnglobant,
  tagNommeUneSourceExterne,
  positionsDeMontant,
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
  // Cette assertion a change, et l arbitrage est rendu ici plutot que
  // subi. Elle exigeait qu un montant tagge [pitch] reste signale, par
  // emprunt du raisonnement tenu sur les noms propres. Les deux
  // controles ne reprochent pas la meme chose : le controle des noms
  // reproche une absence des donnees extraites, que [pitch] contredit
  // sans la lever ; celui-ci reproche une devise etrangere sans
  // conversion ni provenance, et [pitch] y repond. Le releve sur le
  // corpus l a rendu visible en donnant douze alertes de la forme
  // « TAM declare = 25 Mds$ mondial [pitch] », ou il n y a rien a
  // convertir.
  const t = "Le ticket ressort a $12M [pitch] sur cette operation.";
  check(findCurrencyMismatch(t, 'EUR', 'test').length === 0,
    'un montant tagge pitch est declare lu dans le deck, dans ses unites');
  const u = "Le ticket ressort a $12M sur cette operation.";
  check(findCurrencyMismatch(u, 'EUR', 'test').length === 1,
    'le meme montant sans tag reste signale');
}
{
  // Et la difference de famille tient toujours, la ou elle a un sens.
  const t = "Le concurrent Kolibri [pitch] domine le segment sur ce perimetre.";
  check(findUnknownNames(t, new Set(['concurrent']), 'test')
    .some((x) => /Kolibri/.test(x.message)),
    'un nom propre tagge pitch reste a verifier');
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
  // Cette assertion a change, et elle a change dans l autre sens.
  // Elle exigeait d abord qu un crochet dont l en-tete n est pas un mot
  // de provenance connu ne vaille pas declaration de source. Elle avait
  // ete ecrite sur l intuition que les crochets de la prose se
  // repartissent en tags reconnus et en crochets quelconques. Le releve
  // des crochets sur trente-huit analyses persistees dit le contraire :
  // deux cent vingt-neuf en-tetes distincts, et la queue est faite de
  // noms de sources ecrits en clair, `[FMI WEO]`, `[Atomico SoET 2025]`,
  // `[base verifiee]`. Un crochet quelconque n existe pas dans ce
  // corpus. L assertion avait donc tort et non la mesure.
  const q = "un [libelle quelconque] du texte";
  check(tagEnglobant(q, 8) === '[libelle quelconque]',
    'un crochet est rendu tel quel, quel que soit son en-tete');
  check(porteUnTagDeSource(q, 8),
    'et une position a l interieur est une designation de source');
}

console.log('\n[Suite 6] un tag nomme une source des lors qu il ne nomme pas que le pitch');
{
  for (const t of ['[web : Crunchbase]', '[inference]', '[corpus]', '[FMI WEO]',
    '[Atomico SoET 2025]', '[base verifiee]', '[benchmark externe]',
    '[worldbank-gdp]', '[PitchBook Q1 2026]', '[moteur fragilite]']) {
    check(tagNommeUneSourceExterne(t), `${t} nomme une source exterieure`);
  }
  for (const t of ['[pitch]', '[pitch contexte]', '[pitch notes complementaires]',
    '[pitch non verifie]', '[]']) {
    check(!tagNommeUneSourceExterne(t), `${t} ne nomme que le document`);
  }
  // Une seule clause hors pitch suffit : le tag mixte declare bien une
  // lecture externe en plus de la lecture du deck.
  for (const t of ['[pitch + web : Viadeo]', '[pitch vs web : acteureco.fr]',
    '[pitch + inference]']) {
    check(tagNommeUneSourceExterne(t), `${t} declare aussi une lecture externe`);
  }
}
{
  // Copie du run 0d0ab2b3 : la prose imbrique les crochets, et la
  // declaration qui compte est la plus interieure.
  const t = "Udemy for Business est le comparable sectoriel le plus precis pour ce "
    + "dossier [pitch comparable au 30% Udemy instructeurs [inference]], meme canal.";
  check(porteUnTagDeSource(t, 0),
    'un tag imbrique dans un tag de pitch declare tout de meme la source');
  check(!findUnknownNames(t, new Set(['comparable']), 'test')
    .some((x) => /Udemy/.test(x.message)),
    'et le nom qu il couvre n est pas signale');
}
{
  // Et la consequence sur le point de passage unique : un montant source
  // par un tag hors inventaire n est plus signale.
  const t = "le tour ressort tres inferieur a la mediane de marche de $190m "
    + "pour le stade detecte (Series D+) [benchmark externe].";
  check(porteUnTagDeSource(t, t.indexOf('$190m')),
    'un montant tagge [benchmark externe] est source');
  check(findCurrencyMismatch(t, 'EUR', 'test').length === 0,
    'et il ne ressort plus en alerte de devise');
  const u = t.replace(' [benchmark externe]', '');
  check(findCurrencyMismatch(u, 'EUR', 'test').length === 1,
    'la ou le meme montant sans aucun tag reste signale');
}

console.log('\n[Suite 7] un symbole se lit avant le nombre comme apres, et une annee n est pas un montant');
{
  const t = "Le TAM 500 Mds$ 2025 est confirme par les sources web a perimetre comparable.";
  const p = positionsDeMontant(t, 'USD');
  check(p.length === 1, `un seul montant lu et non deux (${p.length})`);
  check(t.slice(p[0], p[0] + 8) === '500 Mds$',
    `le montant lu est la forme suffixee (${JSON.stringify(t.slice(p[0], p[0] + 8))})`);
}
{
  check(positionsDeMontant('mesure faite en $ 2025 sur le perimetre', 'USD').length === 0,
    'un symbole suivi d une annee nue ne rend aucun montant');
  check(positionsDeMontant('un ticket de $2025M sur le fonds', 'USD').length === 1,
    'mais la meme annee suivie d une magnitude est un montant');
  check(positionsDeMontant('la mediane de marche de $190m pour le stade', 'USD').length === 1,
    'la forme prefixee reste lue');
  const e = positionsDeMontant('un tour de 10 M€ leve en 2024', 'EUR');
  check(e.length === 1 && e[0] === 11, `la forme suffixee en euros aussi (${JSON.stringify(e)})`);
  check(positionsDeMontant('un tour de €10.7m leve en 2024', 'EUR').length === 1,
    'et la forme prefixee en euros');
}
{
  // La mention de conversion se cherche dans le segment, pas a une
  // distance. Les deux sens comptent, et le jeu d essai les exerce.
  const proche = "le tour vaut environ $12m sur ce perimetre.";
  check(findCurrencyMismatch(proche, 'EUR', 'test').length === 0,
    'une mention de conversion dans le segment desamorce');
  const loin = "le tour se compare a la mediane de marche des societes du meme stade, "
    + "soit une reference etablie sur un echantillon large et documente, de $12m.";
  check(findCurrencyMismatch(loin, 'EUR', 'test').length === 0,
    'meme a plus de quarante caracteres, des lors que le segment tient');
  const autrePhrase = "la conversion vaut environ deux pour un. Le tour ressort a $12m.";
  check(findCurrencyMismatch(autrePhrase, 'EUR', 'test').length === 1,
    'et une mention de la phrase precedente ne desamorce plus');
}
{
  // Le verrou voit-il la faute quand on la lui donne. Un controle qui ne
  // cherche rien est vert pour la mauvaise raison.
  check(findCurrencyMismatch("le tour ressort a $12m sur le perimetre.", 'EUR', 'test').length === 1,
    'un montant nu, sans tag ni conversion, est bien signale');
  check(debutDeSegment("premiere phrase. seconde phrase", 20) === 16,
    'le debut de segment est bien pris apres la ponctuation forte');
  check(debutDeSegment("un taux de 12.5% dans la phrase", 25) === 0,
    'et une decimale ne le deplace pas');
}


// ============================================================
// LA REFERENCE NE SE CONSTRUIT PAS SUR LA PROSE GENEREE
// ------------------------------------------------------------
// Defaut constate le 6 aout 2026 : le compte de noms propres du meme
// dossier passait de 44 a 99 entre deux runs au meme commit. La cause
// n etait pas le detecteur mais sa reference. `buildAllowedNames`
// parcourait toute l extraction en decoupant chaque chaine en mots, y
// compris `rawSummary`, un paragraphe que le modele reecrit a chaque
// run. La moitie des entrees autorisees, 51 pour cent sur les 54 notes
// du corpus, venaient de cette prose.
//
// C est un controle dont la reference est contaminee par ce qu il
// mesure : il ne pouvait pas rendre deux fois le meme verdict.
// ============================================================

console.log('\n[Suite prose] la reference exclut ce que le modele redige');
{
  const { buildAllowedNames: bAN, findUnknownNames: fUN } = require('./assertion-validator');

  const base: any = {
    companyName: 'Societe', sector: 'SaaS', subSector: 'plateforme',
    founders: [{ name: 'Rebecca Cathline', role: 'CEO', background: 'ex-Youboox' }],
    competitorsCited: [], traction: { metrics: [] }, fundraise: {},
  };
  // Le meme dossier, deux resumes differents : c est le cas reel, ou le
  // paragraphe est reecrit sans que le document bouge.
  const a = { ...base, rawSummary: 'Hello Planet propose des formations certifiantes et un accompagnement RSE.' };
  const b = { ...base, rawSummary: 'Hello Planet evolue vers une plateforme dediee a l engagement environnemental.' };

  const sa = bAN(a), sb = bAN(b);
  const differents = Array.from(sa).filter((x: any) => !sb.has(x)).length
    + Array.from(sb).filter((x: any) => !sa.has(x)).length;
  check(differents === 0,
    `deux resumes differents rendent la meme reference (${differents} entree(s) d ecart)`);

  // Et le fait releve, lui, continue d entrer : l exclusion porte sur
  // quatre champs nommes, pas sur la longueur.
  check(sa.has('cathline'), 'un fondateur nomme reste documente');
  check(sa.has('ex-youboox') || sa.has('youboox'), 'et son parcours aussi, qui est un fait releve');
  check(!sa.has('certifiantes'), 'un mot du resume n entre pas');

  // Le faux negatif ferme : un mot quelconque ne couvre plus un nom.
  // « certification » est documente, « Qualiopi » ne l est pas, et
  // l ancienne regle acceptait le couple sur le premier seul.
  const t = 'Le dossier revendique une Certification Qualiopi obtenue aupres de son organisme.';
  const avecCertif = bAN({ ...base, traction: { metrics: ['certification en cours'] } });
  check(fUN(t, avecCertif, 'champ').length === 1,
    'Certification Qualiopi ne passe plus parce que « certification » est documente');
  // Et la contrepartie : quand les deux mots sont documentes, le nom
  // passe. Sans cette moitie, le test passerait aussi si la regle
  // refusait tout.
  const lesDeux = bAN({ ...base, traction: { metrics: ['certification qualiopi en cours'] } });
  check(fUN(t, lesDeux, 'champ').length === 0,
    'et il passe des que les deux mots le sont');

  // Un sigle reste couvert, sinon le resserrage remplacerait une cecite
  // par du bruit : « API OpenAI » ne nomme personne d autre qu OpenAI.
  check(fUN('Le produit expose une API OpenAI documentee et publique aujourd hui.', bAN(base), 'champ').length === 0,
    'un compose nom connu plus sigle reste couvert');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
