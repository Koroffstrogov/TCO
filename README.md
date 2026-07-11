# Comparateur TCO automobile local

Application web autonome permettant de comparer le coût total de possession de véhicules librement décrits. Elle n’embarque ni catalogue, ni tarif de marché, ni règle réglementaire supposée à jour : toutes les hypothèses financières et d’usage restent visibles et modifiables.

## Lancer l’application

Double-cliquez sur `index.html`, ou ouvrez-le depuis votre navigateur. Aucun serveur, compte, build, téléchargement de dépendance ou accès réseau n’est nécessaire. Les scripts sont volontairement chargés comme scripts classiques pour rester compatibles avec une ouverture directe en `file://`.

Les navigateurs peuvent restreindre `localStorage` en navigation privée. L’application reste alors utilisable pendant la session et affiche un avertissement si la sauvegarde échoue.

## Utilisation

1. Renseignez les **hypothèses communes** : horizon, kilométrages, prix d’énergie et paramètres indicatifs d’IK.
2. Décrivez chaque véhicule dans sa carte scénario : prix d’achat, frais, taxe, aides, remise, consommation, entretien, pneus, assurance et IK retenues.
3. Sélectionnez un profil et un niveau de décote pour chaque scénario.
4. Modifiez au besoin les taux annuels dans l’éditeur de décotes.
5. Consultez la synthèse, le détail des composantes et les graphiques, actualisés à chaque saisie.

Les nombres acceptent la virgule ou le point décimal. Les pourcentages acceptent notamment `12`, `12%`, `12,5%` et `0.125` ; ils sont stockés sous forme de ratio (`0.12` pour 12 %). Un champ vide vaut temporairement zéro. Les saisies négatives ou hors limites sont signalées sans bloquer le reste de l’interface.

L’interface qualifie les champs avec cinq repères : **↑ TCO** pour les coûts qui l’augmentent, **↓ TCO** pour les aides, remises et IK qui le réduisent, **Calcul** pour les informations utilisées sans effet toujours directionnel, **Indicatif** pour les simples repères qui ne sont jamais injectés automatiquement dans le TCO, et **Hors TCO** pour la description ou l’affichage.

## Sauvegarde, export et import

Chaque modification est sauvegardée automatiquement dans trois clés versionnées de `localStorage` :

- `tcoApp.v2.settings`
- `tcoApp.v2.scenarios`
- `tcoApp.v2.depreciationProfiles`

Le bouton **Sauvegarder** force une sauvegarde et confirme son résultat. **Exporter JSON** télécharge un état V2 complet et normalisé. **Importer JSON** attend un objet contenant `settings`, `scenarios` et `depreciationProfiles`, puis valide et recharge l’état. Les exports V1 restent acceptés : leurs coûts globaux sont migrés vers chacun des scénarios selon son énergie et son statut. Les anciennes clés V1 sont également relues automatiquement lorsqu’aucune sauvegarde V2 n’existe.

**Réinitialiser** restaure l’ensemble de la configuration initiale. Le bouton de restauration dans l’éditeur ne réinitialise que les 12 profils de décote fournis par la spécification.

## Séparation des données V2

Les hypothèses communes sont limitées à neuf valeurs partagées : horizon KPI, horizon recommandé, kilométrages total et professionnel, prix essence et électricité, barème IK indicatif, majoration électrique et coefficient de prudence.

Chaque scénario est la source de vérité pour son véhicule :

- prix d’achat net, frais d’achat et taxe d’immatriculation ;
- aide à l’achat et remise complémentaire ;
- consommation adaptée à l’énergie ;
- entretien, pneus et assurance annuels ;
- IK annuelle effectivement retenue dans le TCO ;
- énergie, statut et profil de décote.

Deux véhicules de même énergie peuvent donc utiliser des hypothèses entièrement différentes. Le format V2 prend aussi en charge des overrides optionnels de kilométrage annuel et de prix d’énergie dans le JSON ; une valeur `null` conserve l’hypothèse commune.

## Modèle de calcul

À l’horizon KPI (1 à 10 ans), la valeur résiduelle applique successivement les dix taux annuels du profil choisi à la valeur du véhicule hors frais et taxes. Les aides et remises propres au scénario sont d’abord soustraites de cette assiette, sans règle implicite liée à l’énergie ou au statut.

Le TCO brut additionne :

```text
décote + frais d’achat + taxe d’immatriculation
+ énergie cumulée + entretien cumulé + pneus cumulés + assurance cumulée
```

Le TCO net soustrait ensuite `scenario.ikAnnuelleRetenue × horizon`. Le coût annuel divise ce résultat par l’horizon ; le coût par kilomètre le divise par le kilométrage total utilisé pour ce scénario. La référence de comparaison est le premier scénario thermique inclus, ou à défaut le premier scénario inclus. L’IK indicative et son bonus électrique restent de simples repères communs : ils n’écrasent jamais l’IK retenue d’un scénario.

## Vérification

Les cas chiffrés des critères d’acceptation sont couverts par un script sans dépendance :

```powershell
node tests/calculations.test.js
```

Le test couvre la décote, les coûts propres aux véhicules, l’énergie thermique et électrique, les IK, les overrides, la coexistence de deux VE différents, la migration V1, l’aller-retour JSON, les formats de pourcentage et l’intégrité des 12 profils par défaut.

## Limites volontaires de la V2

- aucune donnée de prix, de marché ou de fiscalité n’est récupérée ;
- aucun modèle automobile n’est proposé ; les mentions « Tesla » ne nomment que les profils de décote imposés par la spécification ;
- les coûts d’entretien, pneus et assurance sont des montants annuels simplifiés ;
- la valeur résiduelle est une projection mécanique des taux manuels ;
- les prix d’énergie et consommations sont constants sur l’horizon ;
- l’IK retenue est une hypothèse utilisateur, pas un calcul réglementaire ;
- les données restent propres au navigateur et au fichier local utilisé.
