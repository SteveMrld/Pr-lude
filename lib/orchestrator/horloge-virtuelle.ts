// ============================================================
// HORLOGE VIRTUELLE POUR LES TESTS DE DEADLINE
// ------------------------------------------------------------
// Un test de deadline qui dort reellement mesure la charge de la
// machine autant que la logique qu il verifie. La suite
// engine-deadline echouait par intermittence quand elle tournait
// derriere le reste du depot : dix-sept constructions temporelles,
// chacune supposant que l ordonnanceur rende la main a temps.
//
// Elargir les marges aurait recule le seuil sans changer la nature du
// test. Un test intermittent finit par etre relance jusqu a passer,
// puis ignore, et il masque alors un vrai echec.
//
// Cette horloge remplace le temps par un compteur que le test avance
// lui-meme. Les minuteurs se declenchent dans l ordre de leur echeance,
// a echeance egale dans l ordre de leur creation, et les microtaches
// sont vidangees entre deux declenchements pour que les chaines de
// promesses aient reellement progresse avant l echeance suivante.
//
// Elle n est utilisee qu en test. La production garde les minuteurs du
// runtime, par defaut du wrapper.
// ============================================================

import type { Scheduler } from './engine-deadline';

interface Minuteur {
  id: number;
  echeance: number;
  ordre: number;
  fn: () => void;
}

export class HorlogeVirtuelle {
  private courant = 0;
  private suivantId = 1;
  private suivantOrdre = 0;
  private minuteurs = new Map<number, Minuteur>();

  /** Instant courant, en millisecondes virtuelles. */
  get maintenant(): number {
    return this.courant;
  }

  /** Minuteurs encore armes. Utile pour verifier qu une garde a bien
   *  ete desarmee plutot que simplement non declenchee. */
  get enAttente(): number {
    return this.minuteurs.size;
  }

  /** Vue Scheduler, a injecter dans createEngineDeadlineWrapper. */
  scheduler(): Scheduler {
    return {
      setTimeout: (fn: () => void, ms: number) => {
        const id = this.suivantId++;
        this.minuteurs.set(id, {
          id,
          echeance: this.courant + Math.max(0, ms),
          ordre: this.suivantOrdre++,
          fn,
        });
        return id;
      },
      clearTimeout: (id: any) => {
        this.minuteurs.delete(id);
      },
    };
  }

  /**
   * Promesse resolue quand l horloge atteint `ms` a partir de
   * maintenant. Remplace les sleeps du test : le travail simule avance
   * sur la meme horloge que les gardes, donc leur course est
   * reproductible.
   */
  attendre(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scheduler().setTimeout(() => resolve(), ms);
    });
  }

  /**
   * Avance le temps de `ms`, en declenchant tous les minuteurs echus,
   * dans l ordre. Vidange les microtaches entre chaque declenchement :
   * sans cela, une chaine `then` armee par un minuteur ne serait pas
   * encore executee au declenchement du suivant, et l ordre observe ne
   * serait pas celui du temps.
   */
  async avancer(ms: number): Promise<void> {
    const cible = this.courant + ms;
    for (;;) {
      const du = Array.from(this.minuteurs.values())
        .filter((m) => m.echeance <= cible)
        .sort((a, b) => (a.echeance - b.echeance) || (a.ordre - b.ordre))[0];
      if (!du) break;
      this.courant = du.echeance;
      this.minuteurs.delete(du.id);
      du.fn();
      await vidangerMicrotaches();
    }
    this.courant = cible;
    await vidangerMicrotaches();
  }
}

/**
 * Laisse les chaines de promesses en attente s executer. Plusieurs
 * tours sont necessaires : une chaine de `then` progresse d un maillon
 * par tour de microtaches, et le pipeline en enchaine jusqu a trois.
 * Le setImmediate final cede la boucle d evenements sans dependre
 * d aucune duree.
 */
export function vidangerMicrotaches(tours = 8): Promise<void> {
  return new Promise<void>((resolve) => {
    let restants = tours;
    const tour = () => {
      if (restants-- <= 0) { setImmediate(resolve); return; }
      Promise.resolve().then(tour);
    };
    tour();
  });
}
