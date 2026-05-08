# Moteur de Fragilite Structurelle

Ce dossier contient les fiches de specification des patterns du moteur
Fragilite Structurelle de Prelude. Le moteur s active conditionnellement
sur les dossiers Series B et au-dela via la matrice de pertinence.

## Vision

> "Cette entreprise est-elle en train de devenir plus forte, ou plus fragile
> sans que le marche ne le voie encore ?"

Les outils VC traditionnels mesurent ce qui croit. Prelude mesure ce qui
pourrait casser. Les outils existants analysent les fondamentaux apparents.
Prelude analyse les fragilites structurelles invisibles. Les outils
existants prennent un instantane. Prelude lit une trajectoire dans le temps.

## Mapping des fragilites identifiees vers les modules

| Fragilite (vision) | Module Prelude |
|---|---|
| Soutenabilite profonde | Growth Subsidized Model |
| Modeles subventionnes par le capital | Growth Subsidized Model |
| Marges artificielles | Growth Subsidized Model + Coherence Financiere (m10) |
| Dependances cachees | Infrastructure Hostage + Internal Reality Leak (NDrift) |
| Dependances infrastructurelles | Infrastructure Hostage |
| Asymetries de pouvoir | Capital Structure Fragility |
| Coûts exponentiels | Fixed Cost Trap |
| Risques reglementaires differes | Regulatory Time Bomb |
| Faux moats | Commoditization Drift |
| Dependances narratives | Narrative Drift Analysis (deja code) |
| Points de rupture | Stress Simulation Engine (Phase 3) |
| Fragilites geopolitiques | Dependency Graph (Phase 3) |
| Structures plus fragiles a l echelle | Score de Trajectoire (Phase 4) |

Treize fragilites identifiees, neuf modules pour les couvrir. Aucun outil
VC actuel ne couvre ce perimetre.

## Architecture en six couches anti-hallucination

Chaque pattern du moteur applique systematiquement six couches de filtre
pour eviter les diagnostics par analogie hative.

1. **Pre-screening** via la matrice de pertinence. Detection du stade et
   de l archetype business. Le moteur ne tourne que si applicable.

2. **Pattern applicability filter**. Pour chaque pattern, classifier qui
   determine s il est applicable au business model du dossier. Fixed Cost
   Trap n est pas applicable a Airbnb (asset chez les hosts). Il est
   applicable a WeWork (baux long-terme chez WeWork).

3. **Evidence collection symetrique**. Pour chaque pattern marque
   applicable, collecte des evidences pro ET contra. La symetrie est la
   protection cle contre l overfit.

4. **Scoring avec contre-test**. Intensite, confidence, et evidence
   contraire chiffrees separement. Si l evidence contraire pese 50 quand
   l evidence pro pese 60, le pattern est marque unresolved.

5. **Cross-validation contre archetypes positifs**. Si le moteur detecte
   WeWork-like, il compare a Airbnb (counter-archetype). Si la proximite
   Airbnb est plus forte, le pattern est downgrade.

6. **Trajectory analysis** (en mode re-evaluation). Calcul des deltas si
   une analyse anterieure existe.

## Fiches existantes

### Patterns redigees et integrees

- **Narrative Drift Analysis** : code dans `lib/engines/narrative-drift-engine.ts`
  avec sa taxonomie lexicale calibree sur six corpus (WeWork, Theranos,
  Airbnb, Stripe, Mistral, controle SaaS). Test LLM reel valide sur Theranos
  (verdict drapeau-rouge, score 89) et Stripe (verdict sain, score 10).

### Patterns redigees a integrer

- **Growth Subsidized Model** : voir `growth-subsidized-model.md`
- **Infrastructure Hostage** : voir `infrastructure-hostage.md`
- **Fixed Cost Trap** : voir `fixed-cost-trap.md`

### Patterns a rediger

- Regulatory Time Bomb
- Commoditization Drift
- Capital Structure Fragility
- Scale Mirage Risk

### Modules trans-stade non encore demarres

- Stress Simulation Engine (Phase 3)
- Dependency Graph (Phase 3)
- Score de Trajectoire (Phase 4, le plus differenciant commercialement)

## Prochaines sessions

1. Test du moteur Narrative Drift sur un dossier reel (UP&CHARGE ou autre)
   pour valider en conditions de production avant integration UI.

2. Integration UI propre de Narrative Drift dans le pipeline et la note
   d instruction. Trois heures de travail technique : enrichissement
   extraction-engine pour le stade granulaire, ajout dans la matrice de
   pertinence, appel conditionnel dans pipeline-runner, nouvelle section
   dans la note d instruction (HomeClient + InvestmentNoteView). Plus un
   bouton dev "Forcer Narrative Drift" pour le mode test sur dossiers seed.

3. Redaction des prochaines fiches patterns dans des sessions dediees, sur
   le meme modele que Narrative Drift et Growth Subsidized.

4. Conception du Score de Trajectoire (Phase 4), fonctionnalite la plus
   differenciante commercialement pour les fonds growth (monitoring de
   portefeuille).

## Positionnement

Le moteur de Fragilite Structurelle est ce qui transforme Prelude en
infrastructure d instruction du capital growth. C est le module qui
justifie un tarif Institution a 15 ou 25K EUR/mois pour des fonds comme
Eurazeo, Axa Equity, Tikehau Capital, Ardian.

Phrase de pitch en une ligne : "Prelude est l infrastructure d instruction
qui mesure ce que les outils traditionnels ne peuvent pas voir : les
fragilites structurelles qui s accumulent dans le succes apparent, et
leur trajectoire dans le temps."

## Contraintes anti-hallucination communes a tous les patterns

- Tagging strict des sources : [pitch], [bp], [web], [inference]
- Evidence factuelle obligatoire pour tout score >= 60
- Symetrie evidencePro / evidenceContra
- Counter-archetype le plus proche identifie systematiquement
- Contrainte de coherence entre metriques objectives et score LLM
- Pas de conclusion sans citation textuelle datee ou metrique chiffree
