# Pack de prompts Markdown — Application TCO locale

Ce dossier contient les fichiers Markdown à placer dans un repo avant de demander à Codex de générer l’application.

## Utilisation recommandée

1. Créer un repo vide.
2. Copier tous les fichiers `.md` de ce dossier à la racine du repo.
3. Ouvrir Codex sur ce repo.
4. Coller le contenu de `00_PROMPT_CODEX_INITIAL.md` comme premier prompt.
5. Demander à Codex de créer les fichiers HTML/CSS/JS en respectant les autres documents.

## Contenu

| Fichier | Rôle |
|---|---|
| `00_PROMPT_CODEX_INITIAL.md` | Prompt initial à coller dans Codex. |
| `01_SPEC_APP_TCO.md` | Spécification fonctionnelle. |
| `02_MODELE_CALCUL_TCO.md` | Formules et conventions de calcul. |
| `03_PARAMETRES_DECOTES_DEFAULTS.md` | Profils de décote par défaut. |
| `04_ARCHITECTURE_REPO.md` | Architecture cible du repo. |
| `05_CRITERES_ACCEPTATION.md` | Tests manuels et critères d’acceptation. |

## Position de conception

La V1 doit rester volontairement simple : locale, transparente, sans base de modèles et avec des hypothèses utilisateur visibles. Les seuls profils embarqués sont les profils de décote fournis.
