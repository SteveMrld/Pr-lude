# Validation extraction financiere sur corpus

Rapport genere le 2026-07-15, harnais scripts/validate-extraction-corpus.ts.

## Trois questions

- Q1. Sur combien de dossiers le modele produit une valeur lastActualYear ?
- Q2. Sur combien il s abstient explicitement (extraction reussie mais valeur null) ?
- Q3. Sur combien la valeur passe les gardes de la primitive (evidence non vide, annee presente dans les projections, annee non posterieure a la derniere annee des projections) ?

## Chiffres bruts

- Dossiers total en corpus : 28
- Dossiers avec upload PDF : 25
- Dossiers skip (pas de PDF) : 3
- Erreurs download / extraction : 5

**Q1 :** 9 / 25 dossiers avec upload produisent une valeur lastActualYear non nulle.
**Q2 :** 11 / 25 dossiers avec upload : extraction reussie mais lastActualYear=null (abstention).
**Q3 :** 9 / 25 dossiers passent les gardes de la primitive (evidence + appartenance aux projections + non posteriorite).

Duree totale : 1126s.

## Tableau par dossier

| Dossier | Statut | lastActualYear | Evidence (extrait) | Basis 2023 | Basis 2024 | Basis 2025 | Basis 2026 | MaxProj | Gap | Primitive |
|---|---|---|---|---|---|---|---|---|---|---|
| Mistral AI | skipped-no-upload | — |  |  |  |  |  | — | — | - |
| BlueAi | skipped-no-upload | — |  |  |  |  |  | — | — | - |
| JNAN Hotels | skipped-no-upload | — |  |  |  |  |  | — | — | - |
| PEN GROUP | ok | — |  |  |  |  | projected | 2033 | — | last-actual-year-absent |
| Platypus Craft | ok | — |  |  |  |  |  | — | — | last-actual-year-absent |
| ZargesTubesca Group | ok | 2014 | "All companies included in the transaction perimeter have be |  |  |  |  | 2018 | 4 | OK |
| Alliance Marine | ok | 2015 | FY15A figures include the contribution from acquisitions com |  |  |  |  | 2020 | 5 | OK |
| JM Bruneau SAS (Bruneau) | ok | 2013 | 2013A Sales: €296m / 2013A adjusted EBITDA: €27.6m / tableau |  |  |  |  | 2016 | 3 | OK |
| Ambulife | ok | — |  |  |  |  |  | 2026 | — | last-actual-year-absent |
| Crowdaa | ok | — |  |  | projected | projected | projected | 2026 | — | last-actual-year-absent |
| Bemersive | ok | — |  |  |  |  |  | — | — | last-actual-year-absent |
| Liik | ok | — |  |  |  |  |  | 2029 | — | last-actual-year-absent |
| BlueAi | ok | — |  |  |  |  |  | — | — | last-actual-year-absent |
| UP&CHARGE | ok | — |  |  |  |  |  | 2030 | — | last-actual-year-absent |
| Humanava | ok | — |  |  |  |  |  | 2026 | — | last-actual-year-absent |
| Technicis | ok | 2014 | "Les comptes de résultat et bilans présentés sont construits |  |  |  |  | 2020 | 6 | OK |
| Bemersive (EVABOX) | ok | — |  |  |  |  |  | 2022 | — | last-actual-year-absent |
| Redcats Children and Family Br | extraction-error | — |  |  |  |  |  | — | — | - |
| OOGarden SAS | ok | 2013 | "au 31 décembre, en k€ 2011A 2012A 2013A 2014B [...] Chiffre |  |  |  |  | 2017 | 4 | OK |
| Compagnie des Alpes - Portefeu | extraction-error | — |  |  |  |  |  | — | — | - |
| Tratel Affrètement SASU | ok | 2014 | 2012a-2014a P&L as per adjusted reporting – tableau titré '2 |  |  |  |  | 2019 | 5 | OK |
| Braincube | extraction-error | — |  |  |  |  |  | — | — | - |
| Annajah Motors | ok | — |  |  |  |  |  | 2029 | — | last-actual-year-absent |
| Smart&co | extraction-error | — |  |  |  |  |  | — | — | - |
| Odalys | ok | 2013 | "2011A 2012A 2013A / Net sales 178.7 212.0 229.3" – tableau  |  |  |  |  | 2016 | 3 | OK |
| Saint-Gobain Silicon Carbide B | extraction-error | — |  |  |  |  |  | — | — | - |
| HEI (Hygiène et Environnement  | ok | 2014 | "Comptes de résultat détaillés sur la période 2012-2014 (en  |  |  |  |  | 2017 | 3 | OK |
| TOLSON | ok | 2023 | Tableau P&L page 38 : colonne '2023A' sous l'en-tête 'Histor | actual | budget | projected | projected | 2026 | 3 | OK |

## Motifs de rejet par la primitive

- last-actual-year-absent : 11 dossiers

## Justesse

Ce rapport mesure ce que le modele produit, il ne sait pas ce qui est vrai.
Verification manuelle sur echantillon a effectuer separement.