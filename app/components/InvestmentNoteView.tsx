'use client';

import React from 'react';
import { enrichProse, splitIntoParagraphs } from '@/lib/note-typography';

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

  // Helper pour extraire la première phrase d'un paragraphe long. Utilisé pour
  // les pull quotes : on veut une phrase impactante, pas un paragraphe entier.
  const firstSentence = (s: string | undefined, maxLen: number = 220): string => {
    if (!s) return '';
    const trimmed = s.trim();
    // Cherche la première séparation en .,!,? suivie d'un espace ou fin de chaîne
    const match = trimmed.match(/^[^.!?]+[.!?](?=\s|$)/);
    const candidate = match ? match[0] : trimmed;
    if (candidate.length <= maxLen) return candidate;
    // Si trop long, tronque proprement au dernier espace avant maxLen
    const truncated = candidate.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > maxLen * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '…';
  };

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
        <p className="note-paragraph">{enrichProse(e.rawSummary) || '—'}</p>

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
              {fmfList.map((f: any, i: number) => {
                // Distinction critique : score "non instruit" vs score reel.
                // Quand evaluability === 'non-evaluable', le score est un plancher
                // de convention (5-15) qui signale l'impossibilite d'instruire,
                // PAS une mauvaise note. On affiche un libelle explicite pour eviter
                // que le lecteur lise '5/100' comme un mauvais profil.
                const nonEvaluable = f.evaluability === 'non-evaluable';
                const partiallyEvaluable = f.evaluability === 'partially-evaluable';
                return (
                  <div key={i} className={`founder-block ${nonEvaluable ? 'founder-block-uneval' : ''}`}>
                    <div className="founder-header">
                      <span className="founder-name">{f.name}</span>
                      <span className="founder-role">/ {f.role}</span>
                      {nonEvaluable ? (
                        <span className="founder-fit founder-fit-uneval" title="Score non instruit faute de données vérifiables - n'est pas un mauvais score, c'est l'absence d'instruction possible">
                          NON INSTRUIT
                        </span>
                      ) : partiallyEvaluable ? (
                        <span className="founder-fit founder-fit-partial" title="Instruction partielle - score à calibrer prudemment">
                          FMF {f.overallFitScore}/100 · Partiel
                        </span>
                      ) : (
                        <span className="founder-fit">FMF {f.overallFitScore}/100</span>
                      )}
                    </div>
                    <div className="founder-text"><strong>EXPERIENCE :</strong> {f.trajectorySummary}</div>
                    {f.tacitExpertise && (
                      <div className="founder-text"><strong>EXPERTISE TACITE :</strong> {f.tacitExpertise}</div>
                    )}
                    {f.fitSignals?.length > 0 && (
                      <div className="founder-text"><strong>SIGNAUX POSITIFS :</strong> {f.fitSignals.join(' · ')}</div>
                    )}
                  </div>
                );
              })}
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
        <p className="note-paragraph">{enrichProse(e.productDescription) || '—'}</p>

        <h3 className="note-h3">Business model</h3>
        <p className="note-paragraph">{enrichProse(e.businessModel) || '—'}</p>

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
        <p className="note-paragraph">{enrichProse(m.needIntensity?.rationale) || '—'}</p>
        {m.defensibility?.moats?.length > 0 && (
          <p className="note-paragraph"><strong>Moats identifiés :</strong> {m.defensibility.moats.join(' · ')}</p>
        )}

        {/* MARKET SIZING - bloc TAM/SAM/SOM avec sources verifiees.
            Ne s affiche que si le moteur Marche a effectivement rempli
            marketSizing (introduit en Niveau 2.A v2). Pour les analyses
            anciennes, le bloc reste invisible (retrocompatibilite). */}
        {m.marketSizing && (
          <>
            <h3 className="note-h3">Market sizing</h3>
            {m.marketSizing.sizingNarrative && (
              <p className="note-paragraph">{enrichProse(m.marketSizing.sizingNarrative)}</p>
            )}
            <table className="note-table">
              <tbody>
                {m.marketSizing.tam && (
                  <tr>
                    <td className="note-label">
                      TAM
                      {m.marketSizing.tam.confidence && (
                        <span className="sizing-confidence" data-conf={m.marketSizing.tam.confidence}>
                          {m.marketSizing.tam.confidence === 'high' ? '●' : m.marketSizing.tam.confidence === 'medium' ? '◐' : '○'}
                        </span>
                      )}
                    </td>
                    <td className="note-value">
                      <strong>{m.marketSizing.tam.value}</strong>
                      {m.marketSizing.tam.timeframe && <span className="sizing-meta"> · {m.marketSizing.tam.timeframe}</span>}
                      {m.marketSizing.tam.source && <div className="sizing-source">Source : {m.marketSizing.tam.source}</div>}
                    </td>
                  </tr>
                )}
                {m.marketSizing.sam && (
                  <tr>
                    <td className="note-label">SAM</td>
                    <td className="note-value">
                      <strong>{m.marketSizing.sam.value}</strong>
                      {m.marketSizing.sam.timeframe && <span className="sizing-meta"> · {m.marketSizing.sam.timeframe}</span>}
                      {m.marketSizing.sam.source && <div className="sizing-source">Source : {m.marketSizing.sam.source}</div>}
                      {m.marketSizing.sam.methodology && <div className="sizing-source">Méthode : {m.marketSizing.sam.methodology}</div>}
                    </td>
                  </tr>
                )}
                {m.marketSizing.som && (
                  <tr>
                    <td className="note-label">SOM</td>
                    <td className="note-value">
                      <strong>{m.marketSizing.som.value}</strong>
                      {m.marketSizing.som.timeframe && <span className="sizing-meta"> · {m.marketSizing.som.timeframe}</span>}
                      {m.marketSizing.som.methodology && <div className="sizing-source">Méthode : {m.marketSizing.som.methodology}</div>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Alignement vs pitch : signal de rigueur du founder */}
            {m.marketSizing.pitchAlignment && m.marketSizing.pitchAlignment !== 'aligned' && (
              <div className={`pitch-alignment pitch-alignment-${m.marketSizing.pitchAlignment}`}>
                <span className="pitch-alignment-label">Alignement pitch :</span>
                <span className="pitch-alignment-value">
                  {m.marketSizing.pitchAlignment === 'overestimated' && 'Pitch surestime le marché'}
                  {m.marketSizing.pitchAlignment === 'underestimated' && 'Pitch sous-estime le marché'}
                  {m.marketSizing.pitchAlignment === 'pitch-not-cited' && 'Pitch ne cite pas de TAM'}
                </span>
                {m.marketSizing.pitchAlignmentNote && (
                  <div className="pitch-alignment-note">{enrichProse(m.marketSizing.pitchAlignmentNote)}</div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Bloc 3 - Due diligence */}
      <section className="note-section">
        <h2 className="note-section-title"><span className="note-section-num">3.</span> Investment Thesis</h2>

        <div className="dd-meta">
          <span className="dd-meta-bullet" aria-hidden="true">●</span>
          <span className="dd-meta-text">{dateAnalyzed.toUpperCase()}</span>
          <span className="dd-meta-sep" aria-hidden="true">·</span>
          <span className="dd-meta-text">Note préliminaire IC</span>
        </div>

        <h3 className="note-h3">Recommendation</h3>
        <div className="verdict-box">
          <div className="verdict-line">
            <span className="verdict-label">Verdict</span>
            <span className="verdict-value">{reco.verdict || '—'}</span>
          </div>
          <div className="verdict-line feature">
            <span className="verdict-label">Score global</span>
            <span className="verdict-value big">{reco.globalScore || 0}<span style={{ fontSize: 13, opacity: 0.5, fontWeight: 400 }}> / 100</span></span>
          </div>
          <div className="verdict-line feature">
            <span className="verdict-label">Probabilité de succès</span>
            <span className="verdict-value big">{reco.successProbability || 0}<span style={{ fontSize: 13, opacity: 0.5, fontWeight: 400 }}>%</span></span>
          </div>
          <div className="verdict-line">
            <span className="verdict-label">Probabilité d'échec</span>
            <span className="verdict-value">{reco.failureProbability || 0}%</span>
          </div>
        </div>

        {/* Polish 3 : barre de seuils visuelle. Permet de capter instantanement
            ou se situe le dossier dans l axe REFUSER / APPROFONDIR / CONDITIONS
            / INVESTIR. Les seuils par defaut sont 45 / 60 / 75. */}
        {typeof reco.globalScore === 'number' && (
          <div className="score-thresholds">
            <div className="score-thresholds-track">
              <div className="zone zone-refuser" style={{ width: '45%' }} title="Refuser : score &lt; 45" />
              <div className="zone zone-approfondir" style={{ width: '15%' }} title="Approfondir : 45-60" />
              <div className="zone zone-conditions" style={{ width: '15%' }} title="Investir avec conditions : 60-75" />
              <div className="zone zone-investir" style={{ width: '25%' }} title="Investir : 75+" />
              <div
                className="score-marker"
                style={{ left: `${Math.min(100, Math.max(0, reco.globalScore))}%` }}
                aria-label={`Score actuel : ${reco.globalScore} sur 100`}
              />
            </div>
            <div className="score-thresholds-labels">
              <span className="lbl lbl-refuser">Refuser</span>
              <span className="lbl lbl-approfondir">Approfondir</span>
              <span className="lbl lbl-conditions">Conditions</span>
              <span className="lbl lbl-investir">Investir</span>
            </div>
            <div className="score-thresholds-axis">
              <span>0</span>
              <span style={{ flex: '0 0 auto', position: 'absolute', left: '45%', transform: 'translateX(-50%)' }}>45</span>
              <span style={{ flex: '0 0 auto', position: 'absolute', left: '60%', transform: 'translateX(-50%)' }}>60</span>
              <span style={{ flex: '0 0 auto', position: 'absolute', left: '75%', transform: 'translateX(-50%)' }}>75</span>
              <span>100</span>
            </div>
          </div>
        )}

        {/* Argumentation reco - prose dense decoupee en paragraphes
            courts (3 phrases) avec chiffres-cles mis en valeur. */}
        <div style={{ marginTop: 18 }}>
          {splitIntoParagraphs(reco.argumentation, 3).map((p, i) => (
            <p key={i} className="note-paragraph">{enrichProse(p)}</p>
          ))}
        </div>

        {/* Pull quote 1 : extrait de l'argumentation du verdict, mis en
            exergue comme dans un article FT. Utilise la première phrase si
            assez impactante, sinon la résolution dialectique. */}
        {reco.argumentation && firstSentence(reco.argumentation, 200).length > 50 && (
          <blockquote className="pull-quote">
            <span className="pull-quote-mark" aria-hidden="true">«</span>
            {firstSentence(reco.argumentation, 200)}
            <span className="pull-quote-mark" aria-hidden="true">»</span>
          </blockquote>
        )}

        {/* Sous-section The case for : ce qui rend ce dossier potentiellement
            exceptionnel. Consomme syntheseSingularite + signaux contrariens
            haute force + comparables contrariens. C est le cote 'thesis' du
            memo IC dialectique. */}
        {(ca?.syntheseSingularite || (ca?.signals && Object.values(ca.signals).some((s: any) => s?.detected && s.strength >= 60))) && (
          <>
            <h3 className="note-h3">The case for</h3>
            {ca.syntheseSingularite && (
              <>{splitIntoParagraphs(ca.syntheseSingularite, 3).map((p, i) => (
                <p key={i} className="note-paragraph">{enrichProse(p)}</p>
              ))}</>
            )}
            {ca.signals && Object.values(ca.signals).filter((s: any) => s?.detected && s.strength >= 60).length > 0 && (
              <>
                <h4 className="note-h4">Signaux contrariens identifiés</h4>
                <ul className="risk-list">
                  {Object.values(ca.signals)
                    .filter((s: any) => s?.detected && s.strength >= 60)
                    .map((s: any, i: number) => (
                      <li key={i}>
                        <span className="signal-score-pill signal-score-contrarian">{s.strength}</span>
                        <strong>{s.signalName}.</strong> {s.evidence}
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
              <blockquote className="pull-quote pull-quote-contrarian">
                <span className="pull-quote-mark" aria-hidden="true">«</span>
                {ca.recommandationContrarienne}
                <span className="pull-quote-mark" aria-hidden="true">»</span>
                <cite className="pull-quote-cite">Recommandation contrarienne</cite>
              </blockquote>
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
              <>{splitIntoParagraphs(ba.syntheseAveuglement, 3).map((p, i) => (
                <p key={i} className="note-paragraph">{enrichProse(p)}</p>
              ))}</>
            )}

            {/* Pull quote 3 : si un pattern historique converge fortement
                (similarité >= 70%), on l'extrait en exergue. C'est le moment
                où l'analyse compare le dossier à un échec célèbre. */}
            {ba.patternsHistoriques?.length > 0 && (() => {
              const topPattern = [...(ba.patternsHistoriques || [])].sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0))[0];
              if (topPattern && topPattern.similarity >= 70) {
                return (
                  <blockquote className="pull-quote pull-quote-blindspot">
                    <span className="pull-quote-mark" aria-hidden="true">«</span>
                    Ce dossier reproduit le pattern <strong>{topPattern.case}</strong> ({topPattern.outcome}) avec une proximité structurelle de {topPattern.similarity}%.
                    <span className="pull-quote-mark" aria-hidden="true">»</span>
                    {topPattern.lessonLearned && (
                      <cite className="pull-quote-cite">{topPattern.lessonLearned}</cite>
                    )}
                  </blockquote>
                );
              }
              return null;
            })()}
            {ba.patterns && Object.values(ba.patterns).filter((p: any) => p?.detected && p.intensity >= 60).length > 0 && (
              <>
                <h4 className="note-h4">Patterns d'aveuglement détectés</h4>
                <ul className="risk-list">
                  {Object.values(ba.patterns)
                    .filter((p: any) => p?.detected && p.intensity >= 60)
                    .map((p: any, i: number) => (
                      <li key={i}>
                        <span className="signal-score-pill signal-score-blindspot">{p.intensity}</span>
                        <strong>{p.patternName}.</strong> {p.evidence}
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
                      <span className="signal-score-pill signal-score-blindspot">{p.similarity}</span>
                      <strong>{p.case}.</strong> {p.outcome}
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
            {splitIntoParagraphs(reco.blindspotsVsContrarian.resolution, 3).map((p, i) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
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
                {splitIntoParagraphs(macro.regulatoryEnvironment, 3).map((p, i) => (
                  <p key={i} className="note-paragraph">{enrichProse(p)}</p>
                ))}
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
            <p className="note-paragraph"><strong>Différenciation :</strong> {enrichProse(m.competitiveMatrix.differentiationRationale)}</p>
          </>
        )}

        {fc?.hasFinancialData && (
          <>
            <h3 className="note-h3">Financial assessment</h3>
            {splitIntoParagraphs(fc.syntheseCoherence, 3).map((p, i) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
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
            {(pm.internationalBenchmarks || []).map((b: any, i: number) => {
              // Mapping cautionLevel -> classe + libelle pour le badge
              const cautionConfig: Record<string, { cls: string; label: string }> = {
                'reference-positive': { cls: 'caution-positive', label: 'Référence positive' },
                'cite-with-caveat': { cls: 'caution-caveat', label: 'À nuancer' },
                'cautionary-tale': { cls: 'caution-tale', label: 'Avertissement' },
              };
              const statusConfig: Record<string, { cls: string; label: string }> = {
                confirmed: { cls: 'status-confirmed', label: 'Statut : confirmé' },
                promising: { cls: 'status-promising', label: 'Statut : prometteur' },
                fragile: { cls: 'status-fragile', label: 'Statut : fragile' },
                'in-difficulty': { cls: 'status-difficulty', label: 'Statut : en difficulté' },
                'too-early': { cls: 'status-too-early', label: 'Statut : trop tôt' },
              };
              const caution = b.cautionLevel ? cautionConfig[b.cautionLevel] : null;
              const status = b.currentStatus ? statusConfig[b.currentStatus] : null;
              return (
                <div key={i} className={`benchmark-block ${caution ? caution.cls : ''}`}>
                  <div className="benchmark-header">
                    <span className="benchmark-name">{b.name}</span>
                    <span className="benchmark-geo">{b.geography} · {b.foundedYear} · {b.outcome}</span>
                  </div>
                  {(caution || status) && (
                    <div className="benchmark-badges">
                      {caution && <span className={`benchmark-badge ${caution.cls}`}>{caution.label}</span>}
                      {status && <span className={`benchmark-badge ${status.cls}`}>{status.label}</span>}
                    </div>
                  )}
                  <div className="benchmark-bet"><strong>Pari initial :</strong> {b.initialBet}</div>
                  <div className="benchmark-relevance"><strong>Pertinence :</strong> {b.relevanceToCurrentDeal}</div>
                </div>
              );
            })}
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

      {/* SECTION SOURCES & METHODOLOGY - Documentation des références externes
          consolidées par les moteurs Prélude. Montre la rigueur méthodologique
          de la note. */}
      <section className="note-sources">
        <h4 className="note-h4">Sources & methodology</h4>
        <p className="note-sources-intro">
          Cette note s'appuie sur l'analyse du dossier déposé et sur un corpus de bornes externes consolidées trimestriellement.
        </p>
        <ol className="note-sources-list">
          <li>
            <strong>PitchBook-NVCA Venture Monitor Q1 2026.</strong>
            <span className="note-sources-detail"> Médianes pré-money par stade, séparation IA vs non-IA, concentration extrême du capital US (top 5 deals = 73,2%), step-up médian, fundraising bifurqué.</span>
          </li>
          <li>
            <strong>Atomico State of European Tech 2025.</strong>
            <span className="note-sources-detail"> Profondeur du marché européen (44 Md$ annuels vs 267 Md$ US Q1 2026), allocation pension funds VC (0,009% AUM Europe vs 0,028% US), Mighty 50 (comparables européens), pipeline réglementaire EU 2026.</span>
          </li>
          <li>
            <strong>Bain Global Private Equity Report 2025.</strong>
            <span className="note-sources-detail"> Liquidité LP (distributions to NAV 2024 = 11%, plus bas niveau en 10+ ans), gap fundraising entre top et bottom quartile (53 points), multiples buyout EBITDA.</span>
          </li>
          <li>
            <strong>Correlation Ventures &amp; Cambridge Associates.</strong>
            <span className="note-sources-detail"> Loi de puissance des retours VC (65% des deals en 0-1x, 4% en 10x+), benchmarks de TRI et TVPI par quartile de fond, persistance Kaplan-Schoar.</span>
          </li>
        </ol>
      </section>

      <div className="note-footer">
        <div>Note préparée par Prélude · Plateforme d'instruction VC européenne</div>
        <div>Document confidentiel · Usage strictement interne au Comité d'Investissement</div>
      </div>

      <style jsx>{`
        /* ============================================================
           PRELUDE - Investment Note - Direction visuelle C
           Inspiration : Financial Times, Bloomberg, The Economist online
           Phases : C1 fondations · C2 mise en scene · C3 couleur affinee
           ============================================================ */

        .investment-note {
          /* PALETTE EDITORIALE C3
             Encre, papier, hairlines, accents semantiques.
             L'accent unique de la marque est bleu encre #1a2e4a
             (utilise tres parcimonieusement : nameplate, links, citations
             de la marque). Les couleurs semantiques (rouge sourd, vert profond,
             ambre) sont reservees aux indicateurs et restent sobres. */

          --paper: #fbfaf7;
          --paper-accent: #f3efe6;
          --paper-warm: #f6e8e0;
          --ink: #1d1c1a;
          --ink-secondary: #555049;
          --ink-tertiary: #6a655d;
          --ink-quaternary: #a8a094;
          --hairline: #d8d2c5;
          --hairline-soft: #ebe5d6;

          --accent-marque: #1a2e4a;
          --accent-marque-soft: #e6ebf2;

          --semantic-critical: #6b1a1a;
          --semantic-critical-soft: #f8caca;
          --semantic-warning: #5d4216;
          --semantic-warning-soft: #fbf3df;
          --semantic-positive: #2d4a2d;
          --semantic-positive-soft: #cfe5cf;

          max-width: 920px;
          margin: 0 auto;
          padding: 56px 64px;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 15px;
          line-height: 1.7;
          font-feature-settings: "kern", "liga", "onum";
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* HEADER - Style "nameplate" de journal premium :
           PRELUDE en grand, dateline et classification en petits caractères
           sans-serif uppercase, filet horizontal de séparation. */
        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 18px;
          border-bottom: 1px solid #1d1c1a;
          margin-bottom: 48px;
          position: relative;
        }
        .note-header::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 1px;
          background: #1d1c1a;
          opacity: 0.4;
        }
        .note-brand {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 30px;
          font-weight: 700;
          letter-spacing: 0.16em;
          line-height: 1;
          color: var(--accent-marque);
        }
        .note-title {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6a655d;
          margin-top: 8px;
        }
        .note-header-right {
          text-align: right;
        }
        .note-date {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: #1d1c1a;
          letter-spacing: 0.04em;
        }
        .note-classification {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #8a8478;
          margin-top: 4px;
          text-transform: uppercase;
          font-weight: 500;
        }

        /* SECTIONS - Numérotation grand format en serif italique, titre en
           serif affirmé. Pas de fond noir : on remplace par un trait haut
           fin et une numérotation qui descend dans la marge. */
        .note-section {
          margin-bottom: 64px;
          position: relative;
        }
        .note-section-title {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 32px;
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -0.015em;
          padding: 0 0 14px 0;
          margin: 0 0 32px 0;
          background: transparent;
          color: #1d1c1a;
          border-bottom: 1px solid #1d1c1a;
          position: relative;
        }
        .note-section-num {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 28px;
          font-weight: 400;
          font-style: italic;
          color: #a8a094;
          margin-right: 14px;
          font-feature-settings: "lnum";
        }

        /* H3 - Sous-section. Style "kicker" éditorial : trait court à gauche,
           titre serif gras, espace généreux. */
        /* H3 - Sous-section. Style "kicker" éditorial : un filet horizontal
           court au-dessus du titre, titre serif gras, espace généreux.
           Quand un H3 suit immédiatement un autre H3 (sans contenu intermédiaire),
           on évite le double filet via :first-of-type. */
        .note-h3 {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 21px;
          font-weight: 600;
          line-height: 1.25;
          margin-top: 56px;
          margin-bottom: 20px;
          padding-bottom: 0;
          padding-top: 16px;
          padding-left: 0;
          border-bottom: none;
          border-left: none;
          border-top: 1px solid var(--ink);
          letter-spacing: -0.01em;
          position: relative;
        }
        /* Le premier H3 d'une section n'a pas de filet (la section a deja son
           propre titre H2 avec filet de separation). */
        .note-section > .note-h3:first-of-type {
          margin-top: 32px;
          padding-top: 0;
          border-top: none;
        }

        /* H4 - Label de groupe. Style sans-serif uppercase tracking large,
           contrasté avec les serifs des H2/H3. C'est la signature éditoriale
           classique des publications économiques premium. */
        .note-h4 {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10.5px;
          font-weight: 700;
          margin-top: 28px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--ink-tertiary);
        }

        /* PARAGRAPHES - Refonte pour aération maximale.
           
           Le passage d'une note dense à un livrable d'IC lisible exige :
           - Plus d'espace inter-paragraphes (16->24px)
           - Plus de leading inter-lignes (1.7->1.75)
           - Pas de justification sur paragraphes longs (la justification
             produit des "rivières" qui rendent les blocs encore plus denses)
           - Pas de hyphens auto (idem, casse le rythme visuel)
           
           Le plus important : limiter la largeur de colonne (max-width 68ch
           ~ 680px) pour respecter le confort de lecture optimal de 60-75
           caracteres par ligne (regle typographique standard).
        */
        .note-paragraph {
          margin: 0 0 22px 0;
          line-height: 1.78;
          font-size: 15.5px;
          color: #1d1c1a;
          text-align: left;
          hyphens: manual;
          max-width: 68ch;
          letter-spacing: 0.005em;
        }
        .note-paragraph:last-child {
          margin-bottom: 0;
        }
        .note-paragraph.muted {
          opacity: 0.55;
          font-style: italic;
        }
        
        /* PARAGRAPHE LARGE - Pour les zones de fond sombre (recommandation
           finale, résolution dialectique) ou les zones où le paragraphe
           doit s'étendre (encadrés, alertes). */
        .note-paragraph-wide {
          max-width: none;
        }
        
        /* PARAGRAPHE SUR FOND SOMBRE - Le bloc bleu encre de la
           recommandation finale necessite plus d aération encore parce que
           le contraste fort fatigue plus vite l œil. On augmente le leading
           a 1.85 et le margin a 28px pour vraiment respirer. */
        .note-paragraph-dark {
          margin: 0 0 28px 0;
          line-height: 1.85;
          font-size: 15.5px;
          color: #f4ede0;
          text-align: left;
          hyphens: manual;
          max-width: 72ch;
          letter-spacing: 0.005em;
        }
        .note-paragraph-dark:last-child {
          margin-bottom: 0;
        }
        
        /* CHIFFRE-CLÉ - Met en valeur les nombres importants dans la prose
           (montants EUR, ratios, pourcentages, scores). Pas de couleur
           agressive : juste un fond legerement contraste, une typo en
           feature lining-nums pour des chiffres alignes typographiquement,
           et un peu de poids. Le but est que l œil les attrape sans qu ils
           hurlent. */
        .num-key {
          font-feature-settings: "lnum", "tnum";
          font-weight: 600;
          padding: 1px 5px;
          background: rgba(58, 75, 110, 0.08);
          border-radius: 2px;
          white-space: nowrap;
        }
        /* Variante sur fond sombre */
        .note-paragraph-dark .num-key {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
        
        /* ACCROCHE DE PARAGRAPHE - Premiere phrase courte qui donne le
           thesis du paragraphe, en small-caps pour creer une accroche
           visuelle sans tomber dans le bullet point. Style The Atlantic. */
        .lede {
          font-variant-caps: all-small-caps;
          letter-spacing: 0.04em;
          font-weight: 600;
          color: #1d1c1a;
          margin-right: 0.3em;
        }
        .note-paragraph-dark .lede {
          color: #f4ede0;
        }

        /* DROP CAP - Lettrine sur le premier paragraphe qui suit immédiatement
           un H3. Style FT/Economist : capitale grande, alignée sur 3 lignes,
           en serif gras. */
        .note-h3 + .note-paragraph::first-letter {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 52px;
          font-weight: 700;
          line-height: 0.85;
          float: left;
          margin: 6px 10px 0 0;
          color: #1d1c1a;
        }

        /* PULL QUOTES - Phrase clé extraite du flow narratif et mise en
           exergue. Style FT/Economist : grande typo serif italique, guillemets
           typographiques surdimensionnés en gris clair, pas de bordures.
           La typo parle d'elle-même.

           Trois variantes selon le contexte :
           - Defaut : neutre, encre noire
           - .pull-quote-contrarian : accent bleu/vert pour case for
           - .pull-quote-blindspot : accent rouge sourd pour case against */
        .pull-quote {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 22px;
          font-style: italic;
          font-weight: 400;
          line-height: 1.45;
          letter-spacing: -0.005em;
          color: #1d1c1a;
          margin: 32px 40px 32px 40px;
          padding: 8px 0;
          text-align: center;
          position: relative;
          border-top: 1px solid #1d1c1a;
          border-bottom: 1px solid #1d1c1a;
          padding-top: 28px;
          padding-bottom: 28px;
        }
        .pull-quote-mark {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-style: normal;
          font-size: 32px;
          font-weight: 400;
          color: #a8a094;
          margin: 0 6px;
          vertical-align: -4px;
          line-height: 1;
        }
        .pull-quote-cite {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-style: normal;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #6a655d;
          margin-top: 18px;
        }
        .pull-quote-cite::before {
          content: '— ';
        }
        .pull-quote-contrarian {
          color: #2d4a2d;
          border-top-color: #2d4a2d;
          border-bottom-color: #2d4a2d;
        }
        .pull-quote-contrarian .pull-quote-mark {
          color: rgba(45, 74, 45, 0.5);
        }
        .pull-quote-blindspot {
          color: #6b1a1a;
          border-top-color: #6b1a1a;
          border-bottom-color: #6b1a1a;
        }
        .pull-quote-blindspot .pull-quote-mark {
          color: rgba(107, 26, 26, 0.5);
        }
        .pull-quote strong {
          font-style: italic;
          font-weight: 700;
        }

        /* TABLES - Style "data table" éditoriale : pas de bordures externes,
           hairlines internes très fines, label en sans-serif uppercase. */
        .note-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 22px;
          border-top: 1px solid #1d1c1a;
          border-bottom: 1px solid #1d1c1a;
        }
        .note-table td {
          padding: 12px 14px;
          border: none;
          border-bottom: 1px solid #d8d2c5;
          vertical-align: top;
        }
        .note-table tr:last-child td {
          border-bottom: none;
        }
        .note-label {
          width: 30%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 600;
          background: transparent;
          color: #6a655d;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .note-value {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 14px;
          color: #1d1c1a;
          line-height: 1.55;
        }
        .note-value.bold {
          font-weight: 600;
        }

        /* MARKET SIZING - styles dedies au bloc TAM/SAM/SOM.
           Conception : table classique mais avec une mention discrete
           de la source en sous-ligne, et un indicateur de confiance
           type pastille.
           
           Le but est que le lecteur voie d un coup d œil :
             1. Le chiffre (gros, en gras)
             2. Le timeframe (gris, leger)
             3. La source (encore plus discret, en italique)
             4. La confiance (petit point colore) */
        .sizing-confidence {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          line-height: 1;
          vertical-align: middle;
        }
        .sizing-confidence[data-conf="high"]   { color: #2d4a2d; }
        .sizing-confidence[data-conf="medium"] { color: #a8732e; }
        .sizing-confidence[data-conf="low"]    { color: #8b2e1f; }
        
        .sizing-meta {
          color: #6a655d;
          font-size: 12.5px;
          font-weight: 400;
        }
        .sizing-source {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          color: #6a655d;
          font-style: italic;
          margin-top: 3px;
          letter-spacing: 0.01em;
        }
        
        /* PITCH ALIGNMENT - encadre discret qui signale les ecarts
           entre le TAM cite dans le pitch et le TAM verifie web.
           Code couleur :
             overestimated -> ocre attenue (pas alarmiste mais signal clair)
             underestimated -> vert sombre (rare, signal positif)
             pitch-not-cited -> gris ardoise (manque de rigueur founder) */
        .pitch-alignment {
          margin-top: 16px;
          padding: 10px 14px;
          border-left: 3px solid #6a655d;
          background: #f4f0e6;
          font-size: 13px;
          line-height: 1.55;
        }
        .pitch-alignment-overestimated {
          border-left-color: #a8732e;
          background: #f7eedc;
        }
        .pitch-alignment-underestimated {
          border-left-color: #2d4a2d;
          background: #e8f0e8;
        }
        .pitch-alignment-pitch-not-cited {
          border-left-color: #6a655d;
          background: #ede9de;
        }
        .pitch-alignment-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6a655d;
          margin-right: 8px;
        }
        .pitch-alignment-value {
          font-weight: 600;
          color: #1d1c1a;
        }
        .pitch-alignment-note {
          margin-top: 6px;
          color: #1d1c1a;
        }

        /* TABLE FINANCIALS - Tableau à colonnes pour les projections.
           Style FT : header foncé, chiffres alignés à droite, lining numerals,
           hairlines internes seulement. */
        .note-financials-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 22px;
          font-size: 13px;
          border-top: 1px solid #1d1c1a;
          border-bottom: 1px solid #1d1c1a;
        }
        .note-financials-table th, .note-financials-table td {
          padding: 10px 12px;
          border: none;
          border-bottom: 1px solid #d8d2c5;
          text-align: right;
          font-feature-settings: "lnum", "tnum";
        }
        .note-financials-table tr:last-child td {
          border-bottom: none;
        }
        .note-financials-table th {
          background: transparent;
          color: #1d1c1a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-bottom: 1px solid #1d1c1a;
        }
        .note-financials-table .row-label {
          text-align: left;
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6a655d;
          width: 28%;
        }
        .founder-block {
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid #d8d2c5;
        }
        .founder-block:last-child {
          border-bottom: none;
        }
        .founder-header {
          display: flex;
          gap: 10px;
          align-items: baseline;
          margin-bottom: 10px;
        }
        .founder-name {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.005em;
        }
        .founder-role {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          color: #6a655d;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .founder-fit {
          margin-left: auto;
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 13px;
          font-weight: 600;
          padding: 3px 10px;
          background: #1d1c1a;
          color: #fbfaf7;
          letter-spacing: 0.02em;
          font-feature-settings: "lnum";
        }
        /* Variantes pour signaler le degre d'instruction du score :
           non-instruit (donnees absentes) et partiel (donnees fragmentees).
           Ces variantes evitent que le lecteur lise un score plancher
           comme un mauvais profil. */
        .founder-fit-uneval {
          background: #5a564e;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .founder-fit-partial {
          background: #a8732e;
          font-size: 12px;
        }
        /* Le bloc fondateur non-instruit est legerement attenue pour
           signaler visuellement que ce n est pas un profil mauvais
           mais un profil non-instruit. */
        .founder-block-uneval {
          background: #f4f0e6;
          padding: 14px 16px;
          margin-bottom: 22px;
          border-left: 3px solid #5a564e;
        }
        .founder-text {
          font-size: 14px;
          margin-bottom: 6px;
          line-height: 1.65;
          color: #1d1c1a;
        }
        .founder-text strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6a655d;
          margin-right: 6px;
        }

        /* VERDICT BOX - Boîte de récap chiffres clés. Style sobre fond crème
           clair, hairlines fines, typo de chiffres "lining numerals" pour
           alignement vertical parfait. */
        .verdict-box {
          background: #f3efe6;
          border: none;
          padding: 22px 26px;
          margin-bottom: 16px;
          border-top: 1px solid #1d1c1a;
          border-bottom: 1px solid #1d1c1a;
        }
        .verdict-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 8px 0;
          border-bottom: 1px solid rgba(29, 28, 26, 0.1);
        }
        .verdict-line:last-child {
          border-bottom: none;
        }
        .verdict-line:last-child {
          border-bottom: none;
        }
        .verdict-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6a655d;
          font-weight: 500;
        }
        .verdict-value {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 16px;
          font-weight: 600;
          text-transform: capitalize;
          color: #1d1c1a;
          font-feature-settings: "lnum";
        }
        .verdict-value.big {
          font-size: 32px;
          font-weight: 600;
          font-feature-settings: "lnum";
          text-transform: none;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .verdict-line.feature {
          padding: 14px 0;
          align-items: baseline;
        }

        /* Polish 3 : barre de seuils visuelle. Le score s affiche comme une
           position sur l axe REFUSER / APPROFONDIR / CONDITIONS / INVESTIR. */
        .score-thresholds {
          margin: 18px 0 8px;
          padding: 0 4px;
        }
        .score-thresholds-track {
          position: relative;
          display: flex;
          height: 14px;
          margin-bottom: 8px;
          border: 1px solid rgba(0,0,0,0.12);
        }
        .score-thresholds-track .zone {
          height: 100%;
        }
        .zone-refuser {
          background: linear-gradient(90deg, #f8caca 0%, #f8caca 100%);
        }
        .zone-approfondir {
          background: linear-gradient(90deg, #fbf3df 0%, #fbf3df 100%);
        }
        .zone-conditions {
          background: linear-gradient(90deg, #e8efe8 0%, #e8efe8 100%);
        }
        .zone-investir {
          background: linear-gradient(90deg, #cfe5cf 0%, #cfe5cf 100%);
        }
        .score-marker {
          position: absolute;
          top: -4px;
          width: 3px;
          height: 22px;
          background: #1a1a1a;
          transform: translateX(-50%);
          box-shadow: 0 0 0 2px rgba(255,255,255,0.9);
        }
        .score-thresholds-labels {
          display: grid;
          grid-template-columns: 45fr 15fr 15fr 25fr;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
          color: #555;
          margin-bottom: 4px;
        }
        .score-thresholds-labels .lbl {
          text-align: center;
          padding: 0 4px;
        }
        .lbl-refuser { color: #6b1a1a; }
        .lbl-approfondir { color: #6b4d2c; }
        .lbl-conditions { color: #2d4a2d; }
        .lbl-investir { color: #1f3a1f; }
        .score-thresholds-axis {
          position: relative;
          height: 14px;
          font-size: 10px;
          color: #888;
          font-feature-settings: "lnum";
          display: flex;
          justify-content: space-between;
        }

        .risk-list {
          padding-left: 0;
          list-style: none;
          margin-bottom: 22px;
        }
        .risk-list li {
          padding: 16px 20px;
          margin-bottom: 10px;
          background: #f3efe6;
          border-left: 3px solid #1d1c1a;
          font-size: 14px;
          line-height: 1.65;
          color: #1d1c1a;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .risk-list li strong {
          font-weight: 600;
        }

        /* SIGNAL SCORE PILL - Big number stylé pour les patterns/signaux.
           Affichage en serif gras 22px, dans une "pastille" carrée à gauche du li.
           Couleur sourde rouge pour blindspot, vert pour contrarian. */
        .signal-score-pill {
          flex: 0 0 auto;
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          font-feature-settings: "lnum";
          line-height: 1;
          padding: 8px 12px;
          min-width: 56px;
          text-align: center;
          letter-spacing: -0.02em;
          align-self: stretch;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .signal-score-blindspot {
          background: #6b1a1a;
          color: #fbfaf7;
        }
        .signal-score-contrarian {
          background: #2d4a2d;
          color: #fbfaf7;
        }
        .risk-sev {
          display: inline-block;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 9px;
          margin-right: 10px;
          font-weight: 700;
          border-radius: 3px;
          vertical-align: 1px;
        }
        .sev-low {
          background: #e8efe8;
          color: #1f3a1f;
          border: 1px solid #cfd8cf;
        }
        .sev-medium {
          background: #fbf3df;
          color: #5d4216;
          border: 1px solid #ead9b3;
        }
        .sev-high {
          background: #fce0cc;
          color: #6b2f0e;
          border: 1px solid #f0b896;
        }
        .sev-critical {
          background: #f8caca;
          color: #5e0f0f;
          border: 1px solid #e89696;
        }
        .matrix-wrap {
          overflow-x: auto;
          margin-bottom: 12px;
        }
        /* MATRIX - Tableau de positionnement compétitif. Hairlines internes,
           pas de fond noir sur les en-têtes (on garde la légèreté éditoriale). */
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          border-top: 1px solid #1d1c1a;
          border-bottom: 1px solid #1d1c1a;
        }
        .matrix-table th, .matrix-table td {
          padding: 8px 10px;
          border: none;
          border-bottom: 1px solid #d8d2c5;
          border-right: 1px solid #d8d2c5;
          text-align: center;
        }
        .matrix-table th:last-child, .matrix-table td:last-child {
          border-right: none;
        }
        .matrix-table tr:last-child td {
          border-bottom: none;
        }
        .matrix-dim {
          background: transparent;
          color: #1d1c1a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-bottom: 1px solid #1d1c1a !important;
        }
        .matrix-player {
          text-align: left !important;
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #6a655d;
        }
        .matrix-table tr.target .matrix-player {
          background: #1d1c1a;
          color: #fbfaf7;
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: none;
        }
        .matrix-table tr.target td {
          background: #f3efe6;
        }
        .cov-yes { color: #1f3a1f; font-weight: 700; font-size: 14px; }
        .cov-no { color: #6b1a1a; font-size: 14px; }

        /* ALERT BOX - Encart d'alertes critiques. Style "callout" éditorial :
           bordure gauche épaisse rouge sourd, fond crème un peu plus saturé. */
        .alert-box {
          padding: 18px 22px;
          background: #f6e8e0;
          border: none;
          border-left: 4px solid #6b1a1a;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.65;
        }
        .alert-box strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6b1a1a;
          display: block;
          margin-bottom: 8px;
        }
        .alert-box ul {
          margin: 0;
          padding-left: 18px;
          color: #1d1c1a;
        }
        .alert-box ul li {
          margin-bottom: 6px;
        }

        /* ORDERED LIST - Listes numérotées style éditorial. */
        .ordered-list {
          padding-left: 24px;
          margin: 14px 0 22px;
        }
        .ordered-list li {
          margin-bottom: 10px;
          font-size: 14px;
          line-height: 1.65;
          padding-left: 6px;
        }
        .ordered-list li::marker {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-weight: 600;
          color: #6a655d;
        }

        /* BENCHMARK BLOCK - Encarts pour les comparables. Style "sidebar"
           éditorial : fond crème légèrement saturé, hairline gauche, espacement
           généreux.
           Le bloc change de couleur selon cautionLevel pour signaler
           visuellement la nature du comparable cite : reference positive
           (bleu encre), a nuancer (ocre brule), avertissement (rouge anglais).
           Le lecteur sait du premier coup d oeil si on cite un succes ou
           un cas d ecole d echec. */
        .benchmark-block {
          margin-bottom: 18px;
          padding: 16px 20px;
          background: #f3efe6;
          border-left: 3px solid #1d1c1a;
        }
        .benchmark-block.caution-positive {
          background: #f3efe6;
          border-left-color: #1a2e4a;
        }
        .benchmark-block.caution-caveat {
          background: #f3e3c8;
          border-left-color: #a8732e;
        }
        .benchmark-block.caution-tale {
          background: #f4dccf;
          border-left-color: #8b2e1f;
        }
        .benchmark-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .benchmark-name {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.005em;
        }
        .benchmark-geo {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          color: #6a655d;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
        }
        /* Bloc badges sous le header : caution level + statut. Disposes
           horizontalement, tres compact, lecture rapide. */
        .benchmark-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .benchmark-badge {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 8px;
        }
        .benchmark-badge.caution-positive {
          background: #1a2e4a;
          color: #fbfaf7;
        }
        .benchmark-badge.caution-caveat {
          background: #a8732e;
          color: #fbfaf7;
        }
        .benchmark-badge.caution-tale {
          background: #8b2e1f;
          color: #fbfaf7;
        }
        .benchmark-badge.status-confirmed {
          background: #2d4a2e;
          color: #fbfaf7;
        }
        .benchmark-badge.status-promising {
          background: #3a5378;
          color: #fbfaf7;
        }
        .benchmark-badge.status-fragile {
          background: #8a7a3c;
          color: #fbfaf7;
        }
        .benchmark-badge.status-difficulty {
          background: #6b1a1a;
          color: #fbfaf7;
        }
        .benchmark-badge.status-too-early {
          background: #5a564e;
          color: #fbfaf7;
        }
        .benchmark-bet, .benchmark-relevance {
          font-size: 14px;
          margin-bottom: 8px;
          line-height: 1.65;
          color: #1d1c1a;
        }
        .benchmark-bet strong, .benchmark-relevance strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6a655d;
          margin-right: 6px;
        }

        /* ACTION LIST - Liste d'actions du structuring plan. */
        .action-list {
          list-style: none;
          padding-left: 0;
          margin: 8px 0 18px;
        }
        .action-list li {
          padding: 12px 0;
          border-bottom: 1px solid #d8d2c5;
          font-size: 14px;
          line-height: 1.55;
          font-size: 12px;
          line-height: 1.5;
        }
        .action-list li:last-child { border-bottom: none; }
        .action-axis {
          display: inline-block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          background: #1d1c1a;
          color: #fbfaf7;
          padding: 3px 10px;
          margin-right: 12px;
          font-weight: 700;
        }

        /* DATELINE - Date d'analyse stylée comme une dateline d'article presse.
           Format : ● 1 MAI 2026 · NOTE PRELIMINAIRE IC
           Bullet rouge sourd type "live news", date en uppercase letter-spacing
           large, separateur en gris discret. */
        .dd-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-bottom: 26px;
        }
        .dd-meta-bullet {
          color: var(--semantic-critical);
          font-size: 9px;
          line-height: 1;
        }
        .dd-meta-sep {
          color: var(--ink-quaternary);
          font-size: 11px;
          margin: 0 2px;
        }
        .dd-meta-text {
          color: var(--ink-tertiary);
        }

        /* SECTION SOURCES & METHODOLOGY - Documentation des references
           externes consolidees. Style "endnote" classique de publication
           economique. Filet horizontal, typo plus petite, espacement sobre. */
        .note-sources {
          margin-top: 64px;
          padding-top: 32px;
          border-top: 1px solid #1d1c1a;
        }
        .note-sources .note-h4 {
          margin-top: 0;
          margin-bottom: 14px;
        }
        .note-sources-intro {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 13px;
          font-style: italic;
          color: #6a655d;
          line-height: 1.65;
          margin: 0 0 18px 0;
        }
        .note-sources-list {
          list-style: none;
          padding-left: 0;
          margin: 0;
          counter-reset: source;
        }
        .note-sources-list li {
          position: relative;
          padding-left: 32px;
          margin-bottom: 12px;
          font-size: 12px;
          line-height: 1.6;
          counter-increment: source;
        }
        .note-sources-list li::before {
          content: counter(source);
          position: absolute;
          left: 0;
          top: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #fbfaf7;
          background: #1d1c1a;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-feature-settings: "lnum";
        }
        .note-sources-list li strong {
          font-family: 'Iowan Old Style', 'Charter', 'Cambria', Georgia, serif;
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: -0.005em;
        }
        .note-sources-detail {
          color: #555049;
        }

        /* COLOPHON - Footer stylé comme un colophon d'article. Filet horizontal,
           texte centré en sans-serif uppercase, deux lignes courtes. */
        .note-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid rgba(29, 28, 26, 0.4);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-weight: 500;
          color: #6a655d;
          text-align: center;
          line-height: 1.8;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        @media print {
          .investment-note {
            padding: 0;
            max-width: 100%;
            background: #fff;
          }
          .note-section-title {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
