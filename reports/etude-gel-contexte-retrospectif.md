# Etude de faisabilite du gel de contexte pour l analyse retrospective

Contexte. La demonstration Mubadala en due diligence exige que nous puissions
analyser un dossier date sans que le pipeline mobilise de connaissance
posterieure a la date de ce dossier, et surtout que nous puissions le
prouver. Cette etude repond a la question de faisabilite. Elle ne construit
rien, elle instruit.

## Etape 1. Cartographie des sources de contexte, datables ou non

Le pipeline Prelude injecte du contexte externe a l analyse en plusieurs
endroits, chacun avec un statut different vis-a-vis du bornage temporel.

Les sources bornables proprement, parce qu elles portent une date exploitable
et deja instrumentee, sont les fiches sectorielles persistees dans la table
`sectoral_briefs`, chacune tamponnee `generated_at` en ISO 8601 et deja
soumise a un seuil de fraicheur codifie (fresh sous 9 mois, stale entre 9 et
12 mois, expired au dela, voir `lib/engines/sectoral-injection-pure.ts:36-40`),
les benchmarks sectoriels dans `lib/data/sector-benchmarks.ts` qui portent
un champ `asOf` par plage (2023, 2024, Q3-Q4 2024, avec sources explicites
Bessemer Cloud Index, OpenView SaaS Benchmarks, Atomico European Tech, Carta,
SVB Tech Banking), les comparables verifies dans
`lib/data/verified-comparables.ts` qui portent un `asOf` par comparable et
une note globale de rafraichissement annuel, les benchmarks macro et
europeens dans `lib/benchmarks/*` avec un `asOf` ISO date rigoureux
maintenu dans `sources.ts:11-79`, les prediction_records historiques et
analyses passees en base qui portent tous un `created_at` et un `captured_at`
fiables, et enfin le deck entrant lui meme dont la date d instruction est
capturable soit par l upload Storage soit par le parametre optionnel `asOf`
deja accepte par `/api/analyze:164` et persiste en `analyses.frozen_as_of`.

Les sources qui echappent au bornage temporel sont d une autre nature. La
premiere est le web search natif Anthropic, active par defaut via l outil
`web_search_20250305`, dont les resultats injectes dans la conversation ne
portent aucune date auditable de leur cote, et dont les balises `<cite>`
sont explicitement stripees au retour (fonction `stripCiteTags`, ligne
322-328 de `anthropic-client.ts`). Cette source est deja coupee des que
`frozen=true` est passe en parametre du run, donc techniquement neutralisable,
mais son ecosysteme prouve qu il n existe aucune infrastructure d audit
post-hoc des sources web. La seconde, structurelle, est la connaissance du
modele Claude lui meme. Sonnet 4.6 porte un cutoff d avril 2025, Haiku 4.5
porte un cutoff d octobre 2025. Pour un dossier de juin 2024, Claude sait
donc jusqu a 16 mois de futur. Cette knowledge n est pas datee, pas
filtrable, pas auditable de l exterieur. La troisieme, plus mineure, est la
doctrine implicitement datee au commit applicatif (patterns Phase 4,
matrices de configuration, prompts systeme des 29 moteurs enregistres au
version stamp) dont la date est celle du deploiement, pas celle du
dossier, et qui refletent notre etat de pensee actuel.

Un constat operatoire ressort de cette cartographie. Toute source structuree
en base ou en fichier statique est bornable au prix d une discipline de
filtrage a l ingestion. Le web search est coupable proprement par le flag
existant. La knowledge intrinseque du LLM est le seul verrou qu on ne
franchit pas.

## Etape 2. Le probleme du LLM qui sait le futur

Le coeur de la difficulte tient a ceci. Quand un moteur d analyse envoie
son prompt a Claude, il envoie du texte. Claude repond avec du texte. Rien
dans ce protocole ne permet d imposer techniquement une amnesie selective
sur la periode posterieure a une date donnee. Le modele est une boite
opaque dont la memoire est distillee dans ses poids, et aucune API cliente
ne peut inhiber une portion temporelle de ces poids.

Cela pose. Passons en revue les options honnetement.

L instruction explicite dans le prompt, du type tu es en juin 2024, tu
ignores tout ce que tu sais posterieurement a cette date, est la voie la
plus simple. Elle est aussi la plus faible. C est une injonction morale a
un modele stochastique. Le modele peut y adherer strictement sur les
questions ou il verifie son raisonnement, et deriver silencieusement sur
les autres. Il peut invoquer un fait de 2025 en le presentant comme une
tendance evidente en 2024. La detection a posteriori est impossible sans
oracle externe qui saurait ce qui etait connu ou non a une date donnee.
Utile comme signal, jamais comme preuve.

La fourniture d un contexte date ferme, avec la regle stricte de ne raisonner
qu a partir de ce bundle, est nettement plus solide. On construit un
manifeste de sources datees antecedentes au dossier, on l injecte dans les
system prompts, et on force chaque assertion factuelle ou chiffree a porter
une citation renvoyant a une entree du bundle. Toute assertion non citee
devient un candidat de fuite auditable a posteriori par regex plus audit
humain. Cette voie a une vraie force sur les chiffres precis, les faits
datables, les evenements macro. Elle reste faible sur les intuitions, les
patterns, les jugements gestaltiques ou le modele peut synthetiser une
connaissance posterieure en la maquillant en inference plausible a partir
du bundle. On ne prouve pas l anti-fuite parfaite, on la rend couteuse et
detectable.

La cross-validation par contradiction, qui consiste a lancer deux fois la
meme analyse, une fois avec bundle date, une fois sans, et a comparer les
verdicts, mesure la sensibilite au contexte injecte mais ne prouve pas
l anti-fuite. Deux verdicts identiques peuvent tenir a une pure alignement
de la connaissance posterieure avec le contexte fourni. Deux verdicts
divergents indiquent que le contexte fait quelque chose, sans plus. C est
un instrument de diagnostic, pas de preuve.

Le recours a un modele open source dote d un cutoff antecedent verifiable,
ou a un modele plus ancien avec cutoff connu et documente, est
techniquement plus rigoureux mais rompt le produit. Prelude n est pas
Prelude sans Claude Opus et Sonnet en socle. Cette option est
inacceptable commercialement.

La redaction ou le masking du dossier pour retirer les indices temporels
est contre productif. On corrompt le dossier analyse et on ne resout rien
sur la knowledge du modele.

Verdict honnete sur l etape 2. L anti-fuite parfaite n existe pas avec un
LLM proprietaire ferme. La combinaison bundle date ferme, instruction de
citation obligatoire, audit humain sur echantillon, produit un niveau de
rigueur defendable, avec une reserve intrinseque a assumer publiquement.
Toute promesse d anti-fuite absolue serait une imposture qu un partner
sophistique detecterait en trois questions.

## Etape 3. La tracabilite comme preuve, structure du journal

La force reelle du dispositif n est pas d empecher la fuite, c est de la
rendre auditable et donc argumentable. Le journal de provenance est le
document qui transforme une pratique en preuve.

Il aurait la structure suivante, une entree par analyse retrospective.
D abord un en tete qui identifie le dossier cible, sa date d instruction
effective, la borne de gel appliquee (`freeze_boundary`), et le fingerprint
version_stamp deja produit par le pipeline. Ensuite le bundle de contexte,
une liste des sources injectees avec pour chacune son type (fiche
sectorielle, comparable verifie, benchmark sectoriel, benchmark macro,
prediction record historique), son identifiant en base, sa date propre, son
anciennete au moment du gel, et le statut inclus ou exclu avec motif. Le
web search y figure explicitement comme desactive, avec la raison technique
(flag frozen coupe l outil `web_search_20250305`). La knowledge du modele
y figure explicitement comme fuite structurelle non neutralisable, avec le
cutoff declare du modele, le decalage en mois entre ce cutoff et la borne
de gel, et la mitigation appliquee (instruction, citation obligatoire,
audit).

Ensuite la partie la plus utile en salle, l extraction des citations. Pour
chaque assertion factuelle ou chiffree du rapport produit, une ligne indique
le moteur qui l a emise, la citation extraite de la reponse LLM, la source
citee et sa date, et un statut PASS si la source est dans le bundle et
anterieure a la borne, FAIL avec drapeau leak candidate si la source n est
pas dans le bundle ou si elle est posterieure a la borne, WARN si
l assertion ne porte pas de citation explicite. Ce dernier registre est ce
qui se montre a Mubadala. Il donne un taux mesurable de fuite candidate par
analyse, il permet une comparaison chiffree entre le pipeline gele et le
pipeline non gele, il expose la difficulte plutot que de la cacher.

L insertion dans le pipeline se fait a trois endroits. En amont de
l orchestration, une fonction `buildFrozenContextBundle(asOf)` construit
le bundle en filtrant chaque source par date. Pendant l execution, chaque
appel LLM recoit une reference au bundle et une instruction ajoutee au
system prompt exigeant citation systematique. En aval de chaque moteur, un
extracteur parse la reponse pour identifier les citations et les valider
contre le bundle. Le manifeste consolide est ecrit en fin de pipeline dans
une nouvelle table Supabase `retrospective_provenance`, une ligne par
analyse gelee, avec cle etrangere vers `analyses.id`. Le version_stamp
existant capture deja `runMode: { frozen, asOf }`, il suffit de le compter
comme source d autorite pour identifier une analyse retrospective.

## Etape 4. Cas de test propose, Bemersive

Bemersive est le cas d ecole. Deux runs deja en base (026f62d0 et
a1694ba9), tous deux avec outcome resolu fail source temoignage fondateur,
non demarrage commercial sur le marche VR AR grand public confirme par le
porteur du dossier. Le dossier date de 2024, l echec est connu, nous avons
donc une verite terrain pour juger la qualite d une analyse retrospective.

Le gel appliquerait `freeze_boundary` a la date d instruction originale du
deck, disons juin 2024. Les sources bornees seraient les fiches sectorielles
VR AR ou consumer hardware anterieures a juin 2024, les comparables verifies
du secteur avec `asOf` anterieur (Meta Reality Labs 2022-2023, Oculus,
Magic Leap Series C 2019, Nreal Series C 2022, HTC Vive dans sa phase B2C),
les benchmarks marche VR grand public issus des rapports IDC et Gartner
2022-2024, les prediction records d autres dossiers Prelude anterieurs si
disponibles. Les sources explicitement exclues seraient les resultats Meta
2024 Q4 et 2025 sur pertes Reality Labs, les chiffres de ventes Apple
Vision Pro post lancement fevrier 2024 dans leur decroissance rapide, toute
presse posterieure a juin 2024. Web search coupe par frozen. Reserve LLM
declaree, Sonnet 4.6 avec cutoff avril 2025 sait au moins un an du futur
du dossier.

La verification post analyse procederait ainsi. Extraction automatique
des claims chiffres et factuels du rapport genere par regex sur les
sections des 14 moteurs. Validation de chaque claim contre le bundle,
production du taux de fuite candidate. Audit humain sur un echantillon
dirige de dix claims parmi les plus a risque (chiffres de marche VR AR,
comparables invoques, evenements macro cites). Detection lexicale des
formulations qui trahissent la retrospection, du type il s est avere que,
en realite, l histoire a montre, avec revue humaine des occurrences. Enfin
un run parallele non gele pour mesurer la sensibilite. Si le verdict change
peu, le contexte gele suffisait a produire le meme diagnostic. Si le verdict
change beaucoup, la connaissance posterieure pesait, ce qui reste
interessant a exposer comme mesure de la value ajoutee du gel.

Le resultat qu on cherche est double. Un, mesurer si le pipeline gele
detecte le pattern Fixed Cost Trap et Commoditization Drift sur VR AR
grand public avec le seul contexte 2024, sans la mediatisation posterieure
des echecs sectoriels. Deux, si oui, la demonstration est puissante, Prelude
voyait le rique quand personne ne le voyait encore consensuellement. Si non,
si le moteur ne releve rien de significatif avec le contexte 2024 seul, la
demonstration est honnete et instructive, elle expose une limite du
pipeline au moment de l instruction que nous corrigerions dans la
calibration doctrinale future.

## Etape 5. Verdict de faisabilite

Faisable partiellement. Defendable en salle sous conditions.

Ce qui est faisable proprement, avec rigueur documentable. Le datage et le
bornage des sources structurees (comparables, benchmarks, briefs
sectoriels, prediction records historiques) reposent sur des champs `asOf`
et `generated_at` deja presents dans le code, avec seuil de fraicheur deja
codifie pour un sous ensemble. La coupure du web search est acquise via
`frozen=true` qui rentre deja dans le fingerprint. Le journal de provenance
est constructible sans revolution architecturale, le version_stamp existant
sert de socle, il suffit d ajouter une table de manifeste et un extracteur
de citations. Le systeme de fingerprint a 29 moteurs enregistres avec hash
des prompts systemes est deja en place pour tracer quelle version d
instrument a produit quelle analyse.

Ce qui reste approximable et non prouvable, l anti fuite intrinseque au
modele Claude. C est structurel, aucune technique client side n y remedie.
La mitigation par instruction plus citation plus audit reduit la surface
de fuite sur les chiffres et les faits datables, sans jamais la fermer
completement sur les patterns et les intuitions.

Ce qu on peut defendre honnetement en due diligence Mubadala repose sur
trois piliers explicites. Un bundle de contexte date construit et publie
avec chaque analyse retrospective. Une discipline de citation obligatoire
dans les reponses LLM, verifiee par extraction automatique et par audit
humain sur echantillon. Une declaration explicite dans le rapport
retrospectif lui meme d une reserve LLM cutoff, transformant la limite
residuelle en preuve d honnetete methodologique plutot qu en faille
dissimulee.

Cette derniere condition n est pas cosmetique. Un partner sophistique en
salle testera la robustesse de la promesse anti fuite. Si notre reponse
est nous garantissons zero fuite, nous perdons la salle en dix minutes
sur la premiere question technique. Si notre reponse est nous avons
neutralise les sources exogenes, nous avons force la citation, nous avons
audit humain, et nous declarons une reserve LLM structurelle documentee
comme partie integrante du protocole, nous gagnons la salle sur la maturite
methodologique. Le fond de la question Mubadala n est pas peut on prouver
l impossible, c est avez vous pense a la question honnetement et
construit un protocole a la hauteur.

Cout d ingenierie estime, hors calibration doctrinale et hors audit humain
recurrent, cinq a huit jours sur les composants suivants. Fonction
`buildFrozenContextBundle(asOf)` qui filtre les sources structurees. Ajout
au system prompt des moteurs Bloc 1 concernes d un bloc d instruction
citation. Extracteur de citations post reponse LLM par regex plus
validation contre bundle. Table Supabase `retrospective_provenance` avec
sa migration. Endpoint de restitution du manifeste pour l UI de rapport
retrospectif. Documentation methodologique pour la salle DD.

Piege a ne pas evacuer. La tentation de vendre l anti fuite absolue est
forte parce que c est plus vendable. Elle est mortelle parce qu elle est
verifiable en direct. La bonne posture commerciale est la rigueur assumee
avec ses limites explicitees. C est celle qui distingue Prelude d Affinity
et de PitchBook, pas la promesse magique.

## Synthese en une phrase

L anti fuite parfaite est structurellement inatteignable avec Claude en
socle, mais un dispositif a trois piliers (bundle date, citation obligatoire,
audit humain sur echantillon) plus la declaration explicite de la reserve
LLM cutoff produit un niveau de rigueur qui tient en salle a condition de
ne jamais promettre l impossible.
