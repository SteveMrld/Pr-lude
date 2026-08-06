// ============================================================
// GET /api/analyses/[id]/trajectory
// ------------------------------------------------------------
// Retourne un TrajectorySummary calcule sur le DOSSIER, c est-a-dire
// sur l ensemble des analyses de la meme societe chez le meme
// proprietaire, et non sur la seule chaine de versions d une ligne.
//
// POURQUOI LA SOURCE A CHANGE
//
// La route lisait `analyses_versions` exclusivement. Au 6 aout 2026,
// cette table est vide sur soixante-cinq analyses persistees, parce que
// le versionnement automatique a disparu avec la creation de ligne a t0
// et que le seul chemin restant passe par un dialogue qui ne s ouvre
// qu en cas d echec de persistance. Un dossier analyse dix fois rendait
// donc dix lignes distinctes et aucune trajectoire, quel que soit le
// nombre de runs. `buildTrajectoryFromAnalyses` declarait pourtant
// depuis l origine accepter une liste venue d un listAnalyses filtre
// par societe autant que des versions : seule la seconde source etait
// cablee.
//
// CE QUI ENTRE DANS LA CHAINE
//
// Les analyses du meme dossier, au sens de `lib/trajectory-dossier`,
// plus les versions de chacune quand il en existe. Une version est un
// acte explicite et elle garde sa place ; elle n est simplement plus la
// seule source. Chaque element porte sa provenance, son identifiant, sa
// date, son fichier et son empreinte de document.
//
// CE QUE LA REPONSE DECLARE, ET POURQUOI
//
// Deux societes reellement distinctes portant exactement le meme nom
// chez le meme fonds se rejoindraient, et rien dans les donnees ne les
// separe. Plutot que de fabriquer une garde sur le pays ou le secteur,
// qui sont des sorties de modele et couperaient de vrais dossiers plus
// souvent qu elles n empecheraient de fausses fusions, la reponse dit de
// quoi la chaine est faite. Une fusion se voit et se conteste au lieu de
// se produire en silence.
//
// Elle declare aussi sur combien de documents distincts la chaine
// repose. C est la lecture qui passe avant les deltas : sept runs du
// meme memorandum ne racontent pas l evolution d une societe, ils
// mesurent la dispersion du pipeline, et les lire comme une trajectoire
// ferait passer une variance pour une evolution. Le corpus au 6 aout
// 2026 ne porte que des chaines de ce genre.
//
// Le champ `summary` est inchange dans sa forme : les trois
// consommateurs qui ne lisent que lui continuent de fonctionner a
// l identique.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listVersions, getVersion } from '@/lib/collaboration-store';
import {
  getAnalysis,
  isPersistenceEnabled,
  chargerCandidatesDuDossier,
  chargerResultatsDeMembres,
} from '@/lib/analysis-store';
import { membresDuDossier, assiseDocumentaire } from '@/lib/trajectory-dossier';
import {
  buildTrajectoryFromAnalyses,
  type AnalysisPayloadForSnapshot,
} from '@/lib/engines/trajectory';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Un element de la chaine, avec de quoi le retrouver. */
interface ElementDeChaine {
  analysisId: string;
  provenance: 'analyse' | 'version';
  versionNum: number | null;
  createdAt: string;
  sourceFilename: string | null;
  deckHash: string | null;
}

function versPayload(
  identifiantDansLaChaine: string,
  quand: string,
  contenu: any,
): AnalysisPayloadForSnapshot {
  return {
    analysisId: identifiantDansLaChaine,
    analyzedAt: quand,
    mechanicalScore: contenu?.mechanicalScore,
    fragiliteStructurelle: contenu?.fragiliteStructurelle,
    narrativeDrift: contenu?.narrativeDrift,
    finalRecommendation: contenu?.finalRecommendation,
    globalScore: contenu?.globalScore,
    verdict: contenu?.verdict,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }

  const analysisId = params.id;
  if (!analysisId) {
    return NextResponse.json({ error: 'missing-id' }, { status: 400 });
  }

  // 1. Le dossier : l ancre et ses voisins de meme nom, chez le meme
  //    proprietaire. Colonnes legeres, `result_json` n est pas charge.
  const { ancre, candidates, tronque } = await chargerCandidatesDuDossier(analysisId);

  // Ancre non indexable : ligne inexistante, sans resultat, ou nommee
  // par le libelle pose avant extraction. On retombe sur la lecture de
  // l analyse seule plutot que d inventer un dossier qu elle ne declare
  // pas.
  if (!ancre) {
    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    const contenu = (analysis as any).resultJson ?? (analysis as any).result ?? {};
    const summary = buildTrajectoryFromAnalyses([
      versPayload(
        analysisId,
        (analysis as any).createdAt ?? (analysis as any).created_at ?? '',
        contenu,
      ),
    ]);
    return NextResponse.json({
      summary,
      dossier: {
        regroupe: false,
        motif: 'ancre-non-indexable',
        membres: [],
        assise: null,
        lectureTronquee: false,
      },
    });
  }

  const membres = membresDuDossier(ancre, candidates);

  // 2. Le contenu des seuls membres retenus.
  const resultats = await chargerResultatsDeMembres(membres.map((m) => m.id));

  // 3. La chaine : pour chaque membre, ses versions puis son etat
  //    vivant. Les versions restent une source parce qu elles sont un
  //    acte explicite ; elles ne sont plus la seule.
  const chaine: ElementDeChaine[] = [];
  const payloads: AnalysisPayloadForSnapshot[] = [];

  for (const membre of membres) {
    const versions = await listVersions(membre.id);
    if (versions && versions.length > 0) {
      const pleines = await Promise.all(
        versions.map((v) => getVersion(membre.id, v.versionNum)),
      );
      for (const v of pleines) {
        if (!v || !v.snapshotJson) continue;
        chaine.push({
          analysisId: membre.id,
          provenance: 'version',
          versionNum: v.versionNum,
          createdAt: v.createdAt,
          sourceFilename: v.sourceFilename ?? membre.sourceFilename,
          deckHash: membre.deckHash,
        });
        payloads.push(versPayload(v.id, v.createdAt, v.snapshotJson));
      }
    }

    const contenu = resultats.get(membre.id);
    if (!contenu) continue;
    chaine.push({
      analysisId: membre.id,
      provenance: 'analyse',
      versionNum: null,
      createdAt: membre.createdAt,
      sourceFilename: membre.sourceFilename,
      deckHash: membre.deckHash,
    });
    payloads.push(versPayload(membre.id, membre.createdAt, contenu));
  }

  const summary = buildTrajectoryFromAnalyses(payloads);

  return NextResponse.json({
    summary,
    dossier: {
      regroupe: true,
      // La cle n est pas rendue : elle porte le nom de la societe et
      // l identifiant du proprietaire, et la reponse n a pas besoin de
      // les republier pour que le regroupement soit verifiable. Ce qui
      // le rend verifiable est la liste de ce qui est entre.
      membres: chaine,
      nombreAnalyses: membres.length,
      assise: assiseDocumentaire(membres),
      lectureTronquee: tronque,
    },
  });
}
