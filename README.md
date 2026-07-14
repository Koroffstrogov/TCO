# Comparateur TCO automobile local

Application web autonome permettant de comparer le coût total de possession de véhicules librement décrits. Elle n’embarque ni catalogue, ni tarif de marché, ni règle réglementaire supposée à jour : toutes les hypothèses financières et d’usage restent visibles et modifiables.

## Lancer l’application

Double-cliquez sur `index.html`, ou ouvrez-le depuis votre navigateur. Aucun serveur, compte, build, téléchargement de dépendance ou accès réseau n’est nécessaire. Les scripts sont volontairement chargés comme scripts classiques pour rester compatibles avec une ouverture directe en `file://`.

Les navigateurs peuvent restreindre `localStorage` en navigation privée. L’application reste alors utilisable pendant la session et affiche un avertissement si la sauvegarde échoue.

## Utilisation

1. Renseignez les **hypothèses communes** : horizon, kilométrages, prix d’énergie et paramètres indicatifs d’IK.
2. Décrivez chaque véhicule dans sa carte scénario : prix d’achat, année de mise en circulation, kilométrage à l’achat, frais, taxe, aides, montant de reprise, consommation et coûts annuels.
3. Sélectionnez un profil et un niveau de décote pour chaque scénario.
4. Modifiez au besoin les dix taux du profil, indexés sur l’âge du véhicule, ou utilisez l’assistant **Profil de décote automatique**.
5. Consultez la synthèse, le détail annuel par scénario, les graphiques de TCO et la courbe de valeur résiduelle, actualisés à chaque saisie.

Les nombres acceptent la virgule ou le point décimal. Les pourcentages acceptent notamment `12`, `12%`, `12,5%` et `0.125` ; ils sont stockés sous forme de ratio (`0.12` pour 12 %). Un champ vide vaut temporairement zéro. Les saisies négatives ou hors limites sont signalées sans bloquer le reste de l’interface.

L’interface qualifie les champs avec six repères : **↑ TCO** pour les coûts qui l’augmentent, **↓ TCO** pour les aides, remises, reprises et IK qui le réduisent, **Calcul** pour les informations utilisées sans effet toujours directionnel, **Indicatif** pour les simples repères qui ne sont jamais injectés automatiquement dans le TCO, **Projection** pour une information de suivi sans pénalité initiale, et **Hors TCO** pour la description ou l’affichage.

## Sauvegarde, export et import

Chaque modification est sauvegardée automatiquement dans trois clés versionnées de `localStorage` :

- `tcoApp.v3.settings`
- `tcoApp.v3.scenarios`
- `tcoApp.v3.depreciationProfiles`

Le bouton **Sauvegarder** force une sauvegarde et confirme son résultat. **Exporter JSON** télécharge un état V3 complet et normalisé. **Importer JSON** attend un objet contenant `settings`, `scenarios` et `depreciationProfiles`, puis valide et recharge l’état. Les exports V1 et V2 restent acceptés. Les anciennes clés sont relues puis migrées automatiquement lorsqu’aucune sauvegarde V3 n’existe.

Lors d’une migration V2, un véhicule neuf sans année reçoit l’année courante. Une occasion sans année conserve `null` et affiche un avertissement. Le kilométrage d’achat et le montant de reprise absents deviennent `0`. Les anciens réglages avancés éventuellement présents dans un profil sont retirés lors de la normalisation.

**Réinitialiser** restaure l’ensemble de la configuration initiale. Le bouton de restauration dans l’éditeur ne réinitialise que les 12 profils de décote fournis par la spécification.

## Séparation des données V3

Les hypothèses communes sont limitées à neuf valeurs partagées : horizon KPI, horizon recommandé, kilométrages total et professionnel, prix essence et électricité, barème IK indicatif, majoration électrique et coefficient de prudence.

Chaque scénario est la source de vérité pour son véhicule :

- prix d’achat net, frais d’achat et taxe d’immatriculation ;
- aide à l’achat, remise complémentaire et montant de reprise du véhicule ;
- consommation adaptée à l’énergie ;
- entretien, pneus et assurance annuels ;
- IK annuelle effectivement retenue dans le TCO ;
- énergie, statut et profil de décote ;
- année de mise en circulation, kilométrage à l’achat et éventuel kilométrage annuel propre au scénario.

Deux véhicules de même énergie peuvent donc utiliser des hypothèses entièrement différentes. `kilometrageAnnuelOverride` et `prixEnergieOverride` acceptent `null` pour conserver l’hypothèse commune.

## Modèle de calcul

À l’horizon KPI (1 à 10 ans), la valeur résiduelle part du prix réel payé, après aides et remises. Ce prix intègre déjà l’âge et le kilométrage présents au moment de l’achat : aucune pénalité initiale supplémentaire n’est appliquée.

Les dix taux du profil correspondent désormais aux dix premières années de vie du véhicule. L’âge à l’achat est calculé avec `année courante − année de mise en circulation`. Une occasion âgée de 5 ans applique donc le taux « âge 6 » pendant sa première année de possession. Le taux « âge 10 » est répété pour toutes les années suivantes. Si l’année d’une occasion est inconnue, l’application conserve temporairement un index par année de possession et affiche un avertissement.

L’assistant de profil automatique relie exactement un prix de départ à un prix final estimé sur une durée entière de 1 à 10 ans. Il propose trois trajectoires : **Taux annuel constant** (`c = 1`), **Décote légèrement accélérée au début** (`c = 0,85`) et **Décote initiale forte** (`c = 0,65`). Le taux annuel moyen équivalent affiché reste le même pour ces trois formes ; seuls les taux annuels réels changent. La courbe est prévisualisée et prolongée jusqu’à l’année 10, puis ses dix taux sont appliqués au profil choisi. Le tableau manuel reste la source enregistrée : les taux générés peuvent être retouchés et sont sauvegardés comme les autres profils.

```text
âge N = âge à l’achat + N
année du profil = min(âge N, 10)
taux N = taux du profil[année du profil]
valeur résiduelle N = valeur résiduelle N−1 × (1 − taux N)
```

Le kilométrage présent à l’achat ne pénalise pas une seconde fois la valeur : il sert uniquement à afficher le kilométrage projeté. Les douze profils conservent uniquement leurs dix taux historiques modifiables.

Le montant de reprise est traité comme un apport propre au scénario. Il est déduit du coût d’acquisition et du TCO dès l’année 0, mais ne réduit pas l’assiette de décote du véhicule acheté ni sa valeur résiduelle projetée.

Le panneau **Détail annuel par scénario** sépare désormais trois lectures complémentaires :

- la **composition économique du TCO** additionne la décote, les usages, les frais et la taxe, puis déduit une seule fois la reprise et les IK ; la valeur résiduelle n’y apparaît pas séparément puisqu’elle est déjà intégrée dans la décote ;
- la **trésorerie annuelle** présente l’acquisition nette en année 0, les coûts d’utilisation, les IK encaissées et une revente simulée uniquement dans la dernière année ; la dépense nette cumulée se réconcilie exactement avec le résultat économique final à l’horizon ;
- la **valeur estimée du véhicule** montre positivement l’assiette à l’achat puis la valeur de l’actif à chaque fin d’année, sans la traiter comme une recette avant la revente simulée.

Chaque scénario affiche d’abord une synthèse à l’horizon et la composition du TCO, puis la trésorerie, la valeur du véhicule et enfin un détail complet par poste repliable. Un résultat négatif est libellé **Excédent théorique après IK** et présenté en valeur absolue afin d’éviter de confondre un gain théorique avec un « TCO négatif ».

Le TCO brut additionne :

```text
décote + frais d’achat + taxe d’immatriculation
+ énergie cumulée + entretien cumulé + pneus cumulés + assurance cumulée
```

Le TCO net soustrait ensuite `scenario.montantReprise`, puis `scenario.ikAnnuelleRetenue × horizon`. Le coût annuel divise ce résultat par l’horizon ; le coût par kilomètre le divise par le kilométrage total utilisé pour ce scénario. La référence de comparaison est le premier scénario thermique inclus, ou à défaut le premier scénario inclus. L’IK indicative et son bonus électrique restent de simples repères communs : ils n’écrasent jamais l’IK retenue d’un scénario.

## Vérification

Les cas chiffrés des critères d’acceptation sont couverts par un script sans dépendance :

```powershell
node tests/calculations.test.js
```

Le test couvre notamment le décalage du profil selon l’âge, la répétition du taux âge 10, les projections kilométriques, la décomposition annuelle réconciliée, les calculs TCO et les migrations V1/V2.

## Limites volontaires de la V3

- aucune donnée de prix, de marché ou de fiscalité n’est récupérée ;
- aucun modèle automobile n’est proposé ; les mentions « Tesla » ne nomment que les profils de décote imposés par la spécification ;
- les coûts d’entretien, pneus et assurance sont des montants annuels simplifiés ;
- la valeur résiduelle est une projection mécanique des dix taux manuels ;
- les prix d’énergie et consommations sont constants sur l’horizon ;
- l’IK retenue est une hypothèse utilisateur, pas un calcul réglementaire ;
- les données restent propres au navigateur et au fichier local utilisé.
