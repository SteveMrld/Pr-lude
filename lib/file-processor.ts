import * as XLSX from 'xlsx';

export type FileNature = 'pitch_deck' | 'business_plan' | 'financial_other' | 'unknown';

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

  // Heuristiques sur le nom
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

  // Identifier le BP (Excel ou CSV)
  let businessPlan: ClassifiedFile | null = classified.find(f =>
    f.nature === 'business_plan' && (f.type === 'excel' || f.type === 'csv')
  ) || null;

  // Sinon, premier Excel/CSV
  if (!businessPlan) {
    businessPlan = classified.find(f => f.type === 'excel' || f.type === 'csv') || null;
  }

  const others = classified.filter(f => f !== pitchDeck && f !== businessPlan);

  return { pitchDeck, businessPlan, others };
}
