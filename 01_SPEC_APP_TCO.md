# Spécification fonctionnelle — Application TCO locale

## 1. Finalité

L’application calcule et compare le coût total de possession automobile entre un scénario thermique et des scénarios électriques. Elle est conçue pour une lecture locale, sans serveur, sans base de données et sans référentiel de modèles.

Elle doit servir d’outil de décision paramétrable. Les hypothèses doivent rester visibles et modifiables.

## 2. Périmètre V1

Inclus :

- saisie des paramètres globaux ;
- saisie de scénarios véhicule libres ;
- profils de décote sur 10 ans ;
- sauvegarde locale ;
- export/import JSON ;
- comparaison dynamique ;
- graphiques de comparaison ;
- calcul de TCO brut et net après IK.

Exclus :

- base de modèles automobiles ;
- récupération de prix marché ;
- connexion à une API ;
- fiscalité détaillée autre que les champs fournis ;
- authentification ;
- serveur ;
- tableur externe obligatoire.

## 3. Organisation de l’interface

L’écran principal doit être organisé en sections.

### 3.1 Synthèse

Afficher des cartes de résultat :

- scénario le moins coûteux à l’horizon KPI ;
- TCO net après IK par scénario ;
- écart en euros vs thermique ;
- coût moyen annuel ;
- coût par km ;
- valeur résiduelle estimée.

### 3.2 Paramètres globaux

Tous les paramètres globaux doivent être éditables. Les champs doivent être regroupés par thème :

- horizon et kilométrage ;
- prix d’achat ;
- énergie ;
- IK ;
- frais et fiscalité ;
- entretien, pneus, assurance ;
- aides et remises.

### 3.3 Scénarios véhicule

Chaque scénario contient :

- nom libre ;
- énergie : thermique ou électrique ;
- statut : occasion ou neuf ;
- profil de décote ;
- niveau de décote ;
- consommation selon énergie ;
- inclusion dans la comparaison ;
- option de duplication ;
- option de suppression, sauf pour les scénarios initiaux si cela simplifie la V1.

Les scénarios par défaut sont :

| Identifiant | Nom affiché | Énergie | Statut | Profil par défaut | Niveau par défaut |
|---|---|---:|---:|---|---|
| thermal_used | Thermique occasion | thermique | occasion | Thermique occasion | Central |
| electric_used | Électrique occasion | électrique | occasion | Tesla occasion | Central |
| electric_new | Électrique neuve | électrique | neuf | Électrique neuve | Central |

Ces scénarios ne sont pas une base de modèles. Ils sont seulement des lignes de comparaison éditables.

### 3.4 Profils de décote

L’éditeur doit afficher une table avec :

- clé ;
- type de décote ;
- niveau ;
- année 1 à année 10 ;
- actions : modifier, dupliquer, supprimer.

Un assistant optionnel permet de générer les dix taux d’un profil à partir d’un prix de départ, d’un prix final estimé et d’une durée de 1 à 10 ans, selon une interpolation exponentielle composée. L’utilisateur choisit une forme à taux annuel constant (`c = 1`), légèrement accélérée au début (`c = 0,85`) ou à décote initiale forte (`c = 0,65`). La trajectoire est prolongée jusqu’à l’année 10 ; sa prévisualisation, ses taux annuels réels et son taux annuel moyen équivalent sont affichés avant de conserver les dix taux modifiables dans le profil sélectionné.

L’utilisateur doit pouvoir sauvegarder plusieurs profils. La clé logique recommandée est :

```text
<Type décote>|<Niveau>
```

Exemple :

```text
Thermique occasion|Central
```

### 3.5 Graphiques

Afficher au moins :

- comparaison du TCO net après IK ;
- TCO cumulé année par année ;
- décomposition de coût par composante, si le temps le permet.

Graphiques en Canvas ou SVG natif. Pas de dépendance externe.

## 4. Paramètres globaux obligatoires

| Clé technique | Libellé UI | Type | Unité | Défaut recommandé | Commentaire |
|---|---|---:|---:|---:|---|
| horizonKpi | Horizon KPI | entier | années | 5 | Borne V1 : 1 à 10 ans. |
| prixNetDepartElec | Prix net départ élec | nombre | € | 0 | Prix saisi par l’utilisateur. |
| prixNetDepartThermique | Prix net départ thermique | nombre | € | 0 | Prix saisi par l’utilisateur. |
| kilometrageTotalAnnuel | Kilométrage total annuel | nombre | km/an | 0 | Sert aux coûts énergie et coût/km. |
| kilometrageProRembourseIk | Kilométrage pro remboursé IK | nombre | km/an | 0 | Sert au calcul IK indicatif. |
| prixEssence | Prix essence | nombre | €/L | 0 | Pas de valeur marché codée en dur. |
| prixElectricite | Prix électricité | nombre | €/kWh | 0 | Pas de valeur marché codée en dur. |
| baremeIkActuel | Barème IK actuel | nombre | €/km | 0 | Paramètre libre, pas de barème réglementaire embarqué. |
| majorationVehiculeElectrique | Majoration véhicule électrique | pourcentage | % | 0 | Ex : saisir `20%` ou `0,20`. |
| coefficientPrudenceIk | Coefficient de prudence IK | nombre | coefficient | 1 | Multiplie l’IK indicative. |
| ikActuellesAnnuelles | IK actuelles annuelles | nombre | €/an | 0 | Montant annuel retenu pour le scénario actuel. |
| bonusIkElectriqueRetenu | Bonus IK électrique retenu | nombre | €/an | 0 | Bonus annuel ajouté aux IK des scénarios électriques. |
| horizonAnalyseRecommande | Horizon d'analyse recommandé | entier | années | 5 | Affiché comme repère, sans remplacer l’horizon KPI. |
| taxeImmatriculation | Taxe d'immatriculation | nombre | € | 0 | Coût non récupérable. |
| fraisAchatThermiqueOccasion | Frais achat thermique occasion | nombre | € | 0 | Coût non récupérable. |
| fraisAchatElectriqueOccasion | Frais achat électrique occasion | nombre | € | 0 | Coût non récupérable. |
| fraisAchatElectriqueNeuve | Frais achat électrique neuve | nombre | € | 0 | Coût non récupérable. |
| entretienThermiqueStandard | Entretien thermique standard | nombre | €/an | 0 | Coût annuel. |
| entretienElectriqueStandard | Entretien électrique standard | nombre | €/an | 0 | Coût annuel. |
| pneusThermiqueStandard | Pneus thermique standard | nombre | €/an | 0 | Coût annuel. |
| pneusModelYStandard | Pneus Model Y standard | nombre | €/an | 0 | Coût annuel électrique par défaut, libellé conservé. |
| assuranceThermiqueStandard | Assurance thermique standard | nombre | €/an | 0 | Coût annuel. |
| assuranceElectriqueStandard | Assurance électrique standard | nombre | €/an | 0 | Coût annuel. |
| aideVeNeuveEligible | Aide VE neuve éligible | nombre | € | 0 | Soustraite uniquement aux scénarios électriques neufs. |
| surbonusRemiseComplementaire | Surbonus / remise complémentaire | nombre | € | 0 | Soustrait uniquement aux scénarios électriques neufs. |

## 5. Champs scénario additionnels

Ces champs sont nécessaires au calcul, mais ne constituent pas une base de référence.

| Clé technique | Libellé UI | Type | Unité | Défaut recommandé | Commentaire |
|---|---|---:|---:|---:|---|
| name | Nom du scénario | texte | — | selon scénario | Editable. |
| energyType | Type d’énergie | enum | — | thermique/électrique | Contrôle le calcul énergie. |
| acquisitionStatus | Statut | enum | — | occasion/neuf | Contrôle les frais et aides. |
| montantReprise | Montant de reprise du véhicule | nombre | € | 0 | Déduit de l’acquisition et du TCO sans modifier l’assiette de décote. |
| depreciationType | Type décote | enum | — | selon scénario | Doit correspondre aux profils disponibles. |
| depreciationLevel | Niveau décote | enum | — | Central | Optimiste, Central, Pessimiste ou niveau utilisateur. |
| consoThermiqueL100 | Consommation thermique | nombre | L/100 km | 0 | Utilisé si énergie thermique. |
| consoElectriqueKwh100 | Consommation électrique | nombre | kWh/100 km | 0 | Utilisé si énergie électrique. |
| includeInCharts | Inclure dans les graphiques | booléen | — | true | Permet d’exclure un scénario. |

## 6. Persistance

Utiliser `localStorage` avec des clés versionnées :

```text
tcoApp.v1.settings
tcoApp.v1.scenarios
tcoApp.v1.depreciationProfiles
```

L’application doit gérer le cas où les données stockées sont absentes, incomplètes ou invalides.

## 7. Import / export

Exporter un JSON unique contenant :

```json
{
  "version": 1,
  "exportedAt": "ISO_DATE",
  "settings": {},
  "scenarios": [],
  "depreciationProfiles": []
}
```

L’import doit valider la présence minimale de `settings`, `scenarios` et `depreciationProfiles`, puis recharger l’interface.

## 8. Règles UX

- Tout changement déclenche un recalcul.
- Les résultats doivent rester lisibles même si des champs valent 0.
- Les erreurs de saisie doivent être affichées près des champs concernés.
- Les formats français doivent être acceptés : virgule décimale, espaces, symbole `%`, symbole `€`.
- Les valeurs exportées doivent être normalisées en nombres JavaScript.
