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

export type WorkflowHistoryItem = {
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  comment: string | null;
};

type Props = {
  result: any;
  filename?: string;
  workflowHistory?: WorkflowHistoryItem[];
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

// Vocabulaire de comite : on traduit les codes machine en termes
// que des partners reconnaissent immediatement sur la couverture
// d un pack IC.
const STAGE_LABELS: Record<string, string> = {
  deposited: 'Depose',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signe',
  declined: 'Refuse',
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

export default function IcPackView({ result, filename, workflowHistory }: Props) {
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

  // Telecharge le pack en PDF via Puppeteer cote serveur. Capture le
  // bloc .ic-pack avec les feuilles de style locales pour preserver
  // le rendu exact (palette papier creme, serif Le Grand Continent).
  const handleDownloadPdf = async () => {
    try {
      const icEl = document.querySelector('.ic-pack');
      if (!icEl) throw new Error('Pack IC non trouve dans le DOM');
      const html = icEl.outerHTML;

      const styleSheets = Array.from(document.styleSheets);
      const cssRules: string[] = [];
      for (const sheet of styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (rules) {
            for (let i = 0; i < rules.length; i++) {
              cssRules.push(rules[i].cssText);
            }
          }
        } catch {
          // CORS sur certaines feuilles externes : on ignore
        }
      }
      const css = cssRules.join('\n');

      const companyName = ext.companyName || 'analyse';
      const fileName = `prelude-ic-pack-${String(companyName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          css,
          title: `Prelude · Pack IC · ${companyName}`,
          fileName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export Pack IC echec:', err);
      alert('Echec export Pack IC : ' + (err?.message || 'erreur inconnue'));
    }
  };

  return (
    <div>
      {/* Barre d action au-dessus du pack : telechargement PDF dedie.
          Cachee a l impression via le data attr no-print pour que le
          bouton n apparaisse pas dans le PDF lui-meme. */}
      <div
        data-no-print="true"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <button
          onClick={handleDownloadPdf}
          style={{
            padding: '8px 18px',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: 'var(--ink)',
            color: '#fefefe',
            border: '1px solid var(--ink)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ↓ Telecharger en PDF
        </button>
      </div>

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

          {/* Timeline d instruction : montre au comite le parcours du dossier
              dans le pipeline (depose -> instruction -> DD terrain -> IC).
              Permet d evaluer en un coup d oeil le serieux et la duree de
              l instruction avant le passage en comite. */}
          {workflowHistory && workflowHistory.length > 0 && (
            <div className="ic-timeline">
              <div className="ic-timeline-label">Parcours d instruction</div>
              <ol className="ic-timeline-list">
                {[...workflowHistory]
                  .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                  .map((item, idx) => (
                    <li key={idx} className="ic-timeline-item">
                      <span className="ic-timeline-dot" aria-hidden="true" />
                      <div className="ic-timeline-content">
                        <div className="ic-timeline-stage">
                          {STAGE_LABELS[item.toStage] || item.toStage}
                        </div>
                        <div className="ic-timeline-date">
                          {formatDate(item.changedAt)}
                        </div>
                        {item.comment && (
                          <div className="ic-timeline-comment">« {item.comment} »</div>
                        )}
                      </div>
                    </li>
                  ))}
              </ol>
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
    </div>
  );
}
