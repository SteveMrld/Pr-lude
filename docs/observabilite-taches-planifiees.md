# Ce qu il faudrait pour qu une tache planifiee morte se voie

Proposition, non implementee. Ecrite le 3 aout 2026 apres la
decouverte que les six crons declares dans `vercel.json` n avaient
jamais atteint leur handler, interceptes par le middleware
d authentification et rediriges en 307 vers `/login`.

## Le probleme n est pas l absence de trace

Il faut commencer par la, parce que la reponse evidente est fausse et
qu elle a deja ete donnee. Le cron `cleanup-stale-running` ecrivait
deja une trace d invocation dans `error_logs`, posee avant meme
l evaluation de l autorisation, precisement pour distinguer une tache
jamais appelee d une tache appelee et refusee. Le commentaire qui
l accompagne annonce sans ambiguite que la serie temporelle de ces
entrees sert de heartbeat. Cette instrumentation a ete ajoutee le 27
juillet 2026 en reponse a une premiere alerte, et elle a fonctionne :
c est son absence totale, sur toute la vie de la table, qui a permis
d etablir la panne le 3 aout.

Elle a donc mis une semaine a produire son diagnostic, et elle ne l a
produit que parce qu un humain est alle la lire, en cherchant autre
chose. Le defaut n est pas dans l ecriture, il est dans la lecture. Une
trace que personne n interroge est un journal de bord jete a la mer.

Cela impose une contrainte a toute la suite : ajouter une table
`cron_runs` mieux tenue qu `error_logs` ne changerait rien du tout si
le dispositif s arrete la. La question a traiter n est pas ou ecrire,
c est qui lit et selon quel declencheur.

## La difficulte de fond

Un heartbeat prouve la vie, il ne signale pas la mort. Le battement
present est un fait positif que l on peut ecrire ; le battement absent
n est un evenement pour personne. Il faut donc un tiers qui, a un
moment choisi par lui et non par la tache surveillee, constate que rien
n est arrive.

D ou le piege, qui merite d etre nomme avant de proposer quoi que ce
soit : si ce tiers est lui-meme une tache planifiee, il meurt de la
meme cause que ce qu il surveille. Un cron de surveillance branche sur
`/api/cron/monitor` aurait ete redirige en 307 comme les six autres, le
3 aout au matin, et aurait garde le meme silence. C est la forme
generale de la faute relevee dans la discipline de mesure du 3 aout :
une mesure faite avec un instrument de la meme nature que ce qu elle
evalue ne borne rien.

Le lecteur doit donc tourner pour une raison qui n a rien a voir avec
les taches planifiees.

## Trois couches, dont une seule aurait attrape la panne du 3 aout

**Couche une, la trace.** Une table `cron_runs`, une ligne par tache,
clef sur le nom : dernier declenchement observe, derniere reussite,
dernier statut, dernier detail. Deux horodatages distincts et non un
seul, parce que le cas le plus interessant est celui ou la tache est
appelee et echoue, et qu un unique champ le confond avec le cas ou
elle n est pas appelee.

L ecriture passe par un enrobage unique, `withCronTrace(nom, handler)`,
qui enveloppe chaque handler et pose la ligne quel que soit le sort de
l appel. Pas un appel a ajouter en tete de chaque route. La discipline
des regles ecrites recense trois echecs de la meme forme dans la
semaine, dont le parametre `opts?.emit` des fetchers, cable sur six
evenements et jamais emis, et le parametre `measure` passe onze fois
sur quarante-quatre sites d appel. Une trace que chaque route doit
penser a ecrire sera oubliee par la septieme route, qui est justement
celle qu on n aura pas relue.

Cette couche seule n aurait rien vu le 3 aout. Le handler n etant
jamais atteint, l enrobage ne tourne pas davantage que le reste.

**Couche deux, le lecteur interne.** Comparer, pour chaque tache
declaree, l age de sa derniere reussite a la periode que lui donne
`vercel.json`. La liste des taches et leurs plannings se lisent depuis
ce fichier, jamais depuis une copie : c est ce que fait deja
`middleware.test.ts`, et c est ce qui fera qu une septieme tache sera
couverte sans que personne y pense. Une tache dont la derniere reussite
depasse deux ou trois fois sa periode est en retard, et le retard est
la seule chose qu on puisse vraiment mesurer, l arret n etant jamais
qu un retard qu on n a pas fini d attendre.

Ou placer ce lecteur decide de sa valeur. Dans un cron, il est
inutile, pour la raison dite plus haut. Dans le rendu de la page
d administration, il devient reel : la page tourne parce qu un humain
l ouvre, donc pour une raison independante de la sante des taches. Le
cout est un bandeau qui affiche six lignes et leur retard, et le
benefice est qu il devient impossible de visiter l administration sans
voir qu une tache est morte.

Cette couche aurait attrape la panne du 3 aout le jour ou quelqu un
serait passe sur la page d administration. Ni avant, ni jamais si
personne n y passe.

**Couche trois, le lecteur externe.** Le seul dispositif qui detecte
une plateforme entierement muette est un tiers qui attend un signal et
s alarme de ne pas le recevoir. C est un interrupteur d homme mort :
chaque tache reussie envoie un ping a un service exterieur, et c est ce
service, qui ne depend ni de Vercel ni de Supabase ni du middleware,
qui alerte quand le ping cesse. L inversion est tout le sujet. Ce n est
plus la plateforme qui doit avoir la presence d esprit de signaler sa
propre panne, c est le silence qui devient l evenement.

C est la seule des trois couches qui aurait produit une alerte le 8
juin, jour de la premiere ligne restee bloquee en `running`, au lieu du
3 aout. Elle est aussi la seule qui introduit une dependance a un tiers,
et c est l arbitrage a rendre.

## Ce que la proposition ne resout pas

Une tache peut tourner, reussir, et ne rien faire. Les mesures du 3
aout montrent que quatre des cinq crons non balayeurs n avaient de
toute facon aucun travail a effectuer, faute de dossiers en
portefeuille et de decisions posees depuis plus de six mois. Une trace
de reussite les aurait declares vivants, ce qu ils auraient ete, sans
rien dire du fait que leur effet utile etait nul. Distinguer la tache
qui tourne a vide de la tache qui produit demande de tracer le travail
accompli et pas seulement le passage, ce que la couche une permet par
son champ de detail mais qu aucun seuil ne lira a la place d un humain.

Et le meme raisonnement se retrouve un cran plus bas, dans le
traitement du champ `progress.heartbeatAt` : une trace ecrite par tout
le monde ne mesure plus rien, une trace que personne ne lit ne mesure
rien non plus. Les deux echecs sont symetriques.

## Recommandation

Couche une, puis couche deux au rendu de la page d administration.
Elles ne dependent d aucun tiers, elles se tiennent en un enrobage et
un bandeau, et elles transforment une panne indetectable en une panne
qui se voit des qu on regarde. La couche trois vaut la dependance
qu elle coute, mais elle se decide separement, et elle merite d etre
posee comme une question de gouvernance plutot que comme une tache
technique : accepte-t-on qu un service exterieur sache quand Prelude se
tait.
