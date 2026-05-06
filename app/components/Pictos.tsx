// Pictogrammes Prelude.
// SVG inline, traits 1.5px, geometriques, palette papier/encre.
// Style : agence de notation europeenne / cabinet d avocats prestige.
// Pas de Lucide, pas d emoji. Chaque picto est concu pour la marque.

import type { SVGProps } from 'react';

const baseProps: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: '20',
  height: '20',
  'aria-hidden': true,
};

/** Sceau circulaire avec etoile : validation, certification, methode etablie. */
export function PictoSeal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" strokeDasharray="0.5 1.8" />
      <path d="M12 8.5 L12.9 10.7 L15.3 11.0 L13.5 12.6 L13.9 15.0 L12 13.8 L10.1 15.0 L10.5 12.6 L8.7 11.0 L11.1 10.7 Z" />
    </svg>
  );
}

/** Boussole : singularites, signaux contrariens, prise de cap. */
export function PictoCompass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8 L13 13 L8 16 L11 11 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M16 8 L13 13 L8 16 L11 11 Z" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

/** OEil cercle : aveuglement collectif, angles morts. */
export function PictoEye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9.5" strokeDasharray="2 2" />
      <path d="M3.5 12 C5.5 8.5 8.5 6.5 12 6.5 C15.5 6.5 18.5 8.5 20.5 12 C18.5 15.5 15.5 17.5 12 17.5 C8.5 17.5 5.5 15.5 3.5 12 Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

/** Filet / mailles : pattern matching, corpus de cas. */
export function PictoNet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 6 L21 6 M3 12 L21 12 M3 18 L21 18" />
      <path d="M7 3 L7 21 M12 3 L12 21 M17 3 L17 21" />
      <circle cx="7" cy="6" r="0.9" fill="currentColor" />
      <circle cx="17" cy="6" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="7" cy="18" r="0.9" fill="currentColor" />
      <circle cx="17" cy="18" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Triangle d alerte : drapeau rouge, risque structurel. */
export function PictoFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 21 L5 4 L13.5 6.2 L13.5 13 L5 11 Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M5 21 L5 4 L13.5 6.2 L13.5 13 L5 11 Z" />
    </svg>
  );
}

/** Balance : coherence financiere, equilibre. */
export function PictoScale(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4 L12 20" />
      <path d="M7 20 L17 20" />
      <path d="M5 8 L19 6" />
      <path d="M5 8 L2 14 A 3.5 3.5 0 0 0 8 14 Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M5 8 L2 14 A 3.5 3.5 0 0 0 8 14 Z" />
      <path d="M19 6 L16 12 A 3.5 3.5 0 0 0 22 12 Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M19 6 L16 12 A 3.5 3.5 0 0 0 22 12 Z" />
    </svg>
  );
}

/** Globe : marche, geographie, comparables internationaux. */
export function PictoGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12 L21 12" />
      <path d="M5.2 6.5 C8 8 16 8 18.8 6.5" />
      <path d="M5.2 17.5 C8 16 16 16 18.8 17.5" />
    </svg>
  );
}

/** Clepsydre : timing macro, fenetre temporelle. */
export function PictoHourglass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 3 L18 3" />
      <path d="M6 21 L18 21" />
      <path d="M6 3 C6 8 18 16 18 21" />
      <path d="M18 3 C18 8 6 16 6 21" />
      <path d="M8.5 6 L15.5 6 L12 11 Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/** Document plie : extraction, lecture du dossier. */
export function PictoDocument(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 3 L14 3 L19 8 L19 21 L5 21 Z" />
      <path d="M14 3 L14 8 L19 8" />
      <path d="M8 12 L16 12 M8 15 L16 15 M8 18 L13 18" />
    </svg>
  );
}

/** Cercles imbriques : equipe, collectif, fondateurs. */
export function PictoTeam(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="9" cy="10" r="3" />
      <circle cx="15" cy="10" r="3" />
      <path d="M4 20 C4 16 6 14 9 14 C10.5 14 11.5 14.5 12 15.2" />
      <path d="M20 20 C20 16 18 14 15 14 C13.5 14 12.5 14.5 12 15.2" />
    </svg>
  );
}

/** Pyramide : orchestration, synthese, hierarchie de l analyse. */
export function PictoPyramid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 L4 20 L20 20 Z" />
      <path d="M12 3 L8.5 10 L15.5 10 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M8.5 10 L15.5 10" />
      <path d="M6.5 14.5 L17.5 14.5" />
    </svg>
  );
}

/** Telephone retro : reference checks, appels DD. */
export function PictoPhone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 4 L9 4 L10.5 8 L8.5 9.5 C9.5 12 12 14.5 14.5 15.5 L16 13.5 L20 15 L20 19 C20 19.5 19.5 20 19 20 C11 20 4 13 4 5 C4 4.5 4.5 4 5 4 Z" />
    </svg>
  );
}

/** Spirale / boucle : retournement causal, inversion. */
export function PictoSpiral(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M19 12 A 7 7 0 1 1 12 5 A 5 5 0 1 1 12 15 A 3 3 0 1 1 15 12" />
      <circle cx="15" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

/**
 * Mapping engine id -> picto. Utilise par les cards methode.
 * Garde une coherence semantique : chaque picto reflete la nature
 * de l etape, pas juste un ornement decoratif.
 */
export const ENGINE_PICTOS = {
  extraction: PictoDocument,
  team: PictoTeam,
  market: PictoGlobe,
  macro: PictoHourglass,
  'financial-extraction': PictoScale,
  pattern: PictoNet,
  causal: PictoSpiral,
  blindspot: PictoEye,
  contrarian: PictoCompass,
  'financial-coherence': PictoScale,
  'tech-claim': PictoNet,
  'execution-friction': PictoCompass,
  orchestrate: PictoPyramid,
  'reference-checks': PictoPhone,
  'dd-financial': PictoScale,
  'dd-contractual': PictoDocument,
  'dd-technical': PictoDocument,
  'dd-references': PictoPhone,
} as const;
