// ============================================================
// RUN-DEMONSTRATION
// ------------------------------------------------------------
// Lance les notes successives d une demonstration a plusieurs documents,
// en mode gele, chacune ancree sur la date de son propre document.
//
// POURQUOI CE SCRIPT EXISTE ET POURQUOI AUCUN CHEMIN EXISTANT NE SUFFIT
//
// Une demonstration a deux notes repose sur une propriete que rien ne
// garantit aujourd hui : la premiere note ne doit rien savoir de ce que
// la seconde apprendra. Un run lance depuis l interface porte toujours
// frozen a faux, quelle que soit l intention du partner, parce que
// HomeClient ne met pas ce champ dans son payload. Sur un dossier dont
// l issue est publique, un run d aout 2026 avec le web ouvert trouverait
// la suite de l histoire, et la note de premiere date cesserait d etre
// la lecture qu on pretend montrer. Ce n est pas une degradation de
// qualite, c est la destruction de l objet meme de la demonstration.
//
// Le seul emetteur de frozen dans le depot est le script d ingestion de
// corpus, et il ne convient pas ici. Il envoie un fichier par run, il
// cree une ligne reference_dossiers qui n a rien a faire dans une
// demonstration, et surtout il declare asOfSource a corpus-ingestion,
// ce qui fait precisement refuser a la regle de millesime de s ancrer
// sur la date passee : l ancre y est la date de la campagne et non celle
// du document. Ici on veut l inverse, l ancre du document lui-meme, donc
// deck-receipt.
//
// CE QUE LE SCRIPT VERIFIE PLUTOT QUE DE LE SUPPOSER
//
// Demander frozen n est pas l obtenir. Le script relit, sur l analyse
// persistee, runMode.frozen et webSearchEnabled dans le version stamp,
// et il s arrete si l un des deux dement la demande. Une note lancee
// avec l intention du gel et sortie web ouvert est pire qu une note
// assumee ouverte, parce qu on la montrerait en la croyant etanche.
//
// Il verifie aussi que les notes successives ont rencontre le meme code.
// Deux runs a empreintes differentes ne sont pas deux tirages du meme
// systeme, et tout ecart entre eux mesure un diff et non une evolution.
// La comparaison porte sur doctrineHash, enginesHash et modelsHash,
// jamais sur le seul sha, conformement a la regle de conformite : un sha
// date un etat du depot, documentation comprise, et ce qu on veut
// verrouiller est l etat du code qui s execute.
//
// Il verifie enfin que les notes se sont rangees dans le meme dossier,
// au sens de lib/trajectory-dossier. C est la defaillance la plus
// probable et la moins visible : deux documents d une meme societe
// peuvent la nommer differemment, un prospectus donnant la denomination
// sociale complete la ou des comptes donnent le nom commercial. Deux
// noms differents produisent deux dossiers, donc aucune trajectoire, et
// rien dans les notes prises separement ne le signale.
//
// L ORDRE N EST PAS UNE COMMODITE
//
// Les notes se lancent dans l ordre chronologique de leurs documents, et
// le script le tient sur la date d ancrage plutot que sur l ordre du
// fichier de manifeste ou sur les noms de fichiers, qui seraient une
// convention et non une contrainte. Des ancres non strictement
// croissantes sont refusees avant tout appel.
//
// Usage :
//   npx tsx --env-file=.env --env-file=.env.local scripts/run-demonstration.ts --manifeste=<chemin.json>
//   ... --manifeste=<chemin.json> --apply
//
// Le serveur Next doit tourner au moment du --apply (npm run dev), le
// script ne duplique pas le pipeline, il poste sur /api/analyze.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { cleComplete } from '../lib/trajectory-dossier';
import { fingerprintStamp } from '../lib/instrumentation/version-stamp';
// La definition d absence vit a un seul endroit. Une coalescence nulle
// recopiee ici ne rattraperait pas la chaine vide, que l extraction rend
// quand elle n a pas trouve, et le verrou champ-absent l a refusee.
import { champ } from '../lib/engines/champ-absent';
import {
  APPELS_PORTEURS_DE_PDF,
  plafondTokensDeLAppel,
  requeteTientDansLePlafond,
  plafondFichierOctets,
  estBloquant,
  PLAFOND_REQUETE_OCTETS,
} from '../lib/engines/budget-pdf';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BUCKET = 'dossier-uploads';
const OWNER_KEY = 'demonstration';
// Le pipeline prend 90 a 180 s par dossier ; 600 s laisse la marge des
// dossiers lourds et de la latence reseau.
const PIPELINE_TIMEOUT_MS = 600_000;

// ============================================================
// MANIFESTE
// ============================================================

export interface NoteDemandee {
  fichier: string;
  /** Date d ancrage, ISO YYYY-MM-DD. Voir la discipline de precision :
   *  une date partielle s arrondit vers le tard quand on cherche ce qui
   *  lui est posterieur, donc un document date d un mois sans jour
   *  s ancre en fin de mois. */
  asOf: string;
  libelle: string;
}

export interface Manifeste {
  dossier: string;
  track: 'early' | 'growth';
  notes: NoteDemandee[];
}

export function lireManifeste(chemin: string): Manifeste {
  if (!existsSync(chemin)) throw new Error(`manifeste introuvable : ${chemin}`);
  const brut = JSON.parse(readFileSync(chemin, 'utf-8'));

  if (typeof brut?.dossier !== 'string' || !brut.dossier.trim()) {
    throw new Error('manifeste : champ "dossier" requis');
  }
  if (brut?.track !== 'early' && brut?.track !== 'growth') {
    throw new Error('manifeste : champ "track" requis, early ou growth');
  }
  if (!Array.isArray(brut?.notes) || brut.notes.length < 2) {
    throw new Error('manifeste : au moins deux notes, sinon il n y a rien a comparer');
  }

  const notes: NoteDemandee[] = brut.notes.map((n: any, i: number) => {
    if (typeof n?.fichier !== 'string' || !existsSync(n.fichier)) {
      throw new Error(`note ${i + 1} : fichier introuvable (${n?.fichier})`);
    }
    if (typeof n?.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n.asOf)) {
      throw new Error(`note ${i + 1} : asOf requis au format YYYY-MM-DD`);
    }
    if (typeof n?.libelle !== 'string' || !n.libelle.trim()) {
      throw new Error(`note ${i + 1} : libelle requis`);
    }
    return { fichier: n.fichier, asOf: n.asOf, libelle: n.libelle };
  });

  // L ordre chronologique se tient sur les ancres et non sur la position
  // dans le fichier : une position est une convention, une ancre est une
  // contrainte que le script peut verifier.
  for (let i = 1; i < notes.length; i++) {
    if (!(notes[i - 1].asOf < notes[i].asOf)) {
      throw new Error(
        `ordre : les ancres doivent etre strictement croissantes, `
        + `note ${i} (${notes[i - 1].asOf}) puis note ${i + 1} (${notes[i].asOf})`,
      );
    }
  }

  return { dossier: brut.dossier.trim(), track: brut.track, notes };
}

// ============================================================
// SUPABASE ET STORAGE
// ============================================================

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  return createClient(url, key, { auth: { persistSession: false } });
}

function nomSur(fichier: string): string {
  return basename(fichier).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function televerser(
  admin: ReturnType<typeof getAdmin>,
  fichier: string,
  sessionId: string,
): Promise<{ storagePath: string; name: string; mimeType: string; size: number }> {
  const uid = randomUUID().slice(0, 8);
  const storagePath = `${OWNER_KEY}/${sessionId}/${uid}-${nomSur(fichier)}`;
  const buffer = readFileSync(fichier);
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });
  if (error) throw new Error(`upload echoue (${basename(fichier)}) : ${error.message}`);
  return {
    storagePath,
    name: basename(fichier),
    mimeType: 'application/pdf',
    size: statSync(fichier).size,
  };
}

// ============================================================
// LANCEMENT D UNE NOTE
// ============================================================

interface NoteProduite {
  analysisId: string;
  companyName: string | null;
}

async function lancerNote(
  ref: { storagePath: string; name: string; mimeType: string; size: number },
  note: NoteDemandee,
  track: 'early' | 'growth',
): Promise<NoteProduite> {
  const sessionId = ref.storagePath.split('/')[1];
  const body = {
    sessionId,
    ownerKey: OWNER_KEY,
    files: [ref],
    track,
    // Le gel est la raison d etre de ce script. Il coupe le web search
    // sur les quatre moteurs concernes et entre dans le fingerprint.
    frozen: true,
    asOf: note.asOf,
    // deck-receipt et non corpus-ingestion : l ancre est la date du
    // document, pas celle de la campagne, et la regle de millesime doit
    // s y ancrer plutot que la refuser.
    asOfSource: 'deck-receipt',
  };

  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PIPELINE_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    const texte = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} : ${texte.slice(0, 200)}`);
  }

  let tampon = '';
  const decodeur = new TextDecoder('utf-8');
  const lecteur = (res.body as any).getReader();
  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });
    const evenements = tampon.split('\n\n');
    tampon = evenements.pop() || '';
    for (const ev of evenements) {
      const ligneEvt = ev.split('\n').find((l) => l.startsWith('event:'));
      const ligneData = ev.split('\n').find((l) => l.startsWith('data:'));
      if (!ligneEvt || !ligneData) continue;
      const type = ligneEvt.replace(/^event:\s*/, '').trim();
      const brut = ligneData.replace(/^data:\s*/, '').trim();
      if (type === 'complete') {
        let charge: any = null;
        try { charge = JSON.parse(brut); } catch { charge = null; }
        const analysisId = charge?._persisted?.id || charge?.meta?.analysisId || null;
        if (!analysisId) throw new Error('evenement complete sans analysisId');
        return {
          analysisId,
          companyName: charge?.extraction?.companyName ?? null,
        };
      }
      if (type === 'prescan-knockout') {
        throw new Error('pre-scan knockout : le dossier a ete ecarte avant analyse');
      }
      if (type === 'error') {
        throw new Error(`erreur pipeline : ${brut.slice(0, 200)}`);
      }
    }
  }
  throw new Error('flux SSE coupe avant complete');
}

// ============================================================
// RELECTURE DE CE QUI A ETE REELLEMENT PRODUIT
// ============================================================

interface Controle {
  frozen: boolean | null;
  webSearchEnabled: boolean | null;
  /**
   * Empreintes calculees a partir du stamp persiste, jamais lues comme
   * un champ. Le stamp ne porte PAS d enginesHash : il porte les
   * empreintes par moteur dont ce hash descend, et `fingerprintStamp`
   * fait la reduction. Chercher le champ le trouverait absent sur toutes
   * les notes et ferait comparer deux valeurs nulles, c est-a-dire
   * conclure a un code identique sur une lecture vide. C est la faute
   * exacte que le comparatif de relecture a deja commise.
   */
  empreintes: import('../lib/instrumentation/version-stamp').StampFingerprint | null;
  companyName: string | null;
  cle: string | null;
}

async function relire(
  admin: ReturnType<typeof getAdmin>,
  analysisId: string,
): Promise<Controle> {
  const { data, error } = await admin
    .from('analyses')
    .select('id, user_id, company_name, result_json')
    .eq('id', analysisId)
    .maybeSingle();
  if (error || !data) throw new Error(`analyse ${analysisId} illisible apres run`);

  const stamp = (data as any).result_json?.meta?.versionStamp ?? null;

  return {
    frozen: stamp?.runMode?.frozen ?? null,
    webSearchEnabled: stamp?.webSearchEnabled ?? null,
    empreintes: stamp ? fingerprintStamp(stamp) : null,
    companyName: (data as any).company_name ?? null,
    cle: cleComplete({
      userId: (data as any).user_id ?? null,
      companyName: (data as any).company_name ?? null,
    }),
  };
}

// ============================================================
// ADMISSIBILITE DES DOCUMENTS, MESUREE AVANT DE DEPENSER
// ------------------------------------------------------------
// Un moteur qui tombe sur depassement de fenetre et un moteur qui tombe sur
// doctrine rendent la meme chose au lecteur : une note amputee, sans que
// rien ne distingue les deux causes. Le second est un resultat, le premier
// est un accident, et les confondre ruine la demonstration en donnant
// l apparence d une lecture severe a un echec technique.
//
// La mesure se fait par `count_tokens`, qui est gratuit et qui valide le
// bloc document exactement comme le fera l appel reel. Elle sert donc deux
// fois : elle rend le compte de tokens, et elle fait respecter par l API
// elle-meme le plafond de pages, qu aucune bibliotheque du depot ne saurait
// lire sans compter des marqueurs dans le texte du PDF.
//
// Aucun seuil n est pose ici. La fenetre se lit sur l API des modeles, la
// reserve de sortie et le modele de chaque appel viennent de
// `lib/engines/budget-pdf`, verrouille contre les sites reels, et le
// plafond de taille descend du plafond de requete divise par le facteur
// base64.
// ============================================================

interface VerdictDocument {
  fichier: string;
  octets: number;
  octetsBase64: number;
  tailleAdmise: boolean;
  parAppel: Array<{
    moteur: string;
    model: string;
    bloquant: boolean;
    admis: boolean;
    detail: string;
  }>;
  admis: boolean;
}

async function fenetreDuModele(model: string): Promise<number | null> {
  const r = await fetch(`https://api.anthropic.com/v1/models/${model}`, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
  });
  if (!r.ok) return null;
  const j: any = await r.json();
  return typeof j?.max_input_tokens === 'number' ? j.max_input_tokens : null;
}

async function compterDocument(
  model: string,
  b64: string,
): Promise<{ ok: true; tokens: number } | { ok: false; message: string }> {
  const r = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: 'x' },
        ],
      }],
    }),
  });
  const t = await r.text();
  if (!r.ok) {
    let message = t.slice(0, 300);
    try { message = JSON.parse(t)?.error?.message ?? message; } catch { /* brut */ }
    return { ok: false, message };
  }
  return { ok: true, tokens: JSON.parse(t).input_tokens };
}

async function verifierDocument(fichier: string): Promise<VerdictDocument> {
  const buf = readFileSync(fichier);
  const b64 = buf.toString('base64');
  const tailleAdmise = requeteTientDansLePlafond(buf.length);

  const verdict: VerdictDocument = {
    fichier,
    octets: buf.length,
    octetsBase64: b64.length,
    tailleAdmise,
    parAppel: [],
    admis: tailleAdmise,
  };

  // Inutile de compter des tokens sur un corps qui ne partira jamais.
  if (!tailleAdmise) return verdict;

  // Un compte par modele distinct, pas un par appel : deux appels sur le
  // meme modele rendent le meme compte, et count_tokens n est gratuit qu en
  // argent, pas en temps.
  const modeles = Array.from(new Set(APPELS_PORTEURS_DE_PDF.map((a) => a.model)));
  const compte = new Map<string, Awaited<ReturnType<typeof compterDocument>>>();
  const fenetres = new Map<string, number | null>();
  for (const m of modeles) {
    compte.set(m, await compterDocument(m, b64));
    fenetres.set(m, await fenetreDuModele(m));
  }

  for (const appel of APPELS_PORTEURS_DE_PDF) {
    const c = compte.get(appel.model)!;
    const fenetre = fenetres.get(appel.model) ?? null;
    const bloquant = estBloquant(appel);

    if (c.ok === false) {
      // L API refuse le document. Elle dit pourquoi, et sa raison vaut
      // mieux que la notre : elle applique le plafond de pages que rien
      // dans le depot ne sait lire.
      verdict.parAppel.push({
        moteur: appel.moteur, model: appel.model, bloquant, admis: false,
        detail: `refuse par l API : ${c.message}`,
      });
      if (bloquant) verdict.admis = false;
      continue;
    }

    if (fenetre === null) {
      verdict.parAppel.push({
        moteur: appel.moteur, model: appel.model, bloquant, admis: false,
        detail: `fenetre du modele illisible : le plafond ne se calcule pas, donc rien ne se conclut`,
      });
      if (bloquant) verdict.admis = false;
      continue;
    }

    const plafond = plafondTokensDeLAppel(appel, fenetre);
    const tient = c.tokens <= plafond;
    verdict.parAppel.push({
      moteur: appel.moteur, model: appel.model, bloquant, admis: tient,
      detail: `${c.tokens.toLocaleString('fr-FR')} tokens sur un plafond de ${plafond.toLocaleString('fr-FR')}`
        + ` (fenetre ${fenetre.toLocaleString('fr-FR')} moins sortie ${appel.reserveSortie} moins enveloppe ${appel.enveloppeTokens})`,
    });
    if (!tient && bloquant) verdict.admis = false;
  }

  return verdict;
}

function rendreVerdictDocument(v: VerdictDocument, libelle: string): void {
  const plafondFichier = plafondFichierOctets();
  console.log(`  ${libelle}`);
  console.log(`    ${v.octets.toLocaleString('fr-FR')} octets, ${v.octetsBase64.toLocaleString('fr-FR')} en base64`
    + `, plafond de fichier ${plafondFichier.toLocaleString('fr-FR')}`);
  if (!v.tailleAdmise) {
    console.log(`    REFUS : le corps de requete depasse ${(PLAFOND_REQUETE_OCTETS / 1024 / 1024).toFixed(0)} Mo.`);
    return;
  }
  for (const a of v.parAppel) {
    const marque = a.admis ? 'ok  ' : (a.bloquant ? 'REFUS' : 'perdu');
    console.log(`    ${marque} ${a.moteur.padEnd(20)} ${a.detail}`);
  }
  const perdus = v.parAppel.filter((a) => !a.admis && !a.bloquant);
  if (perdus.length) {
    console.log(`    Ces moteurs ne tourneront pas et le pipeline continuera sans eux :`);
    console.log(`    ${perdus.map((p) => p.moteur).join(', ')}. La note existera, amputee de ce qu ils portent.`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const APPLY = argv.includes('--apply');
  const cheminManifeste = (argv.find((a) => a.startsWith('--manifeste=')) ?? '').slice(12);
  if (!cheminManifeste) {
    console.error('Usage : --manifeste=<chemin.json> [--apply]');
    process.exit(1);
  }

  const manifeste = lireManifeste(cheminManifeste);

  console.log('============================================================');
  console.log(`DEMONSTRATION : ${manifeste.dossier}`);
  console.log(`parcours ${manifeste.track}, ${manifeste.notes.length} notes, mode gele`);
  console.log('============================================================\n');
  manifeste.notes.forEach((n, i) => {
    console.log(`  note ${i + 1}  ancre ${n.asOf}  ${n.libelle}`);
    console.log(`           ${n.fichier}`);
  });
  console.log('');

  // ============================================================
  // ADMISSIBILITE, AVANT TOUTE DEPENSE
  // ------------------------------------------------------------
  // Elle se mesure en dry-run comme en apply, et elle arrete dans les deux
  // cas. La verifier seulement en dry-run laisserait passer un --apply
  // lance directement, ce qui est precisement la commande couteuse.
  // ============================================================
  console.log('ADMISSIBILITE DES DOCUMENTS');
  console.log('mesuree par count_tokens, gratuit, sur le bloc document que le pipeline enverra.');
  console.log('');

  let toutAdmis = true;
  for (let i = 0; i < manifeste.notes.length; i++) {
    const n = manifeste.notes[i];
    const v = await verifierDocument(n.fichier);
    rendreVerdictDocument(v, `note ${i + 1} : ${basename(n.fichier)}`);
    console.log('');
    if (!v.admis) toutAdmis = false;
  }

  if (!toutAdmis) {
    console.error('ARRET. Un document au moins est refuse par un appel bloquant.');
    console.error('Le lancer produirait des moteurs tombes sur depassement de fenetre,');
    console.error('que rien ne distinguerait de moteurs tombes sur doctrine.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('DRY-RUN. Rien n a ete televerse ni lance.');
    console.log('Chaque note partira avec frozen=true, asOfSource=deck-receipt,');
    console.log('et son ancre propre. Relancer avec --apply pour executer.');
    console.log('');
    console.log('Cout attendu : trois a quatre dollars et demi et dix minutes par note.');
    return;
  }

  const admin = getAdmin();
  const produites: Array<{ note: NoteDemandee; sortie: NoteProduite; controle: Controle }> = [];

  for (let i = 0; i < manifeste.notes.length; i++) {
    const note = manifeste.notes[i];
    console.log(`--- note ${i + 1} / ${manifeste.notes.length} : ${note.libelle}`);

    const sessionId = randomUUID();
    const ref = await televerser(admin, note.fichier, sessionId);
    console.log(`    televerse : ${ref.storagePath}`);

    const sortie = await lancerNote(ref, note, manifeste.track);
    console.log(`    analyse   : ${sortie.analysisId}`);

    const controle = await relire(admin, sortie.analysisId);
    console.log(`    societe   : ${champ(controle.companyName, 'non nommee')}`);
    console.log(`    gel       : frozen=${controle.frozen}  webSearchEnabled=${controle.webSearchEnabled}`);

    // L ARRET QUI JUSTIFIE LE SCRIPT
    //
    // Demander le gel n est pas l obtenir. Une note sortie web ouvert
    // sur un dossier dont l issue est publique connait la suite de
    // l histoire, et continuer produirait une seconde note tout aussi
    // inutilisable en croyant avancer.
    if (controle.frozen !== true || controle.webSearchEnabled !== false) {
      console.error('');
      console.error('ARRET. La note demandee gelee n est pas sortie gelee.');
      console.error(`  runMode.frozen attendu true, lu ${controle.frozen}`);
      console.error(`  webSearchEnabled attendu false, lu ${controle.webSearchEnabled}`);
      console.error('  La note ne vaut rien pour la demonstration et les suivantes');
      console.error('  ne sont pas lancees.');
      process.exit(1);
    }

    produites.push({ note, sortie, controle });
    console.log('');
  }

  // ============================================================
  // TROIS VERDICTS, ET ILS SE LISENT DANS CET ORDRE
  // ============================================================

  console.log('============================================================');
  console.log('VERDICTS');
  console.log('============================================================\n');

  // 1. Le code. Deux runs a empreintes differentes ne sont pas deux
  //    tirages du meme systeme : tout ecart entre eux mesure un diff.
  const ref0 = produites[0].controle.empreintes;
  // inputsHash est volontairement hors de la comparaison : les notes
  // portent sur des documents differents par construction, donc leurs
  // entrees different et c est le sujet meme de la demonstration. Ce
  // qu on verrouille est le code, pas l entree.
  const sansEmpreinte = produites.some((p) => p.controle.empreintes === null);
  const memeCode = !sansEmpreinte && ref0 !== null && produites.every((p) =>
    p.controle.empreintes!.doctrineHash === ref0.doctrineHash
    && p.controle.empreintes!.enginesHash === ref0.enginesHash
    && p.controle.empreintes!.modelsHash === ref0.modelsHash
    && p.controle.empreintes!.configsHash === ref0.configsHash);

  console.log(`1. CODE : ${sansEmpreinte ? 'INDETERMINE, une note sans version stamp'
    : memeCode ? 'identique sur toutes les notes' : 'DIFFERENT entre les notes'}`);
  produites.forEach((p, i) => {
    const e = p.controle.empreintes;
    console.log(`     note ${i + 1}  sha ${(e?.commitSha ?? 'absent').slice(0, 7)}`
      + `  doctrine ${(e?.doctrineHash ?? 'absent').slice(0, 10)}`
      + `  engines ${(e?.enginesHash ?? 'absent').slice(0, 10)}`
      + `  models ${(e?.modelsHash ?? 'absent').slice(0, 10)}`);
  });
  if (sansEmpreinte) {
    console.log('     Une note ne porte pas de version stamp : la question du code');
    console.log('     reste ouverte et ne se resout pas en l absence de reponse.');
  } else if (!memeCode) {
    console.log('     Les notes n ont pas rencontre le meme code. Aucun ecart entre');
    console.log('     elles ne se lit comme une evolution du dossier.');
  }
  console.log('');

  // 2. Le dossier. C est la defaillance la plus probable et la moins
  //    visible : deux documents d une meme societe peuvent la nommer
  //    differemment, et deux noms font deux dossiers.
  const cles = new Set(produites.map((p) => p.controle.cle ?? 'NULL'));
  const memeDossier = cles.size === 1 && !cles.has('NULL');
  console.log(`2. DOSSIER : ${memeDossier ? 'les notes se rangent ensemble' : 'les notes NE se rangent PAS ensemble'}`);
  produites.forEach((p, i) => {
    console.log(`     note ${i + 1}  "${champ(p.controle.companyName, 'non nommee')}"`);
  });
  if (!memeDossier) {
    console.log('     Les societes extraites different, donc la trajectoire ne verra');
    console.log('     qu une note par dossier. Rien dans les notes prises separement');
    console.log('     ne le signale : c est ici que cela se voit, et nulle part ailleurs.');
  }
  console.log('');

  // 3. Ou lire la trajectoire.
  const ancre = produites[0].sortie.analysisId;
  console.log('3. TRAJECTOIRE');
  console.log(`     GET ${BASE_URL}/api/analyses/${ancre}/trajectory`);
  console.log('     La reponse declare de quoi la chaine est faite et sur combien');
  console.log('     de documents distincts elle repose. Cette derniere lecture passe');
  console.log('     avant les deltas.');
  console.log('');

  if (!memeCode || !memeDossier) process.exit(1);
}

// Le test importe `lireManifeste` par la porte de production. Lancer
// `main` a l import ferait partir un pipeline pendant la suite de tests,
// donc l execution est conditionnee au fait d etre le point d entree.
// L egalite porte sur le nom de fichier exact et non sur une inclusion :
// « run-demonstration » est contenu dans « run-demonstration.test.ts »,
// et une inclusion aurait fait partir le pipeline pendant la suite de
// tests. Le premier essai l a fait.
const estPointDEntree = basename(process.argv[1] ?? '') === 'run-demonstration.ts';
if (estPointDEntree) {
  main().catch((err) => {
    console.error('\nECHEC :', err?.message ?? err);
    process.exit(1);
  });
}
