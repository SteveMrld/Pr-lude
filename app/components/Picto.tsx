// ============================================================
// PICTOS — bibliotheque de pictogrammes line-art 24x24
// ------------------------------------------------------------
// Tous les pictos sont des SVG inline 24x24 avec stroke 1.5px,
// pas de fill (sauf rares exceptions). Ils heritent de la
// couleur courante via stroke="currentColor".
//
// Trois familles :
//  - ENGINE_PICTOS    : un picto pour chacun des 13 moteurs
//  - UI_PICTOS        : pictos genericiues pour les boutons et statuts
//  - SECTION_PICTOS   : pictos pour les sections editoriales (piliers, etc.)
//
// Usage :
//   import { Picto } from '@/app/components/Picto';
//   <Picto name="lecture" size={24} />
// ============================================================

import React from 'react';

interface PictoProps {
  name: PictoName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
}

export type PictoName =
  // Moteurs
  | 'lecture' | 'equipe' | 'marche' | 'macro' | 'financiers'
  | 'concurrence' | 'brevets' | 'reglementaire' | 'risques'
  | 'blindspot' | 'argumentation' | 'verdict' | 'pack-ic'
  // UI
  | 'arrow-right' | 'arrow-up-right' | 'check' | 'circle' | 'circle-half'
  | 'document' | 'upload' | 'search' | 'chevron-right' | 'sparkle'
  // Sections
  | 'pillar-rigueur' | 'pillar-comite' | 'pillar-memoire'
  | 'instruction' | 'lecture-rapide' | 'pipeline';

const PATHS: Record<PictoName, React.ReactNode> = {
  // ============== MOTEURS (13) ==============
  // Chaque moteur = une metaphore visuelle : Lecture = livre ouvert,
  // Equipe = trois figures, Marche = courbe + cible, Macro = globe,
  // Financiers = barres + euro, Concurrence = grille de points,
  // Brevets = sceau, Reglementaire = balance, Risques = triangle alerte,
  // Blindspot = oeil avec angle mort, Argumentation = bulles de pensee,
  // Verdict = marteau + ligne, Pack IC = dossier signe.

  'lecture': (
    <>
      <path d="M3 5.5 C3 4.7, 3.7 4, 4.5 4 H10.5 C11.3 4, 12 4.7, 12 5.5 V19" />
      <path d="M21 5.5 C21 4.7, 20.3 4, 19.5 4 H13.5 C12.7 4, 12 4.7, 12 5.5 V19" />
      <path d="M3 5.5 V19 C3 19.8, 3.7 20.5, 4.5 20.5 H19.5 C20.3 20.5, 21 19.8, 21 19 V5.5" />
      <path d="M5.5 8 H9" /><path d="M5.5 11 H9.5" /><path d="M14.5 8 H18.5" /><path d="M14.5 11 H18" />
    </>
  ),
  'equipe': (
    <>
      <circle cx="8" cy="9" r="2.5" /><circle cx="16" cy="9" r="2.5" />
      <path d="M3 19 C3 16.2, 5.2 14, 8 14 C10.8 14, 13 16.2, 13 19" />
      <path d="M11 19 C11 16.2, 13.2 14, 16 14 C18.8 14, 21 16.2, 21 19" />
    </>
  ),
  'marche': (
    <>
      <path d="M3 18 L9 12 L13 15 L21 6" />
      <path d="M16 6 H21 V11" /><circle cx="9" cy="12" r="1.2" /><circle cx="13" cy="15" r="1.2" />
    </>
  ),
  'macro': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12 H21" /><path d="M12 3 C9 6, 9 18, 12 21" /><path d="M12 3 C15 6, 15 18, 12 21" />
    </>
  ),
  'financiers': (
    <>
      <path d="M5 20 V11" /><path d="M10 20 V8" /><path d="M15 20 V13" /><path d="M20 20 V5" />
      <path d="M3 20 H21" />
    </>
  ),
  'concurrence': (
    <>
      <circle cx="6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" />
      <circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="18" cy="12" r="1.5" />
      <circle cx="6" cy="18" r="1.5" /><circle cx="12" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" />
    </>
  ),
  'brevets': (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14 L7 21 L12 18 L17 21 L15 14" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  'reglementaire': (
    <>
      <path d="M12 4 V20" /><path d="M6 20 H18" />
      <path d="M5 9 H11" /><path d="M13 9 H19" />
      <path d="M3 14 C3 11, 5 9, 8 9 C11 9, 11 11, 11 14 Z" />
      <path d="M13 14 C13 11, 15 9, 16 9 C19 9, 21 11, 21 14 Z" />
    </>
  ),
  'risques': (
    <>
      <path d="M12 3 L22 20 H2 Z" />
      <path d="M12 10 V14" /><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  'blindspot': (
    <>
      <path d="M2 12 C5 7, 9 5, 12 5 C15 5, 19 7, 22 12 C19 17, 15 19, 12 19 C9 19, 5 17, 2 12 Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 4 L21 20" />
    </>
  ),
  'argumentation': (
    <>
      <path d="M3 6 C3 4.9, 3.9 4, 5 4 H13 C14.1 4, 15 4.9, 15 6 V12 C15 13.1, 14.1 14, 13 14 H8 L4 17 V6 Z" />
      <path d="M19 10 C20.1 10, 21 10.9, 21 12 V18 C21 19.1, 20.1 20, 19 20 H13 L9 23 V20" />
    </>
  ),
  'verdict': (
    <>
      <path d="M14 4 L20 10 L13 17 L7 11 Z" />
      <path d="M5 13 L11 19" /><path d="M3 21 H11" />
    </>
  ),
  'pack-ic': (
    <>
      <path d="M5 4 H15 L19 8 V20 H5 Z" />
      <path d="M14 4 V9 H19" />
      <path d="M8 13 H16" /><path d="M8 16 H14" />
    </>
  ),

  // ============== UI ==============
  'arrow-right': <path d="M5 12 H19 M13 6 L19 12 L13 18" />,
  'arrow-up-right': <path d="M7 17 L17 7 M9 7 H17 V15" />,
  'check': <path d="M5 12.5 L10 17.5 L19 7.5" />,
  'circle': <circle cx="12" cy="12" r="9" />,
  'circle-half': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 A9 9 0 0 1 12 21" fill="currentColor" stroke="none" />
    </>
  ),
  'document': (
    <>
      <path d="M5 4 H15 L19 8 V20 H5 Z" />
      <path d="M14 4 V9 H19" />
    </>
  ),
  'upload': (
    <>
      <path d="M12 4 V16" /><path d="M7 9 L12 4 L17 9" />
      <path d="M5 17 V19 C5 19.6 5.4 20 6 20 H18 C18.6 20 19 19.6 19 19 V17" />
    </>
  ),
  'search': (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 L20 20" />
    </>
  ),
  'chevron-right': <path d="M9 6 L15 12 L9 18" />,
  'sparkle': (
    <>
      <path d="M12 4 L13.5 10.5 L20 12 L13.5 13.5 L12 20 L10.5 13.5 L4 12 L10.5 10.5 Z" />
    </>
  ),

  // ============== SECTIONS EDITORIALES ==============
  'pillar-rigueur': (
    // Trois colonnes verticales (rigueur architecturale)
    <>
      <path d="M5 5 V19" /><path d="M12 5 V19" /><path d="M19 5 V19" />
      <path d="M3 5 H21" /><path d="M3 19 H21" />
    </>
  ),
  'pillar-comite': (
    // Cercle de figures autour d une table
    <>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="4" r="1.5" /><circle cx="12" cy="20" r="1.5" />
      <circle cx="4" cy="12" r="1.5" /><circle cx="20" cy="12" r="1.5" />
      <circle cx="6" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" />
      <circle cx="6" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" />
    </>
  ),
  'pillar-memoire': (
    // Empilement de strates / sediments
    <>
      <path d="M3 8 H21" /><path d="M3 12 H21" /><path d="M3 16 H21" />
      <path d="M3 5 H21 V20 H3 Z" />
      <path d="M7 8 V12" /><path d="M14 12 V16" /><path d="M10 5 V8" /><path d="M17 16 V20" />
    </>
  ),
  'instruction': (
    // Loupe sur document
    <>
      <path d="M4 4 H13 L17 8 V13" />
      <path d="M12 4 V8 H17" />
      <circle cx="15" cy="16" r="4" />
      <path d="M18 19 L21 22" />
    </>
  ),
  'lecture-rapide': (
    // Eclair stylise
    <>
      <path d="M13 3 L5 13 H11 L9 21 L19 9 H13 Z" />
    </>
  ),
  'pipeline': (
    // Flux de boites connectees
    <>
      <rect x="3" y="9" width="5" height="6" rx="0.5" />
      <rect x="11" y="9" width="5" height="6" rx="0.5" />
      <rect x="19" y="9" width="2" height="6" rx="0.5" />
      <path d="M8 12 H11" /><path d="M16 12 H19" />
    </>
  ),
};

/**
 * Composant Picto. Rend un SVG inline avec stroke="currentColor".
 * Hereditate de la couleur du parent. Aucune couleur en dur dans la
 * librairie, c est au call-site de fournir la teinte via color: ...
 */
export function Picto({
  name,
  size = 24,
  strokeWidth = 1.5,
  className,
  style,
  'aria-hidden': ariaHidden = true,
}: PictoProps) {
  const path = PATHS[name];
  if (!path) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Picto] unknown name: ${name}`);
    }
    return null;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden={ariaHidden}
    >
      {path}
    </svg>
  );
}

export default Picto;
