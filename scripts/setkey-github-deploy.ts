// ============================================================
// SETKEY-GITHUB-DEPLOY : injection du jeton de lecture des deploiements
// ------------------------------------------------------------
// Meme mecanisme que `setkey-supabase-pat.ts` : un serveur local, un
// test contre l API avant toute ecriture, puis l ecriture dans
// `.env.local`. Le jeton ne transite jamais par la ligne de commande,
// donc il ne se depose pas dans `~/.bash_history`, ce qui est la seule
// raison d etre de cette forme et elle est ecrite au registre depuis le
// 7 aout 2026.
//
// LE JETON A DEMANDER, ET IL EST VOLONTAIREMENT PLUS PAUVRE QUE CE QUE
// GITHUB PROPOSE PAR DEFAUT. Un jeton fin, sur ce depot seul, avec une
// seule permission : Deployments en lecture. Il ne peut ni pousser, ni
// lire le code, ni ouvrir une issue, ni voir les secrets. Le test
// ci-dessous refuse un jeton qui n arrive pas a lire les deploiements,
// et il refuse aussi de valider sur un jeton qui saurait ecrire : un
// jeton trop large qui fonctionne est precisement celui qu on garde des
// annees sans y penser.
//
// LA DEUXIEME ECRITURE, DECLAREE. Le formulaire, l ecriture dans
// `.env.local` et le serveur existent deja dans `setkey-supabase-pat.ts`.
// Ce fichier en est une seconde ecriture, ce que la doctrine du depot
// deconseille, et le choix est assume plutot que cache : fusionner les
// deux demanderait de toucher au chemin d injection d un identifiant qui
// fonctionne, pour un gain de forme. La dette est donc que les deux
// devront etre corriges ensemble le jour ou l un des deux se revele
// fautif.
//
// Usage :
//   npx tsx scripts/setkey-github-deploy.ts
//   puis ouvrir http://localhost:7779
// ============================================================

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

import { depotDuRemote } from './verifier-deploiement';

const PORT = 7779;
const ENV_FILE = join(process.cwd(), '.env.local');
const ENV_VAR = 'GITHUB_DEPLOY_TOKEN';

const depot = (() => {
  const url = execSync('git remote get-url origin').toString().trim();
  const d = depotDuRemote(url);
  if (!d) throw new Error(`Remote non reconnu comme depot GitHub : ${url}`);
  return d;
})();

const PAGE_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Setkey jeton de deploiement</title>
<style>
  body { font-family: ui-monospace, Menlo, monospace; max-width: 720px; margin: 40px auto; padding: 0 20px; background: #f7f5f0; color: #2a2520; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .sub { color: #6b6359; font-size: 13px; margin-bottom: 24px; line-height: 1.6; }
  textarea { width: 100%; min-height: 70px; font-family: inherit; font-size: 13px; padding: 10px; border: 1px solid #c9c1b4; border-radius: 4px; box-sizing: border-box; background: #fffefb; }
  button { font-family: inherit; font-size: 13px; padding: 8px 14px; margin-top: 12px; margin-right: 8px; cursor: pointer; border: 1px solid #2a2520; background: #fff; }
  button:hover { background: #2a2520; color: #fff; }
  button[disabled] { opacity: 0.4; cursor: not-allowed; }
  .result { margin-top: 16px; padding: 10px 14px; border-radius: 4px; font-size: 13px; line-height: 1.5; }
  .result.ok { background: #e8f1eb; color: #2d6e3e; border: 1px solid #b9d8c5; }
  .result.ko { background: #f4e7e4; color: #8a2f24; border: 1px solid #e0b9b1; }
  .result.info { background: #f0ece2; color: #4a4338; border: 1px solid #d4cdba; }
  code { background: #efeae0; padding: 1px 4px; }
</style>
</head>
<body>
<h1>Jeton de lecture des deploiements</h1>
<p class="sub">
Sur <code>github.com/settings/personal-access-tokens</code>, creer un jeton
<strong>fin</strong> limite au depot <code>${depot.proprietaire}/${depot.nom}</code>,
avec une seule permission : <strong>Deployments : Read-only</strong>. Rien d autre.
Le test ci-dessous lit les deploiements du depot et refuse le jeton s il ne le peut pas.
</p>
<textarea id="key" autofocus autocomplete="off" spellcheck="false" placeholder="github_pat_..."></textarea>
<div>
  <button id="test">Tester</button>
  <button id="save" disabled>Ecrire dans .env.local</button>
  <button id="quit">Arreter le serveur</button>
</div>
<div id="result"></div>
<script>
var keyEl = document.getElementById('key');
var out = document.getElementById('result');
var btnSave = document.getElementById('save');
var passe = false;
function montrer(k, t) { out.className = 'result ' + k; out.textContent = t; }
document.getElementById('test').addEventListener('click', async function () {
  var v = keyEl.value.replace(/\\s+/g, '');
  if (!v) { montrer('ko', 'Jeton vide.'); return; }
  montrer('info', 'Test en cours...');
  var r = await fetch('/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: v }) });
  var d = await r.json();
  if (d.ok) { montrer('ok', 'OK : ' + d.summary); passe = true; btnSave.disabled = false; }
  else { montrer('ko', 'ECHEC : ' + d.error); passe = false; btnSave.disabled = true; }
});
document.getElementById('save').addEventListener('click', async function () {
  if (!passe) { montrer('ko', 'Lance d abord un test concluant.'); return; }
  var v = keyEl.value.replace(/\\s+/g, '');
  var r = await fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: v }) });
  var d = await r.json();
  montrer(d.ok ? 'ok' : 'ko', d.ok ? 'Ecrit dans ' + d.path + '. Verifier avec : npm run verifier-deploiement' : 'Echec : ' + d.error);
});
document.getElementById('quit').addEventListener('click', async function () {
  await fetch('/quit', { method: 'POST' }).catch(function () {});
  montrer('info', 'Serveur arrete.');
});
</script>
</body>
</html>`;

async function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = [];
    req.on('data', c => morceaux.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')));
    req.on('error', reject);
  });
}

function repondre(res: ServerResponse, statut: number, corps: unknown): void {
  res.writeHead(statut, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

/**
 * Le test porte sur ce que le jeton doit pouvoir faire, et sur ce qu il
 * ne doit pas pouvoir faire.
 *
 * Le premier sens prouve qu il sert. Le second prouve qu il est etroit,
 * et il compte autant : un jeton qui sait ecrire passerait le premier
 * test sans que rien ne le signale, et il resterait dans `.env.local`
 * pendant des mois avec des droits que personne n a voulu lui donner.
 */
async function tester(cle: string): Promise<{ ok: boolean; error?: string; summary?: string }> {
  const entetes = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${cle}`,
  };
  const racine = `https://api.github.com/repos/${depot.proprietaire}/${depot.nom}`;
  try {
    const r = await fetch(`${racine}/deployments?per_page=3`, { headers: entetes });
    if (!r.ok) {
      return { ok: false, error: `lecture des deploiements refusee : HTTP ${r.status} ${(await r.text()).slice(0, 160)}` };
    }
    const d = (await r.json()) as Array<{ sha: string; environment: string }>;

    // Le second sens : une ecriture doit etre refusee. On tente la
    // creation d un deploiement volontairement invalide ; un jeton en
    // lecture seule rend 403, un jeton trop large rend autre chose.
    const w = await fetch(`${racine}/deployments`, {
      method: 'POST',
      headers: { ...entetes, 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'refs/heads/jeton-de-controle-qui-n-existe-pas' }),
    });
    if (w.status !== 403 && w.status !== 404) {
      return {
        ok: false,
        error: `le jeton n est pas en lecture seule : une tentative d ecriture rend HTTP ${w.status}`
          + ' au lieu de 403. Recreer le jeton avec Deployments : Read-only.',
      };
    }
    return {
      ok: true,
      summary: `${d.length} deploiement(s) lisible(s), ecriture refusee (HTTP ${w.status}).`,
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function ecrire(cle: string): { ok: boolean; error?: string; path: string } {
  try {
    let contenu = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
    const ligne = `${ENV_VAR}=${cle}`;
    const re = new RegExp(`^${ENV_VAR}=.*$`, 'm');
    if (re.test(contenu)) contenu = contenu.replace(re, ligne);
    else {
      if (contenu.length > 0 && !contenu.endsWith('\n')) contenu += '\n';
      contenu += ligne + '\n';
    }
    writeFileSync(ENV_FILE, contenu, 'utf8');
    return { ok: true, path: ENV_FILE };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), path: ENV_FILE };
  }
}

const serveur = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const methode = req.method ?? 'GET';
  if (methode === 'GET' && (url === '/' || url === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE_HTML);
    return;
  }
  if (methode === 'POST' && (url === '/test' || url === '/save')) {
    const cle = String((JSON.parse(await lireCorps(req)) as { key?: string })?.key ?? '').trim();
    if (!cle) { repondre(res, 400, { ok: false, error: 'Jeton vide.' }); return; }
    repondre(res, 200, url === '/test' ? await tester(cle) : ecrire(cle));
    return;
  }
  if (methode === 'POST' && url === '/quit') {
    repondre(res, 200, { ok: true });
    setTimeout(() => process.exit(0), 100);
    return;
  }
  repondre(res, 404, { ok: false, error: 'inconnu' });
});

serveur.listen(PORT, () => {
  console.log(`Setkey jeton de deploiement : http://localhost:${PORT}`);
  console.log(`Depot vise : ${depot.proprietaire}/${depot.nom}. Permission attendue : Deployments Read-only.`);
});
