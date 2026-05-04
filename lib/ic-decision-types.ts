// ============================================================
// IC DECISION TYPES
// ------------------------------------------------------------
// Types et constantes purs (sans dependance serveur). Importable
// depuis Client Components et Server Components. Le store
// (lib/ic-decision-store.ts) re-exporte ces types et ajoute la
// logique d acces base.
// ============================================================

export type IcVoteResult =
  | 'approuve'
  | 'approuve-avec-conditions'
  | 'reporte'
  | 'refuse';

export const IC_VOTE_RESULTS: IcVoteResult[] = [
  'approuve',
  'approuve-avec-conditions',
  'reporte',
  'refuse',
];

export const IC_VOTE_RESULT_LABELS: Record<IcVoteResult, string> = {
  'approuve': 'Approuvé',
  'approuve-avec-conditions': 'Approuvé avec conditions',
  'reporte': 'Reporté',
  'refuse': 'Refusé',
};

export interface IcDecision {
  analysisId: string;
  partnerPrincipal: string | null;
  committeeDate: string | null; // ISO yyyy-mm-dd
  voteResult: IcVoteResult | null;
  conditions: string | null;
  updatedAt: string;
  updatedBy: string | null;
}
