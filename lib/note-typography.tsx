// ============================================================
// Utilitaires de typographie pour la note d'investissement
// ------------------------------------------------------------
// Helpers de mise en page des textes denses produits par les
// moteurs LLM. Permet d aerer visuellement la prose sans toucher
// aux prompts : le moteur produit du texte naturel, le rendu UI
// se charge de la typographie.
// ============================================================

import React from 'react';

/**
 * Met en valeur les chiffres-cles dans la prose.
 *
 * Detecte et entoure de <span class="num-key"> les motifs typiques d une
 * note d investissement :
 *   - Montants : "EUR 312.5M", "51.25M EUR", "660M$", "1370 USD"
 *   - Pourcentages : "22%", "78%", "EBITDA 41%"
 *   - Ratios : "ratio 25.8:1", "x2.55", "x1.8-x2.1"
 *   - Annees seules (1990-2099) : "2026", "2033"
 *   - Scores : "82/100", "score 38"
 *
 * Les classes CSS .num-key sont definies dans InvestmentNoteView et
 * doivent etre disponibles dans le scope du composant qui appelle
 * enrichProse. Variantes : .note-paragraph-dark .num-key sur fond sombre.
 */
export function enrichProse(text: string | undefined | null): React.ReactNode {
  if (!text || typeof text !== 'string') return text;

  // Pattern global qui capture les motifs numeriques en une passe.
  // L ordre dans l alternance compte : on met les motifs longs d abord
  // pour eviter qu un motif court le mange.
  const pattern = /(\d+[,.]?\d*\s?[Mk]?d?(?:s)?\s?(?:EUR|USD|€|\$|M\$|Md\$|Mds\$|M€))|((?:EUR|USD|€|\$)\s?\d+[,.]?\d*\s?[Mk]?d?s?)|(\d+[,.]?\d*\s?(?:Mds?|M)\s?(?:EUR|USD|€|\$)?)|(ratio\s\d+[,.]?\d*\s?:\s?\d+)|(x\d+[,.]?\d*(?:-x\d+[,.]?\d*)?)|(\d+[,.]?\d*\s?%)|(\d+\/\d+(?:\s|$))|((?<=score\s)\d+(?:\/100)?)|(\b(?:19|20)\d{2}\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={`nk-${keyCounter++}`} className="num-key">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;
  return <>{parts}</>;
}

/**
 * Decoupe un long paragraphe en plusieurs paragraphes courts.
 *
 * Strategie : on cherche les phrases (delimitees par '. ', '? ', '! ')
 * et on regroupe par 2-3 phrases par paragraphe pour un rythme de
 * lecture aere. Les paragraphes resultants sont retournes en array
 * pour que le composant appelant les rende avec ses propres balises.
 *
 * Le chiffre cible est 3 phrases par paragraphe sauf si le paragraphe
 * d origine en contient moins.
 */
export function splitIntoParagraphs(text: string | undefined | null, sentencesPerParagraph: number = 3): string[] {
  if (!text || typeof text !== 'string') return [];

  // Regex robuste qui capture les phrases sans casser les abreviations
  // courantes (EUR, M., etc.). On accepte . ! ? suivis d un espace ou
  // de la fin de chaine. On preserve la ponctuation finale.
  const sentences: string[] = [];
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = sentenceRegex.exec(text)) !== null) {
    const s = m[0].trim();
    if (s.length > 0) sentences.push(s);
  }
  // S il reste un fragment non termine par . ! ?, on l ajoute
  const lastIndex = sentences.reduce((acc, s) => acc + text.indexOf(s, acc) + s.length, 0);
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim();
    if (tail.length > 0) {
      // Coller a la derniere phrase plutot que creer un nouveau paragraphe
      if (sentences.length > 0) {
        sentences[sentences.length - 1] += ' ' + tail;
      } else {
        sentences.push(tail);
      }
    }
  }

  // Si aucune phrase detectee (texte sans ponctuation finale),
  // retourner tel quel
  if (sentences.length === 0) return [text.trim()];

  // Regrouper en paragraphes
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    const group = sentences.slice(i, i + sentencesPerParagraph).join(' ');
    paragraphs.push(group);
  }

  return paragraphs;
}
