// ============================================================
// COMPOSANTES D OPERATION, FONCTIONS PURES
// ------------------------------------------------------------
// Isole dans son propre module parce que la note en a besoin et que le
// moteur d extraction, ou ces fonctions vivaient d abord, tire le
// client Anthropic et donc async_hooks dans le bundle client. Un
// module de derivation ne doit dependre de rien.
// ============================================================

/**
 * Type dominant derive des composantes, pour les seuls consommateurs
 * qui n ont pas encore migre et pour les analyses anterieures.
 *
 * La derivation est mecanique et documentee ici plutot que dispersee :
 * une cession seule est une cession, un cash-in seul une levee, une
 * dette avec cession un LBO, et une operation qui porte cession et
 * cash-in reste un LBO au sens ou le metier l entend, un
 * reinvestissement accompagnant une sortie.
 */
export function deriverTypeDepuisComposantes(
  composantes: Array<{ kind: string; evidence: string; perimetre?: string | null }>,
): { type: string; evidence: string | null } {
  const a = (k: string) => composantes.find((c) => c.kind === k);
  const cashIn = a('cash-in');
  const cession = a('cession');
  const dette = a('dette');
  if (!cashIn && !cession && !dette) return { type: 'non-etabli', evidence: null };
  if (cession && (dette || cashIn)) return { type: 'lbo', evidence: cession.evidence };
  if (cession) {
    const totale = /100\s*%|totalit[ée]|int[ée]gralit[ée]/i.test(`${cession.perimetre ?? ''} ${cession.evidence}`);
    return { type: totale ? 'cession-totale' : 'cession-partielle', evidence: cession.evidence };
  }
  if (cashIn) return { type: 'levee', evidence: cashIn.evidence };
  return { type: 'lbo', evidence: dette!.evidence };
}

/**
 * Adaptateur pour les analyses persistees avant le 3 aout 2026, qui ne
 * portent qu un type et sa citation. Il reconstitue les composantes
 * depuis le type, de sorte que les consommateurs migres lisent une
 * seule forme.
 *
 * Ce n est pas une seconde source de verite : il ne s applique qu a des
 * donnees ou les composantes n existent pas, et il ne produit jamais
 * une composante que le type ne contenait pas deja.
 */
export function composantesDepuisTypeHerite(
  type: string | null | undefined,
  evidence: string | null | undefined,
): Array<{ kind: 'cash-in' | 'cession' | 'dette'; evidence: string; perimetre: string | null }> {
  const cite = typeof evidence === 'string' && evidence.trim().length > 0 ? evidence.trim() : null;
  if (!type || type === 'non-etabli' || !cite) return [];
  if (type === 'levee') return [{ kind: 'cash-in', evidence: cite, perimetre: null }];
  if (type === 'cession-partielle') return [{ kind: 'cession', evidence: cite, perimetre: null }];
  if (type === 'cession-totale') return [{ kind: 'cession', evidence: cite, perimetre: '100%' }];
  if (type === 'lbo') {
    return [
      { kind: 'cession', evidence: cite, perimetre: null },
      { kind: 'dette', evidence: cite, perimetre: null },
    ];
  }
  return [];
}
