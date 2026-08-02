# Grappe 2, tete de file

## 1. La bascule profitable-mature est inerte

Ouvert au brief 22, ecarte volontairement de cette grappe : le
correctif toucherait `lib/engines/valuation-engine.ts`, moteur deja
modifie par le bloc 1, et la methode de grappe interdit deux
correctifs sur un meme moteur dans une meme passe.

### Ce qui est lu

`computeValuation` bascule un dossier vers l asset class
`profitable-mature` quand trois conditions se rencontrent : un EBITDA
positif au millesime de reference, un stade series-b ou series-c-plus,
et une classe d actif qui n est ni saas-b2b, ni cybersecurity, ni
ai-generative (`valuation-engine.ts:262-263`). La bascule est
doctrinalement fondee : sur une PME rentable, les multiples EBITDA
donnent une fourchette plus juste que les multiples de revenu, et
`SECTOR_BENCHMARKS['profitable-mature']` porte pour cela une plage
series-b de 6x a 15x calibree sur l Argos Index
(`lib/data/sector-benchmarks.ts:522-534`).

Cette plage n est jamais atteinte. `computeBySectorMultiples` appelle
`getSectorMultiples(assetClass, stage)`, qui commence par repasser son
argument dans `normalizeAssetClass` (`sector-benchmarks.ts:738`). Or
cette fonction est ecrite pour lire un libelle sectoriel libre sorti du
LLM d extraction, pas pour accepter une classe deja normalisee : elle
cherche des mots-cle de secteur, et `profitable-mature` n en porte
aucun. Elle rend donc `unclassified`, `getSectorMultiples` rend `null`
a la ligne suivante, et la methode ressort non applicable avec le motif
`Pas de plage de multiples definie pour profitable-mature au stade
series-b`.

Mesure sur les vingt et une asset classes du catalogue :
`normalizeAssetClass` est idempotente sur vingt d entre elles.
`profitable-mature` est la seule exception, et c est exactement la
seule qui ne soit pas produite par `normalizeAssetClass` mais derivee
par le moteur de valorisation lui-meme. Le defaut n est donc pas un
oubli dans une liste de mots-cle, c est un melange de deux registres
sous un meme type `string` : un libelle a classer et une classe deja
classee.

Le defaut precede le brief 22 et n a pas ete introduit par lui. Le
bloc 1 en change toutefois la population : la bascule se decide
desormais sur l EBITDA realise et non plus sur l EBITDA d horloge, donc
les dossiers qui l atteignent ne sont plus les memes.

Cout de l effet en production : nul en apparence, ce qui est le pire
cas. Un dossier series-b rentable ne sort pas avec une fourchette
fausse, il sort sans fourchette de multiples du tout, et la
valorisation retombe sur la seule VC inverse. Aucun warning ne dit que
la plage EBITDA existait et n a pas ete lue.

### Ce qui reste a etablir

Combien de dossiers du corpus atteignent la bascule, et ce que la plage
EBITDA leur donnerait. Le rejeu hors ligne est faisable sans cle API,
`computeValuation` etant deterministe et tous ses inputs persistes dans
`result_json` ; c est le meme harnais que celui utilise pour mesurer le
bloc 1.

Ou poser la correction. Deux options qui ne se valent pas. Rendre
`normalizeAssetClass` idempotente en reconnaissant les classes du
catalogue en entree traite la classe entiere de defauts, mais elargit
le contrat d une fonction que trois classificateurs appellent.
Contourner l appel dans `getSectorMultiples` quand l argument est deja
une clef de `SECTOR_BENCHMARKS` est plus etroit et plus sur. La seconde
demande d etablir qu aucun libelle libre du corpus ne collisionne avec
une clef du catalogue.

Si la plage EBITDA doit rester non applicable dans certains cas, par
exemple faute d EBITDA au millesime retenu, le motif ecrit doit le
dire. Aujourd hui il annonce une plage inexistante, ce qui envoie sur
une fausse piste quiconque enquete.

## 2. Le perimetre reel du chantier design

Chiffre pose ici parce qu il sera utile le jour ou le chantier
s ouvrira, et parce qu il contredit l intuition que le depot donne de
lui-meme.

Le code applicatif suivi par git pese 113 549 lignes au 2 aout 2026.
L interface en represente 35,1 pour cent : 21 424 lignes de composants
et 18 423 lignes de pages et de clients, soit 39 847 lignes sur 84
fichiers. Les moteurs, qui sont le coeur du produit et ce que le fonds
achete, pesent 33 701 lignes sur 77 fichiers, soit 29,7 pour cent.
L interface est donc le premier poste du depot, devant les moteurs, et
l ecart de cinq points et demi represente environ six mille lignes.

Deux fichiers portent a eux seuls 14 023 lignes, soit plus du tiers de
l interface : `app/HomeClient.tsx` a 7 015 lignes et
`app/components/InvestmentNoteView.tsx` a 7 008. Le second est le
fichier le plus souvent touche du depot, puisque toute evolution de la
note d instruction y passe, y compris les affichages ajoutes par le
brief 22.

Ce que ce chiffre ne dit pas, et qu il faudra etablir avant d ouvrir le
chantier : quelle part de ces 39 847 lignes est du style inline plutot
que de la structure. Le depot suit par ailleurs 5 520 lignes de CSS
dans un fichier unique, ce qui suggere que les deux regimes coexistent
sans frontiere ecrite. Un decoupage en sous-composants qui ne
trancherait pas cette question deplacerait le volume sans le reduire.
