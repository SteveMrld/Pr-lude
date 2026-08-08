// ============================================================
// ROUTE /api/export-pdf
// ------------------------------------------------------------
// Genere un PDF impeccable cote serveur a partir du HTML rendu
// par le client (la note d investissement).
//
// FLOW :
//   1. Client envoie POST avec { html, css, title, fileName }
//   2. Serveur lance Chromium serverless via Puppeteer-core
//   3. Charge le HTML dans un onglet headless
//   4. Imprime en A4 avec marges propres
//   5. Retourne le PDF binaire en download
//
// RISQUES GERES
//   - Cold start ~3-8s : annonce dans la response time du client
//   - Chromium pese ~50MB : on utilise @sparticuz/chromium-min
//     qui telecharge Chromium au runtime depuis CDN, sortant
//     ainsi de la limite 50MB du package Vercel
//   - Memoire : on limite a 1024MB pour ne pas saturer
//
// LIMITES CONNUES
//   - max-age serverless 300s (suffit largement pour PDF)
//   - Pas de cache : chaque export regenere (couteux mais propre)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { logException } from '@/lib/error-logger';
import { assemblerDocumentExport } from '@/lib/note/document-export';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExportPdfRequest {
  html: string;
  css?: string;
  title?: string;
  fileName?: string;
}

export async function POST(req: NextRequest) {
  let body: ExportPdfRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.html || typeof body.html !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid html field' }, { status: 400 });
  }

  // Limite de taille du HTML pour eviter les abus
  if (body.html.length > 5_000_000) {
    return NextResponse.json({ error: 'HTML too large (>5MB)' }, { status: 413 });
  }

  const title = body.title || 'Note d investissement Prelude';
  const fileName = body.fileName || 'prelude-note.pdf';

  // Le document est assemble par `lib/note/document-export.ts`, et non
  // ici, pour qu un instrument puisse le reconstituer sans le reecrire.
  // La raison est ecrite dans ce module : le defaut de fonte du 8 aout
  // 2026 ne vivait que dans ce document, et les deux facons de le
  // chercher ailleurs l ont manque.
  //
  // PROBLEME RESOLU : @sparticuz/chromium-min serverless est depouille de
  // polices systeme pour gagner du poids. La chaine de fallback Charter
  // Cambria Georgia tombe sur un fallback ultime qui ne couvre pas tout
  // l Unicode. On embarque donc Source Serif 4 et Inter en Google Fonts,
  // et on attend `document.fonts.ready` avant d imprimer.
  const fullHtml = assemblerDocumentExport({ html: body.html, css: body.css, title });

  let browser;
  try {
    // Import dynamique : ne charger Chromium qu en runtime, pas au cold-start.
    // En local (NODE_ENV=development), on utilise puppeteer classique.
    // En production Vercel, @sparticuz/chromium-min telecharge un Chromium
    // optimise pour serverless depuis un CDN.
    const puppeteer = await import('puppeteer-core');
    let executablePath: string;
    let args: string[];
    let headless: boolean | 'shell' = true;

    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium-min')).default;
      // URL du Chromium serverless. Cette URL doit etre accessible en
      // production. La version doit matcher chromium-min installe.
      const chromiumPack = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
      executablePath = await chromium.executablePath(chromiumPack);
      args = chromium.args;
      // chromium.headless n est pas typiquement expose dans les types du
      // package, mais existe au runtime. On force le cast pour l acces.
      headless = (chromium as any).headless ?? 'shell';
    } else {
      // Mode dev : suppose que Chrome/Chromium est installe localement
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    browser = await puppeteer.launch({
      args,
      executablePath,
      headless,
      defaultViewport: { width: 1240, height: 1754 }, // ~A4 en pixels @150dpi
    });

    const page = await browser.newPage();

    // Charger le HTML directement (pas via URL, pour eviter network)
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });

    // ATTENTE EXPLICITE DU CHARGEMENT DES FONTES
    // ------------------------------------------------------------
    // Source Serif 4 et Inter sont charges via Google Fonts <link>.
    // networkidle0 indique que les requetes reseau sont stabilisees
    // mais ne garantit pas que les fontes sont disponibles pour le
    // rendu. document.fonts.ready est une Promise qui se resout quand
    // toutes les fontes declarees sont chargees ET appliquees au DOM.
    // Sans cette attente, le PDF peut etre genere avec un fallback
    // serif incomplet sur l Unicode etendu, ce qui produit les
    // caracteres manquants observes (€, accents, ligatures).
    try {
      await page.evaluate(() => (document as any).fonts.ready);
    } catch {
      // si l attente echoue, on continue : Sparticuz peut avoir des
      // limitations sur l API document.fonts. Le fallback Georgia
      // couvrira la plupart des caracteres latins de base.
    }

    // Generer le PDF avec marges A4 et impression couleurs
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '14mm', right: '14mm', bottom: '16mm', left: '14mm' },
    });

    await browser.close();
    browser = null;

    // Renvoyer le PDF en download
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    await logException('api.export-pdf', err, {
      severity: 'error',
      context: { phase: 'puppeteer-render' },
    });
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return NextResponse.json(
      { error: 'PDF generation failed', detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

