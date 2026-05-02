// Types communs aux adapters Tier 1.
// Chaque adapter expose des fonctions fetch* qui retournent des objets
// fortement types et neutres (pas de dependance au moteur appelant).
//
// Convention : toutes les fonctions retournent null en cas d echec ou
// d absence de resultat (jamais de throw non gere, sauf erreur de
// configuration). Les erreurs reseau sont logguees et loggees, pas
// propagees, pour ne pas casser un pipeline complet sur une source HS.

export interface AdapterContext {
  /** Cle utilisateur si BYOK (decryptee, ne pas logger). */
  apiKey?: string;
  /** Budget temps en ms pour cette requete. Defaut 8000ms. */
  budgetMs?: number;
  /** Hook d evenement pour le tracker du moteur. */
  emit?: (event: string, data: Record<string, unknown>) => void;
}

export interface AdapterCitation {
  /** Identifiant de la source dans le SOURCES_REGISTRY. */
  sourceId: string;
  /** URL canonique du document cite. */
  url: string;
  /** Titre court du document. */
  title: string;
  /** Date d emission/publication si disponible. */
  date?: string;
  /** Tier editorial herite de la source. */
  tier: 1 | 2 | 3 | 4;
}

/**
 * Fetch HTTP avec budget temps et User-Agent Prelude.
 * Retourne null sur timeout, erreur reseau, ou statut HTTP non-2xx.
 */
export async function safeJsonFetch<T = any>(
  url: string,
  init: RequestInit & { budgetMs?: number } = {},
): Promise<T | null> {
  const budget = init.budgetMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Prelude/1.0 (+https://pr-lude.vercel.app)',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch HTTP texte (XML, HTML) avec budget temps.
 */
export async function safeTextFetch(
  url: string,
  init: RequestInit & { budgetMs?: number } = {},
): Promise<string | null> {
  const budget = init.budgetMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Prelude/1.0 (+https://pr-lude.vercel.app)',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
