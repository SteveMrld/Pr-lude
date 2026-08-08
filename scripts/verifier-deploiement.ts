// ============================================================
// VERIFIER-DEPLOIEMENT : l etat du deploiement du commit qu on vient de
// pousser, et le refus de rendre la main quand il est rouge
// ------------------------------------------------------------
// Ecrit le 8 aout 2026, apres six heures de production cassee par un
// commit qui passait `tsc` et la suite deterministe. Les deux etaient
// vertes a bon droit : le compilateur n ouvre pas les fichiers CSS et
// aucun test ne rend de page. Le seul dispositif qui voit cette classe de
// defaut est le build, et le seul qui voit ce que le build a produit est
// l hebergeur.
//
// CE QU IL VERIFIE, ET SUR QUOI IL SE PRONONCE. Il demande a GitHub
// l etat des deploiements associes au sha exact qu on vient de pousser,
// et non au dernier deploiement du depot : deux pushes rapprochés
// donneraient sinon le verdict du precedent, ce qui est la mesure faite
// sur le mauvais objet. Il attend, parce qu un deploiement n existe pas a
// la seconde ou le push se termine, et il distingue trois issues qui ne
// se valent pas.
//
// LES TROIS ISSUES SE DISTINGUENT, ET C EST TOUT LE SUJET. Un
// deploiement reussi rend vert. Un deploiement en echec rend rouge. Et
// l absence de deploiement pour ce sha, apres le delai d attente, n est
// ni l un ni l autre : c est un silence, et un silence ne se lit pas
// comme un succes. Il sort en code distinct avec sa raison, parce qu un
// jeton absent, une integration debranchee et un build qui n a pas encore
// demarre produisent le meme silence et appellent trois reponses
// differentes.
//
// CE QU IL NE COUVRE PAS. Il dit que l hebergeur a construit et deploye,
// pas que la page s affiche : un deploiement vert peut servir une note
// cassee au rendu, et c est le role des sondes de capture. Il ne dit rien
// non plus du contenu du build, seulement de son issue.
//
// LE JETON. `GITHUB_DEPLOY_TOKEN` dans .env.local, jeton fin a portee
// reduite, une seule permission, Deployments en lecture seule sur ce
// depot. Il ne peut ni pousser, ni lire le code, ni ouvrir une issue.
// Sans lui l instrument ne rend pas vert : il rend son silence.
//
// Usage :
//   npx tsx scripts/verifier-deploiement.ts [sha] [--attente <secondes>]
// ============================================================

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, 'utf-8').split('\n')) {
      const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

/**
 * Le depot se derive du remote et ne s ecrit pas dans une constante.
 * Les deux formes du remote sont acceptees, SSH et HTTPS, parce que le
 * depot est passe de l une a l autre le 3 aout et qu une constante
 * ecrite ce jour-la aurait cesse d etre vraie sans le dire.
 */
export function depotDuRemote(url: string): { proprietaire: string; nom: string } | null {
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\s*$/);
  if (!m) return null;
  return { proprietaire: m[1], nom: m[2] };
}

export type EtatDeploiement =
  | { issue: 'succes'; environnement: string; url?: string }
  | { issue: 'echec'; environnement: string; etat: string; url?: string }
  | { issue: 'silence'; raison: string };

/**
 * L etat des deploiements d un sha, tel que GitHub le rapporte.
 *
 * Un sha peut porter plusieurs deploiements, production et previsualisation.
 * Le verdict retient le plus severe : un echec quelque part est un echec,
 * parce que l inverse laisserait un deploiement rouge passer sous le vert
 * d un autre.
 */
export function verdictDesEtats(
  etats: Array<{ environnement: string; etat: string; url?: string }>,
): EtatDeploiement {
  if (etats.length === 0) return { issue: 'silence', raison: 'aucun etat rapporte' };
  const rouge = etats.find(e => ['failure', 'error'].includes(e.etat));
  if (rouge) {
    return { issue: 'echec', environnement: rouge.environnement, etat: rouge.etat, url: rouge.url };
  }
  const vert = etats.find(e => e.etat === 'success');
  if (vert) return { issue: 'succes', environnement: vert.environnement, url: vert.url };
  return {
    issue: 'silence',
    raison: `aucun etat terminal, en cours : ${etats.map(e => e.etat).join(', ')}`,
  };
}

async function etatsDuSha(
  e: Record<string, string>,
  depot: { proprietaire: string; nom: string },
  sha: string,
): Promise<Array<{ environnement: string; etat: string; url?: string }>> {
  const jeton = e.GITHUB_DEPLOY_TOKEN || process.env.GITHUB_DEPLOY_TOKEN;
  const entetes: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${jeton}`,
  };
  const racine = `https://api.github.com/repos/${depot.proprietaire}/${depot.nom}`;
  const r = await fetch(`${racine}/deployments?sha=${sha}&per_page=20`, { headers: entetes });
  if (!r.ok) throw new Error(`deployments: ${r.status} ${await r.text()}`);
  const deploiements = (await r.json()) as Array<{ id: number; environment: string }>;

  const sorties: Array<{ environnement: string; etat: string; url?: string }> = [];
  for (const d of deploiements) {
    const rs = await fetch(`${racine}/deployments/${d.id}/statuses?per_page=20`, { headers: entetes });
    if (!rs.ok) continue;
    const statuts = (await rs.json()) as Array<{ state: string; environment_url?: string }>;
    // Le premier est le plus recent, et c est celui qui vaut.
    if (statuts.length) {
      sorties.push({
        environnement: d.environment,
        etat: statuts[0].state,
        url: statuts[0].environment_url,
      });
    }
  }
  return sorties;
}

async function main() {
  const args = process.argv.slice(2);
  const iAttente = args.indexOf('--attente');
  const attenteMax = iAttente >= 0 ? parseInt(args[iAttente + 1], 10) : 300;
  const sha = args.find(a => !a.startsWith('--') && a !== String(attenteMax))
    || execSync('git rev-parse HEAD').toString().trim();

  const e = env();
  const jeton = e.GITHUB_DEPLOY_TOKEN || process.env.GITHUB_DEPLOY_TOKEN;
  if (!jeton) {
    console.error(
      'GITHUB_DEPLOY_TOKEN absente. L instrument ne peut pas se prononcer, et cette absence\n'
      + 'n est pas un succes : elle se distingue d un deploiement vert et d un deploiement rouge.\n'
      + 'Poser le jeton avec : npx tsx scripts/setkey-github-deploy.ts',
    );
    process.exit(3);
  }

  const remote = execSync('git remote get-url origin').toString().trim();
  const depot = depotDuRemote(remote);
  if (!depot) {
    console.error(`Remote non reconnu comme un depot GitHub : ${remote}`);
    process.exit(3);
  }

  console.log(
    `Deploiement de ${sha.slice(0, 7)} sur ${depot.proprietaire}/${depot.nom},`
    + ` attente maximale ${attenteMax}s.`,
  );

  const debut = Date.now();
  let verdict: EtatDeploiement = { issue: 'silence', raison: 'pas encore interroge' };
  let tour = 0;
  while ((Date.now() - debut) / 1000 < attenteMax) {
    tour += 1;
    const etats = await etatsDuSha(e, depot, sha);
    verdict = verdictDesEtats(etats);
    if (verdict.issue !== 'silence') break;
    process.stdout.write(
      `  tour ${tour} : ${verdict.raison}, ${Math.round((Date.now() - debut) / 1000)}s ecoulees\n`,
    );
    await new Promise(r => setTimeout(r, 15_000));
  }

  if (verdict.issue === 'succes') {
    console.log(`\nDEPLOIEMENT VERT sur ${verdict.environnement}${verdict.url ? ' : ' + verdict.url : ''}.`);
    process.exit(0);
  }
  if (verdict.issue === 'echec') {
    console.error(
      `\nDEPLOIEMENT ROUGE sur ${verdict.environnement}, etat ${verdict.etat}.`
      + `${verdict.url ? ' ' + verdict.url : ''}\n`
      + 'Le commit est pousse et il ne construit pas. La production sert l etat precedent, ou rien.',
    );
    process.exit(1);
  }
  console.error(
    `\nSILENCE apres ${attenteMax}s : ${verdict.raison}.\n`
    + 'Ce n est ni un succes ni un echec, et les trois causes possibles appellent trois reponses :\n'
    + '  le build n a pas encore rendu son verdict, et il faut rappeler l instrument ;\n'
    + '  l integration de l hebergeur ne rapporte pas ses deploiements a GitHub ;\n'
    + '  le jeton ne porte pas la permission Deployments en lecture.',
  );
  process.exit(2);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(3); });
}
