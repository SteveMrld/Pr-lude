// Contrat partage entre le panneau drill-down et les renderers
// types. Volontairement minimal : un renderer prend un output
// arbitraire et le rend en JSX. Les renderers types affinent le
// typage en interne via des casts defensifs.

export interface ToileRendererProps {
  /** Sortie integrale du moteur, telle qu emise par engine-done
   *  ou rechargee depuis result_json. Peut etre n importe quel
   *  shape JSON. Le renderer doit etre tolerant aux champs
   *  manquants. */
  output: unknown;
  /** Id du moteur cible. Utile pour les renderers qui veulent
   *  afficher l id en tete (rarement, mais le contrat le permet). */
  engineId: string;
}
