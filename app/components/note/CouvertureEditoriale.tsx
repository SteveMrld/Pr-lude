// ============================================================
// PRELUDE - CouvertureEditoriale (note d instruction)
// ------------------------------------------------------------
// Equivalent de la page 1 d un memo de fonds VC : tout ce qui permet a
// un partner de prendre une decision provisoire en trente secondes
// avant d ouvrir l analyse detaillee. Trois zones, bandeau de verdict
// avec score et probabilites, identite condensee, et trois colonnes
// drivers decisifs, risques majeurs, action.
//
// La note detaillee qui suit reste inchangee : la couverture est un
// ajout et non une refonte. Qui veut creuser a tout le materiel apres
// elle, comme avant.
//
// Extrait de InvestmentNoteView le 7 aout 2026, dernier bloc du lot 2.
//
// C EST LE BLOC LE PLUS LU DE LA NOTE, et il a ete garde pour la fin
// pour cette raison, le geste devant etre rode avant de le toucher. Le
// couplage qu on lui pretait n existait pas : le mode analyser rend
// vingt-deux classes propres et zero partagee, et les trente-cinq
// regles partent donc avec lui sans arbitrage.
//
// SURFACE D ENTREE : la recommandation finale, l extraction, le
// result_json pour deux lectures de meta, et le mode impression. Quatre
// entrees nommees la ou le parent donnait acces a tout.
// ============================================================

'use client';

import React from 'react';
import { sanitizeNarrativeList } from '@/lib/note/section-fallback';
import { computeTopRisks } from '@/lib/compute-top-risks';

/**
 * Joint des fragments non vides, avec un repli quand tout est absent.
 * Deplace ici avec la couverture : apres extraction, le parent n en
 * avait plus aucun usage. Un utilitaire qui suit son dernier appelant
 * plutot que de rester dans un module partage vide est le bon geste
 * tant qu il n a qu un appelant.
 */
function joinNonEmpty(parts: (string | number | null | undefined)[], sep: string, fallback = '\u2014'): string {
  const filtered = parts
    .filter(p => p !== null && p !== undefined && String(p).trim() !== '')
    .map(p => String(p).trim());
  if (filtered.length === 0) return fallback;
  return filtered.join(sep);
}

export interface CouvertureEditorialeProps {
  reco: any;
  e: any;
  result: any;
  printMode?: boolean;
}

export function CouvertureEditoriale({ reco, e, result, printMode }: CouvertureEditorialeProps): React.ReactElement | null {
const verdict = (reco.verdict || '').toLowerCase();
  const verdictLabels: Record<string, string> = {
    investir: 'Investir',
    'investir-conditions': 'Investir avec conditions',
    approfondir: 'Approfondir',
    refuser: 'Refuser',
  };
  const verdictTone: Record<string, string> = {
    investir: 'cover-verdict-tone-go',
    'investir-conditions': 'cover-verdict-tone-conditional',
    approfondir: 'cover-verdict-tone-watch',
    refuser: 'cover-verdict-tone-decline',
  };
  const globalScore = reco.computedScoreBreakdown?.finalComputedScore
    ?? reco.globalScore
    ?? null;
  // Guard contre les analyses tres anciennes ou corrompues qui n ont
  // ni verdict ni score : dans ce cas on n affiche pas la couverture
  // pour eviter d offrir un cartouche vide. Le partner verra
  // directement la section 1 Societe sans page de couverture, ce
  // qui est preferable a une couverture degenerée. La condition
  // est large : il suffit d avoir soit un verdict soit un score
  // pour que la couverture s affiche.
  if (!reco.verdict && globalScore === null) {
    return null;
  }
  const successProb = typeof reco.successProbability === 'number'
    ? reco.successProbability
    : null;
  const failureProb = typeof reco.failureProbability === 'number'
    ? reco.failureProbability
    : null;
  // Passe par sanitizeNarrativeList comme la section Facteurs
  // decisifs L3215. Sans ce filtre, une entree polluee par un
  // sentinel technique (529, Anthropic, incident transitoire)
  // passe le test Array.isArray et s affiche brute sur la
  // couverture, alors que la section corps la neutralise. Un
  // meme trou doit produire le meme rendu dans les deux vues.
  const drivers = sanitizeNarrativeList(reco.decisionDrivers, 'orchestrator').slice(0, 3);
  const topRisks = computeTopRisks(result, 3);
  const conditions = Array.isArray(reco.conditionsCles)
    ? reco.conditionsCles.slice(0, 3)
    : (Array.isArray(reco.conditions) ? reco.conditions.slice(0, 3) : []);
  const actionText = verdict === 'refuser'
    ? 'Communiquer le refus à la startup, archiver le dossier dans le pipeline avec la motivation principale.'
    : verdict === 'investir' || verdict === 'investir-conditions'
      ? 'Préparer le passage en data room et le Bloc 2 (DD approfondie). Ouvrir les références terrain en parallèle.'
      : 'Cadrer les questions ouvertes avec la startup avant de réinstruire. Approfondir les zones grises identifiées dans la cartographie des risques.';

  return (
    <section className="note-cover" id="engine-section-prescan">
      {/* Bandeau verdict */}
      <div className={`note-cover-verdict ${verdictTone[verdict] || ''}`}>
        <div className="note-cover-verdict-eyebrow">Verdict d&apos;instruction</div>
        <div className="note-cover-verdict-label">
          {verdictLabels[verdict] || (reco.verdict || 'Sans verdict').toUpperCase()}
        </div>
        <div className="note-cover-verdict-stats">
          {globalScore !== null && (
            <div className="note-cover-stat">
              <div className="note-cover-stat-num">{globalScore}<span>/100</span></div>
              <div className="note-cover-stat-label">Score global</div>
            </div>
          )}
          {successProb !== null && (
            <div className="note-cover-stat">
              <div className="note-cover-stat-num">{successProb}<span>%</span></div>
              <div className="note-cover-stat-label">Probabilité succès</div>
            </div>
          )}
          {failureProb !== null && (
            <div className="note-cover-stat">
              <div className="note-cover-stat-num">{failureProb}<span>%</span></div>
              <div className="note-cover-stat-label">Probabilité échec</div>
            </div>
          )}
        </div>
      </div>

      {/* Identite condensee : six lignes denses */}
      <div className="note-cover-identity">
        <dl className="note-cover-identity-grid">
          <div className="note-cover-identity-item">
            <dt>Entité</dt>
            <dd>{e.companyName || 'Non renseigné'}</dd>
          </div>
          <div className="note-cover-identity-item">
            <dt>Secteur</dt>
            <dd>{joinNonEmpty([e.sector, e.subSector], ' · ')}</dd>
          </div>
          <div className="note-cover-identity-item">
            <dt>Géographie</dt>
            <dd>{joinNonEmpty([e.geographicHub, e.country], ', ')}</dd>
          </div>
          <div className="note-cover-identity-item">
            <dt>Tour</dt>
            <dd>{e.fundraise?.stage || 'Non renseigné'}</dd>
          </div>
          <div className="note-cover-identity-item">
            <dt>Montant</dt>
            <dd>{e.fundraise?.amount || 'Non renseigné'}</dd>
          </div>
          <div className="note-cover-identity-item">
            <dt>Activité</dt>
            <dd>{e.productDescription || 'Non renseigné'}</dd>
          </div>
        </dl>
      </div>

      {/* Trois colonnes : drivers, risques, action */}
      <div className="note-cover-trio">
        <div className="note-cover-trio-col">
          <div className="note-cover-trio-label">Drivers décisifs</div>
          {drivers.length > 0 ? (
            <ol className="note-cover-trio-list">
              {drivers.map((d: string, i: number) => (
                <li key={i}>{d}</li>
              ))}
            </ol>
          ) : (
            <div className="note-cover-trio-empty">À documenter dans la thèse d&apos;investissement.</div>
          )}
        </div>
        <div className="note-cover-trio-col">
          <div className="note-cover-trio-label">Risques majeurs</div>
          {topRisks.length > 0 ? (
            <ol className="note-cover-trio-list">
              {topRisks.map((risk, i) => (
                <li key={i}>
                  <span className="note-cover-trio-risk-name">{risk.label}</span>
                  <span className="note-cover-trio-risk-intensity"> · intensité {risk.intensity}/100</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="note-cover-trio-empty">Pas de pattern à risque détecté à intensité critique.</div>
          )}
        </div>
        <div className="note-cover-trio-col">
          <div className="note-cover-trio-label">Action proposée</div>
          <p className="note-cover-trio-action">{actionText}</p>
          {conditions.length > 0 && (
            <>
              <div className="note-cover-trio-action-sub">Conditions clés avant signature</div>
              <ul className="note-cover-trio-conditions">
                {conditions.slice(0, 2).map((c: any, i: number) => (
                  <li key={i}>{typeof c === 'string' ? c : (c?.condition || c?.label || '')}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="note-cover-footer">
        <span>
          Lecture détaillée ci-dessous · 6 sections principales
          {/* Duree d analyse retiree du rendu fige : "analysee en Ns"
              est de la telemetrie interne. Un partner qui lit la note
              exportee n a pas a savoir combien de secondes le pipeline
              a pris. En vue web, on la conserve : c est un signal utile
              de traçabilite pour l analyste qui navigue le dashboard. */}
          {!printMode && result.meta?.durationMs && ` · analysée en ${Math.round(result.meta.durationMs / 1000)}s`}
        </span>
        {/* Lien d ancrage vers section-3 : sert de raccourci de
            navigation en vue web (viewMode note interactif ou
            dashboard). Sans objet dans un PDF fige ou "cliquer sur
            un lien" n a aucun sens et trahit l origine applicative
            du document. Retire en printMode. */}
        {!printMode && (
          <a href="#section-3" className="note-cover-jump">Aller à la thèse d&apos;investissement →</a>
        )}
      </div>
      <style jsx>{`
        .note-cover {
          margin: 0 0 80px 0;
          padding: 0;
        }
        .note-cover-verdict {
          padding: 36px 40px 32px;
          margin-bottom: 28px;
          border: 1px solid var(--hairline);
          border-left: 5px solid var(--ink);
          background: var(--paper);
          position: relative;
        }

        .note-cover-verdict-eyebrow {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 14px;
        }
        .note-cover-verdict-label {
          font-family: var(--serif);
          font-size: 44px;
          font-weight: 600;
          line-height: 1.05;
          color: var(--ink);
          letter-spacing: -0.02em;
          margin-bottom: 26px;
        }
        .note-cover-verdict-stats {
          display: flex;
          gap: 56px;
          flex-wrap: wrap;
        }
        .note-cover-stat-num {
          font-family: var(--serif);
          font-size: 36px;
          font-weight: 600;
          line-height: 1;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .note-cover-stat-num span {
          font-size: 17px;
          font-weight: 400;
          color: var(--muted);
          margin-left: 2px;
        }
        .note-cover-stat-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 6px;
          font-weight: 500;
        }
        .note-cover-identity {
          margin-bottom: 28px;
          padding: 24px 30px;
          background: var(--paper-accent);
          border: 1px solid var(--hairline);
        }
        .note-cover-identity-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px 40px;
          margin: 0;
        }
        .note-cover-identity-item dt {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .note-cover-identity-item dd {
          font-family: var(--serif);
          font-size: 16px;
          color: var(--ink);
          margin: 0;
          line-height: 1.4;
        }
        .note-cover-trio {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 28px;
          margin-bottom: 24px;
        }
        .note-cover-trio-col {
          padding: 22px 24px;
          background: var(--paper);
          border-top: 2px solid var(--ink);
        }
        .note-cover-trio-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 14px;
          font-weight: 600;
        }
        .note-cover-trio-list {
          margin: 0;
          padding-left: 18px;
          list-style: decimal;
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-soft);
        }
        .note-cover-trio-list li {
          margin-bottom: 9px;
        }
        .note-cover-trio-list li:last-child {
          margin-bottom: 0;
        }
        .note-cover-trio-risk-name {
          color: var(--ink);
        }
        .note-cover-trio-risk-intensity {
          color: var(--muted);
          font-style: italic;
          font-size: 12.5px;
        }
        .note-cover-trio-empty {
          font-family: var(--serif);
          font-style: italic;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .note-cover-trio-action {
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
          margin: 0 0 14px 0;
        }
        .note-cover-trio-action-sub {
          font-family: var(--sans);
          font-size: 9.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 6px;
        }
        .note-cover-trio-conditions {
          margin: 0;
          padding-left: 16px;
          font-family: var(--serif);
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          list-style: square;
        }
        .note-cover-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0 0;
          border-top: 1px solid var(--hairline);
          font-family: var(--serif);
          font-size: 12.5px;
          color: var(--muted);
          font-style: italic;
        }
        .note-cover-jump {
          color: var(--accent);
          text-decoration: none;
          font-style: normal;
          font-weight: 500;
        }
        .note-cover-jump:hover {
          text-decoration: underline;
        }
        @media print {
          .note-cover {
            page-break-after: always;
            break-after: page;
          }
        }
        @media (max-width: 900px) {
          .note-cover-verdict {
            padding: 26px 24px 22px;
          }
          .note-cover-verdict-label {
            font-size: 32px;
          }
          .note-cover-verdict-stats {
            gap: 28px;
          }
          .note-cover-stat-num {
            font-size: 28px;
          }
          .note-cover-identity {
            padding: 20px 22px;
          }
          .note-cover-identity-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .note-cover-trio {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </section>
  );
}

export default CouvertureEditoriale;
