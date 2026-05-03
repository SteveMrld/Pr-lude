// Pack IC : vue de preparation au comite d investissement.
//
// Format dense, 3 pages, calibre pour la prise de decision collective.
// Ne reduit pas la profondeur de l instruction : il la condense pour qu un
// comite puisse delibrer en 60 minutes a partir d un dossier que l outil
// a deja instruit en profondeur.
//
// Trois pages :
//   1. Couverture comite : identite, verdict, probabilites, tension dialectique.
//   2. Deliberation : facteurs decisifs, risques critiques, conditions, argumentation.
//   3. Decision et suite : questions ouvertes, plan d instruction, structuration,
//      agenda type, points de vote.
//
// Voix editoriale : Le Grand Continent, The Atlantic. Pas d em-dashes.
// Palette : papier creme, encre noire, accents ocre brule et vert foret.

import React from 'react';
import { computeTopRisks } from '@/lib/compute-top-risks';

type Props = {
  result: any;
  filename?: string;
};

const VERDICT_LABELS: Record<string, string> = {
  'investir': 'Investir',
  'investir avec conditions': 'Investir avec conditions',
  'approfondir': 'Approfondir',
  'refuser': 'Refuser',
};

const VERDICT_COLORS: Record<string, string> = {
  'investir': 'var(--vert-foret)',
  'investir avec conditions': 'var(--ocre-brule)',
  'approfondir': 'var(--ocre-brule)',
  'refuser': 'var(--rouge-anglais)',
};

const TENSION_LABELS: Record<string, string> = {
  'blindspots-dominate': 'Aveuglements dominants',
  'contrarian-justifies': 'Singularites justificatives',
  'balanced-investigate': 'Equilibre, instruction a poursuivre',
};

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function IcPackView({ result, filename }: Props) {
  if (!result) return null;

  const ext = result.extraction || {};
  const reco = result.finalRecommendation || {};
  const causal = result.causalReversal || {};
  const refchecks = result.referenceChecks || {};
  const meta = result.meta || {};

  const verdict = reco.verdict || 'approfondir';
  const verdictColor = VERDICT_COLORS[verdict] || 'var(--ink)';
  const tension = reco.blindspotsVsContrarian || {};
  const topRisks = computeTopRisks(result, 3);
  const decisionDrivers: string[] = reco.decisionDrivers || [];
  const keyConditions: string[] = reco.keyConditions || [];
  const questions: string[] = causal.questionsToInvestigate || [];
  const topQuestions = questions.slice(0, 5);
  const structuringPlan = reco.structuringPlan || {};
  const founderCalls = (refchecks.founderChecks || []).length;
  const customerCalls = (refchecks.customerChecks || []).length;
  const boardCalls = (refchecks.boardChecks || []).length;
  const weakSignals = (refchecks.weakSignalsChecks || []).length;
  const totalCalls = founderCalls + customerCalls + boardCalls;

  const fundraise = ext.fundraise || {};
  const founders = ext.founders || [];

  // Agenda type calibre sur 60 minutes
  const agenda = [
    { duration: '10 min', label: 'Presentation par le partner principal' },
    { duration: '5 min', label: 'Lecture du verdict et des probabilites' },
    { duration: '15 min', label: 'Discussion des facteurs decisifs et des risques' },
    { duration: '15 min', label: 'Reponses aux questions ouvertes' },
    { duration: '10 min', label: 'Tour de table sur les conditions cles' },
    { duration: '5 min', label: 'Vote' },
  ];

  return (
    <div className="ic-pack" data-print-section="ic-pack">
      {/* PAGE 1 : COUVERTURE COMITE */}
      <section className="ic-page ic-page-cover">
        <div className="ic-cover-header">
          <div className="ic-eyebrow">Pack comite d investissement</div>
          <div className="ic-cover-meta">
            {formatDate(meta.analyzedAt) && <span>Instruit le {formatDate(meta.analyzedAt)}</span>}
            {filename && <span className="ic-meta-sep">·</span>}
            {filename && <span>{filename}</span>}
          </div>
        </div>

        <div className="ic-cover-title">
          <h1 className="ic-company">{ext.companyName || 'Societe'}</h1>
          <div className="ic-company-sub">
            {[ext.sector, ext.subSector, ext.country].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="ic-fact-grid">
          <div className="ic-fact">
            <div className="ic-fact-label">Stade</div>
            <div className="ic-fact-value">{fundraise.stage || 'Non precise'}</div>
          </div>
          <div className="ic-fact">
            <div className="ic-fact-label">Levee demandee</div>
            <div className="ic-fact-value">{fundraise.amount || 'Non precise'}</div>
          </div>
          <div className="ic-fact">
            <div className="ic-fact-label">Valuation</div>
            <div className="ic-fact-value">{fundraise.valuation || 'Non precise'}</div>
          </div>
          <div className="ic-fact">
            <div className="ic-fact-label">Annee de fondation</div>
            <div className="ic-fact-value">{ext.yearFounded || 'Non precise'}</div>
          </div>
        </div>

        {founders.length > 0 && (
          <div className="ic-founders">
            <div className="ic-fact-label">Equipe fondatrice</div>
            <div className="ic-founders-list">
              {founders.map((f: any, i: number) => (
                <div key={i} className="ic-founder">
                  <span className="ic-founder-name">{f.name}</span>
                  {f.role && <span className="ic-founder-role"> · {f.role}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ic-verdict-block" style={{ borderTop: `2px solid ${verdictColor}` }}>
          <div className="ic-verdict-row">
            <div>
              <div className="ic-fact-label">Verdict d instruction</div>
              <div className="ic-verdict" style={{ color: verdictColor }}>
                {VERDICT_LABELS[verdict] || verdict}
              </div>
            </div>
            <div className="ic-prob-block">
              <div className="ic-prob-row">
                <span className="ic-prob-label">Probabilite de succes</span>
                <span className="ic-prob-value" style={{ color: 'var(--vert-foret)' }}>
                  {reco.successProbability ?? '—'}%
                </span>
              </div>
              <div className="ic-prob-row">
                <span className="ic-prob-label">Probabilite d echec</span>
                <span className="ic-prob-value" style={{ color: 'var(--rouge-anglais)' }}>
                  {reco.failureProbability ?? '—'}%
                </span>
              </div>
              <div className="ic-prob-row">
                <span className="ic-prob-label">Score auditable</span>
                <span className="ic-prob-value">
                  {reco.computedScoreBreakdown?.finalComputedScore ?? reco.globalScore ?? '—'}/100
                </span>
              </div>
            </div>
          </div>

          {tension.resolution && (
            <div className="ic-tension">
              <div className="ic-tension-label">
                Resolution dialectique · {TENSION_LABELS[tension.tensionResolved] || tension.tensionResolved}
              </div>
              <p className="ic-tension-text">{tension.resolution}</p>
            </div>
          )}
        </div>
      </section>

      {/* PAGE 2 : DELIBERATION */}
      <section className="ic-page">
        <div className="ic-page-title">
          <span className="ic-page-num">II.</span>
          <span>Deliberation</span>
        </div>

        {decisionDrivers.length > 0 && (
          <div className="ic-block">
            <h3 className="ic-block-title">Facteurs decisifs</h3>
            <ol className="ic-numbered-list">
              {decisionDrivers.map((d, i) => <li key={i}>{d}</li>)}
            </ol>
          </div>
        )}

        {topRisks.length > 0 && (
          <div className="ic-block ic-block-risks">
            <h3 className="ic-block-title">Risques critiques</h3>
            <div className="ic-risks-list">
              {topRisks.map((r, i) => (
                <div key={i} className="ic-risk-item">
                  <div className="ic-risk-head">
                    <span className="ic-risk-label">{r.label}</span>
                    <span className="ic-risk-intensity">Intensite {r.intensity}</span>
                  </div>
                  {r.evidence && <p className="ic-risk-evidence">{r.evidence}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {keyConditions.length > 0 && (
          <div className="ic-block ic-block-conditions">
            <h3 className="ic-block-title">Conditions cles</h3>
            <ul className="ic-bullet-list">
              {keyConditions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {reco.argumentation && (
          <div className="ic-block">
            <h3 className="ic-block-title">Argumentation dialectique</h3>
            <p className="ic-argumentation">{reco.argumentation}</p>
          </div>
        )}
      </section>

      {/* PAGE 3 : DECISION ET SUITE */}
      <section className="ic-page">
        <div className="ic-page-title">
          <span className="ic-page-num">III.</span>
          <span>Decision et suite d instruction</span>
        </div>

        {topQuestions.length > 0 && (
          <div className="ic-block">
            <h3 className="ic-block-title">Questions ouvertes pour le partner principal</h3>
            <ol className="ic-numbered-list">
              {topQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </div>
        )}

        {totalCalls > 0 && (
          <div className="ic-block">
            <h3 className="ic-block-title">Plan d instruction terrain</h3>
            <div className="ic-dd-grid">
              <div className="ic-dd-stat">
                <span className="ic-dd-num">{founderCalls}</span>
                <span className="ic-dd-lab">Appels fondateurs</span>
              </div>
              <div className="ic-dd-stat">
                <span className="ic-dd-num">{customerCalls}</span>
                <span className="ic-dd-lab">Appels clients</span>
              </div>
              <div className="ic-dd-stat">
                <span className="ic-dd-num">{boardCalls}</span>
                <span className="ic-dd-lab">Appels gouvernance</span>
              </div>
              <div className="ic-dd-stat">
                <span className="ic-dd-num">{weakSignals}</span>
                <span className="ic-dd-lab">Signaux faibles a verifier</span>
              </div>
            </div>
            {(refchecks.priorityOrder || []).length > 0 && (
              <div className="ic-priority">
                <div className="ic-fact-label">Ordre de priorite recommande</div>
                <ol className="ic-numbered-list ic-numbered-tight">
                  {(refchecks.priorityOrder || []).slice(0, 3).map((p: string, i: number) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {(structuringPlan.shortTerm?.length || structuringPlan.mediumTerm?.length || structuringPlan.longTerm?.length) ? (
          <div className="ic-block">
            <h3 className="ic-block-title">Plan de structuration</h3>
            <div className="ic-plan-grid">
              {(structuringPlan.shortTerm || []).length > 0 && (
                <div className="ic-plan-col">
                  <div className="ic-plan-head">0 a 3 mois</div>
                  <ul className="ic-plan-list">
                    {(structuringPlan.shortTerm || []).map((s: any, i: number) => (
                      <li key={i}><strong>{s.axis}.</strong> {s.action}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(structuringPlan.mediumTerm || []).length > 0 && (
                <div className="ic-plan-col">
                  <div className="ic-plan-head">3 a 12 mois</div>
                  <ul className="ic-plan-list">
                    {(structuringPlan.mediumTerm || []).map((s: any, i: number) => (
                      <li key={i}><strong>{s.axis}.</strong> {s.action}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(structuringPlan.longTerm || []).length > 0 && (
                <div className="ic-plan-col">
                  <div className="ic-plan-head">12 mois et au-dela</div>
                  <ul className="ic-plan-list">
                    {(structuringPlan.longTerm || []).map((s: any, i: number) => (
                      <li key={i}><strong>{s.axis}.</strong> {s.action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="ic-block">
          <h3 className="ic-block-title">Agenda du comite (60 minutes)</h3>
          <table className="ic-agenda-table">
            <tbody>
              {agenda.map((a, i) => (
                <tr key={i}>
                  <td className="ic-agenda-time">{a.duration}</td>
                  <td className="ic-agenda-step">{a.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ic-block ic-vote-block">
          <h3 className="ic-block-title">Points de vote</h3>
          <p className="ic-vote-instruction">
            Chaque membre du comite se prononce sur l une des quatre options.
            La position du partner principal apparait en pre-rempli a partir du verdict d instruction.
          </p>
          <div className="ic-vote-grid">
            {(['investir', 'investir avec conditions', 'approfondir', 'refuser'] as const).map((opt) => {
              const recommended = opt === verdict;
              return (
                <div key={opt} className={`ic-vote-card ${recommended ? 'ic-vote-recommended' : ''}`}>
                  <div className="ic-vote-marker">{recommended ? '◆' : '○'}</div>
                  <div className="ic-vote-label">{VERDICT_LABELS[opt]}</div>
                  {recommended && <div className="ic-vote-badge">Recommande par l instruction</div>}
                </div>
              );
            })}
          </div>
          <div className="ic-signature-block">
            <div className="ic-signature-row">
              <div className="ic-signature-line">
                <div className="ic-fact-label">Partner principal</div>
                <div className="ic-signature-blank"></div>
              </div>
              <div className="ic-signature-line">
                <div className="ic-fact-label">Date de comite</div>
                <div className="ic-signature-blank"></div>
              </div>
            </div>
            <div className="ic-signature-row">
              <div className="ic-signature-line">
                <div className="ic-fact-label">Resultat du vote</div>
                <div className="ic-signature-blank"></div>
              </div>
              <div className="ic-signature-line">
                <div className="ic-fact-label">Conditions retenues</div>
                <div className="ic-signature-blank"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
