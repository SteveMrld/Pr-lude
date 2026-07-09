// ============================================================
// NoteSynthesisHeader — tete de note d instruction Prelude
// ------------------------------------------------------------
// Piece structurante de la note. Ce qu un partner voit en dix
// secondes a l ouverture d un dossier : cartouche identite,
// verdict et score sur jauge editoriale, fourchette de
// valorisation, trois forces majeures et trois signaux de
// vigilance, mise en recit synthetique. Le tout dans la ligne
// editoriale Prelude : papier creme, encre profonde, accents
// ocre brule (approfondir) et vert foret (investir), typographie
// serif Charter facon revue.
//
// Aucun message d erreur technique ne fuite au partner. Quand
// l orchestrateur LLM final n a pas pu produire la mise en recit
// (mode degraded, cf refonte fallback orchestrate briques 1/2/3),
// on remplace l argumentation par un bandeau neutre "mode
// restreint" qui explique en francais editorial ce qui manque
// et suggere de relancer. Aucune trace de "529", "Anthropic",
// "orchestrate" ni "surcharge LLM" dans le rendu partner.
//
// Les forces et les risques sont extraits automatiquement des
// moteurs disponibles dans le resultJson : green flags equipe,
// signaux contrariens forts, intensites marche pour les forces ;
// patterns blindspot haute intensite, alertes critiques,
// patterns fragilite structurelle pour la vigilance.
// ============================================================

import React from 'react';
import { splitIntoParagraphs, enrichProse } from '@/lib/note-typography';

// ============================================================
// TYPES SUCCINCTS
// ------------------------------------------------------------
// Le composant lit un resultJson tres large et essentiellement
// non-type dans HomeClient. On declare ici uniquement la forme
// minimale utilisee, pour garder les acces defensifs.
// ============================================================

interface NoteSynthesisHeaderProps {
  result: any;
}

interface Highlight {
  title: string;
  body: string;
}

const VERDICT_LABELS: Record<string, string> = {
  'investir': 'Investir',
  'investir avec conditions': 'Investir avec conditions',
  'approfondir': 'Approfondir',
  'refuser': 'Refuser',
};

// Slug de verdict pour piloter les classes CSS d accent couleur.
// Regroupe conditions et investir sur la meme famille verte, refuser
// et approfondir sur la famille ocre, avec des intensites distinctes.
function verdictSlug(v: string): 'refuser' | 'approfondir' | 'conditions' | 'investir' | 'neutre' {
  const s = (v || '').toLowerCase().trim();
  if (s === 'investir') return 'investir';
  if (s.includes('conditions')) return 'conditions';
  if (s === 'approfondir') return 'approfondir';
  if (s === 'refuser') return 'refuser';
  return 'neutre';
}

// Confidence de valorisation traduite en francais editorial.
function formatConfidence(c: string | undefined): string {
  if (c === 'high') return 'eleve';
  if (c === 'medium') return 'moyen';
  if (c === 'low') return 'faible';
  return 'non renseigne';
}

// Formatage montant euros compact pour les libelles de valorisation.
// Passe en M€ au-dela d un million, en k€ en dessous. Retourne
// une chaine courte adaptee a un libelle graphique.
function formatEurCompact(n: number | null | undefined): string {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 100 ? `${Math.round(m)} M€` : `${m.toFixed(m >= 10 ? 0 : 1)} M€`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${n} €`;
}

// Compose la ligne "Series A · 8 M€" depuis l extraction. Retourne
// une chaine vide si aucun element pertinent, ce qui masque la ligne.
function formatRoundLine(extraction: any): string {
  const stage = extraction?.fundraise?.stage;
  const amount = extraction?.fundraise?.amount;
  const parts: string[] = [];
  if (typeof stage === 'string' && stage.trim()) parts.push(stage.trim());
  if (typeof amount === 'string' && amount.trim()) parts.push(amount.trim());
  return parts.join(' · ');
}

// Compose la ligne de contexte secteur / geographie discrete au-dessus
// du nom de la societe. Filtre les segments vides pour eviter les
// tirets orphelins.
function formatContextLine(extraction: any): string {
  const parts: string[] = [];
  const sector = typeof extraction?.sector === 'string' ? extraction.sector.trim() : '';
  const subSector = typeof extraction?.subSector === 'string' ? extraction.subSector.trim() : '';
  const country = typeof extraction?.country === 'string' ? extraction.country.trim() : '';
  if (sector) parts.push(sector);
  if (subSector && subSector.toLowerCase() !== sector.toLowerCase()) parts.push(subSector);
  if (country) parts.push(country);
  return parts.join(' · ');
}

// ============================================================
// EXTRACTION FORCES ET RISQUES
// ------------------------------------------------------------
// Pertinence editoriale du header : ce qu on remonte ici doit
// tenir sur trois lignes chacun. On priorise par intensite/score
// et on tronque les evidences a environ 180 chars pour garder
// la respiration. Le vrai detail reste dans les sections
// analytiques de la note plus bas.
// ============================================================

function truncateEvidence(s: string, max: number = 180): string {
  if (!s) return '';
  const cleaned = s.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut) + '…';
}

function extractTopForces(result: any, max: number = 3): Highlight[] {
  const forces: Array<Highlight & { weight: number }> = [];

  // 1. Signaux contrariens detectes avec haute force (>= 60). Ce sont
  // les singularites qui justifient l investissement, prioritaires en
  // tete de note parce que ce sont exactement les elements
  // differenciants qu un partner cherche a valider.
  const signals = result?.contrarianAnalysis?.signals || {};
  for (const sig of Object.values(signals) as any[]) {
    if (sig?.detected && (sig.strength || 0) >= 60) {
      forces.push({
        title: sig.signalName || 'Signal contrarien',
        body: truncateEvidence(sig.evidence || sig.rationale || ''),
        weight: 100 + (sig.strength || 0),
      });
    }
  }

  // 2. Green flags de l equipe fondatrice. Sont deja des phrases
  // courtes et pretes a citer, on prend les premiers dans l ordre
  // produit par le moteur team-engine (qui a deja hierarchise).
  const greenFlags = Array.isArray(result?.team?.greenFlags) ? result.team.greenFlags : [];
  for (const gf of greenFlags.slice(0, 3)) {
    if (typeof gf === 'string' && gf.trim()) {
      forces.push({
        title: 'Force equipe',
        body: truncateEvidence(gf),
        weight: 80,
      });
    }
  }

  // 3. Dimensions marche fortes : intensite besoin, defensibilite,
  // signaux organiques quand >= 70. On n embarque que la meilleure
  // pour eviter de saturer la colonne forces sur un dossier marche
  // solide mais equipe/contrarien faible.
  const market = result?.market;
  if (market) {
    const marketCandidates: Array<{ label: string; score: number; rationale: string }> = [
      {
        label: 'Intensite du besoin',
        score: market?.needIntensity?.score || 0,
        rationale: market?.needIntensity?.rationale || '',
      },
      {
        label: 'Defensibilite',
        score: market?.defensibility?.score || 0,
        rationale: market?.defensibility?.rationale || '',
      },
      {
        label: 'Signaux organiques',
        score: market?.organicSignals?.score || 0,
        rationale: market?.organicSignals?.rationale || '',
      },
    ];
    const bestMarket = marketCandidates
      .filter((c) => c.score >= 70)
      .sort((a, b) => b.score - a.score)[0];
    if (bestMarket) {
      forces.push({
        title: bestMarket.label,
        body: truncateEvidence(bestMarket.rationale),
        weight: 60 + bestMarket.score / 10,
      });
    }
  }

  return forces
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map(({ title, body }) => ({ title, body }));
}

function extractTopRisks(result: any, max: number = 3): Highlight[] {
  const risks: Array<Highlight & { weight: number }> = [];

  // 1. Patterns d aveuglement haute intensite (>= 60). Deja
  // hierarchises par le moteur blindspot avec evidence et intensity
  // structurees. Priorite absolue en vigilance car ce sont des
  // signaux calibres sur des cas historiques.
  const patterns = result?.blindspotAnalysis?.patterns || {};
  for (const p of Object.values(patterns) as any[]) {
    if (p?.detected && (p.intensity || 0) >= 60) {
      risks.push({
        title: p.patternName || 'Pattern a risque',
        body: truncateEvidence(p.evidence || ''),
        weight: 100 + (p.intensity || 0),
      });
    }
  }

  // 2. Patterns de fragilite structurelle (Phase 4) declenches
  // sur ce dossier, s ils sont disponibles. Prend les rationales
  // top prioritaires qui expliquent l activation.
  const fs = result?.fragiliteStructurelle;
  if (fs?.patterns) {
    const fsPatterns = Object.values(fs.patterns) as any[];
    for (const fp of fsPatterns) {
      if (fp?.applicable && (fp.severity || 0) >= 60) {
        risks.push({
          title: fp.patternName || 'Fragilite structurelle',
          body: truncateEvidence(fp.rationale || fp.evidence || ''),
          weight: 90 + (fp.severity || 0) / 2,
        });
      }
    }
  }

  // 3. Alertes critiques brutes du moteur blindspot si on n a pas
  // rempli les trois slots. Ces alertes sont des chaines courtes
  // deja pretes a citer.
  const alertes = Array.isArray(result?.blindspotAnalysis?.alertesCritiques)
    ? result.blindspotAnalysis.alertesCritiques
    : [];
  for (const a of alertes) {
    if (typeof a === 'string' && a.trim()) {
      risks.push({
        title: 'Alerte critique',
        body: truncateEvidence(a),
        weight: 70,
      });
    }
  }

  return risks
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map(({ title, body }) => ({ title, body }));
}

// ============================================================
// JAUGE DE SCORE : SVG editorial sur la palette Prelude.
// Quatre zones colorees selon les seuils du score-calculator
// (0-45 refuser, 45-59 approfondir, 60-74 conditions, 75-100
// investir), curseur d encre profonde sur le score courant,
// labels des seuils en filet fin.
// ============================================================

interface ScoreGaugeProps {
  score: number | null;
}

function ScoreGauge({ score }: ScoreGaugeProps) {
  const clamped = typeof score === 'number' && isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;

  const width = 480;
  const barHeight = 22;
  const paddingY = 24;
  const totalHeight = paddingY + barHeight + 32;
  const thresholds = [45, 60, 75];

  // Segments et couleurs : lavis pale par zone dans la palette Prelude.
  // Les couleurs sont pensees pour un fond papier creme et un rendu PDF
  // sobre. Le vert et l ocre s intensifient a mesure qu on approche du
  // verdict positif ou de la zone de conditions.
  const segments = [
    { from: 0, to: 45, fill: '#efe8db' },   // refuser : gris chaud tres pale
    { from: 45, to: 60, fill: '#f2d9b5' },  // approfondir : lavis ocre pale
    { from: 60, to: 75, fill: '#dfe4d0' },  // conditions : lavis vert tres pale
    { from: 75, to: 100, fill: '#b8ccae' }, // investir : vert foret pale
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${totalHeight}`}
      width="100%"
      height="auto"
      preserveAspectRatio="none"
      aria-label={clamped != null ? `Score global ${clamped} sur 100` : 'Score global non calcule'}
      role="img"
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      {/* Segments colores par zone de verdict. */}
      {segments.map((seg, i) => (
        <rect
          key={i}
          x={(seg.from / 100) * width}
          y={paddingY}
          width={((seg.to - seg.from) / 100) * width}
          height={barHeight}
          fill={seg.fill}
        />
      ))}
      {/* Filet fin autour de la jauge pour ancrer l objet. */}
      <rect
        x={0}
        y={paddingY}
        width={width}
        height={barHeight}
        fill="none"
        stroke="#e7e0d2"
        strokeWidth={1}
      />
      {/* Seuils sous forme de tirets verticaux fins. */}
      {thresholds.map((t) => (
        <g key={t}>
          <line
            x1={(t / 100) * width}
            y1={paddingY - 6}
            x2={(t / 100) * width}
            y2={paddingY + barHeight + 6}
            stroke="#14110d"
            strokeWidth={0.75}
            strokeDasharray="2 2"
            opacity={0.55}
          />
          <text
            x={(t / 100) * width}
            y={paddingY + barHeight + 20}
            fontSize={11}
            fontFamily="var(--sans)"
            fill="#14110d"
            opacity={0.6}
            textAnchor="middle"
          >
            {t}
          </text>
        </g>
      ))}
      {/* Curseur sur le score courant, uniquement si score calcule. */}
      {clamped != null && (
        <g>
          <line
            x1={(clamped / 100) * width}
            y1={paddingY - 8}
            x2={(clamped / 100) * width}
            y2={paddingY + barHeight + 8}
            stroke="#14110d"
            strokeWidth={2}
          />
          <circle
            cx={(clamped / 100) * width}
            cy={paddingY + barHeight / 2}
            r={5}
            fill="#14110d"
          />
        </g>
      )}
    </svg>
  );
}

// ============================================================
// BAR DE VALORISATION : trois traits verticaux (min, central, max)
// alignes sur une regle horizontale fine. Le central est domine
// avec son libelle en gras, min et max en filet fin. Signature
// visuelle sobre qui donne la fourchette en un coup d oeil sans
// occuper toute la largeur de la synthese.
// ============================================================

interface ValuationBarProps {
  min: number;
  central: number;
  max: number;
}

function ValuationBar({ min, central, max }: ValuationBarProps) {
  const width = 480;
  const height = 68;
  const barY = 28;
  const pad = 32;
  const usable = width - 2 * pad;

  const xFor = (v: number) => pad + ((v - min) / (max - min || 1)) * usable;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      preserveAspectRatio="none"
      aria-label={`Valorisation pre-money entre ${formatEurCompact(min)} et ${formatEurCompact(max)} avec central ${formatEurCompact(central)}`}
      role="img"
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      {/* Regle horizontale fine. */}
      <line
        x1={pad}
        y1={barY}
        x2={width - pad}
        y2={barY}
        stroke="#14110d"
        strokeWidth={1}
        opacity={0.35}
      />
      {/* Trait min. */}
      <g>
        <line
          x1={xFor(min)}
          y1={barY - 8}
          x2={xFor(min)}
          y2={barY + 8}
          stroke="#14110d"
          strokeWidth={1}
          opacity={0.6}
        />
        <text
          x={xFor(min)}
          y={barY - 12}
          fontSize={11}
          fontFamily="var(--sans)"
          fill="#14110d"
          opacity={0.7}
          textAnchor="middle"
        >
          {formatEurCompact(min)}
        </text>
      </g>
      {/* Trait central plus fort, avec libelle. */}
      <g>
        <line
          x1={xFor(central)}
          y1={barY - 14}
          x2={xFor(central)}
          y2={barY + 14}
          stroke="#14110d"
          strokeWidth={2}
        />
        <circle cx={xFor(central)} cy={barY} r={4} fill="#14110d" />
        <text
          x={xFor(central)}
          y={barY + 30}
          fontSize={14}
          fontFamily="var(--serif)"
          fill="#14110d"
          fontWeight={500}
          textAnchor="middle"
        >
          {formatEurCompact(central)}
        </text>
      </g>
      {/* Trait max. */}
      <g>
        <line
          x1={xFor(max)}
          y1={barY - 8}
          x2={xFor(max)}
          y2={barY + 8}
          stroke="#14110d"
          strokeWidth={1}
          opacity={0.6}
        />
        <text
          x={xFor(max)}
          y={barY - 12}
          fontSize={11}
          fontFamily="var(--sans)"
          fill="#14110d"
          opacity={0.7}
          textAnchor="middle"
        >
          {formatEurCompact(max)}
        </text>
      </g>
    </svg>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export function NoteSynthesisHeader({ result }: NoteSynthesisHeaderProps) {
  const reco = result?.finalRecommendation || {};
  const extraction = result?.extraction || {};
  const mech = result?.mechanicalScore || {};
  const valuation = result?.valuation || {};

  // Score et verdict avec fallback mecanique cf brique 2 fix
  // orchestrate. On lit prioritairement finalRecommendation, sinon
  // le score mecanique. Cela garantit que meme un run dont
  // l orchestrateur a echoue affiche un score et un verdict
  // veridiques, pas un ecran vide ni un "A Reinstruire" invente.
  const globalScore =
    typeof reco.globalScore === 'number' && isFinite(reco.globalScore)
      ? reco.globalScore
      : typeof mech.globalScore === 'number' && isFinite(mech.globalScore)
        ? mech.globalScore
        : null;

  const rawVerdict =
    (typeof reco.verdict === 'string' && reco.verdict) ||
    (typeof mech.verdict === 'string' && mech.verdict) ||
    'approfondir';

  const degraded = reco.degraded === true;
  const slug = verdictSlug(rawVerdict);
  const verdictLabel =
    VERDICT_LABELS[rawVerdict.toLowerCase().trim()] ||
    rawVerdict.charAt(0).toUpperCase() + rawVerdict.slice(1);

  const contextLine = formatContextLine(extraction);
  const roundLine = formatRoundLine(extraction);
  const companyName = extraction.companyName || 'Dossier sans nom';

  const forces = extractTopForces(result, 3);
  const risks = extractTopRisks(result, 3);

  const valuationRange = valuation?.recommendedRange;
  const valuationConfidence = valuation?.confidence;

  // Argumentation : masquee entierement en mode degrade pour ne
  // pas exposer au partner les mentions techniques (529, Anthropic,
  // orchestrate, LLM). Le bandeau neutre en aval prend le relais
  // avec une formulation editoriale.
  const argumentation =
    !degraded && typeof reco.argumentation === 'string' && reco.argumentation.trim()
      ? reco.argumentation
      : null;

  return (
    <article className="note-syn">
      {/* A. CARTOUCHE IDENTITE */}
      <header className="note-syn-id">
        {contextLine && (
          <div className="note-syn-context">{contextLine}</div>
        )}
        <h1 className="note-syn-company">{companyName}</h1>
        {roundLine && (
          <div className="note-syn-round">{roundLine}</div>
        )}
      </header>

      <hr className="note-syn-rule" />

      {/* B. VERDICT ET SCORE */}
      <section className="note-syn-verdict-block">
        <div className="note-syn-verdict-side">
          <div className="note-syn-eyebrow">Verdict</div>
          <div className={`note-syn-verdict verdict-${slug}`}>
            {verdictLabel}
          </div>
        </div>
        <div className="note-syn-gauge-side">
          <div className="note-syn-eyebrow">Score global · seuils de decision</div>
          <ScoreGauge score={globalScore} />
          <div className="note-syn-score-num">
            {globalScore != null ? globalScore : '—'}
            <span className="note-syn-score-slash">/100</span>
          </div>
        </div>
      </section>

      {/* C. VALORISATION */}
      {valuationRange && typeof valuationRange.central === 'number' && (
        <section className="note-syn-valuation">
          <div className="note-syn-eyebrow">
            Valorisation pre-money · fiabilite {formatConfidence(valuationConfidence)}
          </div>
          <ValuationBar
            min={valuationRange.min}
            central={valuationRange.central}
            max={valuationRange.max}
          />
        </section>
      )}

      {/* D. FORCES / VIGILANCE */}
      <section className="note-syn-forces-risks">
        <div className="note-syn-col note-syn-col-forces">
          <div className="note-syn-eyebrow forces-eyebrow">Forces</div>
          {forces.length === 0 ? (
            <div className="note-syn-empty">
              Aucune force marquante remontee par les moteurs pour ce dossier.
            </div>
          ) : (
            <ul className="note-syn-list">
              {forces.map((f, i) => (
                <li key={i}>
                  <div className="note-syn-item-title">{f.title}</div>
                  {f.body && <div className="note-syn-item-body">{f.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="note-syn-col note-syn-col-risks">
          <div className="note-syn-eyebrow risks-eyebrow">Vigilance</div>
          {risks.length === 0 ? (
            <div className="note-syn-empty">
              Aucun signal de vigilance critique remonte par les moteurs pour ce dossier.
            </div>
          ) : (
            <ul className="note-syn-list">
              {risks.map((r, i) => (
                <li key={i}>
                  <div className="note-syn-item-title">{r.title}</div>
                  {r.body && <div className="note-syn-item-body">{r.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* E. ARGUMENTATION (uniquement en mode nominal) */}
      {argumentation && (
        <section className="note-syn-prose">
          {splitIntoParagraphs(argumentation, 3).map((p, i) => (
            <p key={i}>{enrichProse(p)}</p>
          ))}
        </section>
      )}

      {/* F. BANDEAU MODE RESTREINT (uniquement en mode degrade) */}
      {degraded && (
        <aside className="note-syn-degraded">
          <div className="note-syn-eyebrow degraded-eyebrow">
            Note completee en mode restreint
          </div>
          <p>
            Le score et le verdict affiches ci-dessus sont ceux calcules mecaniquement
            a partir des seize moteurs d analyse qui ont abouti, selon la formule et
            les ponderations documentees dans le score calculator. Ils sont veridiques
            et opposables.
          </p>
          <p>
            La mise en recit finale — retournement causal, resolution dialectique
            entre vigilance et singularite, decision drivers et plan de chantiers —
            n a pas ete produite pour cette instance. Relancer l analyse sur ce
            dossier pour obtenir la note complete.
          </p>
        </aside>
      )}
    </article>
  );
}
