// ============================================================
// Helpers purs pour le script d ingestion corpus Jabrilia
// ------------------------------------------------------------
// Extrait du script principal pour permettre les tests
// deterministes (deriveCompanyName, discoverPdfs, parseCliArgs).
// Pas de dependance Supabase ni de fetch ici : ce module est
// safe a importer depuis un test.
// ============================================================

import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

export interface CliArgs {
  applyMode: boolean;
  verbose: boolean;
  corpusPath: string | null;
}

/**
 * Parse les arguments du script. --apply active l ecriture, sinon
 * dry-run. Le premier argument positionnel est le chemin du corpus.
 * Defaut applyMode=false pour respecter la doctrine "dry-run par
 * defaut, apply explicite".
 */
export function parseCliArgs(argv: string[]): CliArgs {
  const applyMode = argv.includes('--apply');
  const verbose = argv.includes('--verbose');
  const positional = argv.filter(a => !a.startsWith('--'));
  return {
    applyMode,
    verbose,
    corpusPath: positional[0] || null,
  };
}

/**
 * Heuristique de nom de societe a partir du filename. Sert a la
 * fois de clef d idempotence (compare contre reference_dossiers.
 * company_name) et de nom d affichage initial. Le pipeline
 * d extraction met a jour analyses.company_name avec le nom
 * canonique reel ensuite.
 *
 * Regles :
 *   - retire l extension
 *   - remplace tirets/underscores par espaces
 *   - retire les motifs date courants (2024, 2024-Q3, 2024-T2)
 *   - capitalize chaque mot
 *   - retombe sur le basename si la regle vide tout
 */
export function deriveCompanyName(filename: string): string {
  const base = basename(filename, extname(filename));
  // Sequence : remplace tirets/underscores par espaces, retire les
  // tokens date (annee a 4 chiffres et marqueurs de periode Q1, T3
  // qui restent une fois isoles), normalise les espaces, capitalize.
  const cleaned = base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d{4}\b/g, '')
    .replace(/\b[QT]\d\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return cleaned || base;
}

export interface PdfEntry {
  fullPath: string;
  filename: string;
  size: number;
  companyName: string;
  deckReceivedAt: string;
}

/**
 * Liste les PDFs d un dossier. Retourne tableau vide si le dossier
 * n existe pas ou n est pas un dossier. Trie par filename pour un
 * ordre stable inter-runs. La date de reception defaut au jour
 * courant ; un sidecar JSON par PDF pourra plus tard override.
 */
export function discoverPdfs(corpusPath: string, today?: string): PdfEntry[] {
  if (!existsSync(corpusPath)) return [];
  let stat;
  try { stat = statSync(corpusPath); } catch { return []; }
  if (!stat.isDirectory()) return [];

  const entries = readdirSync(corpusPath);
  const dateStr = today || new Date().toISOString().slice(0, 10);
  const pdfs: PdfEntry[] = [];
  for (const entry of entries) {
    const full = join(corpusPath, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (!s.isFile()) continue;
    if (extname(entry).toLowerCase() !== '.pdf') continue;
    pdfs.push({
      fullPath: full,
      filename: entry,
      size: s.size,
      companyName: deriveCompanyName(entry),
      deckReceivedAt: dateStr,
    });
  }
  return pdfs.sort((a, b) => a.filename.localeCompare(b.filename));
}
