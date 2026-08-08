'use client';

// ============================================================
// TITRE COURANT DE LA NOTE, VERSION ECRAN
// ------------------------------------------------------------
// Un bandeau discret en haut de la zone de lecture qui porte le nom de
// la section en cours, et rien d autre.
//
// POURQUOI IL EXISTE, ce que la section courante veut dire et pourquoi
// la liste des sections n est ecrite nulle part : tout cela vit dans
// `lib/note/titre-courant.ts`, avec le pendant imprime, parce que les
// deux doivent nommer la meme chose et qu une seconde lecture aurait
// diverge sans rien casser.
//
// CE QUE CE COMPOSANT NE FAIT PAS. Il ne s imprime pas, et ce n est pas
// un oubli. Une sonde du 7 aout 2026 a mesure qu un element
// `position: sticky` ne se dessine que sur la premiere page d un PDF
// Chromium : fige la, il nommerait la premiere section et laisserait les
// vingt-neuf pages suivantes sans repere, ce qui est pire que rien
// puisqu il aurait l autorite d un repere. Le titre courant du PDF est
// l enveloppe en tableau posee sur le clone exporte, dans le meme
// module. Ce composant est donc retire du montage en mode impression et
// une regle @media print le retire aussi, parce que les deux ferment des
// chemins differents : le montage couvre l export, la regle couvre le
// Ctrl-P d un lecteur que rien n a prevenu.
// ============================================================

import { useEffect, useRef, useState } from 'react';

import {
  SELECTEUR_SECTION,
  nomDeSection,
  type NoeudLisible,
} from '@/lib/note/titre-courant';

/** Ce que le bandeau affiche tant qu aucune section n est atteinte. */
const AVANT_LA_PREMIERE_SECTION = '';

export function NoteTitreCourant() {
  const [titre, setTitre] = useState<string>(AVANT_LA_PREMIERE_SECTION);
  const rafRef = useRef<number | null>(null);
  const bandeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // La section courante est la derniere dont le haut est passe sous le
    // bord bas du bandeau. Ce bord se mesure plutot qu il ne se suppose :
    // le bandeau se colle sous l entete et sous la barre de pipeline,
    // dont la hauteur depend du nombre de moteurs et de l etat du run.
    const relire = () => {
      rafRef.current = null;
      const bande = bandeRef.current;
      if (!bande) return;
      const seuil = bande.getBoundingClientRect().bottom;

      let courant = AVANT_LA_PREMIERE_SECTION;
      for (const s of Array.from(
        document.querySelectorAll<HTMLElement>(SELECTEUR_SECTION),
      )) {
        if (s.getBoundingClientRect().top > seuil) break;
        const nom = nomDeSection(s as unknown as NoeudLisible);
        if (nom) courant = nom;
      }
      setTitre(prev => (prev === courant ? prev : courant));
    };

    const planifier = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(relire);
    };

    relire();
    window.addEventListener('scroll', planifier, { passive: true });
    window.addEventListener('resize', planifier);
    return () => {
      window.removeEventListener('scroll', planifier);
      window.removeEventListener('resize', planifier);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={bandeRef}
      className="note-titre-courant"
      // Le bandeau reste dans le flux meme vide : sa position sert de
      // seuil de mesure, donc le retirer du flux ferait disparaitre la
      // reference au moment precis ou on la calcule.
      data-vide={titre === '' ? 'oui' : 'non'}
      aria-hidden="true"
    >
      <span className="note-titre-courant-texte">{titre}</span>
    </div>
  );
}

export default NoteTitreCourant;
