// ============================================================
// CONFORMITE DE RELECTURE
// ------------------------------------------------------------
// Repond a une seule question, a l entree d un run couteux : le code
// qui va s executer est-il celui qui a ete relu.
//
// POURQUOI CE FICHIER PLUTOT QU UNE CONSTANTE
//
// Le premier etage de la relecture du run de gel exigeait que
// `app.commitSha` porte un sha ecrit a la main dans la consigne. Entre
// l ecriture de cette exigence et le lancement, deux commits n avaient
// touche que `docs/`. Le sha ne correspondait plus, et la regle
// demandait d arreter un run dont le code etait identique a l octet
// pres a celui qu elle protegeait. Elle aurait fait perdre vingt
// dollars et dix minutes pour une divergence qui n existait pas.
//
// Une constante ecrite a la main a deux defauts et le second est le
// pire. Elle est perimee des le commit suivant, ce qui se voit. Et elle
// designe le depot entier, documentation comprise, quand ce qu on veut
// verrouiller est le code qui va tourner, ce qui ne se voit pas.
//
// La reference n est donc pas ecrite, elle est lue : c est l empreinte
// du dernier run reellement persiste, c est-a-dire du dernier code qui
// a produit une note. Elle se deplace toute seule.
//
// CE QUI REND LE VERDICT, ET CE QUI NE LE REND PAS
//
// Le verdict porte sur les empreintes de code du version stamp, pas sur
// le sha. `doctrineHash` couvre les prompts systeme, `enginesHash` les
// modeles, temperatures et hachages de source par moteur, `modelsHash`
// les modeles de la plateforme. Deux runs qui les partagent ont
// rencontre le meme code, quel que soit leur sha.
//
// Le sha est imprime et n emporte rien. La liste des fichiers qui
// different entre les deux commits est imprimee aussi, comme piece a
// conviction et non comme juge : decider a partir d elle demanderait de
// trancher quels fichiers sont executes, c est-a-dire de tenir une
// liste ecrite a la main, exactement ce que ce fichier existe pour
// eviter.
//
// `configsHash` depend du mode de run et de l environnement, et
// `inputsHash` est volontairement vide du cote local puisque rien n est
// lu. Les deux sont signales hors verdict plutot que tus.
//
// USAGE
//   npx tsx scripts/conformite-relecture.ts
//   npx tsx scripts/conformite-relecture.ts --reference=b299ab62
//
// Sortie 0 si conforme, 1 sinon.
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { StampFingerprint } from '../lib/instrumentation/version-stamp';

/** Les champs qui disent quel code a tourne, et eux seuls. */
export const CHAMPS_DECISIFS = ['doctrineHash', 'enginesHash', 'modelsHash'] as const;

/** Les champs imprimes sans emporter le verdict, avec leur raison. */
export const CHAMPS_HORS_VERDICT: Record<string, string> = {
  commitSha: 'date le depot entier, documentation comprise',
  configsHash: 'depend du mode de run et de l environnement',
  inputsHash: 'volontairement vide du cote local, rien n est lu',
};

export interface EcartDeChamp {
  champ: string;
  reference: string;
  local: string;
  identique: boolean;
  decisif: boolean;
  raison?: string;
}

export interface VerdictDeConformite {
  conforme: boolean;
  ecarts: EcartDeChamp[];
  /** Vrai quand le sha bouge sans qu aucun champ decisif bouge. */
  shaSeul: boolean;
}

/**
 * Compare deux empreintes et rend le verdict.
 *
 * Pure : ne lit ni la base, ni le depot, ni le reseau. C est ce qui la
 * rend verrouillable par un test, et c est la raison pour laquelle elle
 * est exportee plutot qu enfouie dans la commande.
 */
export function comparerEmpreintes(
  reference: Partial<StampFingerprint>,
  local: Partial<StampFingerprint>,
): VerdictDeConformite {
  const champs = Array.from(new Set([...Object.keys(reference), ...Object.keys(local)])).sort();
  const ecarts: EcartDeChamp[] = champs.map((champ) => {
    const r = String((reference as Record<string, unknown>)[champ] ?? 'absent');
    const l = String((local as Record<string, unknown>)[champ] ?? 'absent');
    const decisif = (CHAMPS_DECISIFS as readonly string[]).includes(champ);
    return {
      champ,
      reference: r,
      local: l,
      identique: r === l,
      decisif,
      ...(decisif ? {} : { raison: CHAMPS_HORS_VERDICT[champ] ?? 'hors perimetre du verdict' }),
    };
  });
  const decisifsDivergents = ecarts.filter((e) => e.decisif && !e.identique);
  const shaEcarte = ecarts.some((e) => e.champ === 'commitSha' && !e.identique);
  return {
    conforme: decisifsDivergents.length === 0,
    ecarts,
    shaSeul: shaEcarte && decisifsDivergents.length === 0,
  };
}

// ------------------------------------------------------------
// Commande
// ------------------------------------------------------------

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

function arg(nom: string, defaut = ''): string {
  const a = process.argv.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
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
 * Les fichiers qui different entre deux commits. Piece a conviction,
 * jamais juge : rendue vide quand le commit de reference n est pas
 * connu du depot local, ce qui arrive et n est pas une anomalie.
 */
function fichiersEntre(shaA: string, shaB: string): string[] | null {
  try {
    execSync(`git cat-file -e ${shaA}^{commit}`, { stdio: 'ignore' });
    const out = execSync(`git diff --name-only ${shaA} ${shaB}`, { encoding: 'utf-8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const E = env();
  const cible = arg('reference');
  const ou = cible
    ? `where id::text like '${cible.replace(/'/g, "''")}%'`
    : "where result_json->'meta'->'versionStamp' is not null";
  const rows = await sql(E,
    `select id, created_at, source_filename, result_json->'meta'->'versionStamp' as stamp
     from public.analyses ${ou} order by created_at desc limit 1;`);

  if (rows.length === 0 || !rows[0].stamp) {
    console.error('Aucun run persiste ne porte de version stamp. Rien a comparer.');
    process.exit(1);
  }
  const ref = rows[0];

  const { fingerprintStamp, buildVersionStamp } = await import('../lib/instrumentation/version-stamp');
  const empreinteRef = fingerprintStamp(ref.stamp);
  const empreinteLocale = fingerprintStamp(buildVersionStamp({
    inputs: { deckBase64: null, deckBytes: 0, pitchText: null, bpText: null, additionalFiles: [] },
    runMode: { frozen: true, asOf: null },
  } as any));

  const v = comparerEmpreintes(empreinteRef, empreinteLocale);

  console.log('CONFORMITE DE RELECTURE');
  console.log(`Reference : run ${String(ref.id).slice(0, 8)} du ${ref.created_at}, ${ref.source_filename}`);
  console.log('Locale    : etat du repertoire de travail\n');

  const large = Math.max(...v.ecarts.map((e) => e.champ.length));
  for (const e of v.ecarts) {
    const marque = e.identique ? '=' : '≠';
    const poids = e.decisif ? 'decisif    ' : 'hors verdict';
    console.log(`  ${marque} ${e.champ.padEnd(large)}  ${poids}`);
    if (!e.identique) {
      console.log(`      reference ${e.reference}`);
      console.log(`      locale    ${e.local}`);
      if (e.raison) console.log(`      ${e.raison}`);
    }
  }

  if (v.shaSeul) {
    const shaRef = String(empreinteRef.commitSha ?? '');
    const shaLoc = String(empreinteLocale.commitSha ?? '');
    const fichiers = shaRef && shaLoc ? fichiersEntre(shaRef, shaLoc) : null;
    console.log('\nLe sha bouge, aucun champ decisif ne bouge.');
    if (fichiers === null) {
      console.log('  Le commit de reference n est pas connu du depot local : diff indisponible.');
    } else if (fichiers.length === 0) {
      console.log('  Aucun fichier ne differe entre les deux commits.');
    } else {
      console.log(`  ${fichiers.length} fichier(s) different(s) entre les deux commits :`);
      for (const f of fichiers.slice(0, 40)) console.log(`    ${f}`);
      if (fichiers.length > 40) console.log(`    ... et ${fichiers.length - 40} autres`);
      console.log('  Cette liste informe, elle ne tranche pas : le verdict est sur les empreintes.');
    }
  }

  console.log(`\nVERDICT : ${v.conforme ? 'conforme' : 'NON CONFORME'}`);
  if (!v.conforme) {
    console.log('Le code qui tournerait n est pas celui qui a produit le run de reference.');
  }
  process.exit(v.conforme ? 0 : 1);
}

if (require.main === module) {
  main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
}
