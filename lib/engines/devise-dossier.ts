// ============================================================
// DEVISE DU DOSSIER INSTRUIT
// ------------------------------------------------------------
// Lecture pure, sans dependance, extraite d assertion-validator le
// 5 aout 2026 pour une raison de couche et non de doctrine.
//
// La fonction vivait dans le validateur d assertions, qui importe la
// capture de sources, laquelle utilise AsyncLocalStorage. Le moteur de
// valorisation est atteint par InvestmentNoteView puis HomeClient, donc
// par le bundle client : lui faire importer le validateur pour lire une
// devise faisait entrer `async_hooks` dans le navigateur et cassait la
// compilation.
//
// La deplacer plutot que la recopier est le point. Deux lectures de la
// devise d un meme dossier ne se contrediraient pas bruyamment, elles se
// contrediraient en silence, chacune dans son moteur, et le partner
// lirait deux chiffres dont il croirait qu ils descendent de la meme
// lecture. C est exactement ce que lecture-montant a ferme pour les
// montants.
// ============================================================

import type { ExtractionOutput } from './types';

/**
 * Devise dans laquelle le dossier s exprime, lue sur les champs qui
 * portent des montants.
 *
 * `unknown` n est pas un echec de lecture, c est un etat : un dossier
 * peut ne porter aucun symbole, ou en porter autant de chaque sorte.
 * Le consommateur doit le traiter comme une absence et non comme un
 * euro par defaut, ce que le moteur de valorisation a fait en silence
 * jusqu au 5 aout 2026.
 */
export function detectPitchCurrency(extraction: ExtractionOutput): 'EUR' | 'USD' | 'unknown' {
  const texts = [
    extraction.fundraise?.amount || '',
    extraction.fundraise?.valuation || '',
    extraction.traction?.revenue || '',
    ...(extraction.traction?.metrics || []),
    extraction.rawSummary || '',
  ].join(' ').toLowerCase();

  const eurCount = (texts.match(/€|eur\b|euros?/g) || []).length;
  const usdCount = (texts.match(/\$|usd\b|us\$|dollars?/g) || []).length;

  if (eurCount > usdCount * 2) return 'EUR';
  if (usdCount > eurCount * 2) return 'USD';
  if (eurCount > 0 && eurCount >= usdCount) return 'EUR';
  if (usdCount > 0) return 'USD';
  return 'unknown';
}
