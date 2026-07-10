# Architecture recommandée du repo

## 1. Arborescence cible

```text
/
├── index.html
├── README.md
├── css/
│   └── styles.css
└── js/
    ├── app.js
    ├── calculations.js
    ├── charts.js
    ├── defaults.js
    ├── depreciation.js
    ├── storage.js
    └── ui.js
```

## 2. Responsabilités des fichiers

### `index.html`

Contient la structure statique :

- en-tête ;
- zone de synthèse ;
- formulaire paramètres ;
- scénarios ;
- éditeur décotes ;
- graphiques ;
- boutons import/export/réinitialisation.

Charger `js/app.js` en module :

```html
<script type="module" src="js/app.js"></script>
```

### `css/styles.css`

Contient :

- variables CSS ;
- layout responsive ;
- styles de cartes ;
- styles de formulaires ;
- styles de tableaux ;
- styles d’alertes validation ;
- styles d’impression simples si possible.

### `js/defaults.js`

Expose :

```js
export const DEFAULT_SETTINGS = { ... };
export const DEFAULT_SCENARIOS = [ ... ];
export const DEFAULT_DEPRECIATION_PROFILES = [ ... ];
```

Aucune valeur externe supposée à jour ne doit être codée en dur. Pour les montants, utiliser `0` par défaut si aucune hypothèse utilisateur n’est fournie.

### `js/storage.js`

Fonctions recommandées :

```js
export function loadState();
export function saveState(state);
export function resetState();
export function exportState(state);
export function importState(jsonText);
```

Gérer les erreurs JSON et les données incomplètes.

### `js/depreciation.js`

Fonctions recommandées :

```js
export function getProfile(profiles, type, level);
export function getProfileByKey(profiles, key);
export function computeResidualValue(baseValue, rates, horizon);
export function computeAnnualResidualSeries(baseValue, rates, horizon);
export function normalizeRate(value);
export function formatRate(value);
```

### `js/calculations.js`

Fonctions recommandées :

```js
export function calculateScenarioTco(settings, scenario, profiles);
export function calculateAllScenarios(settings, scenarios, profiles);
export function calculateIkIndicators(settings);
export function getReferenceScenarioResult(results);
```

Retourner des objets complets, pas seulement des montants finaux.

### `js/charts.js`

Graphiques en Canvas ou SVG natif.

Fonctions recommandées :

```js
export function renderTcoBarChart(containerOrCanvas, results);
export function renderCumulativeTcoChart(containerOrCanvas, results);
export function renderCostBreakdownChart(containerOrCanvas, results);
```

Règles :

- effacer et redessiner à chaque mise à jour ;
- afficher les labels en français ;
- gérer les séries vides ;
- garder une lisibilité mobile.

### `js/ui.js`

Responsable de :

- rendu des formulaires ;
- rendu des scénarios ;
- rendu de la table de décotes ;
- lecture des valeurs utilisateur ;
- validation ;
- affichage des résultats ;
- branchement des événements.

### `js/app.js`

Point d’entrée :

```js
import { loadState, saveState } from './storage.js';
import { calculateAllScenarios } from './calculations.js';
import { initUi } from './ui.js';

const state = loadState();
initUi({ state, onChange: nextState => { ... } });
```

## 3. Structure d’état recommandée

```js
const state = {
  version: 1,
  settings: {
    horizonKpi: 5,
    prixNetDepartElec: 0,
    prixNetDepartThermique: 0,
    kilometrageTotalAnnuel: 0,
    kilometrageProRembourseIk: 0,
    prixEssence: 0,
    prixElectricite: 0,
    baremeIkActuel: 0,
    majorationVehiculeElectrique: 0,
    coefficientPrudenceIk: 1,
    ikActuellesAnnuelles: 0,
    bonusIkElectriqueRetenu: 0,
    horizonAnalyseRecommande: 5,
    taxeImmatriculation: 0,
    fraisAchatThermiqueOccasion: 0,
    fraisAchatElectriqueOccasion: 0,
    fraisAchatElectriqueNeuve: 0,
    entretienThermiqueStandard: 0,
    entretienElectriqueStandard: 0,
    pneusThermiqueStandard: 0,
    pneusModelYStandard: 0,
    assuranceThermiqueStandard: 0,
    assuranceElectriqueStandard: 0,
    aideVeNeuveEligible: 0,
    surbonusRemiseComplementaire: 0
  },
  scenarios: [
    {
      id: 'thermal_used',
      name: 'Thermique occasion',
      energyType: 'thermal',
      acquisitionStatus: 'used',
      depreciationType: 'Thermique occasion',
      depreciationLevel: 'Central',
      consoThermiqueL100: 0,
      consoElectriqueKwh100: 0,
      includeInCharts: true
    },
    {
      id: 'electric_used',
      name: 'Électrique occasion',
      energyType: 'electric',
      acquisitionStatus: 'used',
      depreciationType: 'Tesla occasion',
      depreciationLevel: 'Central',
      consoThermiqueL100: 0,
      consoElectriqueKwh100: 0,
      includeInCharts: true
    },
    {
      id: 'electric_new',
      name: 'Électrique neuve',
      energyType: 'electric',
      acquisitionStatus: 'new',
      depreciationType: 'Électrique neuve',
      depreciationLevel: 'Central',
      consoThermiqueL100: 0,
      consoElectriqueKwh100: 0,
      includeInCharts: true
    }
  ],
  depreciationProfiles: []
};
```

## 4. Fonctions utilitaires recommandées

Créer des helpers robustes :

```js
parseFrenchNumber(value)
parseFrenchPercent(value)
formatCurrency(value)
formatNumber(value)
formatPercent(value)
formatKm(value)
clamp(value, min, max)
uid(prefix)
```

## 5. Accessibilité et ergonomie

- Utiliser des labels associés aux inputs.
- Prévoir des titres de section clairs.
- Ne pas dépendre uniquement de la couleur dans les graphiques.
- Prévoir des textes alternatifs ou descriptions sous les graphiques.
- Gérer le clavier pour les principaux boutons.

## 6. Limites assumées V1

Documenter dans le README :

- les valeurs réglementaires ne sont pas embarquées ;
- les prix de marché ne sont pas récupérés ;
- les coûts d’entretien sont annuels et simplifiés ;
- la décote suit les profils manuels ;
- la valeur résiduelle est une estimation mécanique ;
- l’IK retenue est une hypothèse utilisateur.
