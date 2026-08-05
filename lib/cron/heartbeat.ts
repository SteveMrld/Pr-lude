// ============================================================
// BATTEMENT D INVOCATION D UNE TACHE PLANIFIEE
// ------------------------------------------------------------
// Une trace durable ecrite a l entree de chaque cron, avant toute
// evaluation d autorisation et avant tout travail, quel que soit le
// sort de l invocation.
//
// POURQUOI IL FAUT LE MEME PARTOUT
//
// Le cron de nettoyage en portait un depuis l origine. C est lui, et
// lui seul, qui a permis d etablir le 3 aout 2026 que les six taches
// planifiees n atteignaient jamais leur handler, interceptees par le
// middleware d authentification et redirigees en 307 vers /login : son
// absence totale de trace etait le fait. Les cinq autres n en avaient
// pas, donc leur silence ne disait rien.
//
// Le 5 aout 2026 a montre le second usage, moins spectaculaire et plus
// frequent. La couche sectorielle n avait rien produit depuis le 13
// mai, et la question « est-ce qu elle s execute et ne trouve rien, ou
// est-ce qu elle echoue en silence » n a pu etre tranchee qu en lisant
// le code du selecteur : seuil de quatre-vingt-dix jours, quatre-vingt-
// quatre ecoules, donc rien d eligible. La reponse etait rassurante et
// il a fallu une lecture de source pour l obtenir. Un battement portant
// le verdict de la passe l aurait donnee en une requete.
//
// C est la difference entre prouver la vie et expliquer le silence. Le
// premier demande une trace ; le second demande que la trace porte ce
// que la passe a decide. Un cron qui ne fait rien doit dire qu il n a
// rien trouve a faire, sinon il est indiscernable d un cron mort.
//
// CE QU IL NE FAIT PAS
//
// Il ne signale pas une absence. Un battement prouve la vie, il ne
// signale pas la mort : aucun processus ne se declenche parce que rien
// ne s est produit, et lire la serie demande qu un humain aille la
// lire. La limite est structurelle et documentee dans CLAUDE.md ; la
// seule reponse qui tienne est un interrupteur d homme mort chez un
// tiers, et c est un arbitrage de gouvernance non tranche.
// ============================================================

import { logError } from '../error-logger';

export interface BattementCron {
  /** Source du log, de la forme `cron.<nom>`. */
  source: string;
  /** True quand l invocation a passe la garde d autorisation. */
  autorisee: boolean;
  /** Motif de la decision d autorisation, tel que la garde le rend. */
  motif: string;
  /** En-tetes utiles au diagnostic d une invocation refusee. */
  userAgent?: string | null;
  aUnEnTeteAutorisation?: boolean;
  /**
   * Ce que la passe a decide, quand elle a decide quelque chose.
   *
   * C est le champ qui distingue « je tourne et je n ai rien a faire »
   * de « je ne tourne pas ». Sans lui, les deux se lisent pareil dans
   * la table, et il faut ouvrir le code pour trancher.
   */
  verdict?: string | null;
  /** Detail libre, chiffres de la passe par exemple. */
  contexte?: Record<string, unknown>;
}

/**
 * Ecrit le battement. Ne leve jamais : une trace qui ferait echouer la
 * tache qu elle observe serait pire que pas de trace.
 */
export async function battreCron(b: BattementCron): Promise<void> {
  try {
    await logError({
      severity: b.autorisee ? 'info' : 'error',
      source: b.source,
      message: b.autorisee
        ? `invocation autorisee (${b.motif})${b.verdict ? ` : ${b.verdict}` : ''}`
        : `invocation refusee 401 (${b.motif})`,
      context: {
        triggeredAt: new Date().toISOString(),
        userAgent: b.userAgent ?? '',
        hasCronSecret: !!process.env.CRON_SECRET,
        hasAuthorizationHeader: !!b.aUnEnTeteAutorisation,
        authorized: b.autorisee,
        ...(b.verdict ? { verdict: b.verdict } : {}),
        ...(b.contexte ?? {}),
      },
    });
  } catch {
    // Silencieux par construction. Le battement observe, il n arbitre
    // pas, et une panne de la table de logs ne doit pas emporter la
    // tache planifiee.
  }
}
