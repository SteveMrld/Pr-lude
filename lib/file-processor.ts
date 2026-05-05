import * as XLSX from 'xlsx';

export type FileNature =
  | 'pitch_deck'
  | 'business_plan'
  | 'general_ledger'
  | 'shareholders_agreement' // pacte d actionnaires
  | 'statutes'                // statuts
  | 'cap_table'               // tableau d actionnariat
  | 'client_contract'         // contrat client
  | 'financial_other'
  | 'unknown';

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

  // Pacte d actionnaires
  if (lowerName.includes('pacte') ||
      lowerName.includes('shareholders agreement') ||
      lowerName.includes('shareholders_agreement') ||
      lowerName.includes('shareholdersagreement') ||
      lowerName.includes(' sha.') || lowerName.startsWith('sha_') ||
      lowerName.includes('_sha_') || lowerName.includes('sha-') ||
      lowerName.includes('shareholder_agreement') ||
      lowerName.includes('investment agreement')) {
    return 'shareholders_agreement';
  }

  // Statuts
  if (lowerName.includes('statuts') || lowerName.includes('articles of association') ||
      lowerName.includes('articles_of_association') ||
      lowerName.includes(' aoa.') || lowerName.startsWith('aoa_') ||
      lowerName.includes('articlesofassociation') ||
      lowerName.includes('bylaws') ||
      lowerName.includes('memorandum and articles')) {
    return 'statutes';
  }

  // Cap table : excel ou pdf
  if (lowerName.includes('cap table') || lowerName.includes('cap_table') ||
      lowerName.includes('captable') || lowerName.includes('capitalisation') ||
      lowerName.includes('capitalization') || lowerName.includes('actionnariat') ||
      lowerName.includes('cap-table') ||
      lowerName.includes('table de capitalisation') ||
      lowerName.includes('cap_structure') || lowerName.includes('capstructure') ||
      lowerName.includes('repartition capital')) {
    return 'cap_table';
  }

  // Contrat client : detection assez specifique pour eviter les faux
  // positifs sur "contrat de travail" ou "contrat de prestation"
  if (lowerName.includes('contrat client') || lowerName.includes('contrat_client') ||
      lowerName.includes('contract_client') || lowerName.includes('clientcontract') ||
      lowerName.includes('client_agreement') ||
      lowerName.includes(' msa.') || lowerName.startsWith('msa_') ||
      lowerName.includes('_msa_') || lowerName.includes('master services agreement') ||
      lowerName.includes('master_services_agreement') ||
      lowerName.includes(' sla.') || lowerName.startsWith('sla_') ||
      lowerName.includes('order form') || lowerName.includes('order_form') ||
      lowerName.includes('purchase agreement') ||
      lowerName.includes('framework agreement')) {
    return 'client_contract';
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
  // Documents juridiques (Module 2 DD contractuelle)
  shareholdersAgreement: ClassifiedFile | null;
  statutes: ClassifiedFile | null;
  capTable: ClassifiedFile | null;
  clientContracts: ClassifiedFile[]; // peut etre plusieurs
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

  // Documents juridiques en priorite : on les extrait avant le pitch
  // pour eviter qu un PDF nomme "pacte_x.pdf" soit pris comme pitch.
  const shareholdersAgreement: ClassifiedFile | null = classified.find(f =>
    f.nature === 'shareholders_agreement' && f.type === 'pdf'
  ) || null;

  const statutes: ClassifiedFile | null = classified.find(f =>
    f.nature === 'statutes' && f.type === 'pdf'
  ) || null;

  const capTable: ClassifiedFile | null = classified.find(f =>
    f.nature === 'cap_table' && (f.type === 'excel' || f.type === 'csv' || f.type === 'pdf')
  ) || null;

  const clientContracts: ClassifiedFile[] = classified.filter(f =>
    f.nature === 'client_contract' && f.type === 'pdf'
  );

  // Identifier le pitch deck principal (le PDF nommé pitch_deck), en
  // excluant explicitement les PDF deja classes comme documents
  // juridiques.
  const legalPdfs = new Set<ClassifiedFile>([
    ...(shareholdersAgreement ? [shareholdersAgreement] : []),
    ...(statutes ? [statutes] : []),
    ...(capTable && capTable.type === 'pdf' ? [capTable] : []),
    ...clientContracts,
  ]);

  let pitchDeck: ClassifiedFile | null = classified.find(f =>
    f.nature === 'pitch_deck' && f.type === 'pdf' && !legalPdfs.has(f)
  ) || null;

  // Si pas trouvé, prendre le premier PDF qui n est pas un document juridique
  if (!pitchDeck) {
    pitchDeck = classified.find(f => f.type === 'pdf' && !legalPdfs.has(f)) || null;
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
    const candidates = classified.filter(f =>
      f !== pitchDeck && f !== capTable &&
      (f.type === 'excel' || f.type === 'csv')
    );
    for (const c of candidates) {
      if (looksLikeLedger(c.payload)) {
        c.nature = 'general_ledger';
        generalLedger = c;
        break;
      }
    }
  }

  // Identifier le BP (Excel ou CSV, distinct du grand livre et du cap table)
  let businessPlan: ClassifiedFile | null = classified.find(f =>
    f !== generalLedger && f !== capTable &&
    f.nature === 'business_plan' && (f.type === 'excel' || f.type === 'csv')
  ) || null;

  // Sinon, premier Excel/CSV qui ne soit ni le pitch ni le grand livre
  // ni le cap table
  if (!businessPlan) {
    businessPlan = classified.find(f =>
      f !== pitchDeck && f !== generalLedger && f !== capTable &&
      (f.type === 'excel' || f.type === 'csv')
    ) || null;
  }

  // Reste : tout ce qui n a pas ete classe
  const allClassified = new Set<ClassifiedFile>([
    ...(pitchDeck ? [pitchDeck] : []),
    ...(businessPlan ? [businessPlan] : []),
    ...(generalLedger ? [generalLedger] : []),
    ...(shareholdersAgreement ? [shareholdersAgreement] : []),
    ...(statutes ? [statutes] : []),
    ...(capTable ? [capTable] : []),
    ...clientContracts,
  ]);
  const others = classified.filter(f => !allClassified.has(f));

  return {
    pitchDeck,
    businessPlan,
    generalLedger,
    shareholdersAgreement,
    statutes,
    capTable,
    clientContracts,
    others,
  };
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
