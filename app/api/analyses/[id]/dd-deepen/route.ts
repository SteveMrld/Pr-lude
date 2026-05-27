import { NextRequest } from 'next/server';
import { processFileRefs, type FileBufferInput } from '@/lib/file-processor';
import { getAnalysis, updateAnalysisLive, extractAnalysisMetadata } from '@/lib/analysis-store';
import { parseLedger } from '@/lib/ledger-parser';
import { parseCapTable } from '@/lib/cap-table-parser';
import { analyzeDDFinancial } from '@/lib/engines/dd-financial-engine';
import { analyzeDDContractual } from '@/lib/engines/dd-contractual-engine';
import { analyzeDDTechnical } from '@/lib/engines/dd-technical-engine';
import { logException } from '@/lib/error-logger';
import {
  downloadDossierFile,
  isValidStoragePath,
} from '@/lib/storage/dossier-uploads';

// ============================================================
// ROUTE DD APPROFONDIE (Module Bloc 2)
// ------------------------------------------------------------
// Enrichit une analyse Bloc 1 existante avec les moteurs Bloc 2
// (Data Room) sans relancer les onze moteurs Bloc 1 deja
// calcules. Le partner declenche cette route lorsqu il a recu de
// la startup les documents data room et qu il decide de passer en
// DD approfondie.
//
// Workflow attendu :
//   1. Le partner a deja lance une analyse Bloc 1 et obtenu une
//      note d instruction avec verdict (investir / investir avec
//      conditions / approfondir).
//   2. Il decide de passer en DD approfondie. La startup lui
//      transmet les documents data room (grand livre, pacte,
//      statuts, cap table, contrats clients, dossier technique).
//   3. Le partner depose ces documents dans la zone d upload Bloc
//      2 de la note. Cette route est appelee.
//   4. Les moteurs Bloc 2 tournent et leurs resultats sont mergees
//      dans le result_json existant. La note se rafraichit avec
//      les sections Data Room.
//
// La route refuse de tourner si le verdict de l instruction
// prealable est "refuser" : il n y a pas de raison d ouvrir une DD
// approfondie sur un dossier deja eliminer en phase 1.
//
// Streaming SSE pour suivi temps reel comme /api/analyze.
// ============================================================

export const maxDuration = 800;
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const analysisId = params.id;

    // Charge l analyse existante avec ownership check (RLS via Supabase)
    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return new Response(
        JSON.stringify({ error: 'Analyse introuvable ou non accessible' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const existingResult = analysis.resultJson || {};
    const extraction = existingResult.extraction;
    if (!extraction) {
      return new Response(
        JSON.stringify({ error: 'Analyse incomplete : extraction du pitch deck manquante. Le Bloc 1 n a pas tourne correctement.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Bloque la DD si verdict = refuser. Conformement au workflow VC
    // standard : si l instruction Bloc 1 conclut au refus, le dossier
    // n entre pas en data room.
    const verdict = existingResult.orchestration?.verdict || analysis.verdict;
    if (verdict === 'refuser') {
      return new Response(
        JSON.stringify({
          error: 'Le verdict de l instruction prealable est "refuser". La DD approfondie n est pas applicable a ce dossier.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Recupere les fichiers Bloc 2 via references Storage. Meme
    // raison qu en Bloc 1 : le multipart frappait le plafond 4,5 Mo
    // des fonctions Vercel sur les pieces lourdes (grand livre Excel
    // dense, dossier technique multi-PDF). Le client doit avoir
    // appele /api/uploads/sign et uploade les octets directement
    // vers Supabase Storage avant ce POST.
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON invalide. Cette route ne prend plus de multipart, voir /api/uploads/sign.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId)) {
      return new Response(
        JSON.stringify({ error: 'sessionId requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const ownerKey = typeof body?.ownerKey === 'string' ? body.ownerKey : 'solo';

    const rawRefs: any[] = Array.isArray(body?.files) ? body.files : [];
    if (rawRefs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Au moins un document data room requis pour declencher la DD approfondie' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const sessionPrefix = `${ownerKey}/${sessionId}`;
    for (const r of rawRefs) {
      if (!r || typeof r.storagePath !== 'string' || typeof r.name !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Ref invalide : storagePath et name requis' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (!isValidStoragePath(r.storagePath, sessionPrefix)) {
        return new Response(
          JSON.stringify({ error: `Chemin Storage refuse : ${r.storagePath}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    const buffered: FileBufferInput[] = await Promise.all(
      rawRefs.map(async (r: any) => {
        const buf = await downloadDossierFile(r.storagePath);
        return {
          name: r.name,
          mimeType: typeof r.mimeType === 'string' ? r.mimeType : '',
          size: typeof r.size === 'number' ? r.size : buf.byteLength,
          buffer: buf,
        };
      }),
    );

    const {
      generalLedger, shareholdersAgreement, statutes, capTable, clientContracts,
      technicalDocs,
    } = await processFileRefs(buffered);

    // Verifie qu au moins un moteur Bloc 2 va pouvoir tourner.
    // Sinon le partner a uploade des fichiers non reconnus, on ne
    // tourne pas pour rien.
    const hasBloc2Doc = !!generalLedger || !!shareholdersAgreement || !!statutes ||
      !!capTable || clientContracts.length > 0 || technicalDocs.length > 0;
    if (!hasBloc2Doc) {
      return new Response(
        JSON.stringify({
          error: 'Aucun document Bloc 2 reconnu. Verifier les noms de fichiers : grand_livre, pacte, statuts, cap_table, contrat_client_X, architecture, security_policy, rgpd, bcp, etc.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Streaming SSE pour suivi des moteurs Bloc 2 en temps reel
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const engineStartedAt: Record<string, number> = {};
        const engineDurations: Record<string, number> = {};

        function send(eventType: string, data: any) {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        function sendStart(engine: string, label: string) {
          engineStartedAt[engine] = Date.now();
          send('engine-start', { engine, label });
        }

        function sendDone(engine: string, output: any) {
          const startedAt = engineStartedAt[engine];
          const durationMs = startedAt != null ? Date.now() - startedAt : null;
          if (durationMs != null) engineDurations[engine] = durationMs;
          send('engine-done', { engine, output, durationMs });
        }

        try {
          send('files-received', {
            generalLedger: generalLedger?.name || null,
            shareholdersAgreement: shareholdersAgreement?.name || null,
            statutes: statutes?.name || null,
            capTable: capTable?.name || null,
            clientContracts: clientContracts.map(c => c.name),
            technicalDocs: technicalDocs.map(t => t.name),
          });

          // Recupere le financialData deja calcule en Bloc 1
          const existingFinancialData = existingResult.financialData || null;

          // ============================================================
          // BLOC 2 : LEDGER PARSING
          // ============================================================
          let ledgerExtraction: any = existingResult.ledgerExtraction || null;
          if (generalLedger) {
            sendStart('ledger-parsing', 'Parsing grand livre comptable');
            try {
              ledgerExtraction = parseLedger(generalLedger.payload);
            } catch (err: any) {
              logException('pipeline.ledger-parsing', err, { severity: 'warning', analysisId: params.id });
            }
            sendDone('ledger-parsing', ledgerExtraction);
          }

          // ============================================================
          // BLOC 2 : DD FINANCIERE
          // ============================================================
          let ddFinancial: any = existingResult.ddFinancial || null;
          if (ledgerExtraction) {
            sendStart('dd-financial', 'DD financiere : confrontation BP versus realite comptable');
            try {
              ddFinancial = await analyzeDDFinancial(
                extraction,
                existingFinancialData,
                ledgerExtraction,
              );
            } catch (err: any) {
              logException('pipeline.dd-financial', err, { severity: 'warning', analysisId: params.id });
            }
            sendDone('dd-financial', ddFinancial);
          }

          // ============================================================
          // BLOC 2 : CAP TABLE PARSING
          // ============================================================
          let capTableExtraction: any = existingResult.capTableExtraction || null;
          if (capTable) {
            sendStart('cap-table-parsing', 'Parsing cap table');
            try {
              const fileType = capTable.type === 'excel' || capTable.type === 'csv' || capTable.type === 'pdf'
                ? capTable.type as 'excel' | 'csv' | 'pdf'
                : 'excel';
              capTableExtraction = parseCapTable(capTable.payload, fileType);
            } catch (err: any) {
              logException('pipeline.cap-table-parsing', err, { severity: 'warning', analysisId: params.id });
            }
            sendDone('cap-table-parsing', capTableExtraction);
          }

          // ============================================================
          // BLOC 2 : DD CONTRACTUELLE
          // ============================================================
          let ddContractual: any = existingResult.ddContractual || null;
          if (shareholdersAgreement || statutes) {
            sendStart('dd-contractual', 'DD contractuelle : cartographie clauses sensibles');
            try {
              ddContractual = await analyzeDDContractual(extraction, {
                shareholdersAgreementPdf: shareholdersAgreement?.payload || null,
                shareholdersAgreementName: shareholdersAgreement?.name || null,
                statutesPdf: statutes?.payload || null,
                statutesName: statutes?.name || null,
                capTableExtraction,
                clientContracts: clientContracts.map(c => ({ name: c.name, pdfBase64: c.payload })),
              });
            } catch (err: any) {
              logException('pipeline.dd-contractual', err, { severity: 'warning', analysisId: params.id });
            }
            sendDone('dd-contractual', ddContractual);
          }

          // ============================================================
          // BLOC 2 : DD TECHNIQUE
          // ============================================================
          let ddTechnical: any = existingResult.ddTechnical || null;
          if (technicalDocs.length > 0) {
            sendStart('dd-technical', 'DD technique : audit du dossier technique fourni');
            try {
              ddTechnical = await analyzeDDTechnical(extraction, {
                techDocs: technicalDocs.map(t => ({ name: t.name, pdfBase64: t.payload })),
              });
            } catch (err: any) {
              logException('pipeline.dd-technical', err, { severity: 'warning', analysisId: params.id });
            }
            sendDone('dd-technical', ddTechnical);
          }

          // ============================================================
          // MERGE DANS LE RESULT_JSON EXISTANT
          // ============================================================
          // Strategie : on garde tout le Bloc 1 intact et on ajoute ou
          // remplace les sorties Bloc 2. Si un moteur Bloc 2 a echoue
          // ou n a pas tourne, on conserve sa sortie precedente
          // (capitalisation incrementale possible : DD financiere
          // d abord, puis ajout de la DD contractuelle plus tard).
          const newResult = {
            ...existingResult,
            ledgerExtraction,
            ddFinancial,
            capTableExtraction,
            ddContractual,
            ddTechnical,
            // Metadonnees enrichies des documents Bloc 2 deposes
            legalDocumentsMeta: {
              hasShareholdersAgreement: !!shareholdersAgreement || !!existingResult.legalDocumentsMeta?.hasShareholdersAgreement,
              shareholdersAgreementName: shareholdersAgreement?.name || existingResult.legalDocumentsMeta?.shareholdersAgreementName || null,
              hasStatutes: !!statutes || !!existingResult.legalDocumentsMeta?.hasStatutes,
              statutesName: statutes?.name || existingResult.legalDocumentsMeta?.statutesName || null,
              hasCapTable: !!capTable || !!existingResult.legalDocumentsMeta?.hasCapTable,
              capTableName: capTable?.name || existingResult.legalDocumentsMeta?.capTableName || null,
              clientContractsCount: clientContracts.length || existingResult.legalDocumentsMeta?.clientContractsCount || 0,
              clientContractsNames: clientContracts.length > 0
                ? clientContracts.map(c => c.name)
                : (existingResult.legalDocumentsMeta?.clientContractsNames || []),
            },
            technicalDocsMeta: {
              count: technicalDocs.length || existingResult.technicalDocsMeta?.count || 0,
              names: technicalDocs.length > 0
                ? technicalDocs.map(t => t.name)
                : (existingResult.technicalDocsMeta?.names || []),
            },
            meta: {
              ...(existingResult.meta || {}),
              ddDeepenedAt: new Date().toISOString(),
              engineDurations: {
                ...(existingResult.meta?.engineDurations || {}),
                ...engineDurations,
              },
            },
          };

          // ============================================================
          // PERSIST DANS SUPABASE
          // ============================================================
          const metadata = extractAnalysisMetadata(newResult);
          await updateAnalysisLive(analysisId, {
            companyName: metadata.companyName || analysis.companyName,
            sector: metadata.sector ?? analysis.sector,
            subSector: metadata.subSector ?? analysis.subSector,
            country: metadata.country ?? analysis.country,
            geographicHub: metadata.geographicHub ?? analysis.geographicHub,
            yearFounded: metadata.yearFounded ?? analysis.yearFounded,
            roundType: metadata.roundType ?? analysis.roundType,
            roundAmountEur: metadata.roundAmountEur ?? analysis.roundAmountEur,
            verdict: metadata.verdict || analysis.verdict,
            verdictConfidence: metadata.verdictConfidence ?? analysis.verdictConfidence,
            globalScore: metadata.globalScore ?? analysis.globalScore,
            blindspotScore: metadata.blindspotScore ?? analysis.blindspotScore,
            contrarianScore: metadata.contrarianScore ?? analysis.contrarianScore,
            coherenceScore: metadata.coherenceScore ?? analysis.coherenceScore,
            resultJson: newResult,
            sourceText: analysis.sourceText,
            sourceFilename: analysis.sourceFilename,
            sourcePages: analysis.sourcePages,
            pipelineDurationMs: analysis.pipelineDurationMs,
            pipelineEnginesStatus: {
              ...(analysis.pipelineEnginesStatus || {}),
              'ledger-parsing': ledgerExtraction ? 'done' : 'idle',
              'dd-financial': ddFinancial ? 'done' : 'idle',
              'cap-table-parsing': capTableExtraction ? 'done' : 'idle',
              'dd-contractual': ddContractual ? 'done' : 'idle',
              'dd-technical': ddTechnical ? 'done' : 'idle',
            },
          });

          send('complete', { result: newResult });
          controller.close();
        } catch (err: any) {
          await logException('api.dd-deepen.pipeline', err, {
            severity: 'error',
            analysisId: params.id,
            context: { phase: 'pipeline-stream' },
          });
          send('error', { error: err?.message || 'Erreur pipeline DD approfondie' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    await logException('api.dd-deepen.route', error, {
      severity: 'error',
      analysisId: params.id,
      context: { phase: 'route-entry' },
    });
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
