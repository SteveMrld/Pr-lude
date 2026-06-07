// ============================================================
// SETKEY-SUPABASE-PAT : injection PAT Supabase sans clipboard long
// ------------------------------------------------------------
// Variante de setkey-server.ts dediee au Personal Access Token
// Supabase (sbp_...) qui permet d appeler la Management API
// (https://api.supabase.com/v1/projects/{ref}/database/query) et
// d executer des DDL arbitraires sans passer par le SQL Editor
// du dashboard (lui-meme expose au risque de clipboard tronque
// sur fichiers > ~5 Ko).
//
// Pourquoi un serveur HTML plutot que la lecture stdin :
// le PAT fait ~40 caracteres donc le clipboard reste fiable,
// mais cette variante reutilise la doctrine setkey-server :
// preview live, validation format, test contre l API, ecriture
// dans .env.local. Le formulaire HTML accepte aussi la saisie
// au clavier comme garde-fou definitif.
//
// Usage :
//   npx tsx scripts/setkey-supabase-pat.ts
//   puis ouvrir http://localhost:7778 dans le navigateur
// ============================================================

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PORT = 7778;
const ENV_FILE = join(process.cwd(), '.env.local');
const ENV_VAR = 'SUPABASE_PAT';

const PAGE_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Setkey Supabase PAT</title>
<style>
  body { font-family: ui-monospace, Menlo, monospace; max-width: 720px; margin: 40px auto; padding: 0 20px; background: #f7f5f0; color: #2a2520; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .sub { color: #6b6359; font-size: 13px; margin-bottom: 24px; }
  textarea { width: 100%; min-height: 70px; font-family: inherit; font-size: 13px; padding: 10px; border: 1px solid #c9c1b4; border-radius: 4px; box-sizing: border-box; background: #fffefb; }
  .meta { font-size: 12px; color: #6b6359; margin-top: 6px; display: flex; justify-content: space-between; }
  .meta .ok { color: #2d6e3e; }
  .meta .ko { color: #a0392c; }
  button { font-family: inherit; font-size: 13px; padding: 8px 14px; margin-top: 12px; margin-right: 8px; cursor: pointer; border: 1px solid #2a2520; background: #fff; }
  button:hover { background: #2a2520; color: #fff; }
  button[disabled] { opacity: 0.4; cursor: not-allowed; }
  pre.preview { background: #fffefb; border: 1px solid #e5dfd2; padding: 8px; font-size: 11px; overflow-x: auto; word-break: break-all; white-space: pre-wrap; max-height: 60px; }
  .result { margin-top: 16px; padding: 10px 14px; border-radius: 4px; font-size: 13px; line-height: 1.5; }
  .result.ok { background: #e8f1eb; color: #2d6e3e; border: 1px solid #b9d8c5; }
  .result.ko { background: #f4e7e4; color: #8a2f24; border: 1px solid #e0b9b1; }
  .result.info { background: #f0ece2; color: #4a4338; border: 1px solid #d4cdba; }
</style>
</head>
<body>
<h1>Injection PAT Supabase dans .env.local</h1>
<p class="sub">Genere ton PAT sur https://supabase.com/dashboard/account/tokens puis colle-le ici. Le test verifie qu il liste bien tes projets.</p>

<form id="form">
  <textarea id="key" autofocus autocomplete="off" spellcheck="false" placeholder="sbp_..."></textarea>
  <div class="meta">
    <span id="counter">longueur : 0 caracteres</span>
    <span id="format"></span>
  </div>

  <details style="margin-top: 12px;">
    <summary style="font-size: 12px; color: #6b6359; cursor: pointer;">Voir le contenu tape</summary>
    <pre class="preview" id="preview"></pre>
  </details>

  <button type="button" id="btnTest">Tester contre l API Supabase</button>
  <button type="button" id="btnSave" disabled>Sauvegarder dans .env.local</button>
  <button type="button" id="btnQuit">Fermer le serveur</button>
</form>

<div id="result" class="result info" style="display:none;"></div>

<script>
const keyEl = document.getElementById('key');
const counterEl = document.getElementById('counter');
const formatEl = document.getElementById('format');
const previewEl = document.getElementById('preview');
const btnTest = document.getElementById('btnTest');
const btnSave = document.getElementById('btnSave');
const btnQuit = document.getElementById('btnQuit');
const resultEl = document.getElementById('result');

let lastTestPassed = false;

function showResult(kind, msg) {
  resultEl.style.display = 'block';
  resultEl.className = 'result ' + kind;
  resultEl.textContent = msg;
}

function refresh() {
  const v = keyEl.value;
  const clean = v.replace(/\\s+/g, '');
  counterEl.textContent = 'longueur : ' + v.length + ' caracteres (sans espace : ' + clean.length + ')';
  previewEl.textContent = v;

  if (clean.startsWith('sbp_') && clean.length >= 30) {
    formatEl.innerHTML = '<span class="ok">format plausible</span>';
  } else if (clean.length === 0) {
    formatEl.textContent = '';
  } else {
    formatEl.innerHTML = '<span class="ko">format inhabituel (attendu : sbp_ + ~40 chars)</span>';
  }

  lastTestPassed = false;
  btnSave.disabled = true;
}

keyEl.addEventListener('input', refresh);

btnTest.addEventListener('click', async () => {
  const v = keyEl.value.replace(/\\s+/g, '');
  if (!v) { showResult('ko', 'Champ vide.'); return; }
  showResult('info', 'Appel api.supabase.com en cours...');
  try {
    const r = await fetch('/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: v }),
    });
    const data = await r.json();
    if (data.ok) {
      showResult('ok', 'OK : PAT valide. ' + data.summary);
      lastTestPassed = true;
      btnSave.disabled = false;
    } else {
      showResult('ko', 'ECHEC : ' + data.error);
      lastTestPassed = false;
      btnSave.disabled = true;
    }
  } catch (e) {
    showResult('ko', 'Erreur reseau : ' + (e && e.message ? e.message : String(e)));
  }
});

btnSave.addEventListener('click', async () => {
  if (!lastTestPassed) { showResult('ko', 'Lance d abord un test concluant.'); return; }
  const v = keyEl.value.replace(/\\s+/g, '');
  showResult('info', 'Ecriture dans .env.local...');
  try {
    const r = await fetch('/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: v }),
    });
    const data = await r.json();
    if (data.ok) {
      showResult('ok', 'Sauvegarde OK dans ' + data.path + '. Tu peux fermer le serveur et lancer apply-migration.ts.');
    } else {
      showResult('ko', 'Echec sauvegarde : ' + data.error);
    }
  } catch (e) {
    showResult('ko', 'Erreur reseau : ' + (e && e.message ? e.message : String(e)));
  }
});

btnQuit.addEventListener('click', async () => {
  await fetch('/quit', { method: 'POST' }).catch(() => {});
  showResult('info', 'Serveur arrete. Tu peux fermer cet onglet.');
});

refresh();
</script>
</body>
</html>`;

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function jsonResponse(res: ServerResponse, status: number, body: any): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function testPat(key: string): Promise<{ ok: boolean; error?: string; summary?: string }> {
  try {
    const r = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
    });
    if (!r.ok) {
      const text = await r.text();
      return { ok: false, error: `HTTP ${r.status} : ${text.slice(0, 200)}` };
    }
    const data: any = await r.json();
    const count = Array.isArray(data) ? data.length : 0;
    const names = Array.isArray(data) ? data.map((p: any) => p?.name ?? '?').slice(0, 5).join(', ') : '';
    return { ok: true, summary: `${count} projet(s) accessibles : ${names}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

function saveKeyToEnvFile(key: string): { ok: boolean; error?: string; path: string } {
  try {
    let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
    const line = `${ENV_VAR}=${key}`;
    const re = new RegExp(`^${ENV_VAR}=.*$`, 'm');
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      if (content.length > 0 && !content.endsWith('\n')) content += '\n';
      content += line + '\n';
    }
    writeFileSync(ENV_FILE, content, 'utf8');
    return { ok: true, path: ENV_FILE };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e), path: ENV_FILE };
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE_HTML);
    return;
  }

  if (method === 'POST' && url === '/test') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const key = String(data?.key ?? '').trim();
      if (!key) { jsonResponse(res, 400, { ok: false, error: 'Cle vide.' }); return; }
      const result = await testPat(key);
      jsonResponse(res, 200, result);
    } catch (e: any) {
      jsonResponse(res, 500, { ok: false, error: e?.message ?? String(e) });
    }
    return;
  }

  if (method === 'POST' && url === '/save') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const key = String(data?.key ?? '').trim();
      if (!key) { jsonResponse(res, 400, { ok: false, error: 'Cle vide.' }); return; }
      const verify = await testPat(key);
      if (!verify.ok) {
        jsonResponse(res, 200, { ok: false, error: 'PAT rejete par l API : ' + verify.error });
        return;
      }
      const result = saveKeyToEnvFile(key);
      jsonResponse(res, 200, result);
    } catch (e: any) {
      jsonResponse(res, 500, { ok: false, error: e?.message ?? String(e) });
    }
    return;
  }

  if (method === 'POST' && url === '/quit') {
    jsonResponse(res, 200, { ok: true });
    setTimeout(() => process.exit(0), 100);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nSetkey-supabase-pat pret.`);
  console.log(`Ouvrir : http://localhost:${PORT}`);
  console.log(`Cible   : ${ENV_FILE} (variable ${ENV_VAR})`);
  console.log(`Ctrl+C pour arreter.\n`);
});
