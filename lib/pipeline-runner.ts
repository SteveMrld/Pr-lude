import { extractFromDeck } from './engines/extraction-engine';
import { analyzeTeam } from './engines/team-engine';
import { analyzeMarket } from './engines/market-engine';
import { analyzeMacro } from './engines/macro-engine';
import { matchPatterns } from './engines/pattern-engine';
import { performCausalReversal } from './engines/causal-engine';
import { analyzeBlindspots } from './engines/blindspot-engine';
import { analyzeContrarian } from './engines/contrarian-engine';
import { extractFinancialData } from './engines/financial-extraction-engine';
import { analyzeFinancialCoherence } from './engines/financial-coherence-engine';
import { analyzeTechClaimCoherence } from './engines/tech-claim-coherence-engine';
import { analyzeExecutionFriction } from './engines/execution-friction-engine';
import { analyzeDDFinancial } from './engines/dd-financial-engine';
import { analyzeDDContractual } from './engines/dd-contractual-engine';
import { analyzeDDTechnical } from './engines/dd-technical-engine';
import { orchestrateFinalRecommendation } from './engines/orchestrator';
import { generateReferenceChecks } from './engines/reference-checks-engine';
import { analyzeBenchmarks } from './engines/benchmark-engine';
import { auditAssertions } from './engines/assertion-validator';
import { parseLedger } from './ledger-parser';
import { parseCapTable } from './cap-table-parser';
import { getJobStore } from './job-store';

interface RunOpts {
  jobId: string;
  pitchDeckPayload: string; // base64 PDF
  pitchDeckName: string;
  businessPlanPayload: string | null; // texte BP ou null
  businessPlanName: string | null;
  generalLedgerPayload: string | null; // texte grand livre comptable ou null
  generalLedgerName: string | null;
  // Documents juridiques (Module 2 DD contractuelle)
  legalDocuments?: {
    shareholdersAgreementPdf: string | null; // base64 PDF
    shareholdersAgreementName: string | null;
    statutesPdf: string | null; // base64 PDF
    statutesName: string | null;
    capTablePayload: string | null; // texte Excel/CSV ou base64 PDF
    capTableName: string | null;
    capTableType: 'excel' | 'csv' | 'pdf' | null;
    clientContracts: Array<{ name: string; pdfBase64: string }>;
  };
  // Dossier technique (Module 3 DD technique). Plusieurs PDFs
  // possibles transmis par la startup : architecture, securite, BCP,
  // RGPD, IP. Si vide, le moteur retourne not_applicable sans appel
  // LLM.
  technicalDocs?: Array<{ name: string; pdfBase64: string }>;
  otherFileNames: string[];
}

export async function runPipeline(opts: RunOpts): Promise<void> {
  const store = getJobStore();
  const startTime = Date.now();
  const {
    jobId, pitchDeckPayload, pitchDeckName,
    businessPlanPayload, businessPlanName,
    generalLedgerPayload, generalLedgerName,
    legalDocuments,
    technicalDocs,
    otherFileNames,
  } = opts;

  try {
    // Moteur 1 : Extraction du pitch deck
    await store.setEngineRunning(jobId, 'extraction');
    const extraction = await extractFromDeck(pitchDeckPayload);
    await store.setEngineDone(jobId, 'extraction', extraction);

    // Moteurs 2, 3, 4 + Extraction financière en parallèle
    await store.setEngineRunning(jobId, 'team');
    await store.setEngineRunning(jobId, 'market');
    await store.setEngineRunning(jobId, 'macro');
    await store.setEngineRunning(jobId, 'financial-extraction');

    const [team, market, macro, financialData] = await Promise.all([
      analyzeTeam(extraction).then(async r => { await store.setEngineDone(jobId, 'team', r); return r; }),
      analyzeMarket(extraction).then(async r => { await store.setEngineDone(jobId, 'market', r); return r; }),
      analyzeMacro(extraction).then(async r => { await store.setEngineDone(jobId, 'macro', r); return r; }),
      extractFinancialData(pitchDeckPayload, businessPlanPayload, extraction).then(async r => { await store.setEngineDone(jobId, 'financial-extraction', r); return r; }),
    ]);

    // Moteur Benchmarks (Session 2/4) : positionnement chiffre du dossier vs marche.
    // 100% deterministe (pas d appel LLM), execution instantanee. Sortie consommee
    // par les moteurs en aval pour enrichir leur raisonnement.
    // Si echec, on continue sans bloquer le pipeline.
    await store.setEngineRunning(jobId, 'benchmarks');
    let benchmarks: any = null;
    try {
      benchmarks = await analyzeBenchmarks(extraction, financialData);
      await store.setEngineDone(jobId, 'benchmarks', benchmarks);
    } catch (err: any) {
      console.warn('[benchmarks] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'benchmarks', null);
    }

    // Moteur Tech Claim Coherence : audit la revendication technologique
    // du dossier (budget tech alloue + revendication de moat tech). Se
    // declenche uniquement si triggers detectes dans le pitch. Sinon
    // retourne un not_applicable sans appel LLM.
    // Ne bloque pas le pipeline : si echec, on continue sans cette section.
    await store.setEngineRunning(jobId, 'tech-claim');
    let techClaimCoherence: any = null;
    try {
      techClaimCoherence = await analyzeTechClaimCoherence(extraction, financialData);
      await store.setEngineDone(jobId, 'tech-claim', techClaimCoherence);
    } catch (err: any) {
      console.warn('[tech-claim] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'tech-claim', null);
    }

    // Parsing du grand livre comptable (deterministe, pas d appel LLM).
    // Module 1 DD financiere etape 1 : extraction structuree des
    // ecritures comptables. Si pas de grand livre uploade, l extraction
    // reste null et le moteur DD financier (etape 2) ne tournera pas.
    await store.setEngineRunning(jobId, 'ledger-parsing');
    let ledgerExtraction: any = null;
    try {
      if (generalLedgerPayload) {
        ledgerExtraction = parseLedger(generalLedgerPayload);
      }
      await store.setEngineDone(jobId, 'ledger-parsing', ledgerExtraction);
    } catch (err: any) {
      console.warn('[ledger-parsing] failed:', err?.message);
      await store.setEngineDone(jobId, 'ledger-parsing', null);
    }

    // Moteur DD financier : confronte le BP projete a la realite du
    // grand livre comptable. Sept tests cote a cote (ecart CA, marge,
    // burn, headcount, concentration client, trajectoire, engagements).
    // Ne tourne que si BP + grand livre presents. Sinon retourne
    // not_applicable sans appel LLM. Module 1 DD financiere etape 2.
    await store.setEngineRunning(jobId, 'dd-financial');
    let ddFinancial: any = null;
    try {
      ddFinancial = await analyzeDDFinancial(extraction, financialData ?? null, ledgerExtraction);
      await store.setEngineDone(jobId, 'dd-financial', ddFinancial);
    } catch (err: any) {
      console.warn('[dd-financial] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'dd-financial', null);
    }

    // Parsing du cap table (deterministe, pas d appel LLM).
    // Module 2 DD contractuelle etape 1 : extraction de la structure
    // d actionnariat depuis Excel/CSV. Si fourni en PDF, le parsing
    // detaille sera fait en etape 2 par le moteur LLM.
    await store.setEngineRunning(jobId, 'cap-table-parsing');
    let capTableExtraction: any = null;
    try {
      if (legalDocuments?.capTablePayload && legalDocuments.capTableType) {
        capTableExtraction = parseCapTable(
          legalDocuments.capTablePayload,
          legalDocuments.capTableType,
        );
      }
      await store.setEngineDone(jobId, 'cap-table-parsing', capTableExtraction);
    } catch (err: any) {
      console.warn('[cap-table-parsing] failed:', err?.message);
      await store.setEngineDone(jobId, 'cap-table-parsing', null);
    }

    // Moteur DD contractuel (Module 2 etape 2) : cartographie des
    // clauses sensibles dans le pacte, les statuts et les contrats
    // clients. Ne tourne que si le pacte ou les statuts sont fournis.
    // Trois appels LLM avec PDF natif (pacte, statuts, jusqu a 3
    // contrats clients), plus un appel de synthese finale.
    // Non bloquant : si echec, on continue sans cette section.
    await store.setEngineRunning(jobId, 'dd-contractual');
    let ddContractual: any = null;
    try {
      if (legalDocuments && (legalDocuments.shareholdersAgreementPdf || legalDocuments.statutesPdf)) {
        ddContractual = await analyzeDDContractual(extraction, {
          shareholdersAgreementPdf: legalDocuments.shareholdersAgreementPdf,
          shareholdersAgreementName: legalDocuments.shareholdersAgreementName,
          statutesPdf: legalDocuments.statutesPdf,
          statutesName: legalDocuments.statutesName,
          capTableExtraction,
          clientContracts: legalDocuments.clientContracts,
        });
      }
      await store.setEngineDone(jobId, 'dd-contractual', ddContractual);
    } catch (err: any) {
      console.warn('[dd-contractual] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'dd-contractual', null);
    }

    // Moteur DD technique (Module 3) : lecture du dossier technique
    // fourni par la startup (architecture overview, security policy,
    // BCP, RGPD register, IP). Dix tests structures alignes sur la
    // GCV Investor DD Checklist sections 4/6/7/8, citation mot pour
    // mot facon ddc. Ne tourne que si au moins un document technique
    // est fourni. Si vide, retourne not_applicable sans appel LLM.
    await store.setEngineRunning(jobId, 'dd-technical');
    let ddTechnical: any = null;
    try {
      ddTechnical = await analyzeDDTechnical(extraction, {
        techDocs: technicalDocs || [],
      });
      await store.setEngineDone(jobId, 'dd-technical', ddTechnical);
    } catch (err: any) {
      console.warn('[dd-technical] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'dd-technical', null);
    }

    // Moteur Friction d execution commerciale et industrielle :
    // decrit objectivement la distance structurelle entre la startup
    // et son chemin vers le revenu (8 axes : go-to-market, financement
    // transactionnel, industrialisation, supply chain, ecosysteme tech,
    // regulation, referencement institutionnel, talent rare). Se
    // declenche si au moins 2 flags sur 8 sont positifs. Sinon
    // retourne un not_applicable sans appel LLM.
    // Ne bloque pas le pipeline : si echec, on continue sans cette section.
    await store.setEngineRunning(jobId, 'execution-friction');
    let executionFriction: any = null;
    try {
      const rawSummary = (extraction as any)?.rawSummary || '';
      executionFriction = await analyzeExecutionFriction(extraction, financialData ?? null, rawSummary);
      await store.setEngineDone(jobId, 'execution-friction', executionFriction);
    } catch (err: any) {
      console.warn('[execution-friction] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'execution-friction', null);
    }

    // Moteur 5 : Pattern Matching
    await store.setEngineRunning(jobId, 'pattern');
    const patternMatching = await matchPatterns(extraction, team, market, macro);
    await store.setEngineDone(jobId, 'pattern', patternMatching);

    // Moteurs 6, 7, 8, 14 en parallèle
    await store.setEngineRunning(jobId, 'causal');
    await store.setEngineRunning(jobId, 'blindspot');
    await store.setEngineRunning(jobId, 'contrarian');
    await store.setEngineRunning(jobId, 'financial-coherence');

    const [causalReversal, blindspotAnalysis, contrarianAnalysis, financialCoherence] = await Promise.all([
      performCausalReversal(extraction, team, market, macro, patternMatching).then(async r => { await store.setEngineDone(jobId, 'causal', r); return r; }),
      analyzeBlindspots(extraction, team, market, macro).then(async r => { await store.setEngineDone(jobId, 'blindspot', r); return r; }),
      analyzeContrarian(extraction, team, market, macro).then(async r => { await store.setEngineDone(jobId, 'contrarian', r); return r; }),
      analyzeFinancialCoherence(extraction, financialData, market, benchmarks).then(async r => { await store.setEngineDone(jobId, 'financial-coherence', r); return r; }),
    ]);

    // Moteur 9 : Orchestration finale
    await store.setEngineRunning(jobId, 'orchestrate');
    const finalRecommendation = await orchestrateFinalRecommendation(
      extraction, team, market, macro, patternMatching, causalReversal,
      blindspotAnalysis, contrarianAnalysis
    );
    await store.setEngineDone(jobId, 'orchestrate', finalRecommendation);

    // Moteur 12 : Reference Checks. Genere le plan d'appels de DD terrain
    // (founders, customers, board) avec questions-types et profils a identifier.
    // Ne bloque pas le pipeline : si echec, on continue sans cette section.
    await store.setEngineRunning(jobId, 'reference-checks');
    let referenceChecks: any = null;
    try {
      referenceChecks = await generateReferenceChecks(
        extraction, team, blindspotAnalysis, causalReversal,
      );
      await store.setEngineDone(jobId, 'reference-checks', referenceChecks);
    } catch (err: any) {
      console.warn('[reference-checks] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'reference-checks', null);
    }

    // ============================================================
    // NIVEAU 2.B : AUDIT CONSOLIDE DES ASSERTIONS
    // ------------------------------------------------------------
    // Apres que tous les moteurs ont produit leurs outputs, on parcourt
    // mecaniquement les textes critiques (red flags, drivers, evidence,
    // rationale, alertes) et on flagge :
    //   - Les noms propres absents du pitch et non taggues [web]/[inference]
    //   - Les conversions de devise non taggues (pitch en EUR mais USD cite)
    //   - Les annees inventees non taggues
    // L audit est non-bloquant : on remonte les warnings dans le resultat
    // pour que l UI puisse les exposer en bandeau et pour que la DD
    // identifie les points a verifier en priorite.
    // ============================================================
    let assertionAudit: any = null;
    try {
      const enginesToAudit: Array<[string, unknown]> = [
        ['team', team],
        ['market', market],
        ['macro', macro],
        ['pattern', patternMatching],
        ['causal', causalReversal],
        ['blindspot', blindspotAnalysis],
        ['contrarian', contrarianAnalysis],
        ['financial-coherence', financialCoherence],
        ['orchestrator', finalRecommendation],
      ];

      const allWarnings: any[] = [];
      const byEngine: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};

      for (const [engineName, engineOutput] of enginesToAudit) {
        if (!engineOutput) continue;
        const report = auditAssertions(engineOutput, extraction);
        if (report.totalWarnings > 0) {
          byEngine[engineName] = report.totalWarnings;
          for (const w of report.warnings) {
            allWarnings.push({ engine: engineName, ...w });
          }
        }
      }

      for (const w of allWarnings) {
        byCategory[w.category] = (byCategory[w.category] || 0) + 1;
        bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1;
      }

      assertionAudit = {
        totalWarnings: allWarnings.length,
        byEngine,
        byCategory,
        bySeverity,
        warnings: allWarnings,
      };

      if (allWarnings.length > 0) {
        console.warn(`[assertion-audit] ${allWarnings.length} warnings across engines:`, byCategory);
      }
    } catch (err: any) {
      console.warn('[assertion-audit] failed, continuing without:', err?.message);
    }

    const result = {
      meta: {
        filename: pitchDeckName,
        additionalFiles: [...(businessPlanName ? [businessPlanName] : []), ...otherFileNames],
        analyzedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      extraction,
      financialData,
      team,
      market,
      macro,
      benchmarks,
      patternMatching,
      causalReversal,
      blindspotAnalysis,
      contrarianAnalysis,
      financialCoherence,
      techClaimCoherence,
      executionFriction,
      ledgerExtraction,
      ddFinancial,
      capTableExtraction,
      ddContractual,
      ddTechnical,
      // Metadonnees des documents techniques uploades. Comme pour les
      // documents juridiques, on expose noms et compte sans persister
      // les fichiers bruts dans result_json.
      technicalDocsMeta: {
        count: (technicalDocs || []).length,
        names: (technicalDocs || []).map(t => t.name),
      },
      // Metadonnees des documents juridiques uploades, pour l etape 2
      // du moteur DD contractuel (LLM) qui s appuiera sur ces fichiers.
      // On expose les noms et la presence sans persister les payloads
      // bruts pour ne pas stocker des documents juridiques sensibles
      // dans le result_json en base.
      legalDocumentsMeta: legalDocuments ? {
        hasShareholdersAgreement: !!legalDocuments.shareholdersAgreementPdf,
        shareholdersAgreementName: legalDocuments.shareholdersAgreementName,
        hasStatutes: !!legalDocuments.statutesPdf,
        statutesName: legalDocuments.statutesName,
        hasCapTable: !!legalDocuments.capTablePayload,
        capTableName: legalDocuments.capTableName,
        clientContractsCount: legalDocuments.clientContracts.length,
        clientContractsNames: legalDocuments.clientContracts.map(c => c.name),
      } : null,
      finalRecommendation,
      referenceChecks,
      assertionAudit,
    };

    await store.setComplete(jobId, result);
  } catch (error: any) {
    console.error('Pipeline error:', error);
    await store.setError(jobId, error.message || 'Erreur pipeline');
  }
}
