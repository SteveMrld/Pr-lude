# Grappe fetchers, la fiabilite des entrees externes

Grappe a part entiere, ouverte au brief 24 et volontairement non
traitee. Elle a ete sortie de la grappe 3 parce qu elle n est pas un
probleme de message mais de contrat.

## Le fait

Les moteurs Equipe et Reference checks lisent un resultat vide venu
des sources externes et concluent a une absence de signal. Ce vide peut
etre un timeout, une erreur reseau, un quota depasse ou une source
indisponible. Rien dans la sortie ne permet de faire la difference,
et le pipeline ne conserve aucune trace de ce qui a echoue.

## Ce qui est lu

`lib/data-fetchers/sources.ts:205-210`. `withBudget` enveloppe chaque
appel de source dans un budget de temps. Le `catch` emet un evenement
SSE `fetcher:timeout` puis retourne `emptyValue`, la valeur vide de la
source. L appelant recoit exactement ce qu il aurait recu d une
recherche aboutie et sans resultat.

`lib/data-fetchers/sources.ts:212-223`. `fetchWithTimeout` retourne
`null` sur toute exception, `AbortError` de timeout comme erreur
reseau. Un 404 legitime et une coupure produisent le meme `null`.

`lib/data-fetchers/sources.ts:646, 654, 662` et suivantes. Une dizaine
d appels de la forme `searchX(...).catch(() => null)`. Le `catch` sans
argument ne journalise rien : l erreur est perdue au moment ou elle
survient.

Les evenements `fetcher:timeout` et `fetcher:miss` n existent nulle
part ailleurs que dans `sources.ts`. Verification faite sur l ensemble
du depot : la route `/api/analyze` ne les capte pas, aucun champ de
`result_json` ne les porte. Ils vivent le temps d une connexion SSE et
disparaissent. **La distinction est donc definitivement perdue** des
que le run est termine, y compris pour un rejeu hors ligne.

Consequence en aval, lue sur les consommateurs : `realData` du moteur
Equipe et les checks du moteur Reference checks sont construits a
partir de ces resultats. Un fondateur dont la recherche OpenAlex,
GitHub et Wikipedia a echoue produit le meme `realData` vide qu un
fondateur reellement absent de ces sources. Le moteur Equipe en tire un
`evaluability: 'non-evaluable'` et un score plancher, presente comme
« non instruit », ce qui est vrai mais ne dit pas que personne n a pu
instruire faute d avoir joint les sources.

## Pourquoi ce n est pas la grappe 3

La forme tranchee au brief 24, un champ de cause a cote du message,
suppose qu il existe un endroit ou declarer la cause. Ici il n y en a
pas : la couche de fetchers ne rend pas un objet de resultat portant
un statut, elle rend la donnee elle-meme, ou son equivalent vide. Poser
un champ demande de changer le type de retour de chaque source, donc
le contrat entre la couche de donnees et les moteurs.

C est la question de la cascade team du brief 21, posee sur les entrees
externes plutot que sur les dependances entre moteurs. La cascade
disait : un moteur ne doit pas consommer en silence une entree que son
amont n a pas produite. La meme phrase vaut ici, avec les sources
externes comme amont.

## Ce qui reste a etablir

Le perimetre exact des sources concernees et leur poids reel. Combien
d appels distincts, lesquels alimentent une dimension du score
mecanique et lesquels ne servent qu a enrichir la note. Un timeout sur
une source decorative et un timeout sur une source qui pese dans le
score ne meritent pas le meme traitement.

La forme du contrat. Envelopper chaque retour dans un objet portant la
donnee et l etat de la recolte est la solution complete et la plus
couteuse, elle touche tous les appelants. Un journal de recolte
agrege par run, persiste dans `result_json`, est moins invasif et
suffirait a rendre la distinction recuperable a posteriori sans changer
la signature des sources. Le second n empeche pas un moteur de
conclure a tort pendant le run, il permet seulement de s en apercevoir
apres.

Ce qu un moteur doit faire quand il apprend que ses entrees sont
incompletes. Baisser sa confiance, se declarer non applicable, ou
produire en signalant. La reponse n est probablement pas la meme pour
Equipe, dont le score entre dans la note mecanique, et pour Reference
checks, dont la sortie est une liste de contacts a appeler.

Le cout d un rejeu. Si la recolte est journalisee, un dossier dont les
sources ont echoue devient identifiable et rejouable. C est peut-etre
la reponse la plus simple : ne rien changer aux moteurs, rendre le
defaut visible, et rejouer.

## Ce qu on ne touche pas

`fetchCache` a `sources.ts:138-147` supprime l entree du cache quand la
promesse echoue, de sorte qu un echec ne soit pas memorise pour tout le
run. Ce comportement est correct et doit le rester : il garantit qu un
second appel dans le meme pipeline retente reellement.
