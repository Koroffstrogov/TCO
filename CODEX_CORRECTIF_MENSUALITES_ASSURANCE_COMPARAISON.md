# Prompt Codex — Correction des mensualités avec assurance et du tableau de comparaison

## Mission

Dans le dépôt `calculimmo`, corrige précisément les indicateurs de mensualité du résumé et le tableau de comparaison.

Le retour utilisateur signale deux problèmes :

1. les indicateurs de résultat ne présentent pas clairement la mensualité avec assurance ;
2. dans le tableau de comparaison, la valeur de la mensualité après événements et sa différence sont incorrectes.

La cause identifiée est que `scenarioComparison.ts` compare actuellement `firstMonthlyPayment` dans les deux scénarios. Lorsqu'un événement intervient plusieurs mois après le début du prêt, la première mensualité du scénario modifié est nécessairement identique à celle du scénario initial. La valeur « Avec événements » et la différence sont alors artificiellement inchangées.

## Résultat fonctionnel attendu

Les deux écrans doivent utiliser exactement la même source de vérité :

- le résumé doit afficher la mensualité applicable après le dernier événement réellement appliqué ;
- le tableau de comparaison doit comparer cette mensualité à la mensualité initiale ;
- les montants hors assurance, assurance et assurance incluse doivent être disponibles séparément ;
- toutes les différences doivent être calculées dans le sens `après événements - initial`.

## Périmètre

Inspecte puis modifie seulement les fichiers nécessaires parmi ceux-ci :

- `src/domain/loanTypes.ts`
- `src/domain/scenarioComparison.ts`
- `src/components/results/ComparisonView.tsx`
- `src/components/results/ResultsDashboard.tsx`
- `src/components/results/MetricCard.tsx`
- `src/app/App.tsx`
- `src/styles/results.css`
- `src/tests/scenarioComparison.test.ts`
- `src/tests/resultsSummary.test.ts`

N'ajoute un nouveau fichier de domaine ou de test que si cela améliore réellement la séparation des responsabilités.

Ne modifie pas dans cette tâche :

- la formule de mensualité ;
- le moteur d'amortissement ;
- la convention d'application des événements ;
- les valeurs du scénario de référence ;
- les calculs d'intérêts, de durée, de gain ou de coût total.

Cette tâche concerne uniquement la sélection de l'échéance pertinente, l'agrégation assurance comprise et leur présentation.

## Modèle métier à mettre en place

Ajoute un modèle explicite équivalent à celui-ci dans `src/domain/loanTypes.ts` :

```ts
export type MonthlyPaymentSnapshot = {
  month: YearMonth | null;
  paymentExcludingInsurance: number;
  insurance: number;
  paymentIncludingInsurance: number;
  loanSettled: boolean;
};

export type MonthlyPaymentComparison = {
  initial: MonthlyPaymentSnapshot;
  afterEvents: MonthlyPaymentSnapshot;
  difference: {
    paymentExcludingInsurance: number;
    insurance: number;
    paymentIncludingInsurance: number;
  };
};
```

Tu peux adapter les noms si la cohérence du domaine l'exige, mais les trois composantes et l'état `loanSettled` doivent rester explicites. Rattache cette comparaison à `ScenarioComparison` afin que les composants React ne recalculent pas ces valeurs chacun de leur côté.

Conserve les propriétés existantes encore utilisées ailleurs. Ne surcharge pas silencieusement `firstMonthlyPayment` avec une nouvelle signification.

## Règles de sélection de l'échéance

Implémente une fonction pure et testable dans `src/domain/scenarioComparison.ts`.

### Situation initiale

Le snapshot initial correspond à la première ligne du tableau initial :

```text
hors assurance = initial.rows[0].monthlyPayment
assurance = initial.rows[0].insurance
avec assurance = hors assurance + assurance
```

### Situation après événements

1. Identifie le dernier événement réellement appliqué, c'est-à-dire le dernier événement dont l'identifiant apparaît dans `row.eventIds`.
2. Ne te base pas sur le dernier événement simplement déclaré : un événement postérieur au remboursement intégral peut ne pas avoir été appliqué.
3. Si cet événement a le timing `after_monthly_payment`, utilise la première ligne strictement postérieure à sa ligne comme échéance de référence.
4. Si cet événement a le timing `before_monthly_payment`, utilise sa propre ligne comme échéance de référence.
5. S'il n'existe aucun événement appliqué, utilise la première ligne du scénario modifié.
6. Si le prêt est soldé sur la ligne du dernier événement et qu'aucune échéance suivante n'existe, retourne :

```text
hors assurance = 0
assurance = 0
avec assurance = 0
loanSettled = true
month = null
```

7. Pour une échéance existante, utilise toujours l'assurance portée par la même ligne que la mensualité. C'est indispensable pour le mode `remaining_capital`.

Ne reprends pas `monthlyInsuranceInitial` pour représenter l'assurance après événement.

### Différences

Calcule systématiquement :

```text
différence hors assurance
= après événements hors assurance - initial hors assurance

différence assurance
= assurance après événements - assurance initiale

différence avec assurance
= après événements avec assurance - initial avec assurance
```

Une réduction doit donc produire une différence négative. Une augmentation doit produire une différence positive.

## Correction du tableau de comparaison

Dans `src/components/results/ComparisonView.tsx`, remplace les lignes ambiguës actuelles par trois lignes distinctes :

| Indicateur | Initial | Après le dernier événement | Différence |
|---|---:|---:|---:|
| Mensualité hors assurance | snapshot initial | snapshot après événements | après - initial |
| Assurance mensuelle | snapshot initial | snapshot après événements | après - initial |
| Mensualité avec assurance | somme initiale | somme après événements | après - initial |

Contraintes :

- ne plus utiliser `comparison.modified.firstMonthlyPayment` pour la mensualité après événements ;
- ne plus forcer la différence d'assurance à `0` ;
- afficher explicitement le signe `+` pour une augmentation et `-` pour une diminution ;
- appliquer une tonalité positive à une baisse de mensualité et négative à une hausse ;
- lorsque `loanSettled` vaut `true`, afficher `0,00 €` et une indication courte `Prêt soldé` sans casser l'alignement du tableau ;
- conserver les lignes de durée et de coûts existantes.

Le tableau doit rester lisible sur mobile et ne pas créer de débordement supplémentaire.

## Correction des indicateurs du résumé

Dans `src/components/results/ResultsDashboard.tsx`, la carte de mensualité après le dernier événement doit présenter en premier la mensualité assurance incluse.

Présentation attendue :

```text
Mensualité après le dernier événement
499,74 € / mois avec assurance
469,74 € hors assurance + 30,00 € d'assurance
-100,00 € / mois par rapport à l'initial, assurance incluse
```

Adapte naturellement le signe de la différence.

Si le prêt est soldé :

```text
0,00 € / mois
Prêt soldé après le dernier événement
```

Si nécessaire, ajoute à `MetricCard.tsx` une prop optionnelle telle que `detail?: string` et rends-la avec une classe dédiée dans `src/styles/results.css`. Ne détourne pas `delta` pour concaténer plusieurs informations difficiles à lire.

Modifie aussi `buildEventsSummary` pour que sa phrase finale indique la mensualité avec assurance et son détail hors assurance + assurance. Cette fonction doit recevoir le snapshot calculé par le domaine et ne pas refaire le calcul.

Dans `App.tsx`, supprime la transmission isolée de `paymentAfterModification` si elle devient redondante. Transmets la comparaison ou le snapshot typé provenant du domaine. Le résumé et le tableau doivent consommer le même objet.

## Tests obligatoires

### `src/tests/scenarioComparison.test.ts`

Ajoute des tests portant sur les valeurs numériques internes, avant formatage :

1. **Événement plusieurs mois après le début**
   - vérifier que la mensualité après événements ne provient pas de `rows[0]` ;
   - vérifier que la différence hors assurance n'est pas artificiellement égale à zéro lorsque la mensualité change.

2. **Mensualité personnalisée avec assurance fixe**
   - utiliser un événement avec une mensualité personnalisée connue, par exemple `710 €` ;
   - vérifier : hors assurance `710`, assurance de la ligne suivante, total égal à leur somme ;
   - vérifier les trois différences `après - initial`.

3. **Assurance sur capital restant dû**
   - vérifier que l'assurance après événement est celle de la ligne de référence suivant l'événement ;
   - vérifier qu'elle n'est pas remplacée par `monthlyInsuranceInitial` ;
   - vérifier `avec assurance = hors assurance + assurance`.

4. **Plusieurs événements**
   - vérifier que le snapshot correspond au dernier événement réellement appliqué, et non à l'événement actif dans l'interface ni au premier événement.

5. **Événement non appliqué après extinction du prêt**
   - vérifier qu'il est ignoré pour déterminer la mensualité de référence.

6. **Remboursement total**
   - utiliser un scénario exact déjà supporté par le moteur, par exemple un prêt à taux nul soldé par un événement ;
   - vérifier les trois montants à zéro et `loanSettled = true`.

7. **Aucun événement appliqué**
   - vérifier que les snapshots initial et après événements utilisent la première échéance et que les trois différences valent zéro.

### `src/tests/resultsSummary.test.ts`

Adapte les tests de `buildEventsSummary` pour vérifier :

- la présence du montant avec assurance ;
- le détail hors assurance et assurance ;
- le cas du prêt soldé.

Si la structure des composants est déjà testée ailleurs, adapte les tests existants plutôt que de dupliquer leur couverture.

## Invariants à vérifier dans les tests

Pour les snapshots initial et après événements :

```ts
paymentIncludingInsurance === paymentExcludingInsurance + insurance
```

Pour les différences :

```ts
difference.paymentExcludingInsurance ===
  afterEvents.paymentExcludingInsurance - initial.paymentExcludingInsurance;

difference.insurance ===
  afterEvents.insurance - initial.insurance;

difference.paymentIncludingInsurance ===
  afterEvents.paymentIncludingInsurance - initial.paymentIncludingInsurance;
```

Utilise les helpers d'arrondi existants uniquement dans les assertions d'affichage. Ne fais aucun arrondi destructif dans le domaine.

## Vérifications finales

Exécute :

```bash
npm test
npm run build
```

À la fin, fournis :

1. la cause racine confirmée ;
2. la liste des fichiers modifiés ;
3. le choix exact de la ligne utilisée après le dernier événement ;
4. les nouveaux tests ajoutés ;
5. le résultat complet de `npm test` et `npm run build` ;
6. un signalement séparé de toute anomalie découverte hors périmètre, sans la corriger dans cette tâche.

## Critères d'acceptation

Le correctif est terminé uniquement si :

- le tableau n'utilise plus la première mensualité du scénario modifié pour représenter la mensualité après événements ;
- la valeur après événements et sa différence sont mathématiquement cohérentes ;
- les mensualités avec assurance sont visibles dans le résumé et le tableau ;
- l'assurance variable provient de la même échéance que la mensualité comparée ;
- le résumé et le tableau utilisent la même source de vérité ;
- le prêt soldé affiche zéro après événement ;
- tous les tests et le build passent ;
- les calculs existants d'intérêts, de durée, de coût et de gain restent inchangés.
