// ============================================================
// Tests deterministes du contrat de type d operation
// ------------------------------------------------------------
// Ce que ces tests prouvent : la garde post-parse ne laisse jamais
// passer un type sans citation, elle vide les cases propres aux
// operations non-levee quand le type n est pas etabli, et le prompt
// nomme les marqueurs reellement observes dans le corpus.
//
// Le defaut ferme : le contrat d extraction ne connaissait que la
// levee. Les quatorze dossiers growth du corpus sont des memorandums
// de cession et de LBO, et le modele rangeait ce qu il lisait dans les
// cases disponibles : « Cession de 100% du capital » dans amount sur
// OOGarden, le conseil vendeur Rothschild dans leadInvestor sur
// ZargesTubesca.
//
// La regle anti-divination est la meme des deux cotes du contrat. Le
// prompt ne doit jamais produire une valeur sans preuve, et la garde
// refuse une valeur sans preuve. Ni l un ni l autre ne devine.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const SRC = readFileSync(join(__dirname, 'extraction-engine.ts'), 'utf8');

/**
 * Rejoue la garde post-parse telle qu elle est ecrite dans le moteur.
 * Le moteur n expose pas la garde separement parce qu elle vit dans le
 * chemin d appel LLM ; on en reproduit la logique ici et on verifie
 * par ailleurs que le source la porte bien.
 */
function appliquerGarde(fr: any): any {
  const TYPES = ['levee', 'cession-partielle', 'cession-totale', 'lbo', 'non-etabli'];
  const evidence = typeof fr.operationTypeEvidence === 'string' && fr.operationTypeEvidence.trim().length > 0
    ? fr.operationTypeEvidence.trim()
    : null;
  fr.operationType = (evidence !== null && TYPES.includes(fr.operationType) && fr.operationType !== 'non-etabli')
    ? fr.operationType
    : 'non-etabli';
  fr.operationTypeEvidence = fr.operationType === 'non-etabli' ? null : evidence;
  if (fr.operationType === 'non-etabli') {
    fr.seller = ''; fr.stakeForSale = ''; fr.sellSideAdvisor = '';
  }
  return fr;
}

// ============================================================
console.log('\n[Suite 1] aucun type sans citation');
// ============================================================

{
  const sansPreuve = appliquerGarde({ operationType: 'cession-totale', operationTypeEvidence: null });
  check(sansPreuve.operationType === 'non-etabli', 'type sans citation : retombe a non-etabli');
  check(sansPreuve.operationTypeEvidence === null, 'et la citation reste nulle');

  const citationVide = appliquerGarde({ operationType: 'lbo', operationTypeEvidence: '   ' });
  check(citationVide.operationType === 'non-etabli', 'citation blanche : retombe a non-etabli');

  const avecPreuve = appliquerGarde({
    operationType: 'cession-totale',
    operationTypeEvidence: "mandate par Compagnie des Alpes pour la cession de 6 parcs",
  });
  check(avecPreuve.operationType === 'cession-totale', 'type avec citation : retenu');
  check(
    avecPreuve.operationTypeEvidence === 'mandate par Compagnie des Alpes pour la cession de 6 parcs',
    'la citation est conservee, espaces de bord retires',
  );
}

{
  // Une valeur hors enumeration ne passe pas, meme accompagnee d une
  // citation : le contrat est ferme, pas permissif.
  const horsEnum = appliquerGarde({ operationType: 'acquisition', operationTypeEvidence: 'texte du document' });
  check(horsEnum.operationType === 'non-etabli', 'valeur hors enumeration : refusee');

  // 'non-etabli' rendu explicitement par le modele reste non-etabli,
  // meme avec une citation : c est le seul etat qu on ne peut pas
  // fonder par une preuve.
  const explicite = appliquerGarde({ operationType: 'non-etabli', operationTypeEvidence: 'rien de concluant' });
  check(explicite.operationType === 'non-etabli', 'non-etabli declare reste non-etabli');
  check(explicite.operationTypeEvidence === null, 'et sa citation est effacee');
}

// ============================================================
console.log('\n[Suite 2] sans type etabli, aucune case non-levee remplie');
// ============================================================

{
  // Les trois cases ne peuvent porter qu une inference quand le type
  // n est pas etabli. On les vide plutot que de les laisser remplies
  // sur une base qu on vient de refuser.
  const r = appliquerGarde({
    operationType: 'cession-totale',
    operationTypeEvidence: null,
    seller: 'Compagnie des Alpes',
    stakeForSale: '100%',
    sellSideAdvisor: 'Rothschild',
  });
  check(r.seller === '', 'seller vide');
  check(r.stakeForSale === '', 'stakeForSale vide');
  check(r.sellSideAdvisor === '', 'sellSideAdvisor vide');
}

{
  // A l inverse, un type etabli conserve les trois cases.
  const r = appliquerGarde({
    operationType: 'cession-totale',
    operationTypeEvidence: 'cession a 100% des marques Vertbaudet et Cyrillus',
    seller: 'PPR / Redcats',
    stakeForSale: '100%',
    sellSideAdvisor: 'Rothschild',
  });
  check(r.seller === 'PPR / Redcats', 'seller conserve');
  check(r.stakeForSale === '100%', 'stakeForSale conserve');
  check(r.sellSideAdvisor === 'Rothschild', 'sellSideAdvisor conserve');
}

// ============================================================
console.log('\n[Suite 3] le prompt porte la regle et les marqueurs mesures');
// ============================================================

{
  check(SRC.includes('"operationType"'), 'le format JSON demande operationType');
  check(SRC.includes('"operationTypeEvidence"'), 'et sa citation');
  check(/RÈGLES TYPE D'OPÉRATION/.test(SRC), 'la section de regles existe');
  check(/ANTI-DIVINATION/.test(SRC), 'la regle anti-divination est enoncee');

  // Les cinq valeurs sont proposees au modele.
  for (const v of ['levee', 'cession-partielle', 'cession-totale', 'lbo', 'non-etabli']) {
    check(SRC.includes(`"${v}"`), `la valeur ${v} est proposee`);
  }

  // Les marqueurs cites sont ceux lus dans le corpus, pas des
  // suppositions. Chacun de ceux-ci figure dans un document traite.
  for (const marqueur of ['memorandum', 'Project Chamois', 'Rothschild', 'Lazard', 'carve-out', 'Compagnie des Alpes']) {
    check(
      SRC.toLowerCase().includes(marqueur.toLowerCase()),
      `le marqueur mesure « ${marqueur} » est nomme`,
    );
  }
}

{
  // Les libelles des champs existants ne presupposent plus la levee.
  check(
    !/"amount": "montant levé ou recherché"/.test(SRC),
    'amount ne se decrit plus comme un montant leve ou recherche seul',
  );
  check(
    /"amount": "montant de l'opération, dont la nature dépend du type/.test(SRC),
    'amount se decrit par le type d operation',
  );
  check(
    /"valuation": "valorisation telle que le document la présente, dont la nature dépend du type/.test(SRC),
    'valuation aussi',
  );
  // Le stade garde son enumeration : un stade reste un stade sur une
  // cession, ce que la mesure du brief 24 a etabli.
  check(SRC.includes("'series-A-early'") && SRC.includes("'growth'"), 'le stade garde son enumeration');
  check(
    /Un stade reste un stade quelle que soit l'opération/.test(SRC),
    'et le prompt le dit explicitement',
  );
}

{
  // La garde post-parse est bien dans le source, pas seulement dans ce
  // test : sans elle, le contrat serait declaratif.
  check(
    /fr\.operationType = \(evidence !== null/.test(SRC),
    'la garde post-parse existe dans le moteur',
  );
  check(
    /fr\.seller = '';/.test(SRC),
    'et elle vide les cases non-levee sur un type non etabli',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
