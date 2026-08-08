// ============================================================
// LE DOCUMENT QUE L EXPORT IMPRIME
// ------------------------------------------------------------
// L assemblage du document PDF vivait dans la route, en litteral de
// gabarit, et il n existait donc qu a l endroit ou il s execute. Un
// instrument qui voulait verifier a quoi ressemble la note imprimee
// n avait que deux choix : lire la note a l ecran, qui n est pas ce
// document, ou recopier le gabarit, qui est une seconde ecriture de la
// meme hypothese.
//
// Les deux ont ete pris, et les deux ont manque le meme defaut. Le
// 8 aout 2026, le repere imprime sortait en Times alors que l ecran le
// rend en Inter : `--sans` descend de `--font-sans`, que next/font pose
// sur une classe de `<html>` que ce document ne porte pas, si bien que
// le jeton entier devenait invalide et que chaque `font-family:
// var(--sans)` de la note etait ignore a l impression. La sonde de
// pagination comparait pourtant cinq axes du repere et rendait
// « 5/5 axes identiques » : elle lisait le repere dans la page vivante,
// ou les variables de next/font existent, c est-a-dire la ou la valeur
// est declaree et non la ou elle est decidee.
//
// L assemblage vit donc ici, en un seul endroit, pour que la route
// l execute et qu un instrument puisse le reconstituer a l octet pres
// sans le reecrire.
// ============================================================

/**
 * Le CSS que le client envoie a la route, collecte sur les feuilles de la
 * page.
 *
 * IL SE LIT SUR LE NOEUD ET NON SUR LES REGLES, ET CE N EST PAS UN DETAIL
 * DE FORME. La serialisation par `cssText` detruit toute propriete
 * raccourcie qui contient un `var()` des lors qu une longhand la reprend
 * dans la meme regle : le moteur ne sait pas reconstituer le raccourci et
 * rend des longhands a valeur vide. Le releve du 8 aout 2026 en compte
 * cent cinquante et une sur treize regles, dont le cartouche de verdict
 * de la couverture, qui perdait ainsi ses filets haut, droit et bas sur
 * la premiere page du PDF. Le texte du `<style>` porte la regle telle
 * qu elle a ete ecrite et ne perd rien.
 *
 * Le repli sur `cssText` reste, pour les feuilles dont le noeud ne porte
 * pas son texte, et il vaut mieux qu une feuille manquante.
 *
 * Cette fonction vivait en trois exemplaires, dans le bouton d export de
 * la note, dans celui du pack IC et dans la sonde de pagination. Trois
 * ecritures de la meme hypothese ne produisent aucun desaccord : elles
 * partagent leurs defauts et les corriger une fois n en corrige aucune.
 */
export function collecterFeuillesDeStyle(doc: Document): string {
  const morceaux: string[] = [];
  for (const feuille of Array.from(doc.styleSheets)) {
    let regles: CSSRuleList | null = null;
    try {
      regles = feuille.cssRules;
    } catch {
      // Feuille distante soumise a CORS : illisible, et c est sans
      // consequence puisque la route recharge les fontes elle-meme.
      continue;
    }
    if (!regles) continue;
    const noeud = feuille.ownerNode as (HTMLElement | null);
    const texte = noeud && noeud.textContent ? noeud.textContent : '';
    if (texte.trim()) {
      morceaux.push(texte);
      continue;
    }
    for (let i = 0; i < regles.length; i++) morceaux.push(regles[i].cssText);
  }
  return morceaux.join('\n');
}

export type EntreeDocumentExport = {
  html: string;
  css?: string;
  title: string;
};

/**
 * La feuille de base du document imprime.
 *
 * Elle precede le CSS de la note, qui peut donc tout redefinir : les
 * composants choisissent leur fonte, et c est voulu.
 */
export const FEUILLE_BASE_EXPORT = `
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      /* L ENCRE DESCEND DU JETON DE LA NOTE, avec le litteral en repli.
         Elle valait #1a1a1a en dur, donc tout ce qui herite au lieu de
         poser sa couleur sortait a une encre que la note ne connait pas :
         cinquante-deux elements au releve du 8 aout 2026. L ecart est
         imperceptible et ce n est pas la question : une valeur recopiee
         depuis une autre finit par en diverger, et rien ici ne reliait
         les deux. */
      color: var(--ink, #1a1a1a);
      font-family: 'Source Serif 4', 'Charter', 'Cambria', Georgia, serif;
      font-size: 11pt;
      line-height: 1.55;
      -webkit-font-feature-settings: "liga", "kern";
      font-feature-settings: "liga", "kern";
    }
    /* PAS DE REGLE DE FAMILLE PAR ELEMENT, ET LA RAISON MERITE D ETRE
       ECRITE PARCE QUE LA REGLE RETIREE SEMBLAIT PRUDENTE.
       Elle nommait « body, p, li, td, th, div, span, h1..h6, blockquote,
       cite » et leur imposait le serif, au motif de garantir une fonte
       Unicode-safe aux elements « qui auraient leur propre font-family
       heritee du CSS injecte ». Elle ne pouvait pas faire cela : un
       selecteur d element perd contre la moindre classe, donc les
       elements qui posent leur famille lui echappaient. Ce qu elle
       atteignait, c etaient exactement les autres, ceux qui HERITENT
       d un ancetre, et elle cassait leur heritage. Le releve du 8 aout
       2026 en compte cinquante-cinq, dont la ligne de meta du dossier,
       en sans a l ecran et en serif sur le papier.
       Le corps porte la meme chaine de fontes et l heritage la propage
       a tout ce qui ne choisit pas, ce qui est le comportement voulu et
       ce que la regle empechait. */
    /* Eviter les coupures dans les blocs critiques */
    .note-section, .note-block, .reco-card, .benchmark-block,
    h1, h2, h3 { break-inside: avoid; page-break-inside: avoid; }
    /* Eviter coupures sur les blocs cartographie risques + chantiers
       structuration (page 3-4 du PDF Platypus avait risques financiers
       coupes en deux). */
    .risk-map, .risk-axis, .structuring-plan, .structuring-axis,
    .pattern-card, .signal-card, .dimension-card { break-inside: avoid; page-break-inside: avoid; }
`;

export const LIEN_FONTES_EXPORT =
  '<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;'
  + '0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Inter:wght@400;500;600;700'
  + '&display=swap" rel="stylesheet">';

export function echapperHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Le document complet, tel que Chromium le recoit avant d imprimer. */
export function assemblerDocumentExport(e: EntreeDocumentExport): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${echapperHtml(e.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${LIEN_FONTES_EXPORT}
  <style>
${FEUILLE_BASE_EXPORT}
    /* CSS supplementaire injecte par le client (styles de la note) */
    ${e.css || ''}
  </style>
</head>
<body>
  ${e.html}
</body>
</html>`;
}
