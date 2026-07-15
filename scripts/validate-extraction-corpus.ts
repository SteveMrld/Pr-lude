// ============================================================
// VALIDATE-EXTRACTION-CORPUS
// ------------------------------------------------------------
// Harnais de mesure du moteur d extraction financiere sur le
// corpus des 25 dossiers dont le PDF source est present dans
// Supabase Storage. Rejoue extractFinancialData avec le nouveau
// prompt (brique 11), collecte lastActualYear + evidence + basis
// par annee, applique la garde de vraisemblance de la primitive
// (brique 12), ecrit un rapport dans reports/.
//
// Ce harnais MESURE, il ne juge pas la justesse. La verification
// manuelle vient apres, sur un echantillon.
//
// Trois questions :
//   Q1 : sur combien de dossiers le modele produit une valeur ?
//   Q2 : sur combien il s abstient ?
//   Q3 : sur combien la valeur passe la garde de vraisemblance ?
//
// Aucune ecriture en base. Le snapshot des analyses reste intact.
// Le rapport ecrit reports/validate-extraction-corpus.md.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { downloadDossierFile } from '../lib/storage/dossier-uploads';
import { extractFinancialData } from '../lib/engines/financial-extraction-engine';
import { deriveDossierReferenceYearWithReason } from '../lib/analysis/reference-year';
import type { ExtractionOutput } from '../lib/engines/types';

// Chargement env. Le fichier .env.local peut porter des fins de
// ligne CRLF (Windows / WSL) ; on normalise pour que le regex
// $ ne bute pas sur un \r trainant qui aurait avale la valeur.
const rawEnv = readFileSync('/home/steve/Pr-lude/.env.local', 'utf-8').replace(/\r\n/g, '\n');
for (const line of rawEnv.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

interface DossierResult {
  id: string;
  companyName: string;
  storagePath: string | null;
  status: 'ok' | 'skipped-no-upload' | 'download-error' | 'extraction-error';
  errorMessage?: string;
  durationMs?: number;
  lastActualYear: number | null;
  lastActualYearEvidence: string | null;
  basisByYear: Array<{ year: string; value: number; basis: string | null; source: string }>;
  maxProjectionYear: number | null;
  gap: number | null;
  primitiveAccepted: boolean;
  rejectionReason: string | null;
  rejectionDetail: string | null;
}

async function main() {
  const started = Date.now();
  const { data } = await s
    .from('analyses')
    .select('id, company_name, uploaded_files, result_json')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });
  const rows = data || [];
  const results: DossierResult[] = [];

  console.log(`Corpus : ${rows.length} dossiers en status=completed`);
  console.log('Estimation cout : ~$0.15-0.30 par extraction, ~$5-8 pour 25 dossiers.');
  console.log('');

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const uploads = Array.isArray(r.uploaded_files) ? r.uploaded_files : [];
    const primary = uploads.find((u: any) => (u?.mimeType || '').includes('pdf') || (u?.name || '').toLowerCase().endsWith('.pdf'));
    const base: DossierResult = {
      id: r.id,
      companyName: r.company_name || '(?)',
      storagePath: primary?.storagePath || null,
      status: 'ok',
      lastActualYear: null,
      lastActualYearEvidence: null,
      basisByYear: [],
      maxProjectionYear: null,
      gap: null,
      primitiveAccepted: false,
      rejectionReason: null,
      rejectionDetail: null,
    };
    if (!primary?.storagePath) {
      base.status = 'skipped-no-upload';
      results.push(base);
      console.log(`[${i + 1}/${rows.length}] ${base.companyName} : SKIP (pas d upload)`);
      continue;
    }

    console.log(`[${i + 1}/${rows.length}] ${base.companyName} : telechargement + extraction...`);
    const t0 = Date.now();
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await downloadDossierFile(primary.storagePath);
    } catch (e: any) {
      base.status = 'download-error';
      base.errorMessage = e?.message || String(e);
      results.push(base);
      console.log(`  ERR download : ${base.errorMessage}`);
      continue;
    }

    const extractionMinimal: ExtractionOutput = (r.result_json?.extraction || {
      companyName: base.companyName,
      sector: 'unknown',
      subSector: '',
      geographicHub: '',
      country: '',
      yearFounded: null,
      productDescription: '',
      businessModel: '',
      marketPitch: '',
      rawSummary: '',
      competitorsCited: [],
      fundraise: { stage: 'seed', amount: '', valuation: null, leadInvestor: null },
      traction: { metrics: {} } as any,
    }) as ExtractionOutput;

    try {
      const fd = await extractFinancialData(pdfBuffer.toString('base64'), null, extractionMinimal);
      base.durationMs = Date.now() - t0;
      base.lastActualYear = fd.lastActualYear ?? null;
      base.lastActualYearEvidence = fd.lastActualYearEvidence ?? null;
      base.basisByYear = (fd.revenueProjection || []).map((p: any) => ({
        year: String(p.year),
        value: Number(p.value),
        basis: p.basis ?? null,
        source: String(p.source || ''),
      }));
      const projYears = base.basisByYear
        .map(b => parseInt(b.year, 10))
        .filter(y => Number.isFinite(y) && y >= 2000 && y <= 2100);
      base.maxProjectionYear = projYears.length > 0 ? Math.max(...projYears) : null;
      if (base.lastActualYear !== null && base.maxProjectionYear !== null) {
        base.gap = base.maxProjectionYear - base.lastActualYear;
      }
      const resolution = deriveDossierReferenceYearWithReason({ financialData: fd });
      base.primitiveAccepted = resolution.year !== null;
      base.rejectionReason = resolution.rejectionReason;
      base.rejectionDetail = resolution.rejectionDetail;
      results.push(base);
      console.log(`  lastActualYear=${base.lastActualYear} evidence=${base.lastActualYearEvidence?.slice(0, 40) || 'null'}... gap=${base.gap} accepted=${base.primitiveAccepted} (${base.durationMs}ms)`);
    } catch (e: any) {
      base.status = 'extraction-error';
      base.errorMessage = e?.message || String(e);
      base.durationMs = Date.now() - t0;
      results.push(base);
      console.log(`  ERR extraction : ${base.errorMessage}`);
    }
  }

  // Reponses aux trois questions
  const total = results.length;
  const skipped = results.filter(r => r.status === 'skipped-no-upload').length;
  const withUpload = total - skipped;
  const errors = results.filter(r => r.status === 'download-error' || r.status === 'extraction-error').length;
  const withValue = results.filter(r => r.lastActualYear !== null).length;
  const abstained = results.filter(r => r.status === 'ok' && r.lastActualYear === null).length;
  const passedGuard = results.filter(r => r.primitiveAccepted).length;

  // Ecriture rapport MD
  mkdirSync('reports', { recursive: true });
  const lines: string[] = [];
  lines.push('# Validation extraction financiere sur corpus');
  lines.push('');
  lines.push(`Rapport genere le ${new Date().toISOString().slice(0, 10)}, harnais scripts/validate-extraction-corpus.ts.`);
  lines.push('');
  lines.push('## Trois questions');
  lines.push('');
  lines.push('- Q1. Sur combien de dossiers le modele produit une valeur lastActualYear ?');
  lines.push('- Q2. Sur combien il s abstient explicitement (extraction reussie mais valeur null) ?');
  lines.push('- Q3. Sur combien la valeur passe les gardes de la primitive (evidence non vide, annee presente dans les projections, annee non posterieure a la derniere annee des projections) ?');
  lines.push('');
  lines.push('## Chiffres bruts');
  lines.push('');
  lines.push(`- Dossiers total en corpus : ${total}`);
  lines.push(`- Dossiers avec upload PDF : ${withUpload}`);
  lines.push(`- Dossiers skip (pas de PDF) : ${skipped}`);
  lines.push(`- Erreurs download / extraction : ${errors}`);
  lines.push('');
  lines.push('**Q1 :** ' + `${withValue} / ${withUpload} dossiers avec upload produisent une valeur lastActualYear non nulle.`);
  lines.push('**Q2 :** ' + `${abstained} / ${withUpload} dossiers avec upload : extraction reussie mais lastActualYear=null (abstention).`);
  lines.push('**Q3 :** ' + `${passedGuard} / ${withUpload} dossiers passent les gardes de la primitive (evidence + appartenance aux projections + non posteriorite).`);
  lines.push('');
  lines.push(`Duree totale : ${Math.round((Date.now() - started) / 1000)}s.`);
  lines.push('');
  lines.push('## Tableau par dossier');
  lines.push('');
  lines.push('| Dossier | Statut | lastActualYear | Evidence (extrait) | Basis 2023 | Basis 2024 | Basis 2025 | Basis 2026 | MaxProj | Gap | Primitive |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const b23 = r.basisByYear.find(b => b.year === '2023')?.basis || '';
    const b24 = r.basisByYear.find(b => b.year === '2024')?.basis || '';
    const b25 = r.basisByYear.find(b => b.year === '2025')?.basis || '';
    const b26 = r.basisByYear.find(b => b.year === '2026')?.basis || '';
    const evExt = (r.lastActualYearEvidence || '').slice(0, 60).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const prim = r.primitiveAccepted ? 'OK' : (r.rejectionReason || '-');
    lines.push(`| ${r.companyName.slice(0, 30)} | ${r.status} | ${r.lastActualYear ?? '—'} | ${evExt} | ${b23} | ${b24} | ${b25} | ${b26} | ${r.maxProjectionYear ?? '—'} | ${r.gap ?? '—'} | ${prim} |`);
  }
  lines.push('');
  lines.push('## Motifs de rejet par la primitive');
  lines.push('');
  const byReason: Record<string, number> = {};
  for (const r of results) {
    if (r.rejectionReason) byReason[r.rejectionReason] = (byReason[r.rejectionReason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(byReason)) {
    lines.push(`- ${reason} : ${count} dossiers`);
  }
  if (Object.keys(byReason).length === 0) lines.push('- aucun rejet');
  lines.push('');
  lines.push('## Justesse');
  lines.push('');
  lines.push('Ce rapport mesure ce que le modele produit, il ne sait pas ce qui est vrai.');
  lines.push('Verification manuelle sur echantillon a effectuer separement.');
  const out = join('reports', 'validate-extraction-corpus.md');
  writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log('');
  console.log(`Rapport ecrit : ${out}`);
  console.log('');
  console.log('=== SYNTHESE ===');
  console.log(`Q1 (valeur produite)         : ${withValue} / ${withUpload}`);
  console.log(`Q2 (abstention)              : ${abstained} / ${withUpload}`);
  console.log(`Q3 (passe garde primitive)   : ${passedGuard} / ${withUpload}`);
  console.log(`Erreurs                      : ${errors}`);
  console.log(`Duree totale                 : ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
