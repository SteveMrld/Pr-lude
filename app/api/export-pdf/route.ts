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

  // Construction du document HTML complet avec le CSS injecte.
  // On force la couleur d impression pour que les badges colores
  // (caution-tale rouge anglais, etc.) ressortent bien.
  const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1a1a1a;
      font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
      font-size: 11pt;
      line-height: 1.55;
    }
    /* Eviter les coupures dans les blocs critiques */
    .note-section, .note-block, .reco-card, .benchmark-block,
    h1, h2, h3 { break-inside: avoid; page-break-inside: avoid; }
    /* CSS supplementaire injecte par le client (styles de la note) */
    ${body.css || ''}
  </style>
</head>
<body>
  ${body.html}
</body>
</html>`;

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
    console.error('[export-pdf] Erreur generation PDF:', err);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return NextResponse.json(
      { error: 'PDF generation failed', detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
