// ============================================================
// Double de client Supabase pour les tests deterministes
// ------------------------------------------------------------
// Les stores de la plateforme sont des modules asynchrones qui ne
// contiennent presque pas de calcul : leur travail est de choisir une
// table, des colonnes, des filtres et un tri, puis de traduire la ligne
// brute en objet TypeScript. Un test qui ne verrait que la valeur
// rendue ne verrait pas la moitie de ce travail, et c est precisement
// la moitie ou vivait la faute du troisieme corollaire de la discipline
// de mesure : lire `analysis_outcomes` la ou le code lit
// `realized_outcomes`.
//
// Ce double enregistre donc l appel plutot que de le simuler en
// silence. Un test peut affirmer la table interrogee, les colonnes
// demandees, chaque filtre avec sa valeur, le tri et la limite, et la
// forme terminale attendue. C est ce qui rend la mesure structurelle :
// on interroge l objet construit par le module, pas le texte du module.
//
// Les reponses sont programmees par le test. Le defaut rend une liste
// vide sans erreur, ce qui est l etat le moins susceptible de faire
// passer un test pour de mauvaises raisons.
// ============================================================

export type OperationSupabase = 'select' | 'insert' | 'update' | 'delete';
export type FormeTerminale = 'single' | 'maybeSingle' | 'liste';

export interface FiltreEnregistre {
  operateur: string;
  colonne: string;
  valeur: unknown;
}

export interface AppelEnregistre {
  table: string;
  operation: OperationSupabase;
  colonnes: string | null;
  filtres: FiltreEnregistre[];
  tris: Array<{ colonne: string; ascendant: boolean }>;
  limite: number | null;
  forme: FormeTerminale;
  payload: unknown;
}

export interface ReponseSupabase {
  data: unknown;
  error: unknown;
}

/**
 * Rend la reponse d un appel. Recoit l appel entierement construit, ce
 * qui permet a un test de repondre differemment selon la table ou le
 * filtre, sans dependre de l ordre des appels.
 */
export type Repondeur = (appel: AppelEnregistre) => ReponseSupabase;

export interface DoubleSupabase {
  client: any;
  /** Les appels dans l ordre ou le module les a termines. */
  appels: AppelEnregistre[];
  /** Dernier appel, raccourci du cas a un seul appel. */
  dernier(): AppelEnregistre;
  /** Les appels portant sur une table donnee. */
  surTable(table: string): AppelEnregistre[];
}

class Requete implements PromiseLike<ReponseSupabase> {
  private appel: AppelEnregistre;
  constructor(
    table: string,
    private readonly repondeur: Repondeur,
    private readonly journal: AppelEnregistre[],
  ) {
    this.appel = {
      table, operation: 'select', colonnes: null,
      filtres: [], tris: [], limite: null, forme: 'liste', payload: undefined,
    };
  }

  select(colonnes?: string) { this.appel.colonnes = colonnes ?? '*'; return this; }
  insert(payload: unknown) { this.appel.operation = 'insert'; this.appel.payload = payload; return this; }
  update(payload: unknown) { this.appel.operation = 'update'; this.appel.payload = payload; return this; }
  delete() { this.appel.operation = 'delete'; return this; }

  private filtre(operateur: string, colonne: string, valeur: unknown) {
    this.appel.filtres.push({ operateur, colonne, valeur });
    return this;
  }
  eq(c: string, v: unknown) { return this.filtre('eq', c, v); }
  neq(c: string, v: unknown) { return this.filtre('neq', c, v); }
  gt(c: string, v: unknown) { return this.filtre('gt', c, v); }
  gte(c: string, v: unknown) { return this.filtre('gte', c, v); }
  lt(c: string, v: unknown) { return this.filtre('lt', c, v); }
  lte(c: string, v: unknown) { return this.filtre('lte', c, v); }
  is(c: string, v: unknown) { return this.filtre('is', c, v); }
  in(c: string, v: unknown) { return this.filtre('in', c, v); }
  ilike(c: string, v: unknown) { return this.filtre('ilike', c, v); }
  not(c: string, op: string, v: unknown) { return this.filtre(`not.${op}`, c, v); }

  order(colonne: string, opts?: { ascending?: boolean }) {
    this.appel.tris.push({ colonne, ascendant: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.appel.limite = n; return this; }
  range(debut: number, fin: number) { this.appel.limite = fin - debut + 1; return this; }

  private terminer(forme: FormeTerminale): ReponseSupabase {
    this.appel.forme = forme;
    this.journal.push(this.appel);
    return this.repondeur(this.appel);
  }

  async single(): Promise<ReponseSupabase> { return this.terminer('single'); }
  async maybeSingle(): Promise<ReponseSupabase> { return this.terminer('maybeSingle'); }

  // Une requete sans forme terminale explicite est attendue telle
  // quelle : c est le cas de listAllPredictionRecords, qui construit sa
  // requete par etapes puis l attend directement.
  then<A = ReponseSupabase, B = never>(
    onOk?: ((v: ReponseSupabase) => A | PromiseLike<A>) | null,
    onKo?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.terminer('liste')).then(onOk, onKo);
  }
}

/**
 * Construit un double. Le repondeur par defaut rend une liste vide.
 */
export function creerDoubleSupabase(repondeur?: Repondeur): DoubleSupabase {
  const appels: AppelEnregistre[] = [];
  const rep: Repondeur = repondeur ?? (() => ({ data: [], error: null }));
  return {
    client: { from: (table: string) => new Requete(table, rep, appels) },
    appels,
    dernier: () => appels[appels.length - 1],
    surTable: (table: string) => appels.filter((a) => a.table === table),
  };
}

/**
 * Repondeur de commodite : rend `data` pour toute requete, sans erreur.
 * A n utiliser que lorsque le test n a qu un appel a servir, sans quoi
 * il devient impossible de distinguer deux lectures differentes.
 */
export function repondToujours(data: unknown): Repondeur {
  return () => ({ data, error: null });
}

/**
 * Neutralise `server-only`, dont l import jette hors d un contexte
 * Next.js serveur et empeche tsx de charger les stores. Le marqueur
 * garde toute sa valeur en production ; il n a simplement pas de sens
 * dans un harnais en ligne de commande.
 */
export function neutraliserServerOnly(): void {
  // Le paquet n est pas installe : Next.js resout ce specificateur a la
  // compilation et il n existe nulle part sur le disque. C est donc la
  // resolution qu il faut detourner, pas le cache de modules, qui est
  // indexe par un chemin que personne ne peut produire.
  const Module = require('module');
  if (Module.__serverOnlyNeutralise) return;
  const stub = require.resolve('./server-only-stub');
  const resoudre = Module._resolveFilename;
  Module._resolveFilename = function (demande: string, ...reste: unknown[]) {
    if (demande === 'server-only') return stub;
    return resoudre.call(this, demande, ...reste);
  };
  Module.__serverOnlyNeutralise = true;
}

/**
 * Substitue le double a `@supabase/supabase-js` pour tout module charge
 * ensuite. Rend le double, dont le journal est lu par le test.
 *
 * L appel doit preceder l import du store, qui capture `createClient` a
 * l evaluation du module.
 */
export function installerDoubleSupabase(repondeur?: Repondeur): DoubleSupabase {
  neutraliserServerOnly();
  const double = creerDoubleSupabase(repondeur);
  const chemin = require.resolve('@supabase/supabase-js');
  require.cache[chemin] = {
    id: chemin, filename: chemin, loaded: true,
    exports: { createClient: () => double.client },
  } as any;
  return double;
}
