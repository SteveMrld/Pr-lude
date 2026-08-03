# Relecture critique de la note Braincube, 3 aout 2026

Note produite pour un dossier de demonstration, relue de bout en bout
avant gel. Run `5eb2ee0a`, commit `4a25d94`, 603 secondes, 22 appels au
modele dont 2 en echec.

Cinq defauts ont ete repares dans la foulee, au brief 30. Ce document
consigne les autres, ecrits et non traites, et ce que le run a
demontre par ailleurs.

## Ce que le run a demontre

**Le controle en attente depuis la grappe 6 est arrive de lui-meme.**
`failedCalls` vaut 2, et les deux echecs portent leur cout : le
pre-scan a 731 ms et zero token pour un depassement de la limite de
cent pages, et un appel Sonnet a **120 409 ms** pour zero token, soit
deux tentatives de soixante secondes avant abandon. Ces deux minutes
entrent desormais dans le cout total du run, ce qui n aurait pas ete le
cas avant le bloc 1 de la grappe 6. La mesure des echecs et des
reprises est verifiee en conditions reelles, et l hypothese qui restait
en suspens depuis le 2 aout est levee.

**Le repli du pre-scan impossible fonctionne.** Le memorandum depasse
cent pages, le moteur ne leve plus, il declare : dix tests non produits
de cause incident, motif nommant la limite, verdict non eliminatoire.

**La distinction incident contre absence du journal de recolte reste
non exercee.** Seize hits, onze vides, deux desactives, zero echec de
source.

## Dettes ouvertes, non traitees

### Le segment de benchmark hors sujet

Le moteur Benchmarks retient le segment « US seriesDPlus IA Q1 2026 »
pour une societe francaise industrielle en LBO. Il emet bien un
avertissement sur la comparaison Europe contre Etats-Unis, mais aucun
sur le fait que le dossier n est ni IA ni series D. La comparaison de
taille de tour qui en sort, 10,7 M$ contre une mediane de 190 M$,
verdict `extreme_outlier` a -94%, est juste sur les chiffres et sans
objet sur le fond : elle compare un cash-in de LBO a des medianes de
tours de venture.

C est la meme famille que la ligne « Tour » fermee en grappe 4 : un
cadre concu pour la levee applique a une operation qui n en est pas
une. Le type d operation existe desormais et n est pas consomme ici.

### L audit d assertions rend 392 alertes dont la majorite est du bruit

391 de categorie `unknown_name`. Cinquante-six sont des faux positifs
demontrables : le detecteur signale « Nom propre "Viadeo" cite sans tag
de source » sur un extrait qui contient litteralement `[web : Viadeo]`.
Il lit le nom a l interieur du tag et le compte comme non tague. Le
reste flagge « B2B », « PLG », « NRR » comme noms propres non sources.

Un controle qui rend 392 alertes dont on sait que la majorite est du
bruit est un controle que personne ne lira, et il masquera la vraie
assertion non etablie le jour ou elle passera. C est le patron du test
intermittent, transpose a l audit d assertions.

### Le SAM annonce a 87, calcule a 86

`marketSizing.sam.value` dit « ~87 Mds$ », sa propre methode conclut
« = ~86 Mds$ », et le SOM reprend 86. Incoherence interne d un facteur
negligeable, mais c est le genre d ecart qu un lecteur attentif releve
en premier et qui entame la confiance dans le reste.

### Le SOM vaut cinq fois ce que sa methode justifie

Le SOM est pose a 430 M$, soit 0,5% du SAM, alors que la methode qui le
precede conclut que la trajectoire propre de la societe donne « moins
de 0,1% ». L ecart est assume dans le texte, « l ambition declaree d un
leadership europeen », mais une ambition reste presentee en position de
mesure.

### Les benchmarks de KPI n ont aucune source

Burn multiple a 2,5 / 4 / 6, Rule of 40 a 30 / 15 / 0, marge brute a
50 / 40 / 25, revenue par employe a 350k / 250k / 150k :
`benchmarkSource` est `undefined` sur tous les indicateurs. Ce sont des
chiffres de place, probablement justes, mais la note n a pas de reponse
a la question de leur origine. Une assertion chiffree sans source est
un defaut, pas une limite.

### preScan marque `ok` alors qu il declare une non-production totale

`pipeline_engines_status` enregistre `preScan: ok` parce que le moteur
a rendu une sortie, alors que cette sortie declare dix tests non
produits de cause incident. Le statut technique et la declaration
editoriale se contredisent sur la meme ligne. L enregistreur devrait
lire `hasProductionIncident` plutot que la seule presence d une sortie.

### `financialCoherence` en echec, rendu comme une absence

Le moteur sort en `failed` avec « contrat minimal non satisfait » et
`result_json.financialCoherence` vaut `null`. La note en parle, mais
comme d une absence de contenu : « le modele economique n a pas ete
instruit sur ce run ». Le lecteur comprend que le sujet n a pas ete
traite, pas qu une piece du dispositif est tombee. La distinction
decision contre incident, tranchee en grappe 3 pour les moteurs, ne
remonte pas jusqu a la prose.

### Le stade `series-a` sur une societe de 2007

Le stade retenu est `series-a` pour une societe fondee en 2007, a 17 M€
d ARR, dans un LBO. `fundraise.stage` dit « series-A-late ». Les
multiples de series-A sont appliques a ce profil sans discussion.

### La consigne d ingenieur imprimee dans le rationale

Le rationale de la methode reproduit les notes internes de la table de
benchmarks : « Multiples revenue plus bas que pure tech. Si profitable,
basculer sur EBITDA multiples (5-10x). » C est une consigne adressee a
personne, imprimee dans une note d instruction.

### `operationType` absent de la racine de l extraction

Le type ne vit que dans `extraction.fundraise.operationType`, avec sa
citation. `extraction.operationType` est `undefined`. Le moteur de
valorisation lit le bon endroit, mais la donnee est a deux niveaux et
un seul est renseigne : tout consommateur qui lit la racine ne voit
rien.

### Le vocabulaire de venture dans le plan de structuration

`finalRecommendation.structuringPlan` recommande « un pacte
d actionnaires post-operation avec clauses de protection investisseur,
drag-along, tag-along, anti-dilution ratchet ». Sur un LBO ce n est pas
absurde, un sponsor equity signe un pacte, mais le registre est celui
du venture et il detonne.

## Bloc 5 du brief 30, traite

Le rapprochement entre un evenement posterieur au document et
l operation decrite etait impossible faute de deux termes : la date de
redaction du document, qui n existait nulle part, et l evenement date
comme donnee, qui n existait qu en prose.

Le premier est livre, `documentDate` avec sa citation sous la regle
anti-divination. Le second devient une grappe, ecrite dans
`prelude-grappe-evenements.md` et non traitee.

Entre les deux, le module `operation-validity` rend un verdict a partir
d une ancre reconstituee et d une detection provisoire sur prose,
declaree comme dette jusque dans la note affichee au lecteur.
