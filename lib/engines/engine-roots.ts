// ============================================================
// RACINES MOTEUR PROTEGEES
// ------------------------------------------------------------
// Toute sortie de moteur du pipeline peut valoir null. Le wrapper
// deadline resout null des qu un moteur timeoute ou rejette
// (lib/orchestrator/engine-deadline.ts:94 et :135), et le
// Promise.all central de app/api/analyze/route.ts recoit donc un
// tableau ou n importe quelle case peut manquer.
//
// Les constructeurs de prompt lisent ces sorties par interpolation
// de template. Chaque interpolation porte deja son repli, ?? '?' ou
// || [], mais ce repli ne protege que la propriete, jamais la
// racine : ${patternMatching.comparables || []} leve si
// patternMatching est null, et le || [] n est jamais atteint.
//
// C est la cause de l incident c487a8b2 du 27 juillet. Douze lignes
// error_logs de source pipeline.orchestrate, quatre disant
// comparables et huit disant systemicCoverage, toutes des lectures
// de propriete sur null dans le meme template. Le nom de propriete
// dans le message ne designait pas une cause mais le rang du
// premier moteur manquant dans l ordre de lecture.
//
// Ce module ferme la classe plutot que les instances. Les racines
// passent par protectEngineRoots, une racine absente devient un
// objet vide, et chaque interpolation retombe sur le repli qu elle
// declarait deja. Un moteur ajoute au prompt demain est couvert des
// lors qu il entre dans l objet, sans qu il faille se souvenir d un
// point d interrogation de plus.
//
// tsconfig.json porte "strict": false, donc strictNullChecks est
// desactive : le compilateur ne signalera jamais cette famille de
// defauts. La discipline ne peut pas venir du typage, elle doit
// venir d une mecanique explicite.
// ============================================================

/**
 * Remplace chaque racine null ou undefined par un objet vide, en
 * conservant les racines presentes telles quelles.
 *
 * Le type de retour retire le null plutot que de reconduire celui de
 * l entree. La fonction rendait `T`, donc une racine declaree nullable
 * ressortait nullable alors qu elle ne l est plus : le seul outil qui
 * aurait pu signaler cette famille de defauts, le jour ou strictNullChecks
 * sera actif, aurait continue de pointer les lectures deja protegees et
 * fait passer le mecanisme pour inutile.
 *
 * PIEGE A CONNAITRE : ne fais jamais passer par ici une sortie
 * utilisee comme condition de presence. Un objet vide est truthy,
 * donc ${narrativeDrift ? buildBlock(narrativeDrift) : ''} basculerait
 * du mauvais cote et construirait un bloc sur du vide. Les sorties
 * qui gouvernent un ternaire de presence restent brutes. Seules les
 * racines dereferencees inconditionnellement entrent ici.
 */
export function protectEngineRoots<T extends Record<string, any>>(
  roots: T,
): { [K in keyof T]: NonNullable<T[K]> } {
  const out: Record<string, any> = {};
  for (const key of Object.keys(roots)) {
    const value = roots[key];
    out[key] = value === null || value === undefined ? {} : value;
  }
  return out as { [K in keyof T]: NonNullable<T[K]> };
}
