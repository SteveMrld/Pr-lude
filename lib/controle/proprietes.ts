// ============================================================
// CATALOGUE DES PROPRIETES D UNE NOTE
// ------------------------------------------------------------
// Ce qu une note doit respecter, ecrit comme une donnee evaluable sur
// n importe quelle note persistee.
//
// POURQUOI CE FICHIER
//
// Trois outils existaient pour eprouver le pipeline hors production, et
// le diagnostic du 5 aout 2026 est qu aucun ne porte d assertion.
// `engine-stability` mesure une dispersion et rend un tableau.
// `replay-partial` reconstitue une note et rend un JSON. Les fixtures
// decrivent des attentes de calibration. Les trois demandent une lecture
// humaine pour conclure, donc aucun ne s accumule : un dispositif qu il
// faut lire depense l attention qu il devait economiser.
//
// Une propriete, elle, rend un verdict. Elle s ecrit une fois et se
// paie une fois. Surtout, elle s evalue retroactivement sur les
// cinquante-deux notes deja persistees : un defaut cesse d etre une
// observation faite sur une note et devient un taux mesure sur toutes.
// C est le seul changement qui deplace le rendement de l attention, et
// il coute cent soixante-seize millisecondes.
//
// TROIS EXIGENCES, ET LA DEUXIEME EST CELLE QU ON OUBLIE
//
// Toute propriete porte son origine, c est-a-dire le defaut constate
// dont elle est nee. Une propriete sans defaut d origine est une
// intuition, et une intuition qui rougit fait perdre plus de temps
// qu elle n en fait gagner.
//
// Toute propriete porte son taux de faux positifs, mesure sur le corpus
// AVANT son entree ici. La sonde du 5 aout en donne le cas type : la
// propriete « la recommandation cite au moins un driver » rendait dix
// violations sur cinquante, soit vingt pour cent, dont neuf etaient le
// repli degrade fonctionnant exactement comme prevu. Elle mesurait un
// chemin en croyant mesurer une qualite. La version qui entre ici porte
// la clause qui manquait et le releve de ce qu elle a coute.
//
// Toute propriete declare sa famille, parce que ce qu une violation
// prouve depend de ce qu elle lit. Une propriete de structure lit une
// sortie deterministe : sur une note reassemblee, elle mesure le code
// d aujourd hui. Une propriete de prose lit du texte produit par le
// modele : elle mesure le code du jour ou le run a eu lieu, et son taux
// ne veut rien dire hors du segment de version ou il a ete releve. Les
// confondre ferait mesurer l etat des notes anciennes en croyant
// mesurer le produit.
// ============================================================

import { tagRevendiqueUneLectureExterne } from '../engines/assertion-validator';

/**
 * Ce que lit la propriete, et donc ce que sa violation prouve.
 *
 *   structure       : sorties deterministes. Un rejeu les recalcule,
 *                     donc la violation porte sur le code actuel.
 *   prose           : texte produit par le modele. La violation porte
 *                     sur le code du run, jamais sur celui d aujourd hui.
 *   instrumentation : ce que le run a depose sur lui-meme. La violation
 *                     porte sur la couche de persistance.
 */
export type Famille = 'structure' | 'prose' | 'instrumentation';

export interface Constat {
  /** Ou, dans la note, avec de quoi le retrouver. */
  ou: string;
  /** Extrait court, pour que le constat se verifie sans rouvrir la note. */
  extrait: string;
}

export interface Propriete {
  id: string;
  /** L enonce en positif : ce que la note doit respecter. */
  enonce: string;
  famille: Famille;
  /** Sections du result_json lues. Verrouille la famille par un test. */
  lit: string[];
  /** Le defaut constate dont la propriete est nee, date. */
  origine: string;
  /**
   * Ce que la mesure sur le corpus a rendu avant l entree de la
   * propriete, faux positifs compris et nommes. Champ obligatoire :
   * une propriete qui n a pas ete eprouvee n entre pas.
   */
  eprouvee: string;
  /** Vrai quand la note porte de quoi evaluer. */
  porte(note: any): boolean;
  /** Les constats. Tableau vide quand la note respecte l enonce. */
  constats(note: any): Constat[];
}

// ------------------------------------------------------------
// Lectures partagees
// ------------------------------------------------------------

/** Toutes les chaines assez longues pour porter une phrase. */
function chainesDe(noeud: unknown, acc: string[] = []): string[] {
  if (typeof noeud === 'string') {
    if (noeud.length >= 40) acc.push(noeud);
    return acc;
  }
  if (Array.isArray(noeud)) { for (const n of noeud) chainesDe(n, acc); return acc; }
  if (noeud && typeof noeud === 'object') {
    for (const v of Object.values(noeud as Record<string, unknown>)) chainesDe(v, acc);
  }
  return acc;
}

/** Les groupes de crochets d un texte, a toutes les profondeurs. */
function tagsDe(text: string): string[] {
  const g: string[] = [];
  const pile: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') { pile.push(i); continue; }
    if (text[i] === ']' && pile.length > 0) g.push(text.slice(pile.pop()!, i + 1));
  }
  return g;
}

function borne(constats: Constat[], max = 5): Constat[] {
  if (constats.length <= max) return constats;
  return [
    ...constats.slice(0, max),
    { ou: '(suite)', extrait: `${constats.length - max} constat(s) de plus, non listes` },
  ];
}

// ------------------------------------------------------------
// Le catalogue
// ------------------------------------------------------------

export const PROPRIETES: Propriete[] = [
  {
    id: 'revendication-adossee-a-une-capture',
    enonce: 'Toute revendication de lecture exterieure au dossier est adossee a une page reellement atteinte.',
    famille: 'prose',
    lit: ['team', 'market', 'macro', 'financialCoherence', 'contrarianAnalysis', 'blindspotAnalysis', 'meta.sourceCapture'],
    origine:
      '5 aout 2026. La plateforme rendait les pages atteintes a cote de la prose et callClaude les jetait au retour. '
      + 'Ce qui tenait lieu de tracabilite etait un tag ecrit de memoire par le modele, sur instruction du prompt.',
    eprouvee:
      'Mesuree sur cinquante notes le 5 aout : quarante-neuf en defaut, aucune ne portant de capture. La cinquantieme, '
      + 'TOLSON du 12 juillet, est une note complete de deux cent soixante-dix-sept passages de prose qui ne revendique '
      + 'aucune lecture exterieure : elle passe a bon droit, ce qui etablit que la propriete ne rougit pas par defaut. '
      + 'Aucun faux positif dans ce sens : une note sans capture qui revendique une lecture ne peut pas l etayer. Le sens '
      + 'inverse, une capture pleine qui ne prouve pas que CETTE assertion en vient, n est pas couvert et ne pretend pas '
      + 'l etre.',
    porte: (n) => !!n?.extraction,
    constats: (n) => {
      const capturees = Number(n?.meta?.sourceCapture?.pages ?? 0);
      if (capturees > 0) return [];
      const vus = new Set<string>();
      const constats: Constat[] = [];
      for (const s of chainesDe(n)) {
        for (const t of tagsDe(s)) {
          if (!tagRevendiqueUneLectureExterne(t)) continue;
          const clef = t.toLowerCase();
          if (vus.has(clef)) continue;
          vus.add(clef);
          const i = s.indexOf(t);
          constats.push({ ou: t, extrait: s.slice(Math.max(0, i - 90), i + t.length).trim() });
        }
      }
      return borne(constats);
    },
  },

  {
    id: 'statuts-moteurs-persistes',
    enonce: 'Le releve par moteur du run est persiste, pour qu un rejeu distingue un moteur tombe d un moteur sans objet.',
    famille: 'instrumentation',
    lit: ['meta.engineStatuses'],
    origine:
      '5 aout 2026. enginesRecorder.snapshot() etait calcule et passe a computeMechanicalScore, et persiste dans zero '
      + 'run sur cinquante-deux. Tout rejeu retombait sur la branche prevue pour les runs anterieurs a l instrumentation, '
      + 'qui recalcule la disponibilite sur les racines et perd la distinction entre incident et absence.',
    eprouvee:
      'Mesuree sur cinquante-deux notes le 5 aout : cinquante-deux violations, aucun faux positif possible, le champ '
      + 'est present ou il ne l est pas. Le taux tombera a zero sur les runs posterieurs au correctif ; il reste a cent '
      + 'pour cent sur les anterieurs, et c est ce que la segmentation par version doit montrer.',
    porte: (n) => !!n?.meta,
    constats: (n) => n?.meta?.engineStatuses
      ? []
      : [{ ou: 'meta.engineStatuses', extrait: 'absent : le rejeu ne peut pas distinguer un incident d une absence' }],
  },

  {
    id: 'cout-du-run-exact',
    enonce: 'Le registre d appels porte les tokens de cache, sans lesquels le cout du run est encadre au lieu d etre exact.',
    famille: 'instrumentation',
    lit: ['meta.llmLedger'],
    origine:
      '5 aout 2026. Le registre ne relevait que input_tokens, qui exclut le cache. Le PDF du dossier passe par le cache '
      + 'sur quatre appels, et un memorandum de cent vingt-deux pages pese deux cent trente-six mille tokens.',
    eprouvee:
      'Mesuree sur les sept notes portant un registre le 5 aout : sept violations. Le registre rendait 1,62 dollar par '
      + 'run Woodpecker quand le cout reel se situe entre trois et quatre dollars et demi. Aucun faux positif possible.',
    porte: (n) => !!n?.meta?.llmLedger,
    constats: (n) => typeof n?.meta?.llmLedger?.totalCacheWriteTokens === 'number'
      ? []
      : [{
        ou: 'meta.llmLedger',
        extrait: `${n?.meta?.llmLedger?.totalCalls ?? '?'} appels releves sans les tokens de cache : le cout rendu est partiel`,
      }],
  },

  {
    id: 'classe-actif-resolue',
    enonce: 'La matrice de pertinence resout une classe d actif.',
    famille: 'structure',
    lit: ['relevanceMatrix'],
    origine:
      '3 aout 2026, arbitrage de classe d actif. Une classe non resolue fait tomber la valorisation sur des multiples '
      + 'generiques et retire au dossier la fourchette qui fonde le prix.',
    eprouvee:
      'Mesuree sur cinquante notes le 5 aout : deux violations, les deux sur Project Chamois. Verification faite, la '
      + 'classe y est bien unclassified et la fourchette de valorisation y est absente. Zero faux positif.',
    porte: (n) => !!n?.relevanceMatrix,
    constats: (n) => {
      const c = n.relevanceMatrix.assetClass;
      return (!c || c === 'unclassified')
        ? [{ ou: 'relevanceMatrix.assetClass', extrait: String(c ?? 'absente') }]
        : [];
    },
  },

  {
    id: 'verdict-suit-le-score',
    enonce: 'Le verdict rendu est compatible avec le score mecanique qui le fonde.',
    // Famille corrigee par le verrou du test : le score est
    // deterministe, le verdict ne l est pas. Ce que la propriete mesure
    // est la fidelite du narrateur au calcul, donc la prose d un run.
    famille: 'prose',
    lit: ['mechanicalScore', 'finalRecommendation'],
    origine:
      '4 aout 2026, verrou de comparabilite. Le score mecanique est la source de verite du verdict ; une divergence '
      + 'signifie que la narration a repris la main sur le calcul.',
    eprouvee:
      'Mesuree sur vingt-deux notes le 5 aout : zero violation. Sentinelle de non-regression plutot que detecteur, et '
      + 'declaree comme telle : une propriete qui n a jamais rougi ne prouve rien tant qu on ne lui a pas donne la faute. '
      + 'Le test la lui donne.',
    porte: (n) => n?.mechanicalScore?.globalScore != null && !!n?.finalRecommendation?.verdict,
    constats: (n) => {
      const s = n.mechanicalScore.globalScore;
      const v = n.finalRecommendation.verdict;
      const incompatible =
        (s >= 70 && v === 'refuser')
        || (s < 40 && (v === 'investir' || v === 'investir avec conditions'));
      return incompatible
        ? [{ ou: 'finalRecommendation.verdict', extrait: `score ${s} pour un verdict « ${v} »` }]
        : [];
    },
  },

  {
    id: 'fourchette-de-valorisation-ordonnee',
    enonce: 'Toute fourchette de valorisation porte un minimum strictement positif et inferieur a son maximum.',
    famille: 'structure',
    lit: ['valuation'],
    origine:
      'Regle de domaine du moteur de valorisation. Une fourchette inversee ou nulle est la seule sortie qu un partner '
      + 'ne peut pas interpreter.',
    eprouvee:
      'Mesuree sur huit notes portant une fourchette le 5 aout : zero violation. Sentinelle. Le test lui donne la faute.',
    porte: (n) => Array.isArray(n?.valuation?.ranges) && n.valuation.ranges.length > 0,
    constats: (n) => borne(n.valuation.ranges
      .filter((r: any) => !(r?.min > 0) || r.min > r.max)
      .map((r: any) => ({ ou: `valuation.ranges[${r?.nature ?? '?'}]`, extrait: `min=${r?.min} max=${r?.max}` }))),
  },

  {
    id: 'drivers-hors-repli-degrade',
    enonce: 'Une recommandation non degradee cite au moins un driver de decision.',
    // Meme correction : la recommandation finale est une sortie du
    // modele. Un taux global sur cette propriete melangerait les
    // versions du prompt d orchestration.
    famille: 'prose',
    lit: ['finalRecommendation'],
    origine:
      '5 aout 2026, sonde du corpus. Une recommandation sans driver ne dit pas au partner ce qui a emporte la decision.',
    eprouvee:
      'La version naive, sans la clause de repli, rendait dix violations sur cinquante le 5 aout, soit vingt pour cent. '
      + 'Verification faite note par note, les dix portent degraded a vrai : le repli fonctionnait exactement comme prevu '
      + 'et la propriete mesurait le chemin, pas la qualite. Cent pour cent de faux positifs. Avec la clause, quarante '
      + 'notes sont portees et aucune n est en defaut. C est le cas type qui justifie l exigence d eprouver avant '
      + 'd inscrire : une propriete plausible, ecrite en trois minutes, aurait fait chercher un defaut inexistant dans '
      + 'dix notes.',
    porte: (n) => !!n?.finalRecommendation && n.finalRecommendation.degraded !== true,
    constats: (n) => {
      const d = n.finalRecommendation.decisionDrivers;
      return (!Array.isArray(d) || d.length === 0)
        ? [{
          ou: 'finalRecommendation.decisionDrivers',
          extrait: `verdict « ${n.finalRecommendation.verdict ?? '?'} » rendu sans aucun driver, hors repli degrade`,
        }]
        : [];
    },
  },

  {
    id: 'comparabilite-declaree',
    enonce: 'Un verdict que le verrou juge non comparable porte la mention qui le dit.',
    famille: 'structure',
    lit: ['mechanicalScore.verdictComparability'],
    origine:
      '4 aout 2026, verrou de comparabilite. Un score calcule sur une assiette partielle peut basculer de verdict sans '
      + 'que le deplacement soit grand : ce qui compte est la distance au seuil, pas l intensite. Quand le verrou conclut '
      + 'a la non-comparabilite, le taire rend un verdict qui se lit comme les autres.',
    eprouvee:
      'Mesuree sur vingt-deux notes le 5 aout : zero violation, toutes comparables avec une marge de six points au '
      + 'minimum. Sentinelle sur un dispositif recent, declaree comme telle.',
    porte: (n) => !!n?.mechanicalScore?.verdictComparability,
    constats: (n) => {
      const c = n.mechanicalScore.verdictComparability;
      return (c.comparable === false && !c.mention)
        ? [{ ou: 'mechanicalScore.verdictComparability', extrait: `non comparable, marge ${c.marge}, aucune mention` }]
        : [];
    },
  },

  {
    id: 'pattern-applicable-instruit',
    enonce: 'Un pattern de fragilite declare applicable instruit au moins un de ses axes.',
    famille: 'prose',
    lit: ['fragiliteStructurelle'],
    origine:
      '3 aout 2026. Fixed Cost Trap et Growth Subsidized Model lisaient trente et une clefs absentes de leur contrat, '
      + 'derriere un cast qui empechait le compilateur de le dire, et rendaient un snapshot vide sur tous les dossiers, '
      + 'y compris ceux qui arrivent avec un business plan complet. Les huit tests etaient verts : les fixtures portaient '
      + 'les memes clefs inventees.',
    eprouvee:
      'Le premier jet a commis exactement la faute qu il traquait, et le corpus l a dit en une passe. Il testait '
      + 'applicabilite !== \'non-applicable\' quand la donnee porte \'not-applicable\' : le litteral ecrit a la main ne '
      + 'correspondait a rien, les soixante-trois patterns non applicables du corpus passaient pour applicables, et le '
      + 'releve rendait trente-quatre notes sur quarante-quatre, soit soixante-dix-sept pour cent, presque tous faux. '
      + 'La correction ne consiste pas a reparer le litteral, ce qui reconduirait sa nature : ce qui est lu est le '
      + 'verdict que le pattern a lui-meme rendu, propriete des donnees et non etiquette devinee. Le seuil de deux cents '
      + 'caracteres sur le rationale reste un arbitrage declare : les axes non instruits du corpus portent une phrase de '
      + 'soixante-trois caracteres, les axes instruits plusieurs centaines.',
    porte: (n) => !!n?.fragiliteStructurelle?.patterns,
    constats: (n) => {
      const constats: Constat[] = [];
      for (const [id, p] of Object.entries<any>(n.fragiliteStructurelle.patterns)) {
        const applicable = typeof p?.verdict === 'string' && p.verdict !== 'non-applicable';
        if (!applicable) continue;
        const axes = [p.axis1, p.axis2, p.axis3].filter(Boolean);
        const instruit = axes.some((a: any) => typeof a?.rationale === 'string' && a.rationale.trim().length >= 200);
        if (!instruit) {
          constats.push({
            ou: `fragiliteStructurelle.patterns.${id}`,
            extrait: `verdict « ${p.verdict} », applicabilite « ${p.applicabilite} », ${axes.length} axe(s), aucun instruit`,
          });
        }
      }
      return borne(constats);
    },
  },

  {
    id: 'annee-non-prise-pour-un-montant',
    enonce: 'Aucune alerte de devise ne porte sur une annee prise pour un montant.',
    famille: 'structure',
    lit: ['assertionAudit'],
    origine:
      '4 aout 2026. Le symbole de devise n etait lu qu en prefixe ; « le TAM 500 Mds$ 2025 » ressortait donc comme un '
      + 'montant de deux mille vingt-cinq dollars, en premiere page de la note, avec un extrait montrant une annee la ou '
      + 'le lecteur attendait une somme.',
    eprouvee:
      'Mesuree sur cinquante notes le 5 aout : une seule violation, et c est un vrai positif verifie a la main. Note '
      + '5eb2ee0a du 2 aout, champ marketSizing.pitchAlignmentNote, extrait « Le TAM 500 Mds$ 2025 est confirme par les '
      + 'sources web » : le symbole suffixe etait lu comme prefixe de l annee, et un TAM de cinq cents milliards '
      + 'ressortait en premiere page comme un montant de deux mille vingt-cinq dollars. Le correctif date du 4 aout, la '
      + 'note du 2 : c est la demonstration de ce que la lecture retroactive du corpus apporte, puisque aucun run neuf ne '
      + 'peut plus reveler ce defaut.',
    porte: (n) => Array.isArray(n?.assertionAudit?.warnings),
    constats: (n) => borne(n.assertionAudit.warnings
      .filter((w: any) => w?.category === 'currency_mismatch'
        && /(?:US\$|USD|\$|€|EUR)\s?(?:19|20)\d{2}\b(?!\s?(?:mds|md|m|bn|b|k)\b)/i.test(String(w.excerpt ?? '')))
      .map((w: any) => ({ ou: w.field ?? 'assertionAudit', extrait: String(w.excerpt ?? '').slice(0, 140) }))),
  },
];

/** Acces par identifiant, pour les tests et le bulletin. */
export function propriete(id: string): Propriete {
  const p = PROPRIETES.find((x) => x.id === id);
  if (!p) throw new Error(`propriete inconnue : ${id}`);
  return p;
}
