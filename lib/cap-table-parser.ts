// ============================================================
// CAP TABLE PARSER (Module 2 DD contractuelle - etape 1)
// ------------------------------------------------------------
// Parse un cap table Excel ou CSV et extrait la structure
// d actionnariat. Sortie deterministe : liste des holders,
// totaux par categorie (fondateurs, investisseurs, pool options),
// drapeaux automatiques sur signaux faibles (dilution fondateur
// excessive, pool insuffisant, concentration investisseur, etc.).
//
// Le parser ne gere pas la simulation dilutive prospective (qui
// est traitee par le moteur DD contractuel etape 2 en LLM). Il
// se contente de capturer la photo a date du cap table fourni.
// ============================================================

// ============================================================
// Types
// ============================================================

export type HolderCategory = 'founder' | 'investor' | 'option_pool' | 'employee' | 'other';

export interface CapTableHolder {
  name: string;
  category: HolderCategory;
  // Type d action : commun, preferentiel A/B/C, options, BSPCE, etc.
  shareClass: string;
  // Nombre d actions (entiere). Null si non extractible.
  shares: number | null;
  // Pourcentage du capital (0-100). Null si non extractible.
  percentage: number | null;
  // Vesting cliff + duree si applicable (extrait depuis libelle si present)
  vestingNotes: string | null;
}

export interface CapTableFlag {
  severity: 'info' | 'attention' | 'alert';
  code: string;
  message: string;
}

export interface CapTableExtraction {
  hasCapTable: boolean;
  source: 'excel' | 'csv' | 'pdf' | 'unknown';
  parseQuality: 'high' | 'medium' | 'low';
  parseWarnings: string[];

  // Toutes les lignes extraites (incluant fondateurs, investisseurs, pool, employes)
  holders: CapTableHolder[];

  // Totaux agreges par categorie
  totals: {
    totalShares: number | null;
    totalPercentage: number; // somme des pct extraits
    founderPercentage: number;     // % cumule des fondateurs
    investorPercentage: number;    // % cumule des investisseurs
    optionPoolPercentage: number;  // % du pool d options non encore alloue
    employeeAllocatedPercentage: number; // % deja alloue aux employes
    otherPercentage: number;
  };

  // Drapeaux deterministes
  flags: CapTableFlag[];
}

// ============================================================
// Helpers
// ============================================================

function parsePct(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    // Convention : si raw est entre 0 et 1.5, on suppose un decimal (0.25 = 25%)
    if (raw > 0 && raw <= 1.5) return raw * 100;
    return raw;
  }
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\u00a0|\u202f|\s/g, '');
  const hasPercent = s.includes('%');
  s = s.replace(/%/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (!hasPercent && n > 0 && n <= 1.5) return n * 100;
  return n;
}

function parseInteger(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\u00a0|\u202f|\s/g, '');
  s = s.replace(/[.,]/g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

interface CapColMap {
  name: number;
  shareClass: number;
  shares: number;
  percentage: number;
  vesting: number;
}

const CAP_NAME_HEADERS = ['holder', 'shareholder', 'detenteur', 'actionnaire', 'investor', 'name', 'nom'];
const CAP_CLASS_HEADERS = ['type', 'shareclass', 'classaction', 'classe', 'category', 'categorie', 'instrument'];
const CAP_SHARES_HEADERS = ['shares', 'nbactions', 'nombreactions', 'nombredactions', 'qty', 'quantite', 'count'];
const CAP_PCT_HEADERS = ['pct', 'percentage', 'pourcentage', 'capital', 'fully diluted', 'fullydiluted', 'fd', 'ownership', 'detention', '%'];
const CAP_VESTING_HEADERS = ['vesting', 'cliff', 'acquisition', 'maturity'];

function findCapHeader(lines: string[], sep: string): { idx: number; map: CapColMap | null } {
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const cells = lines[i].split(sep).map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ''));
    let nameIdx = -1, classIdx = -1, sharesIdx = -1, pctIdx = -1, vestingIdx = -1;
    for (let j = 0; j < cells.length; j++) {
      const c = cells[j];
      if (nameIdx < 0 && CAP_NAME_HEADERS.includes(c)) nameIdx = j;
      if (classIdx < 0 && CAP_CLASS_HEADERS.includes(c)) classIdx = j;
      if (sharesIdx < 0 && CAP_SHARES_HEADERS.includes(c)) sharesIdx = j;
      if (pctIdx < 0 && CAP_PCT_HEADERS.includes(c)) pctIdx = j;
      if (vestingIdx < 0 && CAP_VESTING_HEADERS.includes(c)) vestingIdx = j;
    }
    if (nameIdx >= 0 && (sharesIdx >= 0 || pctIdx >= 0)) {
      return {
        idx: i,
        map: {
          name: nameIdx,
          shareClass: classIdx,
          shares: sharesIdx,
          percentage: pctIdx,
          vesting: vestingIdx,
        },
      };
    }
  }
  return { idx: -1, map: null };
}

function categorize(name: string, shareClass: string): HolderCategory {
  const n = name.toLowerCase();
  const c = shareClass.toLowerCase();

  // Pool d options
  if (n.includes('pool') || n.includes('esop') || n.includes('options non allouees') ||
      n.includes('options non attribuees') || n.includes('unallocated') ||
      c.includes('pool') || c.includes('unallocated') || c === 'options pool') {
    return 'option_pool';
  }

  // Investisseurs
  if (n.includes('fund') || n.includes('ventures') || n.includes('capital') ||
      n.includes('partners') || n.includes('investments') || n.includes('investissement') ||
      n.includes('vc ') || n.endsWith(' vc') || n.includes(' bv') || n.includes(' bv,') ||
      c.includes('preferred') || c.includes('preferentiel') || c.includes('preference') ||
      c.includes('series ') || c.match(/series\s?[a-z]/i)) {
    return 'investor';
  }

  // Options / employes
  if (c.includes('options') || c.includes('bspce') || c.includes('aga') || c.includes('rsa') ||
      c.includes('stock options') || n.includes('employee')) {
    return 'employee';
  }

  // Fondateurs : detection par defaut sur les actions communes des
  // premiers ranks
  if (c.includes('common') || c.includes('commun') || c.includes('ordinary') ||
      c === '' || c === 'actions') {
    return 'founder';
  }

  return 'other';
}

function parseSeparatorBased(rawText: string, sep: string, warnings: string[], source: CapTableExtraction['source']): CapTableExtraction {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim());
  const header = findCapHeader(lines, sep);
  if (!header.map) {
    return makeEmpty(['Cap table : header non identifie. Colonnes attendues : nom + nombre d actions ou pourcentage.', ...warnings], source);
  }

  const map = header.map;
  const holders: CapTableHolder[] = [];
  for (let i = header.idx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    if (cells.length < Math.max(map.name, map.shares, map.percentage) + 1) continue;
    const name = (cells[map.name] || '').trim();
    if (!name) continue;
    // Saute les lignes de total
    const lower = name.toLowerCase();
    if (lower === 'total' || lower === 'totaux' || lower.startsWith('total ') ||
        lower === 'sum' || lower === 'sous-total') continue;

    const shareClass = map.shareClass >= 0 ? (cells[map.shareClass] || '').trim() : '';
    const shares = map.shares >= 0 ? parseInteger(cells[map.shares]) : null;
    const percentage = map.percentage >= 0 ? parsePct(cells[map.percentage]) : null;
    const vesting = map.vesting >= 0 ? (cells[map.vesting] || '').trim() : '';
    const category = categorize(name, shareClass);

    holders.push({
      name,
      category,
      shareClass: shareClass || (category === 'founder' ? 'common' : category === 'investor' ? 'preferred' : ''),
      shares,
      percentage,
      vestingNotes: vesting || null,
    });
  }

  if (holders.length === 0) {
    return makeEmpty(['Cap table : aucun actionnaire identifie.', ...warnings], source);
  }

  const extraction = aggregateAndFlag(holders, source, warnings);
  return extraction;
}

function aggregateAndFlag(holders: CapTableHolder[], source: CapTableExtraction['source'], warnings: string[]): CapTableExtraction {
  const totalShares = holders.reduce((s, h) => s + (h.shares || 0), 0);
  // Si aucun pct n est fourni, on les calcule a partir des shares
  let needsPctImputation = holders.every(h => h.percentage === null);
  if (needsPctImputation && totalShares > 0) {
    holders.forEach(h => {
      if (h.shares !== null) h.percentage = (h.shares / totalShares) * 100;
    });
  }

  const totalPct = holders.reduce((s, h) => s + (h.percentage || 0), 0);
  const founderPct = holders.filter(h => h.category === 'founder').reduce((s, h) => s + (h.percentage || 0), 0);
  const investorPct = holders.filter(h => h.category === 'investor').reduce((s, h) => s + (h.percentage || 0), 0);
  const optionPoolPct = holders.filter(h => h.category === 'option_pool').reduce((s, h) => s + (h.percentage || 0), 0);
  const employeePct = holders.filter(h => h.category === 'employee').reduce((s, h) => s + (h.percentage || 0), 0);
  const otherPct = holders.filter(h => h.category === 'other').reduce((s, h) => s + (h.percentage || 0), 0);

  const flags: CapTableFlag[] = [];

  // Warning si total != 100
  if (totalPct > 0 && Math.abs(totalPct - 100) > 5) {
    flags.push({
      severity: 'attention',
      code: 'total_not_100',
      message: `Somme des pourcentages : ${totalPct.toFixed(1)}%. Le total devrait s elever a 100%. Cap table possiblement incomplet ou colonnes mal alignees.`,
    });
  }

  // Dilution fondateur
  if (founderPct > 0) {
    if (founderPct < 30) {
      flags.push({
        severity: 'alert',
        code: 'founder_low',
        message: `Detention fondateurs cumulee : ${founderPct.toFixed(1)}%. Dilution avancee : la motivation et l alignement long terme des fondateurs peuvent etre fragilises sur les tours suivants.`,
      });
    } else if (founderPct < 45) {
      flags.push({
        severity: 'attention',
        code: 'founder_moderate',
        message: `Detention fondateurs cumulee : ${founderPct.toFixed(1)}%. Dilution moderee : a documenter en regard du nombre de tours deja realises.`,
      });
    }
  }

  // Pool d options
  if (optionPoolPct > 0 && optionPoolPct < 5) {
    flags.push({
      severity: 'attention',
      code: 'pool_thin',
      message: `Pool d options non alloue : ${optionPoolPct.toFixed(1)}%. Pool fin pour soutenir les recrutements seniors a venir. A confronter au plan d hiring.`,
    });
  }

  // Concentration investisseur
  const investors = holders.filter(h => h.category === 'investor' && h.percentage !== null);
  if (investors.length > 0) {
    const topInvestor = investors.reduce((max, h) => ((h.percentage || 0) > (max.percentage || 0) ? h : max), investors[0]);
    if ((topInvestor.percentage || 0) >= 30) {
      flags.push({
        severity: 'alert',
        code: 'investor_concentration',
        message: `Le premier investisseur (${topInvestor.name}) detient ${(topInvestor.percentage || 0).toFixed(1)}% du capital. Concentration significative : verifier les droits de gouvernance et de veto associes dans le pacte.`,
      });
    } else if ((topInvestor.percentage || 0) >= 20) {
      flags.push({
        severity: 'attention',
        code: 'investor_concentration_moderate',
        message: `Le premier investisseur (${topInvestor.name}) detient ${(topInvestor.percentage || 0).toFixed(1)}% du capital. Concentration moderee : confirmer les droits attaches.`,
      });
    }
  }

  return {
    hasCapTable: true,
    source,
    parseQuality: warnings.length === 0 && totalPct > 0 && Math.abs(totalPct - 100) <= 5 ? 'high'
                 : warnings.length <= 2 ? 'medium' : 'low',
    parseWarnings: warnings,
    holders,
    totals: {
      totalShares: totalShares > 0 ? totalShares : null,
      totalPercentage: totalPct,
      founderPercentage: founderPct,
      investorPercentage: investorPct,
      optionPoolPercentage: optionPoolPct,
      employeeAllocatedPercentage: employeePct,
      otherPercentage: otherPct,
    },
    flags,
  };
}

function makeEmpty(warnings: string[], source: CapTableExtraction['source']): CapTableExtraction {
  return {
    hasCapTable: false,
    source,
    parseQuality: 'low',
    parseWarnings: warnings,
    holders: [],
    totals: {
      totalShares: null,
      totalPercentage: 0,
      founderPercentage: 0,
      investorPercentage: 0,
      optionPoolPercentage: 0,
      employeeAllocatedPercentage: 0,
      otherPercentage: 0,
    },
    flags: [],
  };
}

// ============================================================
// Fonction principale
// ============================================================

export function parseCapTable(rawText: string, fileType: 'excel' | 'csv' | 'pdf' = 'excel'): CapTableExtraction {
  const warnings: string[] = [];
  if (!rawText || rawText.trim().length < 30) {
    return makeEmpty(['Cap table : contenu vide ou tronque'], fileType);
  }

  if (fileType === 'pdf') {
    // Le PDF necessite un appel LLM pour parser : on differe a l etape 2.
    // A cette etape on retourne un placeholder qui signale au moteur LLM
    // qu il doit traiter le PDF.
    return {
      ...makeEmpty(['Cap table fourni en PDF : parsing detaille a faire en etape 2 par le moteur LLM'], 'pdf'),
      hasCapTable: true,
    };
  }

  // Essai differents separateurs : virgule, point-virgule, tab
  for (const sep of [',', ';', '\t']) {
    const result = parseSeparatorBased(rawText, sep, warnings, fileType);
    if (result.holders.length > 0) {
      return result;
    }
  }

  return makeEmpty(['Cap table : impossible de parser le fichier. Verifier le format des colonnes (nom, type, shares, %).', ...warnings], fileType);
}
