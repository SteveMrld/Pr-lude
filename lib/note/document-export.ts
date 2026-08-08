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
      color: #1a1a1a;
      font-family: 'Source Serif 4', 'Charter', 'Cambria', Georgia, serif;
      font-size: 11pt;
      line-height: 1.55;
      -webkit-font-feature-settings: "liga", "kern";
      font-feature-settings: "liga", "kern";
    }
    /* Force la chaine de fontes complete pour les elements qui auraient
       leur propre font-family heritee du CSS injecte. Important : on
       prepend Source Serif 4 sur les chaines existantes pour garantir
       que le rendu serverless utilise une fonte Unicode-safe identique
       au rendu web. Le CSS de la note ci-dessous peut overrider, c est
       intentionnel (les composants choisissent leur fonte). */
    body, p, li, td, th, div, span, h1, h2, h3, h4, h5, h6, blockquote, cite {
      font-family: 'Source Serif 4', 'Charter', 'Cambria', Georgia, serif;
    }
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
