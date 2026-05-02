'use client';

import React from 'react';

interface Props {
  result: any;
}

export default function InvestmentNoteView({ result }: Props) {
  const r = result;
  const e = r.extraction || {};
  const t = r.team || {};
  const m = r.market || {};
  const macro = r.macro || {};
  const fc = r.financialCoherence;
  const fd = r.financialData;
  const ba = r.blindspotAnalysis;
  const ca = r.contrarianAnalysis;
  const pm = r.patternMatching;
  const reco = r.finalRecommendation || {};
  const dateAnalyzed = new Date(r.meta?.analyzedAt || Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="investment-note">
      {/* En-tête de note */}
      <div className="note-header">
        <div className="note-header-left">
          <div className="note-brand">PRÉLUDE</div>
          <div className="note-title">Investment Note · Strategy & Solutions</div>
        </div>
        <div className="note-header-right">
          <div className="note-date">{dateAnalyzed}</div>
          <div className="note-classification">CONFIDENTIAL · IC PRELIMINARY</div>
        </div>
      </div>

      {/* Bloc 1 - Company */}
      <section className="note-section">
        <h2 className="note-section-title"><span className="note-section-num">1.</span> Company</h2>

        <table className="note-table">
          <tbody>
            <tr>
              <td className="note-label">Company</td>
              <td className="note-value bold">{e.companyName || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Sector</td>
              <td className="note-value">{e.sector || '—'} {e.subSector ? `· ${e.subSector}` : ''}</td>
            </tr>
            <tr>
              <td className="note-label">Activity</td>
              <td className="note-value">{e.productDescription || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Geography</td>
              <td className="note-value">{e.geographicHub || '—'}{e.country ? `, ${e.country}` : ''}</td>
            </tr>
            <tr>
              <td className="note-label">Deal type</td>
              <td className="note-value">{e.fundraise?.stage || '—'} · {e.fundraise?.amount || 'montant non précisé'}</td>
            </tr>
            <tr>
              <td className="note-label">Deal context</td>
              <td className="note-value">{e.marketPitch || '—'}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="note-h3">History</h3>
        <p className="note-paragraph">{e.rawSummary || '—'}</p>

        <h3 className="note-h3">Executive Staff</h3>
        {(() => {
          // Filtre les fondateurs artefacts. Le moteur Team peut occasionnellement
          // generer des entrees corrompues issues du parsing (ex: name='1.',
          // role='Shareholder (role exact inconnu)') quand le pitch deck contient
          // des numerotations en debut de ligne. On filtre ces artefacts.
          const isValidFounder = (f: any): boolean => {
            const name = (f?.name || '').trim();
            if (!name) return false;
            // Rejette les noms qui commencent par un chiffre, un point, un slash
            if (/^[\d./\\]/.test(name)) return false;
            // Rejette les noms suspectement courts (1-2 caracteres)
            if (name.length < 3) return false;
            return true;
          };
          const fmfList = (t.founderMarketFit || []).filter(isValidFounder);
          const founderList = (e.founders || []).filter(isValidFounder);
          const hasAny = fmfList.length > 0 || founderList.length > 0;
          if (!hasAny) {
            return <p className="note-paragraph">Données fondateurs non disponibles.</p>;
          }
          return (
            <div>
              {fmfList.map((f: any, i: number) => (
                <div key={i} className="founder-block">
                  <div className="founder-header">
                    <span className="founder-name">{f.name}</span>
                    <span className="founder-role">/ {f.role}</span>
                    <span className="founder-fit">FMF {f.overallFitScore}/100</span>
                  </div>
                  <div className="founder-text"><strong>EXPERIENCE :</strong> {f.trajectorySummary}</div>
                  {f.tacitExpertise && (
                    <div className="founder-text"><strong>EXPERTISE TACITE :</strong> {f.tacitExpertise}</div>
                  )}
                  {f.fitSignals?.length > 0 && (
                    <div className="founder-text"><strong>SIGNAUX POSITIFS :</strong> {f.fitSignals.join(' · ')}</div>
                  )}
                </div>
              ))}
              {fmfList.length === 0 && founderList.map((f: any, i: number) => (
                <div key={i} className="founder-block">
                  <div className="founder-header">
                    <span className="founder-name">{f.name}</span>
                    <span className="founder-role">/ {f.role}</span>
                  </div>
                  <div className="founder-text"><strong>EXPERIENCE :</strong> {f.background}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {fd && fd.revenueProjection?.length > 0 && (
          <>
            <h3 className="note-h3">Company financials</h3>
            <table className="note-financials-table">
              <thead>
                <tr>
                  <th></th>
                  {(fd.revenueProjection || []).map((r: any, i: number) => <th key={i}>{r.year}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">CA (M€)</td>
                  {(fd.revenueProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                </tr>
                {fd.grossMarginProjection?.length > 0 && (
                  <tr>
                    <td className="row-label">Marge brute (%)</td>
                    {(fd.grossMarginProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                  </tr>
                )}
                {fd.ebitdaProjection?.length > 0 && (
                  <tr>
                    <td className="row-label">EBITDA (M€)</td>
                    {(fd.ebitdaProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                  </tr>
                )}
                {fd.fcfProjection?.length > 0 && (
                  <tr>
                    <td className="row-label">Free Cash Flow (M€)</td>
                    {(fd.fcfProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* Bloc 2 - Project description */}
      <section className="note-section">
        <h2 className="note-section-title"><span className="note-section-num">2.</span> Proposed Project</h2>

        <h3 className="note-h3">Overall product</h3>
        <p className="note-paragraph">{e.productDescription || '—'}</p>

        <h3 className="note-h3">Business model</h3>
        <p className="note-paragraph">{e.businessModel || '—'}</p>

        {fd?.unitEconomics && (fd.unitEconomics.estimatedCAC !== '' || fd.unitEconomics.averageContractValue !== '') && (
          <>
            <h3 className="note-h3">Economic assumptions</h3>
            <table className="note-table">
              <tbody>
                {fd.unitEconomics.averageContractValue && (
                  <tr><td className="note-label">ACV</td><td className="note-value">{fd.unitEconomics.averageContractValue}</td></tr>
                )}
                {fd.unitEconomics.estimatedCAC && (
                  <tr><td className="note-label">CAC estimé</td><td className="note-value">{fd.unitEconomics.estimatedCAC}</td></tr>
                )}
                {fd.unitEconomics.estimatedLTV && (
                  <tr><td className="note-label">LTV estimé</td><td className="note-value">{fd.unitEconomics.estimatedLTV}</td></tr>
                )}
                {fd.unitEconomics.estimatedLtvCacRatio && (
                  <tr><td className="note-label">Ratio LTV/CAC</td><td className="note-value">{fd.unitEconomics.estimatedLtvCacRatio}</td></tr>
                )}
                {fd.unitEconomics.grossMarginPerUnit && (
                  <tr><td className="note-label">Marge brute / unité</td><td className="note-value">{fd.unitEconomics.grossMarginPerUnit}</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        <h3 className="note-h3">Market opportunity</h3>
        <p className="note-paragraph">{m.needIntensity?.rationale || '—'}</p>
        {m.defensibility?.moats?.length > 0 && (
          <p className="note-paragraph"><strong>Moats identifiés :</strong> {m.defensibility.moats.join(' · ')}</p>
        )}
      </section>

      {/* Bloc 3 - Due diligence */}
      <section className="note-section">
        <h2 className="note-section-title"><span className="note-section-num">3.</span> Investment Thesis</h2>

        <div className="dd-meta">Date d'analyse : {dateAnalyzed}</div>

        <h3 className="note-h3">Recommendation</h3>
        <div className="verdict-box">
          <div className="verdict-line">
            <span className="verdict-label">Verdict</span>
            <span className="verdict-value">{reco.verdict || '—'}</span>
          </div>
          <div className="verdict-line">
            <span className="verdict-label">Score global</span>
            <span className="verdict-value">{reco.globalScore || 0}/100</span>
          </div>
          <div className="verdict-line">
            <span className="verdict-label">Probabilité de succès</span>
            <span className="verdict-value">{reco.successProbability || 0}%</span>
          </div>
          <div className="verdict-line">
            <span className="verdict-label">Probabilité d'échec</span>
            <span className="verdict-value">{reco.failureProbability || 0}%</span>
          </div>
        </div>
        <p className="note-paragraph" style={{ marginTop: 12 }}>{reco.argumentation}</p>

        {/* Sous-section The case for : ce qui rend ce dossier potentiellement
            exceptionnel. Consomme syntheseSingularite + signaux contrariens
            haute force + comparables contrariens. C est le cote 'thesis' du
            memo IC dialectique. */}
        {(ca?.syntheseSingularite || (ca?.signals && Object.values(ca.signals).some((s: any) => s?.detected && s.strength >= 60))) && (
          <>
            <h3 className="note-h3">The case for</h3>
            {ca.syntheseSingularite && (
              <p className="note-paragraph">{ca.syntheseSingularite}</p>
            )}
            {ca.signals && Object.values(ca.signals).filter((s: any) => s?.detected && s.strength >= 60).length > 0 && (
              <>
                <h4 className="note-h4">Signaux contrariens identifiés</h4>
                <ul className="risk-list">
                  {Object.values(ca.signals)
                    .filter((s: any) => s?.detected && s.strength >= 60)
                    .map((s: any, i: number) => (
                      <li key={i}>
                        <strong>{s.signalName}</strong> ({s.strength}/100). {s.evidence}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {ca.comparablesContrariens?.length > 0 && (
              <>
                <h4 className="note-h4">Comparables contrariens</h4>
                {ca.comparablesContrariens.map((c: any, i: number) => (
                  <div key={i} className="benchmark-block">
                    <div className="benchmark-header">
                      <span className="benchmark-name">{c.name}</span>
                      <span className="benchmark-geo">{c.outcome} {c.multipleAtExit && `· ${c.multipleAtExit}`}</span>
                    </div>
                    <div className="benchmark-bet"><strong>Consensus initial :</strong> {c.initialConsensus}</div>
                    <div className="benchmark-relevance"><strong>Pari contrarien :</strong> {c.contrarianBet}</div>
                  </div>
                ))}
              </>
            )}
            {ca.recommandationContrarienne && (
              <p className="note-paragraph"><em>{ca.recommandationContrarienne}</em></p>
            )}
          </>
        )}

        {/* Sous-section The case against : ce qui menace structurellement la
            these. Consomme syntheseAveuglement + patterns haute intensite +
            patterns historiques (Theranos, Ynsect, etc.) + alertes critiques. */}
        {(ba?.syntheseAveuglement || (ba?.patterns && Object.values(ba.patterns).some((p: any) => p?.detected && p.intensity >= 60))) && (
          <>
            <h3 className="note-h3">The case against</h3>
            {ba.syntheseAveuglement && (
              <p className="note-paragraph">{ba.syntheseAveuglement}</p>
            )}
            {ba.patterns && Object.values(ba.patterns).filter((p: any) => p?.detected && p.intensity >= 60).length > 0 && (
              <>
                <h4 className="note-h4">Patterns d'aveuglement détectés</h4>
                <ul className="risk-list">
                  {Object.values(ba.patterns)
                    .filter((p: any) => p?.detected && p.intensity >= 60)
                    .map((p: any, i: number) => (
                      <li key={i}>
                        <strong>{p.patternName}</strong> ({p.intensity}/100). {p.evidence}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {ba.patternsHistoriques?.length > 0 && (
              <>
                <h4 className="note-h4">Patterns historiques convergents</h4>
                <ul className="risk-list">
                  {ba.patternsHistoriques.map((p: any, i: number) => (
                    <li key={i}>
                      <strong>{p.case}</strong> · {p.outcome} · proximité {p.similarity}%
                      {p.lessonLearned && <>. {p.lessonLearned}</>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ba.alertesCritiques?.length > 0 && (
              <div className="alert-box">
                <strong>Alertes critiques :</strong>
                <ul>{ba.alertesCritiques.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </>
        )}

        {/* Sous-section Dialectical resolution : qui l emporte entre signaux
            d aveuglement et singularites contrariennes, et pourquoi. C est
            le moment central du raisonnement IC. */}
        {reco.blindspotsVsContrarian?.resolution && (
          <>
            <h3 className="note-h3">Dialectical resolution</h3>
            <div className="verdict-box" style={{ marginBottom: 12 }}>
              <div className="verdict-line">
                <span className="verdict-label">Poids de l'aveuglement</span>
                <span className="verdict-value">{reco.blindspotsVsContrarian.blindspotsWeight}/100</span>
              </div>
              <div className="verdict-line">
                <span className="verdict-label">Poids contrarien</span>
                <span className="verdict-value">{reco.blindspotsVsContrarian.contrarianWeight}/100</span>
              </div>
              <div className="verdict-line">
                <span className="verdict-label">Tension résolue</span>
                <span className="verdict-value">{reco.blindspotsVsContrarian.tensionResolved}</span>
              </div>
            </div>
            <p className="note-paragraph">{reco.blindspotsVsContrarian.resolution}</p>
          </>
        )}

        {/* Sous-section Macro context : cadrage du marche dans lequel le dossier
            s inscrit. */}
        {(macro?.cyclePosition || macro?.structuralTrends?.length > 0 || macro?.regulatoryEnvironment) && (
          <>
            <h3 className="note-h3">Macro context</h3>
            <table className="note-table">
              <tbody>
                {macro.cyclePosition && (
                  <tr>
                    <td className="note-label">Cycle position</td>
                    <td className="note-value">{macro.cyclePosition}</td>
                  </tr>
                )}
                {macro.vcCapitalOnSegment && (
                  <tr>
                    <td className="note-label">VC capital on segment</td>
                    <td className="note-value">{macro.vcCapitalOnSegment}</td>
                  </tr>
                )}
                {macro.criticalTimingWindow?.exists && (
                  <tr>
                    <td className="note-label">Critical timing window</td>
                    <td className="note-value">{macro.criticalTimingWindow.horizon || ''} · {macro.criticalTimingWindow.rationale || ''}</td>
                  </tr>
                )}
                {typeof macro.contraryclicalOpportunity?.score === 'number' && (
                  <tr>
                    <td className="note-label">Contracyclical opportunity</td>
                    <td className="note-value">{macro.contraryclicalOpportunity.score}/100 · {macro.contraryclicalOpportunity.rationale || ''}</td>
                  </tr>
                )}
                {macro.geopolitics && (
                  <tr>
                    <td className="note-label">Geopolitics</td>
                    <td className="note-value">{macro.geopolitics}</td>
                  </tr>
                )}
                {macro.interestRateRegime && (
                  <tr>
                    <td className="note-label">Interest rate regime</td>
                    <td className="note-value">{macro.interestRateRegime}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {macro.structuralTrends?.length > 0 && (
              <>
                <h4 className="note-h4">Structural trends</h4>
                <ul className="risk-list">
                  {(macro.structuralTrends || []).map((t: string, i: number) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </>
            )}
            {macro.regulatoryEnvironment && (
              <>
                <h4 className="note-h4">Regulatory environment</h4>
                <p className="note-paragraph">{macro.regulatoryEnvironment}</p>
              </>
            )}
          </>
        )}

        {ba?.riskMap && (
          <>
            <h3 className="note-h3">Risk factors</h3>
            <h4 className="note-h4">Strategic risks</h4>
            {(ba.riskMap.strategicRisks || []).length === 0 ? <p className="note-paragraph muted">Aucun risque stratégique identifié.</p> : (
              <ul className="risk-list">
                {(ba.riskMap.strategicRisks || []).map((r: any, i: number) => (
                  <li key={i}>
                    <span className={`risk-sev sev-${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}.</strong> {r.description}
                  </li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Operational risks</h4>
            {(ba.riskMap.operationalRisks || []).length === 0 ? <p className="note-paragraph muted">Aucun risque opérationnel identifié.</p> : (
              <ul className="risk-list">
                {(ba.riskMap.operationalRisks || []).map((r: any, i: number) => (
                  <li key={i}>
                    <span className={`risk-sev sev-${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}.</strong> {r.description}
                  </li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Financial risks</h4>
            {(ba.riskMap.financialRisks || []).length === 0 ? <p className="note-paragraph muted">Aucun risque financier identifié.</p> : (
              <ul className="risk-list">
                {(ba.riskMap.financialRisks || []).map((r: any, i: number) => (
                  <li key={i}>
                    <span className={`risk-sev sev-${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}.</strong> {r.description}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {m?.competitiveMatrix?.dimensions?.length > 0 && (
          <>
            <h3 className="note-h3">Competitive positioning</h3>
            <div className="matrix-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th></th>
                    {(m.competitiveMatrix.dimensions || []).map((d: string, i: number) => (
                      <th key={i} className="matrix-dim">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(m.competitiveMatrix.players || []).map((p: any, i: number) => (
                    <tr key={i} className={p.isTargetCompany ? 'target' : ''}>
                      <td className="matrix-player">{p.name}</td>
                      {(p.coverage || []).map((c: boolean, j: number) => (
                        <td key={j} className={c ? 'cov-yes' : 'cov-no'}>{c ? '√' : '×'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note-paragraph"><strong>Différenciation :</strong> {m.competitiveMatrix.differentiationRationale}</p>
          </>
        )}

        {fc?.hasFinancialData && (
          <>
            <h3 className="note-h3">Financial assessment</h3>
            <p className="note-paragraph">{fc.syntheseCoherence}</p>
            {fc.alertesCritiques?.length > 0 && (
              <div className="alert-box">
                <strong>Alertes critiques :</strong>
                <ul>{(fc.alertesCritiques || []).map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </>
        )}

        <h3 className="note-h3">Decision drivers</h3>
        {reco.decisionDrivers?.length > 0 ? (
          <ol className="ordered-list">
            {(reco.decisionDrivers || []).map((d: string, i: number) => <li key={i}>{d}</li>)}
          </ol>
        ) : <p className="note-paragraph muted">Decision drivers non disponibles.</p>}

        {pm?.internationalBenchmarks?.length > 0 && (
          <>
            <h3 className="note-h3">Comparables & precedents</h3>
            {(pm.internationalBenchmarks || []).map((b: any, i: number) => (
              <div key={i} className="benchmark-block">
                <div className="benchmark-header">
                  <span className="benchmark-name">{b.name}</span>
                  <span className="benchmark-geo">{b.geography} · {b.foundedYear} · {b.outcome}</span>
                </div>
                <div className="benchmark-bet"><strong>Pari initial :</strong> {b.initialBet}</div>
                <div className="benchmark-relevance"><strong>Pertinence :</strong> {b.relevanceToCurrentDeal}</div>
              </div>
            ))}
          </>
        )}
      </section>

      {/* Bloc 4 - Transaction features */}
      <section className="note-section">
        <h2 className="note-section-title"><span className="note-section-num">4.</span> Transaction Features</h2>

        <table className="note-table">
          <tbody>
            <tr>
              <td className="note-label">Stage</td>
              <td className="note-value">{e.fundraise?.stage || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Nominal</td>
              <td className="note-value">{e.fundraise?.amount || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Valuation</td>
              <td className="note-value">{e.fundraise?.valuation || 'non précisée'}</td>
            </tr>
            <tr>
              <td className="note-label">Lead investor</td>
              <td className="note-value">{e.fundraise?.leadInvestor || 'non précisé'}</td>
            </tr>
            {fd?.currentRound?.runwayMonths && fd.currentRound.runwayMonths !== 'non précisé' && (
              <tr>
                <td className="note-label">Runway projeté</td>
                <td className="note-value">{fd.currentRound.runwayMonths} mois</td>
              </tr>
            )}
          </tbody>
        </table>

        {reco.keyConditions?.length > 0 && (
          <>
            <h3 className="note-h3">Key conditions before signature</h3>
            <ol className="ordered-list">
              {(reco.keyConditions || []).map((c: string, i: number) => <li key={i}>{c}</li>)}
            </ol>
          </>
        )}

        {reco.structuringPlan && (
          <>
            <h3 className="note-h3">Structuring plan</h3>
            <h4 className="note-h4">Court terme · 0-3 mois</h4>
            {(reco.structuringPlan.shortTerm || []).length === 0 ? <p className="note-paragraph muted">Aucune action court terme.</p> : (
              <ul className="action-list">
                {(reco.structuringPlan.shortTerm || []).map((a: any, i: number) => (
                  <li key={i}><span className="action-axis">{a.axis}</span>{a.action}</li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Moyen terme · 3-12 mois</h4>
            {(reco.structuringPlan.mediumTerm || []).length === 0 ? <p className="note-paragraph muted">Aucune action moyen terme.</p> : (
              <ul className="action-list">
                {(reco.structuringPlan.mediumTerm || []).map((a: any, i: number) => (
                  <li key={i}><span className="action-axis">{a.axis}</span>{a.action}</li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Long terme · 12+ mois</h4>
            {(reco.structuringPlan.longTerm || []).length === 0 ? <p className="note-paragraph muted">Aucune action long terme.</p> : (
              <ul className="action-list">
                {(reco.structuringPlan.longTerm || []).map((a: any, i: number) => (
                  <li key={i}><span className="action-axis">{a.axis}</span>{a.action}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="note-footer">
        <div>Note préparée par Prélude · Plateforme d'instruction VC européenne</div>
        <div>Document confidentiel · Usage strictement interne au Comité d'Investissement</div>
      </div>

      <style jsx>{`
        .investment-note {
          max-width: 880px;
          margin: 0 auto;
          padding: 32px 40px;
          background: #fefefe;
          color: #1a1a1a;
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 13px;
          line-height: 1.6;
        }
        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 14px;
          border-bottom: 3px solid #1a1a1a;
          margin-bottom: 36px;
        }
        .note-brand {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.08em;
        }
        .note-title {
          font-size: 13px;
          letter-spacing: 0.04em;
          opacity: 0.85;
          margin-top: 4px;
        }
        .note-header-right {
          text-align: right;
        }
        .note-date {
          font-size: 12px;
          opacity: 0.85;
        }
        .note-classification {
          font-size: 9px;
          letter-spacing: 0.12em;
          opacity: 0.6;
          margin-top: 2px;
        }
        .note-section {
          margin-bottom: 36px;
        }
        .note-section-title {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 22px;
          font-weight: 500;
          padding: 10px 14px;
          background: #1a1a1a;
          color: #fefefe;
          margin: 0 0 20px 0;
        }
        .note-section-num {
          margin-right: 8px;
          opacity: 0.6;
        }
        .note-h3 {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 16px;
          font-weight: 500;
          margin-top: 24px;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .note-h4 {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 13px;
          font-weight: 500;
          margin-top: 16px;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          opacity: 0.85;
        }
        .note-paragraph {
          margin-bottom: 12px;
        }
        .note-paragraph.muted {
          opacity: 0.6;
          font-style: italic;
        }
        .note-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .note-table td {
          padding: 8px 10px;
          border: 1px solid #c8c8c8;
          vertical-align: top;
        }
        .note-label {
          width: 130px;
          font-weight: 500;
          background: #f0f0f0;
          font-size: 12px;
        }
        .note-value {
          font-size: 12px;
        }
        .note-value.bold {
          font-weight: 600;
        }
        .note-financials-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          font-size: 12px;
        }
        .note-financials-table th, .note-financials-table td {
          padding: 8px 10px;
          border: 1px solid #c8c8c8;
          text-align: right;
        }
        .note-financials-table th {
          background: #1a1a1a;
          color: #fefefe;
          font-weight: 500;
        }
        .note-financials-table .row-label {
          text-align: left;
          background: #f0f0f0;
          font-weight: 500;
        }
        .founder-block {
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .founder-header {
          display: flex;
          gap: 8px;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .founder-name {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 15px;
          font-weight: 500;
        }
        .founder-role {
          font-size: 12px;
          opacity: 0.7;
        }
        .founder-fit {
          margin-left: auto;
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 13px;
          padding: 2px 8px;
          background: #f0f0f0;
          border: 1px solid #c8c8c8;
        }
        .founder-text {
          font-size: 12px;
          margin-bottom: 4px;
          line-height: 1.5;
        }
        .verdict-box {
          background: #f6f6f6;
          border: 1px solid #c8c8c8;
          padding: 14px 18px;
          margin-bottom: 12px;
        }
        .verdict-line {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .verdict-line:last-child {
          border-bottom: none;
        }
        .verdict-label {
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .verdict-value {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 14px;
          font-weight: 500;
          text-transform: capitalize;
        }
        .risk-list {
          padding-left: 0;
          list-style: none;
          margin-bottom: 16px;
        }
        .risk-list li {
          padding: 8px 12px;
          margin-bottom: 6px;
          background: #f6f6f6;
          border-left: 3px solid #1a1a1a;
          font-size: 12px;
          line-height: 1.5;
        }
        .risk-sev {
          display: inline-block;
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 1px 6px;
          margin-right: 8px;
          font-weight: 600;
        }
        .sev-low { background: #e0e9e0; color: #2d4a2d; }
        .sev-medium { background: #f4ecdc; color: #6b4d2c; }
        .sev-high { background: #f4d8c4; color: #7c3a1a; }
        .sev-critical { background: #f0c4c4; color: #6b1a1a; }
        .matrix-wrap {
          overflow-x: auto;
          margin-bottom: 12px;
        }
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .matrix-table th, .matrix-table td {
          padding: 6px 8px;
          border: 1px solid #c8c8c8;
          text-align: center;
        }
        .matrix-dim {
          background: #1a1a1a;
          color: #fefefe;
          font-weight: 500;
          font-size: 10px;
        }
        .matrix-player {
          text-align: left !important;
          background: #f0f0f0;
          font-weight: 500;
        }
        .matrix-table tr.target .matrix-player {
          background: #e6e6e6;
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 13px;
          font-weight: 600;
        }
        .matrix-table tr.target td {
          background: #fafafa;
        }
        .cov-yes { color: #2d4a2d; font-weight: 600; }
        .cov-no { color: #6b1a1a; }
        .alert-box {
          padding: 10px 14px;
          background: #faf3ec;
          border: 1px solid #c4a484;
          margin-bottom: 14px;
          font-size: 12px;
        }
        .alert-box ul { margin: 6px 0 0 0; padding-left: 18px; }
        .ordered-list {
          padding-left: 24px;
        }
        .ordered-list li {
          margin-bottom: 6px;
          font-size: 12px;
          line-height: 1.5;
        }
        .benchmark-block {
          margin-bottom: 14px;
          padding: 12px 14px;
          background: #f6f6f6;
          border-left: 3px solid #1a1a1a;
        }
        .benchmark-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .benchmark-name {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 15px;
          font-weight: 500;
        }
        .benchmark-geo {
          font-size: 11px;
          opacity: 0.7;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .benchmark-bet, .benchmark-relevance {
          font-size: 12px;
          margin-bottom: 4px;
          line-height: 1.5;
        }
        .action-list {
          list-style: none;
          padding-left: 0;
        }
        .action-list li {
          padding: 8px 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          font-size: 12px;
          line-height: 1.5;
        }
        .action-list li:last-child { border-bottom: none; }
        .action-axis {
          display: inline-block;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: #1a1a1a;
          color: #fefefe;
          padding: 2px 8px;
          margin-right: 10px;
          font-weight: 500;
        }
        .dd-meta {
          font-size: 11px;
          opacity: 0.7;
          margin-bottom: 14px;
        }
        .note-footer {
          margin-top: 48px;
          padding-top: 14px;
          border-top: 1px solid rgba(0,0,0,0.15);
          font-size: 10px;
          opacity: 0.6;
          text-align: center;
          line-height: 1.6;
        }
        @media print {
          .investment-note {
            padding: 0;
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
