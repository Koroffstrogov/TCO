# Critères d’acceptation et tests manuels

## 1. Lancement local

Critères :

- ouvrir `index.html` dans un navigateur suffit ;
- aucun serveur local n’est requis ;
- aucune erreur réseau ne doit apparaître en console ;
- les graphiques s’affichent sans CDN.

## 2. Paramètres obligatoires

Critères :

- tous les paramètres listés dans la spécification sont présents ;
- chaque paramètre est éditable ;
- chaque paramètre est persisté après rechargement ;
- chaque paramètre est présent dans l’export JSON.

Liste à vérifier :

- Horizon KPI
- Prix net départ élec
- Prix net départ thermique
- Kilométrage total annuel
- Kilométrage pro remboursé IK
- Prix essence
- Prix électricité
- Barème IK actuel
- Majoration véhicule électrique
- Coefficient de prudence IK
- IK actuelles annuelles
- Bonus IK électrique retenu
- Horizon d'analyse recommandé
- Taxe d'immatriculation
- Frais achat thermique occasion
- Frais achat électrique occasion
- Frais achat électrique neuve
- Entretien thermique standard
- Entretien électrique standard
- Pneus thermique standard
- Pneus Model Y standard
- Assurance thermique standard
- Assurance électrique standard
- Aide VE neuve éligible
- Surbonus / remise complémentaire

## 3. Absence de base de modèles

Critères :

- aucun catalogue de véhicules n’est présent ;
- aucun prix véhicule réel n’est imposé ;
- aucun modèle automobile n’est sélectionnable depuis une base ;
- les libellés de scénarios sont modifiables ;
- les profils de décote `Tesla occasion` et `Tesla neuve` ne sont que des profils nommés fournis par l’utilisateur, pas des fiches modèle.

## 4. Décotes

Critères :

- les 12 profils par défaut sont présents ;
- chaque profil contient exactement 10 taux ;
- les taux sont éditables ;
- une modification recalcule le TCO ;
- une modification est persistée ;
- le bouton de restauration remet les profils par défaut ;
- l’export/import conserve les profils.

## 5. Test de décote simple

Données :

```text
horizonKpi = 2
prixNetDepartThermique = 10000
aide = 0
frais = 0
taxe = 0
profil = Thermique occasion|Central
coûts annuels = 0
IK = 0
```

Taux :

```text
année 1 = 12%
année 2 = 10%
```

Calcul attendu :

```text
valeur année 1 = 10000 * 0,88 = 8800
valeur année 2 = 8800 * 0,90 = 7920
valeur résiduelle = 7920
coût décote = 2080
TCO brut = 2080
TCO net après IK = 2080
```

## 6. Test aides électrique neuf

Données :

```text
horizonKpi = 1
prixNetDepartElec = 30000
aideVeNeuveEligible = 2000
surbonusRemiseComplementaire = 1000
fraisAchatElectriqueNeuve = 500
taxeImmatriculation = 100
profil = Électrique neuve|Central
coûts annuels = 0
IK = 0
```

Taux année 1 :

```text
22%
```

Calcul attendu :

```text
assietteValeur = 30000 - 2000 - 1000 = 27000
valeur résiduelle = 27000 * 0,78 = 21060
coût décote = 5940
TCO brut = 5940 + 500 + 100 = 6540
TCO net après IK = 6540
```

## 7. Test énergie thermique

Données :

```text
horizonKpi = 3
kilometrageTotalAnnuel = 15000
consoThermiqueL100 = 6
prixEssence = 2
```

Calcul attendu :

```text
coût essence annuel = 15000 * 6 / 100 * 2 = 1800
coût essence cumulé = 1800 * 3 = 5400
```

## 8. Test énergie électrique

Données :

```text
horizonKpi = 3
kilometrageTotalAnnuel = 15000
consoElectriqueKwh100 = 16
prixElectricite = 0,25
```

Calcul attendu :

```text
coût électricité annuel = 15000 * 16 / 100 * 0,25 = 600
coût électricité cumulé = 600 * 3 = 1800
```

## 9. Test IK

Données :

```text
horizonKpi = 5
kilometrageProRembourseIk = 10000
baremeIkActuel = 0,5
coefficientPrudenceIk = 0,9
majorationVehiculeElectrique = 20%
ikActuellesAnnuelles = 3000
bonusIkElectriqueRetenu = 400
```

Calcul indicatif attendu :

```text
IK indicative annuelle = 10000 * 0,5 * 0,9 = 4500
bonus IK électrique indicatif = 4500 * 0,20 = 900
```

Calcul TCO attendu :

```text
IK retenue thermique cumulée = 3000 * 5 = 15000
IK retenue électrique cumulée = (3000 + 400) * 5 = 17000
```

## 10. Recalcul dynamique

Critères :

- modifier le prix d’achat met à jour la valeur résiduelle et le TCO ;
- modifier un taux de décote met à jour la valeur résiduelle et le graphique ;
- modifier le kilométrage met à jour le coût énergie et le coût/km ;
- modifier les IK met à jour le TCO net ;
- aucun rechargement de page n’est nécessaire.

## 11. Import/export

Critères :

- l’export télécharge ou affiche un JSON valide ;
- l’import d’un JSON exporté restaure le même état ;
- l’import invalide affiche une erreur claire ;
- l’import ne casse pas l’application.

## 12. Résilience

Critères :

- un champ vide est traité comme 0 ou signalé sans bloquer ;
- les virgules décimales sont acceptées ;
- `12%`, `12`, `12,0%`, `0,12` et `0.12` sont correctement interprétés pour les pourcentages ;
- les valeurs négatives sur les coûts affichent une alerte ou sont refusées ;
- les résultats restent visibles sur mobile.
