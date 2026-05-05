// ============================================================
// LEDGER PARSER (Module 1 DD financiere - etape 1)
// ------------------------------------------------------------
// Parse un grand livre comptable au format FEC standard francais
// (Fichier des Ecritures Comptables, 18 colonnes normees) ou un
// Excel/CSV libre avec un schema souple (date, compte, libelle,
// debit, credit). Produit une LedgerExtraction structuree avec :
//
// - Soldes agreges par classe de compte (1 a 7)
// - CA reel sur 12 derniers mois avec breakdown mensuel
// - Charges reelles avec breakdown par classe (60, 61, 62, 63, 64)
// - Marge brute reelle
// - Top 10 clients via comptes 411x
// - Top 10 fournisseurs via comptes 401x
// - Cash reel via 512 + 530
// - Engagements hors bilan via 16x, 17x, 421x, 43x, 44x, 455x
// - Burn rate moyen sur 6 derniers mois
// - Runway reel (cash / burn)
// - DSO et DPO
// - Drapeaux automatiques deterministes
//
// Le parsing est entierement deterministe, pas d appel LLM. Le
// moteur DD financier en aval consommera ces donnees brutes pour
// produire l analyse qualitative.
// ============================================================

// ============================================================
// Types
// ============================================================

export interface LedgerEntry {
  date: string;             // ISO YYYY-MM-DD
  accountNumber: string;    // ex "411001" ou "70110000"
  accountLabel: string;     // ex "CLIENTS - SOC X"
  auxAccountNumber: string | null; // compte auxiliaire si present
  auxAccountLabel: string | null;
  description: string;      // libelle de l ecriture
  debit: number;            // EUR
  credit: number;           // EUR
  journal: string | null;   // code journal
  pieceRef: string | null;  // reference piece
}

export interface LedgerFlag {
  severity: 'info' | 'attention' | 'alert' | 'critical';
  code: string;
  message: string;
}

export interface ClientConcentration {
  accountNumber: string;
  label: string;
  revenueLast12Months: number;
  pctOfTotal: number;
}

export interface SupplierConcentration {
  accountNumber: string;
  label: string;
  chargeLast12Months: number;
  pctOfTotal: number;
}

export interface MonthlyBreakdown {
  month: string; // YYYY-MM
  amount: number;
}

export interface LedgerExtraction {
  hasLedger: boolean;
  source: 'fec' | 'excel_libre' | 'csv_libre' | 'unknown';
  parseQuality: 'high' | 'medium' | 'low'; // confiance dans le parsing
  parseWarnings: string[]; // warnings non bloquants pendant le parsing

  // Periode couverte
  periodStart: string | null;
  periodEnd: string | null;
  totalEntries: number;

  // Agregats par classe (en EUR, sens debit-credit normalise par classe)
  classBalances: {
    class1: number; // capitaux propres + emprunts (credit normal)
    class2: number; // immobilisations (debit normal)
    class3: number; // stocks (debit normal)
    class4: number; // tiers (clients debit, fournisseurs credit)
    class5: number; // financieres (debit pour banque)
    class6: number; // charges (debit)
    class7: number; // produits (credit)
  };

  // Indicateurs business calcules
  realRevenue: {
    last12MonthsTotal: number;
    monthlyBreakdown: MonthlyBreakdown[];
    growthRate: number | null; // % YoY si on a 24 mois de donnees
    volatilityCoeff: number | null; // ecart-type / moyenne sur 12 mois
  };

  realCharges: {
    last12MonthsTotal: number;
    breakdownByClass: {
      class60: number; // achats
      class61: number; // services exterieurs
      class62: number; // autres services exterieurs
      class63: number; // impots taxes
      class64: number; // frais de personnel
      class65: number; // autres charges
      class66: number; // charges financieres
      class67: number; // charges exceptionnelles
      class68: number; // dotations amortissements
    };
  };

  realGrossMargin: {
    valueEur: number | null;     // produits - achats - services exterieurs
    pctOfRevenue: number | null;
  };

  realEbitda: {
    valueEur: number | null;     // produits - charges hors 66, 67, 68
    pctOfRevenue: number | null;
  };

  cash: {
    banks: number;        // 512x
    petty: number;        // 530x
    total: number;
  };

  // Top tiers
  topClients: ClientConcentration[];
  topSuppliers: SupplierConcentration[];

  // Engagements hors bilan
  offBalanceCommitments: {
    longTermDebt: number;        // 16x emprunts
    relatedPartyDebts: number;   // 17x dettes liees, 451x groupe et associes
    associateAccounts: number;   // 455x comptes courants associes (debit = pretee a la societe, credit = preteurs)
    payablesNet: number;         // 401x net (credit normal, dette envers fournisseurs)
    salariesDue: number;         // 421x
    socialContributions: number; // 43x
    taxesDue: number;            // 44x
  };

  // Burn et runway
  burnAndRunway: {
    avgMonthlyBurn6m: number | null;     // moyenne sortie cash 6 derniers mois
    runwayMonths: number | null;          // cash total / burn mensuel
  };

  // Cycle de cash
  workingCapital: {
    dso: number | null; // jours
    dpo: number | null; // jours
  };

  // Signaux faibles detectes
  flags: LedgerFlag[];
}

// ============================================================
// Helpers : parsing numerique francais
// ============================================================

function parseEurAmount(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw).trim();
  if (!s) return 0;
  // Retire espaces fines, espaces, EUR/€
  s = s.replace(/\u00a0|\u202f|\s|€|EUR|eur/g, '');
  // Si presence d une virgule ET d un point : on suppose virgule = decimale
  // (format francais). On enleve les points de milliers, on remplace virgule par point.
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Virgule seule = decimale francaise
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDateISO(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // Format FEC : AAAAMMJJ (8 chiffres)
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // Format ISO : YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  // Format francais : JJ/MM/AAAA
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fr) {
    const dd = fr[1].padStart(2, '0');
    const mm = fr[2].padStart(2, '0');
    const yyyy = fr[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // Format JJ-MM-AAAA
  const fr2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (fr2) {
    const dd = fr2[1].padStart(2, '0');
    const mm = fr2[2].padStart(2, '0');
    const yyyy = fr2[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// ============================================================
// Detection du format du grand livre
// ============================================================

export function detectLedgerSource(rawText: string): LedgerExtraction['source'] {
  if (!rawText) return 'unknown';
  const head = rawText.toLowerCase().slice(0, 4000);
  const fecMarkers = ['journalcode', 'ecriturenum', 'comptenum', 'pieceref', 'ecriturelib'];
  const fecHits = fecMarkers.filter(m => head.includes(m)).length;
  if (fecHits >= 3) return 'fec';
  // CSV : separateur virgule
  if (rawText.includes(',') && !rawText.includes('\t')) return 'csv_libre';
  return 'excel_libre';
}

// ============================================================
// Parsing FEC standard
// ============================================================

const FEC_HEADERS_NORMALIZED = [
  'journalcode', 'journallib', 'ecriturenum', 'ecrituredate',
  'comptenum', 'comptelib', 'compauxnum', 'compauxlib',
  'pieceref', 'piecedate', 'ecriturelib', 'debit', 'credit',
  'ecriturelet', 'datelet', 'validdate', 'montantdevise', 'idevise',
];

function parseFEC(rawText: string, warnings: string[]): LedgerEntry[] {
  // Detection du separateur : tab prioritaire, sinon pipe
  const firstLine = rawText.split(/\r?\n/, 1)[0] || '';
  const sep = firstLine.includes('\t') ? '\t' : (firstLine.includes('|') ? '|' : '\t');

  const lines = rawText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    warnings.push('FEC: moins de 2 lignes detectees, fichier probablement vide');
    return [];
  }

  // Parse header ligne 0
  const headerCells = lines[0].split(sep).map(h => h.trim().toLowerCase());

  // Construit mapping header -> index
  const headerIndex: Record<string, number> = {};
  for (let i = 0; i < headerCells.length; i++) {
    const h = headerCells[i].replace(/[\s_]/g, '');
    if (FEC_HEADERS_NORMALIZED.includes(h)) {
      headerIndex[h] = i;
    }
  }

  // Verifier qu on a au moins les colonnes essentielles
  const required = ['ecrituredate', 'comptenum', 'debit', 'credit'];
  for (const r of required) {
    if (!(r in headerIndex)) {
      warnings.push(`FEC: colonne ${r} manquante, fichier non conforme au format FEC`);
      return [];
    }
  }

  const entries: LedgerEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    if (cells.length < required.length) continue;

    const entry: LedgerEntry = {
      date: parseDateISO(cells[headerIndex.ecrituredate] || '') || '',
      accountNumber: (cells[headerIndex.comptenum] || '').trim(),
      accountLabel: ((headerIndex.comptelib != null ? cells[headerIndex.comptelib] : '') || '').trim(),
      auxAccountNumber: headerIndex.compauxnum != null ? (cells[headerIndex.compauxnum] || '').trim() || null : null,
      auxAccountLabel: headerIndex.compauxlib != null ? (cells[headerIndex.compauxlib] || '').trim() || null : null,
      description: ((headerIndex.ecriturelib != null ? cells[headerIndex.ecriturelib] : '') || '').trim(),
      debit: parseEurAmount(cells[headerIndex.debit]),
      credit: parseEurAmount(cells[headerIndex.credit]),
      journal: headerIndex.journalcode != null ? (cells[headerIndex.journalcode] || '').trim() || null : null,
      pieceRef: headerIndex.pieceref != null ? (cells[headerIndex.pieceref] || '').trim() || null : null,
    };

    if (!entry.date || !entry.accountNumber) continue;
    entries.push(entry);
  }

  return entries;
}

// ============================================================
// Parsing Excel libre / CSV libre
// ============================================================

interface ColMap {
  date: number;
  account: number;
  accountLabel: number;
  description: number;
  debit: number;
  credit: number;
}

function findHeaderRow(lines: string[], sep: string): { idx: number; map: ColMap | null } {
  // On cherche la premiere ligne qui contient les marqueurs essentiels
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const cells = lines[i].split(sep).map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ''));
    let dateIdx = -1, accountIdx = -1, accountLabelIdx = -1, debitIdx = -1, creditIdx = -1, descIdx = -1;
    for (let j = 0; j < cells.length; j++) {
      const c = cells[j];
      if (dateIdx < 0 && (c === 'date' || c === 'datepiece' || c === 'datecompta' || c === 'datecomptable' || c === 'dateecriture')) dateIdx = j;
      if (accountIdx < 0 && (c === 'compte' || c === 'comptenum' || c === 'numerocompte' || c === 'numcompte' || c === 'codecompte' || c === 'n°compte' || c === 'n°c' || c === 'numero' || c === 'numéro')) accountIdx = j;
      if (accountLabelIdx < 0 && (c === 'comptelib' || c === 'libellecompte' || c === 'intitulecompte' || c === 'nomcompte')) accountLabelIdx = j;
      if (debitIdx < 0 && (c === 'debit' || c === 'débit' || c === 'montantdebit' || c === 'amountdebit')) debitIdx = j;
      if (creditIdx < 0 && (c === 'credit' || c === 'crédit' || c === 'montantcredit' || c === 'amountcredit')) creditIdx = j;
      if (descIdx < 0 && (c === 'libelle' || c === 'libellé' || c === 'libelleecriture' || c === 'libellécriture' || c === 'description' || c === 'objet' || c === 'narration' || c === 'intitule' || c === 'intitulé')) descIdx = j;
    }
    if (dateIdx >= 0 && accountIdx >= 0 && debitIdx >= 0 && creditIdx >= 0) {
      return {
        idx: i,
        map: {
          date: dateIdx,
          account: accountIdx,
          accountLabel: accountLabelIdx,
          description: descIdx,
          debit: debitIdx,
          credit: creditIdx,
        },
      };
    }
  }
  return { idx: -1, map: null };
}

function parseLedgerLibre(rawText: string, sep: string, warnings: string[]): LedgerEntry[] {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    warnings.push('Grand livre: moins de 2 lignes detectees');
    return [];
  }

  const found = findHeaderRow(lines, sep);
  if (!found.map) {
    warnings.push('Grand livre: header non identifie. Colonnes attendues : date, compte, libelle, debit, credit.');
    return [];
  }
  const map = found.map;

  const entries: LedgerEntry[] = [];
  for (let i = found.idx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    if (cells.length < Math.max(map.date, map.account, map.debit, map.credit) + 1) continue;

    const entry: LedgerEntry = {
      date: parseDateISO(cells[map.date] || '') || '',
      accountNumber: (cells[map.account] || '').trim(),
      accountLabel: map.accountLabel >= 0 ? (cells[map.accountLabel] || '').trim() : '',
      auxAccountNumber: null,
      auxAccountLabel: null,
      description: map.description >= 0 ? (cells[map.description] || '').trim() : '',
      debit: parseEurAmount(cells[map.debit]),
      credit: parseEurAmount(cells[map.credit]),
      journal: null,
      pieceRef: null,
    };

    if (!entry.date || !entry.accountNumber) continue;
    entries.push(entry);
  }

  return entries;
}

// ============================================================
// Calculs business
// ============================================================

function classOf(accountNumber: string): number {
  const c = (accountNumber || '').trim().charAt(0);
  const n = parseInt(c, 10);
  return Number.isFinite(n) ? n : 0;
}

function startsWith(account: string, prefix: string): boolean {
  return (account || '').trim().startsWith(prefix);
}

function isClientAccount(account: string): boolean {
  return startsWith(account, '411');
}

function isSupplierAccount(account: string): boolean {
  return startsWith(account, '401');
}

function isBankAccount(account: string): boolean {
  return startsWith(account, '512');
}

function isPettyCashAccount(account: string): boolean {
  return startsWith(account, '530') || startsWith(account, '531');
}

function aggregateClassBalances(entries: LedgerEntry[]): LedgerExtraction['classBalances'] {
  const totals: Record<number, { debit: number; credit: number }> = {};
  for (let i = 1; i <= 7; i++) totals[i] = { debit: 0, credit: 0 };
  for (const e of entries) {
    const c = classOf(e.accountNumber);
    if (c >= 1 && c <= 7) {
      totals[c].debit += e.debit;
      totals[c].credit += e.credit;
    }
  }
  return {
    class1: totals[1].credit - totals[1].debit, // credit normal pour capitaux et emprunts
    class2: totals[2].debit - totals[2].credit, // debit normal pour immobilisations
    class3: totals[3].debit - totals[3].credit, // debit normal pour stocks
    class4: totals[4].debit - totals[4].credit, // melange : on retourne la difference brute
    class5: totals[5].debit - totals[5].credit, // debit normal pour banque
    class6: totals[6].debit - totals[6].credit, // debit normal pour charges
    class7: totals[7].credit - totals[7].debit, // credit normal pour produits
  };
}

function isWithinLast12Months(date: string, refDate: Date): boolean {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date(refDate);
  cutoff.setMonth(cutoff.getMonth() - 12);
  return d >= cutoff && d <= refDate;
}

function isWithinLast6Months(date: string, refDate: Date): boolean {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date(refDate);
  cutoff.setMonth(cutoff.getMonth() - 6);
  return d >= cutoff && d <= refDate;
}

function getMonth(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function computeRealRevenue(entries: LedgerEntry[], refDate: Date): LedgerExtraction['realRevenue'] {
  // Produits = comptes 70x (credit - debit, credit normal)
  const last12 = entries.filter(e => classOf(e.accountNumber) === 7 && isWithinLast12Months(e.date, refDate));
  const total = last12.reduce((s, e) => s + (e.credit - e.debit), 0);

  // Breakdown mensuel
  const monthMap: Record<string, number> = {};
  for (const e of last12) {
    const m = getMonth(e.date);
    monthMap[m] = (monthMap[m] || 0) + (e.credit - e.debit);
  }
  const monthlyBreakdown: MonthlyBreakdown[] = Object.entries(monthMap)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Growth rate : on cherche les 12 mois precedents (M-13 a M-24)
  const prevCutoffStart = new Date(refDate);
  prevCutoffStart.setMonth(prevCutoffStart.getMonth() - 24);
  const prevCutoffEnd = new Date(refDate);
  prevCutoffEnd.setMonth(prevCutoffEnd.getMonth() - 12);
  const prev12 = entries.filter(e => classOf(e.accountNumber) === 7 && (() => {
    const d = new Date(e.date);
    return d >= prevCutoffStart && d < prevCutoffEnd;
  })());
  const prevTotal = prev12.reduce((s, e) => s + (e.credit - e.debit), 0);
  const growthRate = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  // Volatilite : ecart-type / moyenne sur le breakdown mensuel
  let volatilityCoeff: number | null = null;
  if (monthlyBreakdown.length >= 6) {
    const values = monthlyBreakdown.map(m => m.amount);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    volatilityCoeff = mean > 0 ? stdDev / mean : null;
  }

  return {
    last12MonthsTotal: total,
    monthlyBreakdown,
    growthRate,
    volatilityCoeff,
  };
}

function computeRealCharges(entries: LedgerEntry[], refDate: Date): LedgerExtraction['realCharges'] {
  const last12 = entries.filter(e => classOf(e.accountNumber) === 6 && isWithinLast12Months(e.date, refDate));
  const total = last12.reduce((s, e) => s + (e.debit - e.credit), 0);

  const breakdownByClass = {
    class60: 0, class61: 0, class62: 0, class63: 0, class64: 0,
    class65: 0, class66: 0, class67: 0, class68: 0,
  };
  for (const e of last12) {
    const sub = e.accountNumber.charAt(1);
    const amount = e.debit - e.credit;
    switch (sub) {
      case '0': breakdownByClass.class60 += amount; break;
      case '1': breakdownByClass.class61 += amount; break;
      case '2': breakdownByClass.class62 += amount; break;
      case '3': breakdownByClass.class63 += amount; break;
      case '4': breakdownByClass.class64 += amount; break;
      case '5': breakdownByClass.class65 += amount; break;
      case '6': breakdownByClass.class66 += amount; break;
      case '7': breakdownByClass.class67 += amount; break;
      case '8': breakdownByClass.class68 += amount; break;
    }
  }

  return { last12MonthsTotal: total, breakdownByClass };
}

function computeRealMargins(
  revenue: LedgerExtraction['realRevenue'],
  charges: LedgerExtraction['realCharges'],
): { gross: LedgerExtraction['realGrossMargin']; ebitda: LedgerExtraction['realEbitda'] } {
  const rev = revenue.last12MonthsTotal;
  if (rev <= 0) {
    return {
      gross: { valueEur: null, pctOfRevenue: null },
      ebitda: { valueEur: null, pctOfRevenue: null },
    };
  }
  // Marge brute : produits - achats (60) - services exterieurs (61, 62)
  const directCosts = charges.breakdownByClass.class60 + charges.breakdownByClass.class61 + charges.breakdownByClass.class62;
  const grossValue = rev - directCosts;

  // EBITDA : produits - charges hors 66 financieres, 67 exceptionnelles, 68 dotations
  const ebitdaCharges = charges.breakdownByClass.class60 + charges.breakdownByClass.class61 +
                        charges.breakdownByClass.class62 + charges.breakdownByClass.class63 +
                        charges.breakdownByClass.class64 + charges.breakdownByClass.class65;
  const ebitdaValue = rev - ebitdaCharges;

  return {
    gross: {
      valueEur: grossValue,
      pctOfRevenue: (grossValue / rev) * 100,
    },
    ebitda: {
      valueEur: ebitdaValue,
      pctOfRevenue: (ebitdaValue / rev) * 100,
    },
  };
}

function computeCash(entries: LedgerEntry[]): LedgerExtraction['cash'] {
  const banks = entries
    .filter(e => isBankAccount(e.accountNumber))
    .reduce((s, e) => s + (e.debit - e.credit), 0);
  const petty = entries
    .filter(e => isPettyCashAccount(e.accountNumber))
    .reduce((s, e) => s + (e.debit - e.credit), 0);
  return { banks, petty, total: banks + petty };
}

function computeTopClients(entries: LedgerEntry[], refDate: Date, limit = 10): { list: ClientConcentration[]; totalRevenue: number } {
  // On regroupe les ecritures sur comptes 411x par compte auxiliaire
  // (s il existe) sinon par numero de compte. Le CA reel = credit - debit
  // sur ces comptes (le credit augmente la dette client donc represente
  // une vente). Mais en realite la vente est enregistree par 411 debit
  // contrepartie 70 credit. Pour mesurer le volume genere par client,
  // on regarde le total debit (montant facture) en enlevant les avoirs.
  const byClient: Map<string, { label: string; debit: number; credit: number }> = new Map();
  for (const e of entries) {
    if (!isClientAccount(e.accountNumber)) continue;
    if (!isWithinLast12Months(e.date, refDate)) continue;
    const key = e.auxAccountNumber || e.accountNumber;
    const label = e.auxAccountLabel || e.accountLabel || key;
    const cur = byClient.get(key) || { label, debit: 0, credit: 0 };
    cur.debit += e.debit;
    cur.credit += e.credit;
    if (label && !cur.label) cur.label = label;
    byClient.set(key, cur);
  }
  // Volume facture = debit (montant facture) - credit (avoirs et reglements)
  // Mais reglements aussi creditent 411. Approximation : on prend
  // max(debit, credit) comme volume d activite, puis on prend debit
  // comme volume de facture realiste si > credit, sinon credit.
  // Plus simple : on prend debit comme proxy raisonnable du CA
  // genere par client (volume facture brut sur 12 mois).
  const list: ClientConcentration[] = Array.from(byClient.entries())
    .map(([accountNumber, v]) => ({
      accountNumber,
      label: v.label,
      revenueLast12Months: v.debit,
      pctOfTotal: 0,
    }))
    .filter(c => c.revenueLast12Months > 0)
    .sort((a, b) => b.revenueLast12Months - a.revenueLast12Months)
    .slice(0, limit);

  const totalRevenue = list.reduce((s, c) => s + c.revenueLast12Months, 0);
  // pctOfTotal : il faut le CA total reel pour etre pertinent, on
  // calcule au callsite avec la revenue reelle.
  return { list, totalRevenue };
}

function computeTopSuppliers(entries: LedgerEntry[], refDate: Date, limit = 10): SupplierConcentration[] {
  const bySupplier: Map<string, { label: string; debit: number; credit: number }> = new Map();
  for (const e of entries) {
    if (!isSupplierAccount(e.accountNumber)) continue;
    if (!isWithinLast12Months(e.date, refDate)) continue;
    const key = e.auxAccountNumber || e.accountNumber;
    const label = e.auxAccountLabel || e.accountLabel || key;
    const cur = bySupplier.get(key) || { label, debit: 0, credit: 0 };
    cur.debit += e.debit;
    cur.credit += e.credit;
    if (label && !cur.label) cur.label = label;
    bySupplier.set(key, cur);
  }
  // Volume achat = credit (montant facture par fournisseur) - debit (reglements)
  // Le credit est le proxy raisonnable du volume d achat sur 12 mois.
  const list: SupplierConcentration[] = Array.from(bySupplier.entries())
    .map(([accountNumber, v]) => ({
      accountNumber,
      label: v.label,
      chargeLast12Months: v.credit,
      pctOfTotal: 0,
    }))
    .filter(s => s.chargeLast12Months > 0)
    .sort((a, b) => b.chargeLast12Months - a.chargeLast12Months)
    .slice(0, limit);

  return list;
}

function computeOffBalance(entries: LedgerEntry[]): LedgerExtraction['offBalanceCommitments'] {
  function sumByPrefix(prefix: string, sign: 'credit' | 'debit'): number {
    const filt = entries.filter(e => startsWith(e.accountNumber, prefix));
    return sign === 'credit'
      ? filt.reduce((s, e) => s + (e.credit - e.debit), 0)
      : filt.reduce((s, e) => s + (e.debit - e.credit), 0);
  }
  return {
    longTermDebt: sumByPrefix('16', 'credit'),
    relatedPartyDebts: sumByPrefix('17', 'credit') + sumByPrefix('451', 'credit'),
    associateAccounts: sumByPrefix('455', 'credit') - sumByPrefix('455', 'debit'),
    payablesNet: sumByPrefix('401', 'credit'),
    salariesDue: sumByPrefix('421', 'credit') + sumByPrefix('422', 'credit'),
    socialContributions: sumByPrefix('43', 'credit'),
    taxesDue: sumByPrefix('44', 'credit'),
  };
}

function computeBurnAndRunway(
  entries: LedgerEntry[],
  cash: LedgerExtraction['cash'],
  refDate: Date,
): LedgerExtraction['burnAndRunway'] {
  // Burn = sortie nette de cash sur 6 derniers mois
  // Approche : variation du solde 512 entre M-6 et M0
  const sixMonthsAgo = new Date(refDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const beforeCutoff = entries.filter(e => isBankAccount(e.accountNumber) && new Date(e.date) < sixMonthsAgo);
  const cashAtMinus6 = beforeCutoff.reduce((s, e) => s + (e.debit - e.credit), 0);

  if (cash.banks <= 0 && cashAtMinus6 <= 0) {
    return { avgMonthlyBurn6m: null, runwayMonths: null };
  }
  const variationOver6m = cash.banks - cashAtMinus6;
  // Burn = variation negative (cash diminue). Si positive (cash augmente
  // grace a une levee), on n a pas un burn meaningful sur 6 mois.
  if (variationOver6m >= 0) {
    return { avgMonthlyBurn6m: 0, runwayMonths: null };
  }
  const monthlyBurn = Math.abs(variationOver6m) / 6;
  const runway = monthlyBurn > 0 ? cash.total / monthlyBurn : null;
  return { avgMonthlyBurn6m: monthlyBurn, runwayMonths: runway };
}

function computeWorkingCapital(
  entries: LedgerEntry[],
  revenue: LedgerExtraction['realRevenue'],
  charges: LedgerExtraction['realCharges'],
  refDate: Date,
): LedgerExtraction['workingCapital'] {
  // DSO = (creances clients / CA TTC) * 365
  // Approche : solde 411 net (debit - credit) au refDate / CA 12 mois
  const clientsBalance = entries
    .filter(e => isClientAccount(e.accountNumber) && new Date(e.date) <= refDate)
    .reduce((s, e) => s + (e.debit - e.credit), 0);
  const dso = revenue.last12MonthsTotal > 0
    ? (clientsBalance / revenue.last12MonthsTotal) * 365
    : null;

  const suppliersBalance = entries
    .filter(e => isSupplierAccount(e.accountNumber) && new Date(e.date) <= refDate)
    .reduce((s, e) => s + (e.credit - e.debit), 0);
  // DPO base sur achats class 60 + services 61 + 62 sur 12 mois
  const purchasesBase = charges.breakdownByClass.class60 + charges.breakdownByClass.class61 + charges.breakdownByClass.class62;
  const dpo = purchasesBase > 0 ? (suppliersBalance / purchasesBase) * 365 : null;

  return { dso, dpo };
}

// ============================================================
// Drapeaux deterministes
// ============================================================

function computeFlags(extraction: LedgerExtraction): LedgerFlag[] {
  const flags: LedgerFlag[] = [];

  // Concentration client
  const totalClientRevenue = extraction.topClients.reduce((s, c) => s + c.revenueLast12Months, 0);
  if (extraction.topClients.length > 0 && totalClientRevenue > 0) {
    const top1 = extraction.topClients[0];
    const top1Pct = (top1.revenueLast12Months / totalClientRevenue) * 100;
    if (top1Pct >= 40) {
      flags.push({
        severity: 'critical',
        code: 'concentration_top1',
        message: `Le premier client represente ${top1Pct.toFixed(1)}% du volume client total sur 12 mois (${top1.label}). Concentration critique : la perte de ce client mettrait l activite en peril immediat.`,
      });
    } else if (top1Pct >= 25) {
      flags.push({
        severity: 'alert',
        code: 'concentration_top1',
        message: `Le premier client represente ${top1Pct.toFixed(1)}% du volume client total sur 12 mois (${top1.label}). Concentration elevee a documenter en DD.`,
      });
    }
    const top3Pct = extraction.topClients.slice(0, 3).reduce((s, c) => s + c.revenueLast12Months, 0) / totalClientRevenue * 100;
    if (top3Pct >= 70) {
      flags.push({
        severity: 'alert',
        code: 'concentration_top3',
        message: `Les trois premiers clients representent ${top3Pct.toFixed(1)}% du volume client total. Concentration de portefeuille a evaluer.`,
      });
    }
  }

  // Marge brute negative
  if (extraction.realGrossMargin.pctOfRevenue !== null && extraction.realGrossMargin.pctOfRevenue < 0) {
    flags.push({
      severity: 'critical',
      code: 'gross_margin_negative',
      message: `Marge brute reelle negative : ${extraction.realGrossMargin.pctOfRevenue.toFixed(1)}%. Les charges directes (achats + services exterieurs) excedent les produits. Modele economique non viable en l etat.`,
    });
  } else if (extraction.realGrossMargin.pctOfRevenue !== null && extraction.realGrossMargin.pctOfRevenue < 20) {
    flags.push({
      severity: 'attention',
      code: 'gross_margin_low',
      message: `Marge brute reelle ${extraction.realGrossMargin.pctOfRevenue.toFixed(1)}% : faible vs benchmark. A confronter aux projections du BP.`,
    });
  }

  // Runway court
  if (extraction.burnAndRunway.runwayMonths !== null && extraction.burnAndRunway.runwayMonths < 6) {
    flags.push({
      severity: 'critical',
      code: 'runway_short',
      message: `Runway reel calcule a ${extraction.burnAndRunway.runwayMonths.toFixed(1)} mois. Levee imperative dans les 90 a 180 jours.`,
    });
  } else if (extraction.burnAndRunway.runwayMonths !== null && extraction.burnAndRunway.runwayMonths < 12) {
    flags.push({
      severity: 'alert',
      code: 'runway_tight',
      message: `Runway reel calcule a ${extraction.burnAndRunway.runwayMonths.toFixed(1)} mois. Marge de manoeuvre tendue.`,
    });
  }

  // DSO eleve
  if (extraction.workingCapital.dso !== null && extraction.workingCapital.dso > 90) {
    flags.push({
      severity: 'attention',
      code: 'dso_high',
      message: `DSO calcule a ${extraction.workingCapital.dso.toFixed(0)} jours. Cycle d encaissement long, pression sur le BFR.`,
    });
  }

  // Charges exceptionnelles elevees
  if (extraction.realRevenue.last12MonthsTotal > 0 && extraction.realCharges.breakdownByClass.class67 > 0) {
    const exceptionalPct = (extraction.realCharges.breakdownByClass.class67 / extraction.realRevenue.last12MonthsTotal) * 100;
    if (exceptionalPct > 5) {
      flags.push({
        severity: 'attention',
        code: 'exceptional_charges_high',
        message: `Charges exceptionnelles ${exceptionalPct.toFixed(1)}% du CA sur 12 mois. A detailler : litiges, regularisations, depreciations exceptionnelles.`,
      });
    }
  }

  // Comptes courants associes en debit (la societe a prete aux associes)
  if (extraction.offBalanceCommitments.associateAccounts < 0) {
    flags.push({
      severity: 'alert',
      code: 'associate_accounts_debit',
      message: `Comptes courants associes en debit pour ${Math.abs(extraction.offBalanceCommitments.associateAccounts).toFixed(0)} EUR. La societe a prete a ses associes : a documenter.`,
    });
  }

  // Engagements significatifs vs cash
  const totalCommitments = extraction.offBalanceCommitments.longTermDebt +
                           extraction.offBalanceCommitments.salariesDue +
                           extraction.offBalanceCommitments.socialContributions +
                           extraction.offBalanceCommitments.taxesDue;
  if (extraction.cash.total > 0 && totalCommitments > extraction.cash.total) {
    flags.push({
      severity: 'alert',
      code: 'commitments_above_cash',
      message: `Engagements totaux (dette LT + salaires dus + charges sociales + dette fiscale) superieurs au cash disponible. Vigilance sur la liquidite.`,
    });
  }

  // Revenue volatil
  if (extraction.realRevenue.volatilityCoeff !== null && extraction.realRevenue.volatilityCoeff > 0.5) {
    flags.push({
      severity: 'info',
      code: 'revenue_volatile',
      message: `Coefficient de variation du CA mensuel ${(extraction.realRevenue.volatilityCoeff * 100).toFixed(0)}%. Saisonnalite ou activite irreguliere a expliciter.`,
    });
  }

  return flags;
}

// ============================================================
// Fonction principale
// ============================================================

export function parseLedger(rawText: string): LedgerExtraction {
  const warnings: string[] = [];

  if (!rawText || rawText.trim().length < 50) {
    return makeEmpty(warnings.concat('Grand livre vide ou tronque'));
  }

  const source = detectLedgerSource(rawText);
  let entries: LedgerEntry[] = [];

  if (source === 'fec') {
    entries = parseFEC(rawText, warnings);
  } else if (source === 'csv_libre') {
    entries = parseLedgerLibre(rawText, ',', warnings);
    if (entries.length === 0) {
      entries = parseLedgerLibre(rawText, ';', warnings);
    }
  } else {
    // excel libre : separe par virgule (sortie XLSX.utils.sheet_to_csv) ou tab
    entries = parseLedgerLibre(rawText, ',', warnings);
    if (entries.length === 0) {
      entries = parseLedgerLibre(rawText, ';', warnings);
    }
    if (entries.length === 0) {
      entries = parseLedgerLibre(rawText, '\t', warnings);
    }
  }

  if (entries.length === 0) {
    return makeEmpty(warnings.concat('Aucune ecriture parseable detectee'));
  }

  // Determine la periode
  const dates = entries.map(e => e.date).filter(Boolean).sort();
  const periodStart = dates[0] || null;
  const periodEnd = dates[dates.length - 1] || null;

  // Date de reference : la plus recente
  const refDate = periodEnd ? new Date(periodEnd) : new Date();

  const classBalances = aggregateClassBalances(entries);
  const realRevenue = computeRealRevenue(entries, refDate);
  const realCharges = computeRealCharges(entries, refDate);
  const margins = computeRealMargins(realRevenue, realCharges);
  const cash = computeCash(entries);
  const topClientsResult = computeTopClients(entries, refDate);
  const topClients = topClientsResult.list.map(c => ({
    ...c,
    pctOfTotal: realRevenue.last12MonthsTotal > 0
      ? (c.revenueLast12Months / realRevenue.last12MonthsTotal) * 100
      : 0,
  }));
  const topSuppliers = computeTopSuppliers(entries, refDate);
  const offBalance = computeOffBalance(entries);
  const burnRunway = computeBurnAndRunway(entries, cash, refDate);
  const workingCap = computeWorkingCapital(entries, realRevenue, realCharges, refDate);

  // Qualite du parsing : haute si on a parse > 80% des lignes attendues
  const parseQuality: LedgerExtraction['parseQuality'] =
    warnings.length === 0 ? 'high' :
    warnings.length <= 2 && entries.length > 50 ? 'medium' :
    'low';

  const extraction: LedgerExtraction = {
    hasLedger: true,
    source,
    parseQuality,
    parseWarnings: warnings,
    periodStart,
    periodEnd,
    totalEntries: entries.length,
    classBalances,
    realRevenue,
    realCharges,
    realGrossMargin: margins.gross,
    realEbitda: margins.ebitda,
    cash,
    topClients,
    topSuppliers,
    offBalanceCommitments: offBalance,
    burnAndRunway: burnRunway,
    workingCapital: workingCap,
    flags: [],
  };
  extraction.flags = computeFlags(extraction);
  return extraction;
}

function makeEmpty(warnings: string[]): LedgerExtraction {
  return {
    hasLedger: false,
    source: 'unknown',
    parseQuality: 'low',
    parseWarnings: warnings,
    periodStart: null,
    periodEnd: null,
    totalEntries: 0,
    classBalances: { class1: 0, class2: 0, class3: 0, class4: 0, class5: 0, class6: 0, class7: 0 },
    realRevenue: { last12MonthsTotal: 0, monthlyBreakdown: [], growthRate: null, volatilityCoeff: null },
    realCharges: {
      last12MonthsTotal: 0,
      breakdownByClass: { class60: 0, class61: 0, class62: 0, class63: 0, class64: 0, class65: 0, class66: 0, class67: 0, class68: 0 },
    },
    realGrossMargin: { valueEur: null, pctOfRevenue: null },
    realEbitda: { valueEur: null, pctOfRevenue: null },
    cash: { banks: 0, petty: 0, total: 0 },
    topClients: [],
    topSuppliers: [],
    offBalanceCommitments: {
      longTermDebt: 0, relatedPartyDebts: 0, associateAccounts: 0,
      payablesNet: 0, salariesDue: 0, socialContributions: 0, taxesDue: 0,
    },
    burnAndRunway: { avgMonthlyBurn6m: null, runwayMonths: null },
    workingCapital: { dso: null, dpo: null },
    flags: [],
  };
}
