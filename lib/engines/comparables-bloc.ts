// ============================================================
// LE BLOC DE COMPARABLES SERVI A UN MOTEUR
// ------------------------------------------------------------
// Point d entree unique des trois moteurs qui citent des comparables :
// Pattern Matching, Aveuglement et Contrarien. Ils appelaient chacun
// `buildVerifiedComparablesBlock(detectAssetClass(extraction), ...)`,
// donc chacun rejouait la classification par mots-clefs que la matrice
// de pertinence avait deja tranchee.
//
// Le changement n ajoute aucun parametre aux trois moteurs, et c est
// deliberé. Le mecanisme qui a perdu `opts?.emit` et `measure` etait un
// parametre a se souvenir de passer, applique onze fois sur
// quarante-quatre sites ; ici il n y a rien a passer, la classe se
// derive de l extraction que les trois moteurs recoivent deja. Ce qui
// reste est un changement d import, verrouille par un balayage de
// sources dans comparables-class.test.ts.
//
// La grossierete est declaree au modele et non tue. Un seau emprunte a
// une classe voisine reste une approximation, et le prompt le dit, avec
// la raison de l arbitrage. Un comparable approximatif annonce comme
// tel est utilisable ; le meme comparable presente comme propre au
// dossier est une affirmation fausse.
// ============================================================

import { buildVerifiedComparablesBlock } from '../data/verified-comparables';
import { choisirSeauComparables } from './comparables-class';
import { computeRelevanceMatrix } from './relevance-matrix';
import { normalizeAssetClass } from '../data/sector-benchmarks';
import type { ExtractionOutput } from './types';
import type { DossierStade } from '../data/verified-comparables';

/**
 * La classe arbitree, recalculee depuis l extraction par le meme chemin
 * que la route : concatenation secteur plus sous-secteur, normalisation,
 * puis arbitrage de la matrice contre la chaine de production detectee.
 *
 * Recalculer plutot que recevoir est ce qui evite le parametre. Le
 * calcul est deterministe et purement textuel, donc il rend la meme
 * valeur que la route sur la meme extraction.
 */
function classeArbitreeDe(extraction: ExtractionOutput | null | undefined): string | null {
  if (!extraction) return null;
  const x = extraction as any;
  const indice = normalizeAssetClass(
    `${x.sector || ''} ${x.subSector || ''}`.trim() || x.sector,
  );
  try {
    return computeRelevanceMatrix(extraction, indice).assetClass ?? null;
  } catch {
    return null;
  }
}

/**
 * Le bloc de comparables d un dossier, ou la declaration de sa
 * non-production.
 */
export function blocComparables(
  extraction: ExtractionOutput | null | undefined,
  dossierStade: DossierStade = 'startup',
): string {
  const choix = choisirSeauComparables(extraction, classeArbitreeDe(extraction));

  if (choix.seau === null) {
    // Ni silence ni remplissage. Avant ce module, ce cas injectait les
    // cent vingt-quatre fiches de la base, ce qui a l air d une reponse
    // riche et n est qu une absence de choix.
    return [
      '# BASE DE CHIFFRES VERIFIES DES COMPARABLES : AUCUNE SELECTION',
      '',
      `Aucun seau de comparables n a pu etre choisi pour ce dossier. Motif : ${choix.motif}.`,
      '',
      'Tu ne disposes donc d aucune base de chiffres verifies sur ce dossier. En consequence, tu ne cites AUCUN chiffre precis sur un comparable, quel qu il soit. Tu peux nommer une societe comme repere qualitatif, sans montant, sans valorisation et sans date de tour. Un chiffre invente sur un comparable connu detruit la credibilite de la note devant un partner qui a co-investi dedans, et l absence de base ne s y substitue pas.',
    ].join('\n');
  }

  const bloc = buildVerifiedComparablesBlock(choix.seau, dossierStade);
  if (!choix.emprunte) return bloc;

  return [
    '# AVERTISSEMENT DE PERTINENCE DU SEAU',
    '',
    `Les comparables ci-dessous viennent du seau « ${choix.seau} », qui n est pas le seau propre de la classe « ${choix.classeArbitree} » de ce dossier : cette classe n a pas de comparables en propre dans la base.`,
    `Raison de l arbitrage : ${choix.raison}`,
    '',
    'Consequence sur ta redaction. Tu peux utiliser ces comparables, mais tu dis explicitement au lecteur en quoi l analogie tient et en quoi elle ne tient pas. Un comparable emprunte a une classe voisine et presente comme propre au dossier est une affirmation fausse ; le meme comparable annonce comme approximatif est utilisable.',
    '',
    bloc,
  ].join('\n');
}
