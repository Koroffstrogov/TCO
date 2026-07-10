# Paramètres de décote — Profils par défaut

Les profils ci-dessous sont les seuls profils par défaut à embarquer dans l’application. Ils doivent être modifiables, duplicables, sauvegardables et restaurables.

## 1. Table de décotes par défaut

| Clé | Type décote | Niveau | Année 1 | Année 2 | Année 3 | Année 4 | Année 5 | Année 6 | Année 7 | Année 8 | Année 9 | Année 10 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Thermique occasion\|Optimiste | Thermique occasion | Optimiste | 9,0% | 8,0% | 7,0% | 6,0% | 5,0% | 4,0% | 4,0% | 3,0% | 3,0% | 3,0% |
| Thermique occasion\|Central | Thermique occasion | Central | 12,0% | 10,0% | 8,0% | 7,0% | 6,0% | 5,0% | 5,0% | 4,0% | 4,0% | 4,0% |
| Thermique occasion\|Pessimiste | Thermique occasion | Pessimiste | 16,0% | 13,0% | 11,0% | 9,0% | 8,0% | 7,0% | 6,0% | 5,0% | 5,0% | 5,0% |
| Tesla occasion\|Optimiste | Tesla occasion | Optimiste | 10,0% | 9,0% | 8,0% | 7,0% | 6,0% | 5,0% | 4,0% | 4,0% | 3,0% | 3,0% |
| Tesla occasion\|Central | Tesla occasion | Central | 12,0% | 10,0% | 9,0% | 8,0% | 7,0% | 6,0% | 5,0% | 5,0% | 4,0% | 4,0% |
| Tesla occasion\|Pessimiste | Tesla occasion | Pessimiste | 18,0% | 15,0% | 12,0% | 10,0% | 9,0% | 8,0% | 7,0% | 6,0% | 6,0% | 5,0% |
| Électrique neuve\|Optimiste | Électrique neuve | Optimiste | 17,0% | 12,0% | 10,0% | 8,0% | 7,0% | 6,0% | 5,0% | 4,0% | 4,0% | 3,0% |
| Électrique neuve\|Central | Électrique neuve | Central | 22,0% | 15,0% | 12,0% | 10,0% | 8,0% | 7,0% | 6,0% | 5,0% | 5,0% | 4,0% |
| Électrique neuve\|Pessimiste | Électrique neuve | Pessimiste | 30,0% | 20,0% | 16,0% | 12,0% | 10,0% | 9,0% | 8,0% | 7,0% | 6,0% | 6,0% |
| Tesla neuve\|Optimiste | Tesla neuve | Optimiste | 18,0% | 12,0% | 10,0% | 8,0% | 7,0% | 6,0% | 5,0% | 4,0% | 4,0% | 3,0% |
| Tesla neuve\|Central | Tesla neuve | Central | 24,0% | 16,0% | 13,0% | 10,0% | 8,0% | 7,0% | 6,0% | 5,0% | 5,0% | 4,0% |
| Tesla neuve\|Pessimiste | Tesla neuve | Pessimiste | 32,0% | 22,0% | 16,0% | 12,0% | 10,0% | 9,0% | 8,0% | 7,0% | 6,0% | 6,0% |

## 2. Lecture des scénarios

| Niveau | Interprétation |
|---|---|
| Optimiste | Décote plus lente : marché porteur, bon état, garantie, revente facile. |
| Central | Hypothèse moyenne pour décider sans excès de prudence. |
| Pessimiste | Décote accélérée : baisse des prix neufs, technologie dépassée, marché difficile. |

## 3. Structure JavaScript recommandée

Codex peut transformer la table en tableau d’objets JS dans `js/defaults.js`.

```js
export const DEFAULT_DEPRECIATION_PROFILES = [
  {
    key: 'Thermique occasion|Optimiste',
    type: 'Thermique occasion',
    level: 'Optimiste',
    rates: [0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03]
  },
  {
    key: 'Thermique occasion|Central',
    type: 'Thermique occasion',
    level: 'Central',
    rates: [0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.04]
  },
  {
    key: 'Thermique occasion|Pessimiste',
    type: 'Thermique occasion',
    level: 'Pessimiste',
    rates: [0.16, 0.13, 0.11, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.05]
  },
  {
    key: 'Tesla occasion|Optimiste',
    type: 'Tesla occasion',
    level: 'Optimiste',
    rates: [0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04, 0.03, 0.03]
  },
  {
    key: 'Tesla occasion|Central',
    type: 'Tesla occasion',
    level: 'Central',
    rates: [0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04]
  },
  {
    key: 'Tesla occasion|Pessimiste',
    type: 'Tesla occasion',
    level: 'Pessimiste',
    rates: [0.18, 0.15, 0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.06, 0.05]
  },
  {
    key: 'Électrique neuve|Optimiste',
    type: 'Électrique neuve',
    level: 'Optimiste',
    rates: [0.17, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04, 0.03]
  },
  {
    key: 'Électrique neuve|Central',
    type: 'Électrique neuve',
    level: 'Central',
    rates: [0.22, 0.15, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04]
  },
  {
    key: 'Électrique neuve|Pessimiste',
    type: 'Électrique neuve',
    level: 'Pessimiste',
    rates: [0.30, 0.20, 0.16, 0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.06]
  },
  {
    key: 'Tesla neuve|Optimiste',
    type: 'Tesla neuve',
    level: 'Optimiste',
    rates: [0.18, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04, 0.03]
  },
  {
    key: 'Tesla neuve|Central',
    type: 'Tesla neuve',
    level: 'Central',
    rates: [0.24, 0.16, 0.13, 0.10, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04]
  },
  {
    key: 'Tesla neuve|Pessimiste',
    type: 'Tesla neuve',
    level: 'Pessimiste',
    rates: [0.32, 0.22, 0.16, 0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.06]
  }
];
```

## 4. Règles de sauvegarde

Les profils par défaut peuvent être restaurés à tout moment.

Les profils utilisateur doivent pouvoir coexister avec les profils par défaut. Si l’utilisateur modifie un profil par défaut, l’application peut soit :

1. sauvegarder la modification sous la même clé dans `localStorage`, avec un bouton de restauration ;
2. soit forcer la duplication avant modification.

Option recommandée V1 : autoriser la modification directe et proposer `Restaurer les profils par défaut`.

## 5. Validation des taux

- Accepter la saisie `12`, `12%`, `12,0%`, `0,12`, `0.12`.
- Stocker en interne `0.12`.
- Afficher en pourcentage français avec une décimale si possible.
- Refuser ou signaler les taux inférieurs à 0 ou supérieurs à 100%.
