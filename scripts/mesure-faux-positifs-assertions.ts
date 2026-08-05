// ============================================================
// TAUX DE FAUX POSITIFS DU VALIDATEUR D ASSERTIONS
// ------------------------------------------------------------
// Classe les alertes `unknown_name` persistees du corpus en trois
// familles objectives, et rend le residu. Zero appel au modele.
//
// POURQUOI CE RELEVE EXISTE
//
// Le validateur d assertions signalait, sur le seul run de gel, trois
// cent quatorze noms propres « cites sans tag de source ». Un chiffre
// de cet ordre n est pas lu : il est trop grand pour qu on le parcoure
// et trop plausible pour qu on le conteste. Tant que la part de bruit
// n est pas mesuree, ses alertes restent un nombre affiche en tete de
// note que personne n instruit, ce qui est exactement l etat qu un
// dispositif de controle doit rendre impossible.
//
// CE QUE LA MESURE BORNE, ET CE QU ELLE NE BORNE PAS
//
// Les trois familles sont decidables mecaniquement, sans jugement :
//
//   sigle       le nom incrimine n a aucune minuscule et fait deux a
//               six caracteres. Regle de forme, verifiable a l oeil.
//   documente   la chaine est portee par l extraction du dossier, au
//               sens ou le validateur corrige la cherche desormais.
//   troncature  le nom est un prefixe strict d un mot de l extraction,
//               et la lettre qui suit dans le dossier est precisement
//               une de celles que l ancienne classe du detecteur ne
//               savait pas lire.
//
// Ce que la mesure ne borne pas est le residu. Une alerte qui n entre
// dans aucune des trois familles n est pas pour autant fondee : elle
// peut nommer un cabinet, un rapport ou un concurrent que le modele a
// invente et que personne n a lu. Etablir cette part demanderait une
// lecture humaine sur echantillon, et la mesure ne la remplace pas.
// Le chiffre rendu ici est donc un plancher de faux positifs et jamais
// un taux de bruit : il dit combien d alertes sont certainement
// injustifiees, pas combien le sont.
//
// C est la meme reserve que pour le detecteur d evenements. La sortie
// n est pas de renoncer a mesurer, elle est de ne pas laisser le
// plancher se lire comme un niveau.
//
// USAGE
//   npx tsx scripts/mesure-faux-positifs-assertions.ts
//   npx tsx scripts/mesure-faux-positifs-assertions.ts --detail
//   npx tsx scripts/mesure-faux-positifs-assertions.ts --note=4c921874
// ============================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  buildAllowedNames,
  estUnSigle,
  findUnknownNames,
  lettreIgnoreeParLAncienneClasse,
} from '../lib/engines/assertion-validator';

function env(): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of ['.env', '.env.local']) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const l of readFileSync(p, 'utf-8').split('\n')) {
      const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && m[2]) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return e;
}

async function sql(E: Record<string, string>, q: string): Promise<any[]> {
  const ref = (E.SUPABASE_URL || E.NEXT_PUBLIC_SUPABASE_URL).match(/^https:\/\/([a-z0-9]+)\./)![1];
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E.SUPABASE_PAT}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

/**
 * True quand le detecteur corrige signale encore ce nom-la.
 *
 * La classification des familles interroge les regles du correctif, ce
 * qui la rend exacte et tautologique a la fois : elle dit ce que le
 * correctif retire, par construction. Cette seconde lecture est d une
 * autre nature, puisqu elle rejoue le detecteur entier sur le texte et
 * regarde ce qui en ressort.
 *
 * Elle se fait sur l extrait persiste et non sur la prose d origine,
 * qui n est plus reconstituable champ par champ. L extrait est une
 * fenetre de soixante caracteres, donc un tag de source pose plus loin
 * dans la phrase y est perdu : le detecteur y signale plus qu il ne
 * signalerait sur le texte entier. Le nombre de survivants est ainsi
 * majore, et la part retiree minoree, ce qui est le sens ou une mesure
 * de correctif doit se tromper.
 */
function survitAuCorrectif(nom: string, extrait: string, allowed: Set<string>, champ: string): boolean {
  if (!extrait) return false;
  const bas = nom.toLowerCase();
  return findUnknownNames(extrait, allowed, champ).some((w) => {
    const m = String(w.message).match(/"([^"]+)"/);
    return m !== null && m[1].toLowerCase() === bas;
  });
}

/** Le nom propre incrimine, tel que le message de l alerte le cite. */
function nomIncrimine(w: any): string | null {
  const m = String(w?.message ?? '').match(/"([^"]+)"/);
  return m ? m[1] : null;
}

type Famille = 'sigle' | 'documente' | 'troncature' | 'residu';

/**
 * True quand la lettre qui suit le prefixe cassait l ancienne classe.
 *
 * C est ce qui rend la famille « troncature » decidable plutot que
 * plausible. Un prefixe seul ne prouve rien : « Industrie » est un
 * prefixe de « industrielle » sans qu aucune coupe ait eu lieu, et une
 * mesure qui compterait tout prefixe attribuerait au defaut un volume
 * qui ne lui appartient pas. Ce qui prouve la coupe est que la lettre
 * suivante du dossier soit une de celles que le detecteur ne savait pas
 * lire : « é » apres « beaut », « ø » apres « ørsted ». La question se
 * pose au module qui portait la faute, et non a une copie de sa classe.
 */
function coupeALaLettre(mot: string, prefixe: string): boolean {
  if (mot.length <= prefixe.length || !mot.startsWith(prefixe)) return false;
  return lettreIgnoreeParLAncienneClasse(mot[prefixe.length]);
}

/**
 * La famille d une alerte, dans l ordre ou les corrections s appliquent.
 *
 * L ordre compte et il n est pas arbitraire : le detecteur ecarte les
 * sigles avant que la liste blanche ne soit consultee, donc une alerte
 * qui est a la fois un sigle et un nom documente est retiree par la
 * premiere correction et non par la seconde. Compter autrement
 * attribuerait a chaque correction un merite qu elle n a pas.
 */
function classer(nom: string, allowed: Set<string>, motsExtraction: string[]): Famille {
  const mots = nom.split(/\s+/);
  if (mots.every(estUnSigle)) return 'sigle';

  // La regle de reconnaissance du validateur corrige : la chaine
  // entiere, ou l un de ses mots. On l interroge telle quelle plutot
  // que d en reecrire une approximation, sans quoi la mesure repondrait
  // sur un autre objet que le correctif.
  const bas = nom.toLowerCase();
  if (allowed.has(bas)) return 'documente';
  if (bas.split(/\s+/).some((w) => allowed.has(w))) return 'documente';

  if (bas.length >= 4 && motsExtraction.some((m) => coupeALaLettre(m, bas))) {
    return 'troncature';
  }

  return 'residu';
}

async function main(): Promise<void> {
  const E = env();
  const detail = process.argv.includes('--detail');
  const filtre = (process.argv.find((x) => x.startsWith('--note=')) ?? '').slice(7);

  const rows = await sql(E,
    `select id, created_at, source_filename, result_json::text as j
     from public.analyses where result_json is not null
     order by created_at desc;`);

  const total: Record<Famille, number> = { sigle: 0, documente: 0, troncature: 0, residu: 0 };
  const echantillons: Record<Famille, Set<string>> = {
    sigle: new Set(), documente: new Set(), troncature: new Set(), residu: new Set(),
  };
  const echantillonsSurvivants = new Set<string>();
  let notes = 0;
  let notesAvecAlertes = 0;
  let alertes = 0;
  let survit = 0;
  let sansExtraction = 0;
  const parNote: any[] = [];

  for (const r of rows) {
    const id = String(r.id).slice(0, 8);
    if (filtre && id !== filtre) continue;

    let note: any;
    try { note = JSON.parse(r.j); } catch { continue; }
    notes++;

    const w = note?.assertionAudit?.warnings;
    const brutes = (Array.isArray(w) ? w : [])
      .filter((x: any) => x?.category === 'unknown_name')
      .map((x: any) => ({ nom: nomIncrimine(x), extrait: String(x?.excerpt ?? ''), champ: String(x?.field ?? '') }))
      .filter((x): x is { nom: string; extrait: string; champ: string } => x.nom !== null);
    if (brutes.length === 0) continue;
    notesAvecAlertes++;

    // L extraction persistee de CETTE note, et non une extraction de
    // reference : la liste blanche du validateur est construite par
    // dossier, donc une mesure faite sur un autre dossier ne dirait
    // rien de ce que le validateur aurait vu.
    const extraction = note?.extraction;
    if (!extraction) { sansExtraction++; continue; }

    const allowed = buildAllowedNames(extraction as any);
    const motsExtraction = Array.from(allowed);

    const compte: Record<Famille, number> = { sigle: 0, documente: 0, troncature: 0, residu: 0 };
    let survivants = 0;
    for (const { nom, extrait, champ } of brutes) {
      const f = classer(nom, allowed, motsExtraction);
      compte[f]++;
      total[f]++;
      alertes++;
      if (echantillons[f].size < 40) echantillons[f].add(nom);
      if (survitAuCorrectif(nom, extrait, allowed, champ)) {
        survivants++;
        survit++;
        if (echantillonsSurvivants.size < 40) echantillonsSurvivants.add(nom);
      }
    }

    parNote.push({
      id,
      libelle: `${String(r.created_at).slice(0, 10)} ${String(r.source_filename ?? '?').slice(0, 34)}`,
      alertes: brutes.length,
      ...compte,
      survivants,
    });
  }

  const pct = (n: number) => alertes === 0 ? '0' : (100 * n / alertes).toFixed(1);
  const lignes: string[] = [];
  lignes.push('');
  lignes.push('TAUX DE FAUX POSITIFS DU VALIDATEUR D ASSERTIONS');
  lignes.push('='.repeat(60));
  lignes.push(`${notes} notes lues, ${notesAvecAlertes} portant au moins une alerte de nom propre.`);
  if (sansExtraction > 0) {
    lignes.push(`${sansExtraction} notes exclues faute d extraction persistee : sans elle la liste`);
    lignes.push('blanche ne se reconstruit pas, et les compter en residu attribuerait au');
    lignes.push('validateur un bruit qui vient de la persistence.');
  }
  lignes.push(`${alertes} alertes unknown_name classees.`);
  lignes.push('');
  lignes.push(`  sigle metier      ${String(total.sigle).padStart(5)}  ${pct(total.sigle).padStart(5)}%`);
  lignes.push(`  documente         ${String(total.documente).padStart(5)}  ${pct(total.documente).padStart(5)}%`);
  lignes.push(`  troncature accent ${String(total.troncature).padStart(5)}  ${pct(total.troncature).padStart(5)}%`);
  lignes.push('  ' + '-'.repeat(40));
  const faux = total.sigle + total.documente + total.troncature;
  lignes.push(`  PLANCHER DE FAUX  ${String(faux).padStart(5)}  ${pct(faux).padStart(5)}%`);
  lignes.push(`  residu non borne  ${String(total.residu).padStart(5)}  ${pct(total.residu).padStart(5)}%`);
  lignes.push('');
  lignes.push('Le residu n est pas la part fondee : c est la part que cette mesure ne');
  lignes.push('tranche pas. Elle demande une lecture humaine sur echantillon.');
  lignes.push('');
  lignes.push('-'.repeat(60));
  lignes.push('CE QUE LE DETECTEUR CORRIGE SIGNALE ENCORE');
  lignes.push('');
  lignes.push(`  survivants        ${String(survit).padStart(5)}  ${pct(survit).padStart(5)}%`);
  lignes.push(`  retirees          ${String(alertes - survit).padStart(5)}  ${pct(alertes - survit).padStart(5)}%`);
  lignes.push('');
  lignes.push('Rejeu du detecteur entier sur l extrait de chaque alerte, fenetre de');
  lignes.push('soixante caracteres ou un tag pose plus loin est perdu. Le detecteur y');
  lignes.push('signale donc plus qu il ne signalerait sur la prose entiere : les');
  lignes.push('survivants sont majores et la part retiree minoree.');

  if (detail) {
    lignes.push('');
    lignes.push(`-- survivants (${survit}), echantillon --`);
    lignes.push(Array.from(echantillonsSurvivants).slice(0, 40).map((x) => `« ${x} »`).join(', '));
    for (const f of ['sigle', 'documente', 'troncature', 'residu'] as Famille[]) {
      lignes.push('');
      lignes.push(`-- ${f} (${total[f]}), echantillon --`);
      lignes.push(Array.from(echantillons[f]).slice(0, 40).map((x) => `« ${x} »`).join(', '));
    }
  }

  console.log(lignes.join('\n'));

  const dir = join(process.cwd(), 'scripts', 'audit-output');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fichier = join(dir, 'faux-positifs-assertions.json');
  writeFileSync(fichier, JSON.stringify({
    notes, notesAvecAlertes, sansExtraction, alertes, total,
    survivants: survit,
    echantillons: Object.fromEntries(
      (['sigle', 'documente', 'troncature', 'residu'] as Famille[]).map((f) => [f, Array.from(echantillons[f])]),
    ),
    echantillonSurvivants: Array.from(echantillonsSurvivants),
    parNote,
  }, null, 2));
  console.log(`\nReleve : ${fichier}`);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
