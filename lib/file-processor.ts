import * as XLSX from 'xlsx';

export type FileNature = 'pitch_deck' | 'business_plan' | 'general_ledger' | 'financial_other' | 'unknown';

export interface ClassifiedFile {
  name: string;
  nature: FileNature;
  type: 'pdf' | 'excel' | 'csv' | 'word' | 'other';
  size: number;
  // Pour PDF : base64. Pour Excel/CSV/Word : contenu textuel extrait
  payload: string;
}

/**
 * Identifie la nature d'un fichier à partir de son nom et type MIME
 */
export function classifyFile(file: File): FileNature {
  const lowerName = file.name.toLowerCase();

  // Heuristiques sur le nom : grand livre comptable / FEC.
  // Detection prioritaire sur le BP parce que ces termes sont tres
  // specifiques et ne se confondent pas avec un BP projete.
  if (lowerName.includes('grand livre') || lowerName.includes('grand_livre') ||
      lowerName.includes('grandlivre') || lowerName.includes('general ledger') ||
      lowerName.includes('general_ledger') || lowerName.includes('generalledger') ||
      lowerName.includes('fec.') || lowerName.startsWith('fec_') ||
      lowerName.includes('_fec_') || lowerName.includes(' fec ') ||
      lowerName.includes('ecritures comptables') || lowerName.includes('ecritures_comptables') ||
      lowerName.includes('compta_') || lowerName.includes('_compta.') ||
      lowerName.includes('balance generale') || lowerName.includes('balance_generale') ||
      lowerName.includes('journal_compta') || lowerName.includes('ledger.')) {
    return 'general_ledger';
  }

  // Heuristiques sur le nom : business plan
  if (lowerName.includes('business plan') || lowerName.includes('businessplan') ||
      lowerName.includes('bp ') || lowerName.includes('_bp_') ||
      lowerName.includes('financial') || lowerName.includes('financier') ||
      lowerName.includes('budget') || lowerName.includes('forecast') ||
      lowerName.includes('projection')) {
    return 'business_plan';
  }

  if (lowerName.includes('pitch') || lowerName.includes('deck') ||
      lowerName.includes('teaser') || lowerName.includes('investor')) {
    return 'pitch_deck';
  }

  // Heuristiques sur le type
  if (file.type.includes('pdf')) {
    // PDF par défaut = pitch deck (sauf si nom contient business plan)
    return 'pitch_deck';
  }

  if (file.type.includes('spreadsheet') || file.type.includes('excel') ||
      file.type.includes('csv') || lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
    return 'business_plan';
  }

  return 'unknown';
}

/**
 * Détecte le type technique du fichier
 */
export function getFileType(file: File): ClassifiedFile['type'] {
  const lowerName = file.name.toLowerCase();
  if (file.type.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'excel';
  if (lowerName.endsWith('.csv')) return 'csv';
  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'word';
  return 'other';
}

/**
 * Extrait le contenu textuel d'un fichier Excel pour passage à Claude
 */
export function extractExcelContent(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { strip: true });
      if (csv.trim()) {
        sheets.push(`### Feuille : ${sheetName}\n${csv}`);
      }
    }

    return sheets.join('\n\n---\n\n').slice(0, 30000); // limite pour ne pas saturer le contexte
  } catch (e) {
    return '[Erreur lors de l\'extraction du fichier Excel]';
  }
}

/**
 * Extrait le contenu textuel d'un CSV
 */
export function extractCSVContent(buffer: Buffer): string {
  try {
    return buffer.toString('utf-8').slice(0, 30000);
  } catch (e) {
    return '[Erreur lors de l\'extraction du CSV]';
  }
}

/**
 * Classifie et extrait le contenu de tous les fichiers d'un dossier
 */
export async function processFiles(files: File[]): Promise<{
  pitchDeck: ClassifiedFile | null;
  businessPlan: ClassifiedFile | null;
  generalLedger: ClassifiedFile | null;
  others: ClassifiedFile[];
}> {
  const classified: ClassifiedFile[] = [];

  for (const file of files) {
    const nature = classifyFile(file);
    const type = getFileType(file);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let payload = '';
    if (type === 'pdf') {
      payload = buffer.toString('base64');
    } else if (type === 'excel') {
      payload = extractExcelContent(buffer);
    } else if (type === 'csv') {
      payload = extractCSVContent(buffer);
    } else {
      payload = buffer.toString('utf-8').slice(0, 30000);
    }

    classified.push({
      name: file.name,
      nature,
      type,
      size: file.size,
      payload,
    });
  }

  // Identifier le pitch deck principal (le PDF nommé pitch_deck)
  let pitchDeck: ClassifiedFile | null = classified.find(f => f.nature === 'pitch_deck' && f.type === 'pdf') || null;

  // Si pas trouvé, prendre le premier PDF
  if (!pitchDeck) {
    pitchDeck = classified.find(f => f.type === 'pdf') || null;
  }

  // Identifier le grand livre comptable en priorite (signal explicite
  // dans le nom ou structure FEC reconnue). Doit etre identifie avant
  // le BP pour eviter qu un fichier nomme "FEC.xlsx" soit pris pour
  // un BP.
  let generalLedger: ClassifiedFile | null = classified.find(f =>
    f.nature === 'general_ledger' && (f.type === 'excel' || f.type === 'csv')
  ) || null;

  // Detection structurelle si pas de match par nom : un Excel/CSV
  // dont le contenu commence par les headers FEC standard ou
  // par un schema "compte/debit/credit" est probablement un grand livre.
  if (!generalLedger) {
    const candidates = classified.filter(f => f !== pitchDeck && (f.type === 'excel' || f.type === 'csv'));
    for (const c of candidates) {
      if (looksLikeLedger(c.payload)) {
        c.nature = 'general_ledger';
        generalLedger = c;
        break;
      }
    }
  }

  // Identifier le BP (Excel ou CSV, distinct du grand livre)
  let businessPlan: ClassifiedFile | null = classified.find(f =>
    f !== generalLedger &&
    f.nature === 'business_plan' && (f.type === 'excel' || f.type === 'csv')
  ) || null;

  // Sinon, premier Excel/CSV qui ne soit ni le pitch ni le grand livre
  if (!businessPlan) {
    businessPlan = classified.find(f =>
      f !== pitchDeck && f !== generalLedger &&
      (f.type === 'excel' || f.type === 'csv')
    ) || null;
  }

  const others = classified.filter(f =>
    f !== pitchDeck && f !== businessPlan && f !== generalLedger
  );

  return { pitchDeck, businessPlan, generalLedger, others };
}

/**
 * Heuristique structurelle : un payload texte ressemble-t-il a un
 * grand livre comptable ? On cherche les marqueurs FEC ou les
 * combinaisons de colonnes typiques (compte + debit + credit).
 */
function looksLikeLedger(payload: string): boolean {
  if (!payload) return false;
  const head = payload.toLowerCase().slice(0, 4000);

  // Marqueurs FEC standard (texte tabule, 18 colonnes)
  const fecMarkers = ['journalcode', 'ecriturenum', 'comptenum', 'compaux', 'pieceref'];
  const fecHits = fecMarkers.filter(m => head.includes(m)).length;
  if (fecHits >= 3) return true;

  // Marqueurs Excel libre : compte + debit + credit dans la zone headers
  const hasCompte = /(\bcompte\b|\bnumero compte\b|\bn° compte\b|\bcompte num\b|\bcode compte\b)/.test(head);
  const hasDebit = /\bdebit\b|\bdébit\b/.test(head);
  const hasCredit = /\bcredit\b|\bcrédit\b/.test(head);
  if (hasCompte && hasDebit && hasCredit) return true;

  return false;
}
