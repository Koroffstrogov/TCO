# Modèle de calcul TCO

Ce document décrit le modèle de calcul de la V1. Il privilégie la transparence et la personnalisation plutôt qu’une précision réglementaire ou marché.

## 1. Principes

Le TCO est calculé à l’horizon KPI choisi par l’utilisateur.

En V1, l’horizon exploité pour la décote est borné à 10 ans, car les profils de décote contiennent 10 années. Si `horizonKpi` dépasse 10, afficher un message indiquant que la décote V1 est limitée à 10 ans. Le comportement recommandé est de borner le calcul de décote à 10 ans, tout en gardant les coûts annuels jusqu’à l’horizon demandé si l’interface accepte plus de 10 ans. Pour une V1 plus simple, borner `horizonKpi` à 1–10 ans.

Tous les coûts doivent être calculés scénario par scénario.

## 2. Définitions

### 2.1 Acquisition brute

Pour un scénario thermique :

```text
prixVehicule = prixNetDepartThermique
```

Pour un scénario électrique :

```text
prixVehicule = prixNetDepartElec
```

### 2.2 Aides et remises

Pour un scénario électrique neuf :

```text
aidesApplicables = aideVeNeuveEligible + surbonusRemiseComplementaire
```

Pour tous les autres scénarios :

```text
aidesApplicables = 0
```

### 2.3 Frais d’achat

Pour un thermique occasion :

```text
fraisAchat = fraisAchatThermiqueOccasion
```

Pour un électrique occasion :

```text
fraisAchat = fraisAchatElectriqueOccasion
```

Pour un électrique neuf :

```text
fraisAchat = fraisAchatElectriqueNeuve
```

### 2.4 Taxes

La taxe d’immatriculation est appliquée à chaque scénario :

```text
taxes = taxeImmatriculation
```

V1 simple : ne pas différencier la taxe par énergie, sauf si l’utilisateur duplique le champ plus tard.

### 2.5 Coût d’acquisition net payé

```text
coutAcquisitionNet = max(0, prixVehicule - aidesApplicables) + fraisAchat + taxes - montantReprise
```

### 2.6 Assiette de valeur résiduelle

La valeur résiduelle porte sur la valeur du véhicule, hors frais et taxes non récupérables.

```text
assietteValeur = max(0, prixVehicule - aidesApplicables)
```

## 3. Décote

Chaque profil de décote contient 10 taux annuels.

Exemple pour 3 ans :

```text
valeurAnnee0 = assietteValeur
valeurAnnee1 = valeurAnnee0 * (1 - tauxAnnee1)
valeurAnnee2 = valeurAnnee1 * (1 - tauxAnnee2)
valeurAnnee3 = valeurAnnee2 * (1 - tauxAnnee3)
```

À l’horizon :

```text
valeurResiduelle = assietteValeur * produit(1 - tauxAnneeN) pour N de 1 à horizonKpi
coutDecote = assietteValeur - valeurResiduelle
```

Les taux doivent être manipulés en ratio interne :

```text
12% = 0.12
```

### 3.1 Profil de décote automatique

Pour un prix de départ `P0`, un prix estimé `PX` et une durée entière `X` comprise entre 1 et 10 ans :

```text
tauxDecoteAnnuel = 1 - (PX / P0) ^ (1 / X)
prixAnneeN = P0 × (PX / P0) ^ (N / X)
```

La prévisualisation contient les années `0` à `X`. Les extrémités reprennent exactement `P0` et `PX`, tandis que les valeurs intermédiaires sont arrondies à l’euro pour l’affichage. Le taux composé est appliqué aux dix taux du profil sélectionné, qui reste ensuite éditable et sauvegardé selon le format habituel.

Les deux prix doivent être strictement positifs, `PX` doit être inférieur ou égal à `P0`, et `X` doit être un entier de 1 à 10.

## 4. Énergie

### 4.1 Scénario thermique

```text
coutEnergieAnnuel = kilometrageTotalAnnuel * consoThermiqueL100 / 100 * prixEssence
```

### 4.2 Scénario électrique

```text
coutEnergieAnnuel = kilometrageTotalAnnuel * consoElectriqueKwh100 / 100 * prixElectricite
```

### 4.3 Cumul énergie

```text
coutEnergieCumule = coutEnergieAnnuel * horizonKpi
```

## 5. Entretien, pneus, assurance

### 5.1 Thermique

```text
entretienAnnuel = entretienThermiqueStandard
pneusAnnuel = pneusThermiqueStandard
assuranceAnnuel = assuranceThermiqueStandard
```

### 5.2 Électrique

```text
entretienAnnuel = entretienElectriqueStandard
pneusAnnuel = pneusModelYStandard
assuranceAnnuel = assuranceElectriqueStandard
```

Le libellé `Pneus Model Y standard` est conservé parce qu’il est demandé, mais il doit rester un champ libre, non lié à une base de modèle.

### 5.3 Cumuls

```text
entretienCumule = entretienAnnuel * horizonKpi
pneusCumule = pneusAnnuel * horizonKpi
assuranceCumule = assuranceAnnuel * horizonKpi
```

## 6. IK

La V1 distingue l’IK indicative et l’IK retenue.

### 6.1 IK indicative annuelle

```text
ikIndicativeAnnuelle = kilometrageProRembourseIk * baremeIkActuel * coefficientPrudenceIk
```

### 6.2 Bonus électrique indicatif

```text
bonusIkElectriqueIndicatif = ikIndicativeAnnuelle * majorationVehiculeElectrique
```

### 6.3 IK retenue dans le TCO

Le paramètre `ikActuellesAnnuelles` est le montant annuel retenu pour le scénario de référence.

Pour un scénario thermique :

```text
ikRetenueAnnuelle = ikActuellesAnnuelles
```

Pour un scénario électrique :

```text
ikRetenueAnnuelle = ikActuellesAnnuelles + bonusIkElectriqueRetenu
```

Cumul :

```text
ikRetenueCumulee = ikRetenueAnnuelle * horizonKpi
```

Afficher l’IK indicative et le bonus indicatif à titre d’aide à la saisie, mais ne pas écraser automatiquement `ikActuellesAnnuelles` ou `bonusIkElectriqueRetenu` sans action explicite de l’utilisateur.

## 7. TCO

### 7.1 TCO brut

Le TCO brut exclut la reprise et les IK.

```text
tcoBrut = coutDecote
        + fraisAchat
        + taxes
        + coutEnergieCumule
        + entretienCumule
        + pneusCumule
        + assuranceCumule
```

Note : le prix complet du véhicule n’est pas ajouté directement au TCO, car le coût de détention est représenté par la décote. Les frais et taxes non récupérables sont ajoutés séparément.

### 7.2 TCO net après reprise et IK

```text
tcoNetApresIk = tcoBrut - montantReprise - ikRetenueCumulee
```

La reprise est déduite dès l’année 0 mais ne modifie pas l’assiette de décote du véhicule acheté. Le résultat peut être négatif dans des cas extrêmes. Ne pas bloquer ; afficher simplement la valeur.

### 7.3 Coût annuel moyen

```text
coutAnnuelMoyen = tcoNetApresIk / horizonKpi
```

### 7.4 Coût par km

```text
kmTotalHorizon = kilometrageTotalAnnuel * horizonKpi
coutParKm = kmTotalHorizon > 0 ? tcoNetApresIk / kmTotalHorizon : null
```

### 7.5 Écart vs référence thermique

Le scénario de référence est le premier scénario thermique inclus dans la comparaison. À défaut, utiliser le premier scénario inclus.

```text
ecartVsReference = tcoNetApresIkScenario - tcoNetApresIkReference
```

Un écart négatif signifie que le scénario coûte moins cher que la référence.

## 8. Séries annuelles pour graphiques

Pour chaque année `n` de 1 à `horizonKpi`, calculer :

```text
valeurResiduelleN = assietteValeur * produit(1 - tauxAnneeI) pour I de 1 à n
coutDecoteN = assietteValeur - valeurResiduelleN
coutsAnnuelsCumulesN = n * (coutEnergieAnnuel + entretienAnnuel + pneusAnnuel + assuranceAnnuel)
ikCumuleeN = n * ikRetenueAnnuelle
tcoBrutN = coutDecoteN + fraisAchat + taxes + coutsAnnuelsCumulesN
tcoNetN = tcoBrutN - montantReprise - ikCumuleeN
```

Ces séries alimentent le graphique de TCO cumulé.

## 9. Flux annuels détaillés par scénario

Le tableau annuel distingue les coûts, les gains et les deux lectures du résultat. Les aides et remises affichées sont limitées au montant effectivement déduit du prix :

```text
aidesRemisesAppliquees = prixVehicule - assietteValeur
```

En année 0 :

```text
couts0 = prixVehicule + fraisAchat + taxes
gains0 = aidesRemisesAppliquees + montantReprise
soldeNet0 = couts0 - gains0 = coutAcquisitionNet
cumulTresorerie0 = soldeNet0
```

Pour chaque année `n` de 1 à l’horizon :

```text
coutsN = coutEnergieAnnuel + entretienAnnuel + pneusAnnuel + assuranceAnnuel
gainsN = ikRetenueAnnuelle

si n = horizonKpi :
  gainsN = gainsN + valeurResiduelleN

soldeNetN = coutsN - gainsN
cumulTresorerieN = cumulTresorerieN-1 + soldeNetN
```

La valeur résiduelle constitue donc un flux théorique uniquement à l’horizon final. En parallèle, `tcoEconomiqueN` reprend `tcoNetN` afin d’afficher ce que coûterait une sortie à chaque fin d’année. À l’horizon :

```text
valeurVehiculeDeduite0 = assietteValeur
valeurVehiculeDeduiteN = valeurResiduelleN
```

Cette valeur est un instantané non cumulable : elle explique la déduction appliquée au TCO économique de chaque colonne, mais n’est jamais additionnée aux gains annuels. La colonne « Total horizon » reprend seulement `valeurVehiculeDeduiteHorizon`.

```text
cumulTresorerieHorizon = tcoEconomiqueHorizon = tcoNetApresIk
totalCouts - totalGains = tcoNetApresIk
```

## 10. Décomposition recommandée

Pour chaque scénario, retourner une structure :

```json
{
  "scenarioId": "thermal_used",
  "name": "Thermique occasion",
  "coutAcquisitionNet": 0,
  "assietteValeur": 0,
  "valeurResiduelle": 0,
  "coutDecote": 0,
  "fraisAchat": 0,
  "taxes": 0,
  "coutEnergieCumule": 0,
  "entretienCumule": 0,
  "pneusCumule": 0,
  "assuranceCumule": 0,
  "ikRetenueCumulee": 0,
  "tcoBrut": 0,
  "tcoNetApresIk": 0,
  "coutAnnuelMoyen": 0,
  "coutParKm": null,
  "ecartVsReference": 0,
  "seriesAnnuelles": [],
  "decompositionAnnuelle": {
    "annees": [],
    "totaux": {
      "couts": {},
      "gains": {},
      "totalCouts": 0,
      "totalGains": 0,
      "soldeNet": 0
    }
  }
}
```

## 11. Validation

Règles minimales :

- horizon KPI : entier positif, idéalement 1 à 10 ;
- taux de décote : compris entre 0 et 100% ;
- kilométrages : non négatifs ;
- prix et coûts : non négatifs, sauf remise complémentaire si l’interface veut permettre une correction négative ;
- coefficient de prudence IK : non négatif ;
- consommation : non négative.

En cas de champ invalide, garder l’interface utilisable et afficher un message.
