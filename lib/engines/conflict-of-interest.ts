// ============================================================
// CONFLIT D INTERET : detection deterministe avant note
// ------------------------------------------------------------
// Le partner qui ouvre une note d instruction doit lire en haut
// de la note s il existe un conflit d interet structurel entre le
// fonds qui instruit le dossier et le dossier lui-meme. Trois
// situations canoniques :
//
//   1. SELF_DEAL : le fonds qui instruit est cite comme
//      leadInvestor ou co-investor du dossier. Le partner est en
//      train d auto-instruire son propre deal. Cas extreme,
//      detecte des que le nom du fonds apparait dans la cap table
//      annoncee.
//
//   2. PORTFOLIO_FOLLOWON : le dossier est une societe deja en
//      portfolio du fonds, le tour analyse est un follow-on. Pas
//      un conflit au sens strict, mais une distorsion de lecture
//      probable. Le partner connait deja les founders et
//      l historique, le risque de biais positif (sunk cost
//      psychologique) est documente dans la litterature VC.
//
//   3. SYNDICATE_REGULAR : le leadInvestor ou un co-investor est
//      un fonds avec qui le fonds qui instruit syndique
//      regulierement. Le risque est moins severe mais merite la
//      mention pour transparence.
//
// La detection est purement deterministe : on compare des chaines
// normalizees (lowercase, accents aplatis, signaux de forme
// juridique supprimes). Pas d appel LLM, pas de risque
// d hallucination sur un sujet aussi critique pour la gouvernance.
//
// L injection dans la note se fait via buildConflictOfInterestBlock
// qui produit un encart prefixe ALERTE GOUVERNANCE si au moins une
// detection sort, sinon chaine vide.
// ============================================================

import { normalizeFrText } from '../data/text-normalize';
import type { ExtractionOutput } from './types';

export type ConflictKind =
  | 'self-deal'
  | 'portfolio-followon'
  | 'syndicate-regular';

export interface ConflictOfInterestFlag {
  kind: ConflictKind;
  severity: 'high' | 'medium' | 'low';
  /** Identite exacte de l acteur qui declenche le flag, telle qu ecrite dans le dossier. */
  matchedEntity: string;
  /** Phrase prete a etre affichee dans la note d instruction. */
  rationale: string;
}

export interface ConflictOfInterestInputs {
  /** Nom canonique du fonds qui instruit, tel que le partner se reconnaitrait (ex: "Eurazeo", "Tikehau Capital"). */
  fundName: string | null | undefined;
  /** Liste des societes en portfolio du fonds, ecrites comme elles apparaissent dans les communications publiques. */
  portfolioCompanies: string[] | null | undefined;
  /** Liste des co-investisseurs frequents du fonds, capturee soit manuellement soit derivee de l historique. */
  syndicatePartners: string[] | null | undefined;
}

/**
 * Normalise une entite (nom de fonds, nom de societe) en chaine
 * comparable. Supprime les formes juridiques courantes qui
 * polluent la comparison (SAS, SARL, SA, SCA, Capital, Ventures,
 * Partners) tout en preservant la racine identitaire ("Eurazeo
 * Smart City II" -> "eurazeo smart city ii"; on garde ce qui
 * discrimine, on enleve juste l habillage).
 */
function canonicalize(s: string | null | undefined): string {
  if (!s) return '';
  let n = normalizeFrText(s);
  // Suppression des formes juridiques courantes en fin de chaine.
  n = n.replace(/\b(sas|sarl|sa|sca|sci|sl|ltd|gmbh|llc|inc|corp|corporation)\b/g, ' ');
  // Espaces multiples puis trim.
  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Verifie si entityA et entityB partagent une racine identitaire
 * forte. Le premier mot significatif (longueur >= 3) doit etre
 * commun, ce qui couvre les cas "Eurazeo" vs "Eurazeo Smart City
 * Fund II" sans matcher faussement deux fonds dont seul un suffixe
 * juridique se ressemble.
 */
function sharesIdentityRoot(entityA: string, entityB: string): boolean {
  const a = canonicalize(entityA);
  const b = canonicalize(entityB);
  if (!a || !b) return false;
  if (a === b) return true;
  const aRoot = a.split(/\s+/).find((w) => w.length >= 3) ?? '';
  const bRoot = b.split(/\s+/).find((w) => w.length >= 3) ?? '';
  if (!aRoot || !bRoot) return false;
  return aRoot === bRoot;
}

/**
 * Detecte les conflits d interet entre le fonds qui instruit et
 * le dossier en cours d analyse. Retourne un tableau, vide si
 * aucun signal detecte.
 */
export function detectConflictsOfInterest(
  extraction: ExtractionOutput | null | undefined,
  inputs: ConflictOfInterestInputs | null | undefined,
): ConflictOfInterestFlag[] {
  const flags: ConflictOfInterestFlag[] = [];
  if (!extraction || !inputs) return flags;

  const fundName = inputs.fundName ?? '';
  const portfolio = inputs.portfolioCompanies ?? [];
  const syndicate = inputs.syndicatePartners ?? [];

  const leadInvestor = extraction.fundraise?.leadInvestor ?? '';
  const coInvestors = extraction.fundraise?.coInvestors ?? [];
  const allInvestors = [leadInvestor, ...coInvestors].filter((s) => s && s.trim().length > 0);

  // 1. SELF_DEAL : le fonds qui instruit est lui-meme dans la cap table annoncee.
  if (fundName) {
    for (const inv of allInvestors) {
      if (sharesIdentityRoot(inv, fundName)) {
        flags.push({
          kind: 'self-deal',
          severity: 'high',
          matchedEntity: inv,
          rationale: `Le fonds ${fundName} apparait comme investisseur du tour (${inv}). Le partner qui ouvre cette note auto-instruit son propre deal. Toute lecture du dossier doit prendre en compte cet alignement direct d interet.`,
        });
      }
    }
  }

  // 2. PORTFOLIO_FOLLOWON : la societe analysee est deja en portfolio du fonds.
  const companyName = extraction.companyName ?? '';
  if (companyName && portfolio.length > 0) {
    for (const p of portfolio) {
      if (sharesIdentityRoot(companyName, p)) {
        flags.push({
          kind: 'portfolio-followon',
          severity: 'medium',
          matchedEntity: p,
          rationale: `${companyName} figure deja au portfolio du fonds (entree ${p}). Le tour analyse est un follow-on. Risque structurel de biais positif lie a l historique connu des founders et a la pression de defendre l investissement initial.`,
        });
        break; // un seul flag follow-on suffit
      }
    }
  }

  // 3. SYNDICATE_REGULAR : un co-investor du dossier est un partenaire syndicat regulier.
  if (syndicate.length > 0) {
    const seen = new Set<string>();
    for (const inv of allInvestors) {
      for (const partner of syndicate) {
        if (sharesIdentityRoot(inv, partner) && !seen.has(canonicalize(inv))) {
          flags.push({
            kind: 'syndicate-regular',
            severity: 'low',
            matchedEntity: inv,
            rationale: `${inv} est un co-investisseur regulier du fonds. La proximite ne disqualifie pas le dossier mais le partner doit savoir que la decision n est pas independante des relations de syndication etablies.`,
          });
          seen.add(canonicalize(inv));
        }
      }
    }
  }

  return flags;
}

/**
 * Construit le bloc texte injecte en tete du userPrompt de
 * l orchestrateur quand au moins un conflit est detecte. Retourne
 * la chaine vide si pas de conflit, pour rester transparent dans
 * le flow majoritaire.
 */
export function buildConflictOfInterestBlock(flags: ConflictOfInterestFlag[]): string {
  if (!flags || flags.length === 0) return '';
  const byKind: Record<ConflictKind, ConflictOfInterestFlag[]> = {
    'self-deal': [],
    'portfolio-followon': [],
    'syndicate-regular': [],
  };
  for (const f of flags) byKind[f.kind].push(f);

  const lines: string[] = [];
  lines.push('# ALERTE GOUVERNANCE · CONFLITS D INTERET DETECTES');
  lines.push('');
  if (byKind['self-deal'].length > 0) {
    lines.push('## Self-deal (severite haute)');
    for (const f of byKind['self-deal']) lines.push(`- ${f.rationale}`);
    lines.push('');
  }
  if (byKind['portfolio-followon'].length > 0) {
    lines.push('## Follow-on portfolio (severite moyenne)');
    for (const f of byKind['portfolio-followon']) lines.push(`- ${f.rationale}`);
    lines.push('');
  }
  if (byKind['syndicate-regular'].length > 0) {
    lines.push('## Syndicate regular (severite faible)');
    for (const f of byKind['syndicate-regular']) lines.push(`- ${f.rationale}`);
    lines.push('');
  }
  lines.push('Ces alertes ne disqualifient pas mecaniquement le dossier. Elles signalent que la lecture du partner doit etre filtree par la conscience de la position d interet du fonds.');
  lines.push('');
  return lines.join('\n');
}
