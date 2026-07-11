# Comparateur TCO automobile local

Application web autonome permettant de comparer le coût total de possession de véhicules librement décrits. Elle n’embarque ni catalogue, ni tarif de marché, ni règle réglementaire supposée à jour : toutes les hypothèses financières et d’usage restent visibles et modifiables.

## Lancer l’application

Double-cliquez sur `index.html`, ou ouvrez-le depuis votre navigateur. Aucun serveur, compte, build, téléchargement de dépendance ou accès réseau n’est nécessaire. Les scripts sont volontairement chargés comme scripts classiques pour rester compatibles avec une ouverture directe en `file://`.

Les navigateurs peuvent restreindre `localStorage` en navigation privée. L’application reste alors utilisable pendant la session et affiche un avertissement si la sauvegarde échoue.

## Utilisation

1. Renseignez les **hypothèses communes** : horizon, kilométrages, prix d’énergie et paramètres indicatifs d’IK.
2. Décrivez chaque véhicule dans sa carte scénario : prix d’achat, année de mise en circulation, kilométrage à l’achat, frais, taxe, aides, consommation et coûts annuels.
3. Sélectionnez un profil et un niveau de décote pour chaque scénario.
4. Modifiez au besoin les taux annuels et les réglages avancés d’âge/kilométrage du profil.
5. Consultez la synthèse, le détail des composantes et les graphiques, actualisés à chaque saisie.

Les nombres acceptent la virgule ou le point décimal. Les pourcentages acceptent notamment `12`, `12%`, `12,5%` et `0.125` ; ils sont stockés sous forme de ratio (`0.12` pour 12 %). Un champ vide vaut temporairement zéro. Les saisies négatives ou hors limites sont signalées sans bloquer le reste de l’interface.

L’interface qualifie les champs avec six repères : **↑ TCO** pour les coûts qui l’augmentent, **↓ TCO** pour les aides, remises et IK qui le réduisent, **Calcul** pour les informations utilisées sans effet toujours directionnel, **Indicatif** pour les simples repères qui ne sont jamais injectés automatiquement dans le TCO, **Projection** pour une information de suivi sans pénalité initiale, et **Hors TCO** pour la description ou l’affichage.

## Sauvegarde, export et import

Chaque modification est sauvegardée automatiquement dans trois clés versionnées de `localStorage` :

- `tcoApp.v3.settings`
- `tcoApp.v3.scenarios`
- `tcoApp.v3.depreciationProfiles`

Le bouton **Sauvegarder** force une sauvegarde et confirme son résultat. **Exporter JSON** télécharge un état V3 complet et normalisé. **Importer JSON** attend un objet contenant `settings`, `scenarios` et `depreciationProfiles`, puis valide et recharge l’état. Les exports V1 et V2 restent acceptés. Les anciennes clés sont relues puis migrées automatiquement lorsqu’aucune sauvegarde V3 n’existe.

Lors d’une migration V2, un véhicule neuf sans année reçoit l’année courante. Une occasion sans année conserve `null` et affiche un avertissement. Le kilométrage d’achat absent devient `0`, la sensibilité kilométrique devient `0` et tous les coefficients d’âge deviennent `1` : la migration est donc neutre pour les anciens calculs.

**Réinitialiser** restaure l’ensemble de la configuration initiale. Le bouton de restauration dans l’éditeur ne réinitialise que les 12 profils de décote fournis par la spécification.

## Séparation des données V3

Les hypothèses communes sont limitées à neuf valeurs partagées : horizon KPI, horizon recommandé, kilométrages total et professionnel, prix essence et électricité, barème IK indicatif, majoration électrique et coefficient de prudence.

Chaque scénario est la source de vérité pour son véhicule :

- prix d’achat net, frais d’achat et taxe d’immatriculation ;
- aide à l’achat et remise complémentaire ;
- consommation adaptée à l’énergie ;
- entretien, pneus et assurance annuels ;
- IK annuelle effectivement retenue dans le TCO ;
- énergie, statut et profil de décote.
- année de mise en circulation, kilométrage à l’achat et éventuel kilométrage annuel propre au scénario.

Deux véhicules de même énergie peuvent donc utiliser des hypothèses entièrement différentes. `kilometrageAnnuelOverride` et `prixEnergieOverride` acceptent `null` pour conserver l’hypothèse commune.

## Modèle de calcul

À l’horizon KPI (1 à 10 ans), la valeur résiduelle part du prix réel payé, après aides et remises. Ce prix intègre déjà l’âge et le kilométrage présents au moment de l’achat : aucune pénalité initiale supplémentaire n’est appliquée.

Les dix taux du profil correspondent désormais aux dix premières années de vie du véhicule. L’âge à l’achat est calculé avec `année courante − année de mise en circulation`. Une occasion âgée de 5 ans applique donc le taux « âge 6 » pendant sa première année de possession. Le taux « âge 10 » est répété pour toutes les années suivantes. Si l’année d’une occasion est inconnue, l’application conserve temporairement un index par année de possession et affiche un avertissement.

Pour chaque année, le taux sélectionné est ensuite multiplié par le coefficient correspondant à l’âge atteint. Cette courbe produit une valeur résiduelle de base. Un facteur kilométrique est enfin calculé uniquement sur l’écart futur entre le kilométrage annuel du scénario et celui de référence :

```text
âge N = âge à l’achat + N
année du profil = min(âge N, 10)
taux effectif N = taux du profil[année du profil] × coefficient d’âge(âge N)
```

```text
écart futur année N = (km annuels − km annuels de référence) × N
facteur km = 1 − (écart futur / 10 000) × sensibilité
valeur finale = valeur de base × facteur km
```

Le facteur est plafonné entre `0,70` et `1,15`. La correction kilométrique n’est jamais réinjectée dans la courbe de l’année suivante : elle est recalculée depuis la valeur de base de chaque année. Le kilométrage présent à l’achat sert uniquement à afficher le kilométrage projeté.

Les douze profils conservent leurs dix taux historiques. Chacun possède en plus un kilométrage annuel de référence, une sensibilité par tranche de 10 000 km et onze coefficients d’âge couvrant `0–1 an` jusqu’à `20 ans et +`. Les valeurs par défaut sont volontairement neutres (`0`, `0 %` et coefficients `1`).

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

Le test couvre notamment le décalage du profil selon l’âge, la répétition du taux âge 10, les kilométrages égal/supérieur/inférieur à la référence, les plafonds du facteur, l’absence de double correction du kilométrage initial, les projections, les coefficients d’âge et les migrations V1/V2.

## Limites volontaires de la V3

- aucune donnée de prix, de marché ou de fiscalité n’est récupérée ;
- aucun modèle automobile n’est proposé ; les mentions « Tesla » ne nomment que les profils de décote imposés par la spécification ;
- les coûts d’entretien, pneus et assurance sont des montants annuels simplifiés ;
- la valeur résiduelle est une projection mécanique des taux, coefficients et sensibilités manuels ;
- les prix d’énergie et consommations sont constants sur l’horizon ;
- l’IK retenue est une hypothèse utilisateur, pas un calcul réglementaire ;
- les données restent propres au navigateur et au fichier local utilisé.
