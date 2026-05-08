// ============================================================
// PERSIST-ANALYSIS
// ------------------------------------------------------------
// Logique partagee de persistence d une analyse en base. Extraite
// de app/api/analyses/route.ts pour pouvoir aussi etre appelee
// depuis app/api/analyze/route.ts juste avant le send('complete').
//
// Pourquoi : avant cette refonte, la persistence dependait du
// client. Le pipeline serveur emettait le resultat via SSE, le
// client l interceptait et appelait POST /api/analyses pour
// persister. Si le client se deconnectait avant la fin du pipeline
// (mobile en arriere-plan, ecran qui s eteint, hand-off reseau),
// le serveur poussait dans le vide et l analyse etait perdue alors
// que tout le travail LLM avait ete fait.
//
// Apres : la persistence se fait cote serveur dans la meme
// fonction Vercel que le pipeline. Si le client est connecte, il
// recoit l id deja persiste dans le complete event. Si le client
// est deconnecte, l analyse est en base et apparait dans
// Historique au prochain refresh. Aucune perte possible.
//
// Strategie de collision : le serveur persiste systematiquement
// (jamais de blocage avec choix utilisateur). Si un dossier du
// meme nom existe deja, le serveur cree automatiquement une
// nouvelle version. Le client gere ensuite la consultation des
// versions via l UI dediee.
// ============================================================

import {
  saveAnalysis,
  updateAnalysisLive,
  findExistingByCompany,
  extractAnalysisMetadata,
  isPersistenceEnabled,
  type SaveAnalysisInput,
} from './analysis-store';
import { createVersion } from './collaboration-store';

export type PersistMode = 'new-record' | 'new-version' | 'unsaved';

export interface PersistResult {
  saved: boolean;
  id: string | null;
  mode: PersistMode;
  reason?: string;
  versionNum?: number;
  // Si collision detectee et auto-versioning effectue, on remonte
  // le contexte pour que le client puisse afficher un toast
  // informatif "v3 cree de nouveau dossier Acme" si voulu.
  collisionDetected?: boolean;
  existingCompanyName?: string;
}

export interface PersistInput {
  result: any;
  sourceFilename?: string | null;
  sourceText?: string | null;
  sourcePages?: number | null;
  pipelineDurationMs?: number | null;
  pipelineEnginesStatus?: any;
}

/**
 * Dependances injectables. Permet de mocker les acces base en test
 * sans toucher au comportement de production. Le wrapper public
 * persistAnalysisAutomatically utilise les implementations reelles ;
 * la fonction sous-jacente persistAnalysisWithDeps prend ces deps en
 * parametre et est testable de maniere deterministe.
 */
export interface PersistDeps {
  isPersistenceEnabled: () => boolean;
  extractAnalysisMetadata: (result: any) => any;
  findExistingByCompany: (name: string) => Promise<{ id: string; companyName: string } | null>;
  saveAnalysis: (input: SaveAnalysisInput) => Promise<string | null>;
  updateAnalysisLive: (id: string, input: SaveAnalysisInput) => Promise<boolean>;
  createVersion: (args: {
    analysisId: string;
    snapshotJson: any;
    sourceFilename: string | null;
    pipelineDurationMs: number | null;
    note: string;
  }) => Promise<{ versionNum: number } | null>;
}

const DEFAULT_DEPS: PersistDeps = {
  isPersistenceEnabled,
  extractAnalysisMetadata,
  findExistingByCompany: findExistingByCompany as any,
  saveAnalysis,
  updateAnalysisLive: updateAnalysisLive as any,
  createVersion: createVersion as any,
};


/**
 * Persiste une analyse de maniere automatique, sans dialogue
 * utilisateur. Detecte les collisions et cree une nouvelle version
 * si necessaire.
 *
 * Utilisee par /api/analyze (cote serveur, sans interaction client)
 * et accessible aussi a /api/analyses si mode='auto' demande.
 *
 * @returns un objet { saved, id, mode } qui peut etre inclus dans
 *   le SSE complete event ou dans la reponse JSON de /api/analyses.
 *   En cas de persistence indisponible (env de dev sans Supabase),
 *   retourne { saved: false, id: null, mode: 'unsaved' } sans
 *   throw : le pipeline reste fonctionnel pour le client immediat.
 */
export async function persistAnalysisAutomatically(
  input: PersistInput,
): Promise<PersistResult> {
  return persistAnalysisWithDeps(input, DEFAULT_DEPS);
}

/**
 * Variante testable : prend les dependances en parametre. Utilisee
 * par les tests deterministes pour mocker les acces base. La logique
 * metier est identique a la fonction publique.
 */
export async function persistAnalysisWithDeps(
  input: PersistInput,
  deps: PersistDeps,
): Promise<PersistResult> {
  if (!deps.isPersistenceEnabled()) {
    return { saved: false, id: null, mode: 'unsaved', reason: 'persistence-disabled' };
  }

  try {
    const metadata = deps.extractAnalysisMetadata(input.result);
    const companyName = metadata.companyName || 'Sans nom';

    const saveInput: SaveAnalysisInput = {
      ...metadata,
      companyName,
      verdict: metadata.verdict || 'approfondir',
      resultJson: input.result,
      sourceText: input.sourceText || null,
      sourceFilename: input.sourceFilename || null,
      sourcePages: input.sourcePages || null,
      pipelineDurationMs: input.pipelineDurationMs || null,
      pipelineEnginesStatus: input.pipelineEnginesStatus || null,
    };

    // Detection de collision : un dossier du meme nom existe deja
    // dans la base de l org. Cas typique : re-run d un dossier
    // apres mise a jour des donnees par la startup.
    const existing = await deps.findExistingByCompany(companyName);

    if (existing) {
      // Collision detectee. On cree automatiquement une nouvelle
      // version du dossier existant plutot que de bloquer avec un
      // dialogue. L UI versions du client permet ensuite de
      // basculer entre les versions historiques si besoin.
      const version = await deps.createVersion({
        analysisId: existing.id,
        snapshotJson: input.result,
        sourceFilename: input.sourceFilename || null,
        pipelineDurationMs: input.pipelineDurationMs || null,
        note: 'Re-run pipeline (auto-versioning serveur)',
      });

      if (!version) {
        return {
          saved: false,
          id: null,
          mode: 'unsaved',
          reason: 'version-create-failed',
          collisionDetected: true,
          existingCompanyName: existing.companyName,
        };
      }

      // Mise a jour du live (table analyses) : la lecture par
      // defaut reflete toujours la derniere version.
      const updated = await deps.updateAnalysisLive(existing.id, saveInput);
      if (!updated) {
        console.warn(
          '[persist-analysis] new-version : version creee mais live update echoue pour',
          existing.id,
        );
      }

      return {
        saved: true,
        id: existing.id,
        mode: 'new-version',
        versionNum: version.versionNum,
        collisionDetected: true,
        existingCompanyName: existing.companyName,
      };
    }

    // Pas de collision : creation classique d un nouveau dossier.
    const id = await deps.saveAnalysis(saveInput);
    if (!id) {
      return { saved: false, id: null, mode: 'unsaved', reason: 'save-failed' };
    }

    return { saved: true, id, mode: 'new-record' };
  } catch (err: any) {
    console.error('[persist-analysis] exception :', err);
    return {
      saved: false,
      id: null,
      mode: 'unsaved',
      reason: err?.message || 'unknown-error',
    };
  }
}
