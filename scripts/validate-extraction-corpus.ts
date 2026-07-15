// ============================================================
// VALIDATE-EXTRACTION-CORPUS
// ------------------------------------------------------------
// Harnais de mesure du moteur d extraction financiere sur le
// corpus. Aligne sur route.ts : telecharge TOUS les fichiers de
// chaque dossier depuis Supabase Storage, passe par processFileRefs
// pour classer pitchDeck vs businessPlan vs autres, alimente
// extractFinancialData avec pitchDeck.payload + businessPlan.payload
// exactement comme la production. Aucune reinvention de la
// selection de fichiers.
//
// Un fichier d un type que processFileRefs ne sait pas classer
// est declare explicitement dans le rapport (categorie others),
// jamais d ignorance silencieuse.
//
// Timeout Anthropic SDK global est a 60 000 ms dans anthropic-
// client.ts. Le harnais ne le touche pas. Il utilise un client
// local avec timeout etendu 180 000 ms pour ce diagnostic
// specifique (gros PDFs Bloc 2 style Braincube). Le SYSTEM_PROMPT
// est importe du moteur, la logique reste alignee.
//
// Trois questions :
//   Q1 : sur combien de dossiers le modele produit une valeur ?
//   Q2 : sur combien il s abstient ?
//   Q3 : sur combien la valeur passe les gardes ?
//
// Aucune ecriture en base. Le rapport ecrit reports/validate-
// extraction-corpus.md.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { downloadDossierFile } from '../lib/storage/dossier-uploads';
import { processFileRefs, type FileBufferInput } from '../lib/file-processor';
import { SYSTEM_PROMPT } from '../lib/engines/financial-extraction-engine';
import { deriveDossierReferenceYearWithReason } from '../lib/analysis/reference-year';
import { parseJSON, MODEL } from '../lib/engines/anthropic-client';
import type { FinancialDataExtraction, ExtractionOutput } from '../lib/engines/types';

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

// Client Anthropic local avec deadline etendue. Le SDK production
// est cape a 60s dans anthropic-client.ts, insuffisant pour les gros
// PDFs (Braincube memorandum 100+ pages). Ce client local est
// utilise UNIQUEMENT par ce harnais, aucun impact sur la prod.
const LOCAL_TIMEOUT_MS = 180_000;
const localClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: LOCAL_TIMEOUT_MS,
  maxRetries: 0,
});

async function callExtractionLocal(
  systemPrompt: string,
  userPrompt: string,
  pdfBase64: string,
): Promise<string> {
  const resp = await localClient.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } as any }] as any,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }, cache_control: { type: 'ephemeral' } } as any,
        { type: 'text', text: userPrompt },
      ] as any,
    }],
  });
  const block = resp.content[0] as any;
  return block?.text || '';
}

// Reproduit la logique de extractFinancialData avec le client local.
// Prompts identiques a la production (voir financial-extraction-engine.ts).
async function extractWithLocalClient(
  deckBase64: string,
  bpContent: string | null,
  extraction: ExtractionOutput,
): Promise<FinancialDataExtraction> {
  let userPrompt: string;
  if (!bpContent) {
    userPrompt = `Extrais les données financières présentes dans ce pitch deck.

# CONTEXTE
Société : ${extraction.companyName}
Secteur : ${extraction.sector}
Tour : ${extraction.fundraise?.stage || ''} ${extraction.fundraise?.amount || ''}

Le pitch deck est joint. Aucun business plan séparé n'est disponible.

Pour chaque donnée extraite, source = "deck". Si une donnée typique du BP (projections détaillées, unit economics) n'est pas dans le deck, mets une chaîne vide ou marque "non communiqué".

Retourne uniquement le JSON.`;
  } else {
    userPrompt = `Extrais les données financières en combinant le pitch deck (joint) et le business plan ci-dessous.

# CONTEXTE
Société : ${extraction.companyName}
Secteur : ${extraction.sector}
Tour : ${extraction.fundraise?.stage || ''} ${extraction.fundraise?.amount || ''}

# BUSINESS PLAN (contenu textuel extrait du fichier Excel, CSV ou Word)

${bpContent.slice(0, 8000)}

# INSTRUCTIONS

1. Pour chaque donnée, identifie sa source : deck, bp, ou les deux
2. Si une même donnée apparaît différemment dans deck vs bp, prends la version BP (plus fiable) mais note la divergence dans rawNotes
3. Reconstruis les projections de revenue, marge, EBITDA, FCF, opex, headcount à partir du BP
4. Extrais les unit economics si présents
5. Identifie les hypothèses de marché (TAM, SAM, market share cible)

Retourne uniquement le JSON structuré.`;
  }
  const raw = await callExtractionLocal(SYSTEM_PROMPT, userPrompt, deckBase64);
  const fd = parseJSON<FinancialDataExtraction>(raw);
  fd.hasBP = !!bpContent;
  fd.fileSource = bpContent ? 'both' : 'deck';
  fd.revenueProjection = fd.revenueProjection || [];
  fd.grossMarginProjection = fd.grossMarginProjection || [];
  fd.ebitdaProjection = fd.ebitdaProjection || [];
  fd.fcfProjection = fd.fcfProjection || [];
  fd.opexProjection = fd.opexProjection || [];
  fd.headcount = fd.headcount || [];
  fd.unitEconomics = fd.unitEconomics || { estimatedCAC: '', estimatedLTV: '', estimatedLtvCacRatio: '', averageContractValue: '', grossMarginPerUnit: '' } as any;
  fd.currentRound = fd.currentRound || { amount: '', runwayMonths: '', monthlyBurn: '' };
  fd.marketAssumptions = fd.marketAssumptions || { tamCited: '', samCited: '', targetMarketShare: '', targetCustomersByYearN: '' };
  fd.rawNotes = fd.rawNotes || '';
  if (fd.lastActualYear === undefined) fd.lastActualYear = null;
  if (fd.lastActualYearEvidence === undefined) fd.lastActualYearEvidence = null;
  return fd;
}

interface DossierResult {
  id: string;
  companyName: string;
  fileCount: number;
  fileNames: string[];
  classification: { pitchDeck: string | null; businessPlan: string | null; others: string[] };
  status: 'ok' | 'skipped-no-upload' | 'no-pitch-deck' | 'download-error' | 'extraction-error';
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

// Sous ensemble optionnel par argument CLI. Sinon corpus complet.
const ONLY = process.argv.slice(2).map(s => s.toLowerCase());

async function main() {
  const started = Date.now();
  const { data } = await s
    .from('analyses')
    .select('id, company_name, uploaded_files, result_json')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });
  let rows = data || [];
  if (ONLY.length > 0) {
    rows = rows.filter(r => ONLY.some(f => (r.company_name || '').toLowerCase().includes(f)));
    console.log(`Filtre ONLY : ${rows.length} dossiers cibles (${rows.map(r => r.company_name).join(' | ')})`);
  }
  const results: DossierResult[] = [];

  console.log(`Corpus : ${rows.length} dossiers a traiter`);
  console.log(`Timeout Anthropic local : ${LOCAL_TIMEOUT_MS}ms (SDK production reste a 60s, inchange).`);
  console.log('');

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const uploads = Array.isArray(r.uploaded_files) ? r.uploaded_files : [];
    const base: DossierResult = {
      id: r.id,
      companyName: r.company_name || '(?)',
      fileCount: uploads.length,
      fileNames: uploads.map((u: any) => u?.name || '(?)'),
      classification: { pitchDeck: null, businessPlan: null, others: [] },
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
    if (uploads.length === 0) {
      base.status = 'skipped-no-upload';
      results.push(base);
      console.log(`[${i + 1}/${rows.length}] ${base.companyName} : SKIP (aucun upload)`);
      continue;
    }

    console.log(`[${i + 1}/${rows.length}] ${base.companyName} (${uploads.length} fichier${uploads.length > 1 ? 's' : ''}) : telechargement + classification...`);
    const t0 = Date.now();

    // 1. Telechargement de TOUS les fichiers
    const buffered: FileBufferInput[] = [];
    try {
      for (const u of uploads) {
        if (!u?.storagePath) continue;
        const buf = await downloadDossierFile(u.storagePath);
        buffered.push({
          name: u.name || 'unknown',
          mimeType: u.mimeType || '',
          size: u.size || buf.byteLength,
          buffer: buf,
        });
      }
    } catch (e: any) {
      base.status = 'download-error';
      base.errorMessage = e?.message || String(e);
      results.push(base);
      console.log(`  ERR download : ${base.errorMessage}`);
      continue;
    }

    // 2. Classification alignee sur route.ts
    let processed;
    try {
      processed = await processFileRefs(buffered);
    } catch (e: any) {
      base.status = 'extraction-error';
      base.errorMessage = `processFileRefs: ${e?.message || String(e)}`;
      results.push(base);
      console.log(`  ERR classification : ${base.errorMessage}`);
      continue;
    }
    base.classification.pitchDeck = processed.pitchDeck?.name || null;
    base.classification.businessPlan = processed.businessPlan?.name || null;
    base.classification.others = (processed.others || []).map((f: any) => f.name);

    if (!processed.pitchDeck) {
      base.status = 'no-pitch-deck';
      base.errorMessage = `Aucun pitchDeck classifie parmi ${buffered.length} fichier(s)`;
      results.push(base);
      console.log(`  ${base.errorMessage}`);
      continue;
    }

    // 3. Extraction financiere avec client local (timeout etendu)
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
      const fd = await extractWithLocalClient(
        processed.pitchDeck.payload,
        processed.businessPlan?.payload || null,
        extractionMinimal,
      );
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
      const bpTag = processed.businessPlan ? `BP=${processed.businessPlan.name}` : 'sans BP';
      console.log(`  ${bpTag} | lastActualYear=${base.lastActualYear} evidence="${(base.lastActualYearEvidence || '').slice(0, 40)}" maxProj=${base.maxProjectionYear} gap=${base.gap} primitive=${base.primitiveAccepted ? 'OK' : base.rejectionReason} (${base.durationMs}ms)`);
    } catch (e: any) {
      base.status = 'extraction-error';
      base.errorMessage = e?.message || String(e);
      base.durationMs = Date.now() - t0;
      results.push(base);
      console.log(`  ERR extraction : ${base.errorMessage}`);
    }
  }

  // Chiffres consolides
  const total = results.length;
  const skipped = results.filter(r => r.status === 'skipped-no-upload').length;
  const withUpload = total - skipped;
  const errors = results.filter(r => r.status === 'download-error' || r.status === 'extraction-error' || r.status === 'no-pitch-deck').length;
  const withValue = results.filter(r => r.lastActualYear !== null).length;
  const abstained = results.filter(r => r.status === 'ok' && r.lastActualYear === null).length;
  const passedGuard = results.filter(r => r.primitiveAccepted).length;
  const withBP = results.filter(r => r.classification.businessPlan !== null).length;
  const withOthers = results.filter(r => r.classification.others.length > 0).length;

  // Ecriture rapport MD
  mkdirSync('reports', { recursive: true });
  const lines: string[] = [];
  lines.push('# Validation extraction financiere sur corpus');
  lines.push('');
  lines.push(`Rapport genere le ${new Date().toISOString().slice(0, 10)}, harnais scripts/validate-extraction-corpus.ts.`);
  lines.push(`Timeout Anthropic local ${LOCAL_TIMEOUT_MS}ms (SDK production reste 60s, non modifie).`);
  lines.push('Alignement pipeline : lecture de tous les fichiers via processFileRefs, extraction avec pitchDeck.payload + businessPlan.payload comme en production.');
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
  lines.push(`- Dossiers avec upload : ${withUpload}`);
  lines.push(`- Dossiers skip (pas d upload) : ${skipped}`);
  lines.push(`- Erreurs download / extraction / classification : ${errors}`);
  lines.push(`- Dossiers avec business plan classifie : ${withBP}`);
  lines.push(`- Dossiers avec fichier "others" non integre en extraction : ${withOthers}`);
  lines.push('');
  lines.push('**Q1 :** ' + `${withValue} / ${withUpload} dossiers avec upload produisent une valeur lastActualYear non nulle.`);
  lines.push('**Q2 :** ' + `${abstained} / ${withUpload} dossiers avec upload : extraction reussie mais lastActualYear=null (abstention).`);
  lines.push('**Q3 :** ' + `${passedGuard} / ${withUpload} dossiers passent les gardes de la primitive.`);
  lines.push('');
  lines.push(`Duree totale : ${Math.round((Date.now() - started) / 1000)}s.`);
  lines.push('');
  lines.push('## Tableau par dossier');
  lines.push('');
  lines.push('| Dossier | Statut | Fichiers | BP classifie | Others | lastActualYear | Evidence (extrait) | MaxProj | Primitive |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const others = r.classification.others.length > 0 ? r.classification.others.join(', ') : '';
    const evExt = (r.lastActualYearEvidence || '').slice(0, 60).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const prim = r.primitiveAccepted ? 'OK' : (r.rejectionReason || '-');
    const bpTag = r.classification.businessPlan ? 'oui' : 'non';
    lines.push(`| ${r.companyName.slice(0, 30)} | ${r.status} | ${r.fileCount} | ${bpTag} | ${others.slice(0, 30)} | ${r.lastActualYear ?? '—'} | ${evExt} | ${r.maxProjectionYear ?? '—'} | ${prim} |`);
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
