# Comparateur TCO automobile local

Application web autonome permettant de comparer le coût total de possession d’un scénario thermique et de plusieurs scénarios électriques. Elle n’embarque ni catalogue de véhicules, ni tarif de marché, ni règle réglementaire supposée à jour : toutes les hypothèses financières et d’usage restent visibles et modifiables.

## Lancer l’application

Double-cliquez sur `index.html`, ou ouvrez-le depuis votre navigateur. Aucun serveur, compte, build, téléchargement de dépendance ou accès réseau n’est nécessaire. Les scripts sont volontairement chargés comme scripts classiques pour rester compatibles avec une ouverture directe en `file://`.

Les navigateurs peuvent restreindre `localStorage` en navigation privée. L’application reste alors utilisable pendant la session et affiche un avertissement si la sauvegarde échoue.

## Utilisation

1. Renseignez les paramètres globaux, notamment les prix de départ, kilométrages, coûts d’énergie et IK.
2. Ajustez les trois scénarios initiaux ou ajoutez/dupliquez librement des scénarios.
3. Sélectionnez un profil et un niveau de décote pour chaque scénario.
4. Modifiez au besoin les taux annuels dans l’éditeur de décotes.
5. Consultez la synthèse, le détail des composantes et les graphiques, actualisés à chaque saisie.

Les nombres acceptent la virgule ou le point décimal. Les pourcentages acceptent notamment `12`, `12%`, `12,5%` et `0.125` ; ils sont stockés sous forme de ratio (`0.12` pour 12 %). Un champ vide vaut temporairement zéro. Les saisies négatives ou hors limites sont signalées sans bloquer le reste de l’interface.

## Sauvegarde, export et import

Chaque modification est sauvegardée automatiquement dans trois clés versionnées de `localStorage` :

- `tcoApp.v1.settings`
- `tcoApp.v1.scenarios`
- `tcoApp.v1.depreciationProfiles`

Le bouton **Sauvegarder** force une sauvegarde et confirme son résultat. **Exporter JSON** télécharge l’état complet normalisé. **Importer JSON** attend un objet contenant `settings`, `scenarios` et `depreciationProfiles`, puis valide et recharge l’état. **Réinitialiser** restaure l’ensemble de la configuration initiale. Le bouton de restauration dans l’éditeur ne réinitialise que les 12 profils de décote fournis par la spécification.

## Modèle de calcul

À l’horizon KPI (1 à 10 ans), la valeur résiduelle applique successivement les dix taux annuels du profil choisi à la valeur du véhicule hors frais et taxes. Pour un électrique neuf, les aides et remises saisies sont d’abord soustraites de cette assiette.

Le TCO brut additionne :

```text
décote + frais d’achat + taxe d’immatriculation
+ énergie cumulée + entretien cumulé + pneus cumulés + assurance cumulée
```

Le TCO net soustrait ensuite les IK retenues cumulées. Le coût annuel divise ce résultat par l’horizon ; le coût par kilomètre le divise par le kilométrage total de l’horizon. La référence de comparaison est le premier scénario thermique inclus, ou à défaut le premier scénario inclus. L’IK indicative et son bonus électrique sont affichés comme repères seulement : ils n’écrasent jamais les montants d’IK retenus saisis par l’utilisateur.

## Vérification

Les cas chiffrés des critères d’acceptation sont couverts par un script sans dépendance :

```powershell
node tests/calculations.test.js
```

Le test couvre la décote simple, les aides d’un électrique neuf, les coûts d’énergie thermique et électrique, les IK, les formats de pourcentage et l’intégrité des 12 profils par défaut.

## Limites volontaires de la V1

- aucune donnée de prix, de marché ou de fiscalité n’est récupérée ;
- aucun modèle automobile n’est proposé ; les mentions « Tesla » ne nomment que les profils de décote imposés par la spécification ;
- les coûts d’entretien, pneus et assurance sont des montants annuels simplifiés ;
- la valeur résiduelle est une projection mécanique des taux manuels ;
- les prix d’énergie et consommations sont constants sur l’horizon ;
- l’IK retenue est une hypothèse utilisateur, pas un calcul réglementaire ;
- les données restent propres au navigateur et au fichier local utilisé.
