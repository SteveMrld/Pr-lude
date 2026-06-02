'use client';

// ============================================================
// TabPane - keep-alive lazy pour les onglets du dashboard
// ------------------------------------------------------------
// Probleme resolu : le pattern historique
//   {(activeTab === 'X' || printMode) && (...)}
// demontait/remontait chaque onglet a chaque switch. Pour les
// onglets composants (TrajectoryView, IcPackView,
// PipelineToilePanel), cela relancait le fetch + loading state
// interne (TrajectoryView.tsx:34-71, ReferenceCallNotesPanel.tsx:148-191),
// produisant un flash de 200 a 500ms a chaque visite. Pour les
// onglets inline, cela forcait React a reconcilier l ensemble
// du sous-tree de l onglet sortant + de l onglet entrant.
//
// Mecanique du keep-alive :
//   - Un onglet est mont la PREMIERE fois qu il devient actif
//     (ou en print mode global).
//   - Apres ce premier mount, l onglet reste monte indefiniment
//     dans le DOM et bascule entre actif et inactif via l
//     attribut HTML hidden (equivalent display: none avec en
//     plus le retrait de l accessibility tree).
//   - Au switch suivant, aucun remount, aucun re-fetch, aucun
//     recalcul useMemo, aucun reset de state interne.
//
// Le state mountedTabs est gere cote parent (HomeClient) :
// c est ce qui permet de garder le keep-alive partage entre
// tous les TabPane sans dupliquer la logique. Le parent passe
// aussi le helper selectTab qui ajoute l onglet a mountedTabs
// avant de l activer.
//
// Print mode : tous les TabPane se montent et restent visibles
// pour que l export PDF capture l integralite du dashboard en
// cascade. Le flag noPrint permet d exclure un onglet du print
// (utilise pour Pack IC et Pipeline qui ont leur propre logique
// d export ou n ont pas vocation a apparaitre dans la note PDF).
// ============================================================

import type { ReactNode } from 'react';

export interface TabPaneProps {
  /** Id du tab, doit correspondre a la cle utilisee dans le
   *  selecteur d onglets de la sidebar (cf tabGroups). */
  tabId: string;
  /** Id de l onglet actuellement actif. */
  activeTab: string;
  /** Mode print : tous les TabPane sont montes et visibles. */
  printMode: boolean;
  /** Set des onglets deja visites au moins une fois. */
  mountedTabs: Set<string>;
  /** Si true, l onglet n est jamais visible en print mode meme
   *  s il a ete monte. Utilise pour Pack IC et Pipeline qui ont
   *  une logique d affichage propre et ne participent pas au
   *  rendu cascade pour l export PDF. */
  noPrint?: boolean;
  /** Contenu de l onglet, deja conditionne en amont par les
   *  conditions metier (savedAnalysisId, result.X, etc.). */
  children: ReactNode;
}

export function TabPane({
  tabId,
  activeTab,
  printMode,
  mountedTabs,
  noPrint = false,
  children,
}: TabPaneProps) {
  const isActive = activeTab === tabId;
  const showForPrint = printMode && !noPrint;

  // Lazy mount : tant qu un onglet n a jamais ete actif et qu on
  // n est pas en print mode applicable, on ne le monte pas du
  // tout. Ainsi, ouvrir une analyse n entraine pas le mount
  // immediat des 19 onglets : seuls les onglets reellement
  // visites finissent par exister dans le DOM.
  if (!isActive && !showForPrint && !mountedTabs.has(tabId)) {
    return null;
  }

  // Visibilite : actif (ou print mode applicable) -> visible.
  // Inactif apres avoir ete monte -> hidden. L attribut HTML
  // hidden pose display: none et retire le bloc du flow d
  // accessibilite, ce qui est exactement le comportement
  // souhaite pour un onglet inactif.
  const hide = !isActive && !showForPrint;

  return <div hidden={hide}>{children}</div>;
}
