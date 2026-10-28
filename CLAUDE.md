# Dictionaryx

Jeu de bluff multi-écran (le « jeu du dictionnaire »), en français. Site statique sans framework ni bundler : Preact et htm en UMD, synchronisation entre téléphones par Supabase (Postgres et Realtime), hébergement Vercel. Les joueurs n’ont pas de compte : un identifiant aléatoire par téléphone (localStorage), un pseudo, un code de partie de 4 lettres.

## Liens

- GitHub : https://github.com/fedelo-studio/dictionaryx (branche `main`, chaque push déploie sur Vercel)
- Vercel : https://vercel.com/fedelo-studios-projects/dictionaryx (dossier lié par `vercel link`, voir `.vercel/`). Production : https://dictionaryx-nine.vercel.app, domaine prévu dictionaryx.fedelo.studio
- Supabase : projet `dictionaryx` (ref `lcgxeukwsatdooulveeo`, région eu-west-3, organisation fedelo.studio), migration appliquée. `SUPABASE_URL` et `SUPABASE_ANON_KEY` (clé publishable) sont définies sur Vercel pour Production, Preview et Development, et dans `.env` en local.

## Commandes

- `npm install`
- `npm run build` : génère `dist/` (app.js concaténé à partir de `src/`, styles, bibliothèques copiées depuis node_modules, polices, `config.js` écrit à partir de l’environnement)
- `npm run dev` : build puis serveur local sur http://localhost:5173 ; les chemins `/ABCD` renvoient vers index.html comme sur Vercel
- `npm test` : règles du jeu et banque de mots

## Structure

- `src/core.js` : règles du jeu dans le bloc `LOGIC` (fonctions pures, testées par `test/logic.test.mjs`), état partagé, transitions `TRANS`, progression automatique (tout le monde a écrit, tout le monde a voté, chrono écoulé).
- `src/platform-web.js` : accès Supabase, compare-and-swap sur `rooms.version`, abonnement Realtime et présence, routage par code, écrans d’accueil, formulaire de pseudo, invitation.
- `src/ui.js` : composants Preact écrits avec htm.
- `src/main.js` : démarrage.
- `src/styles.css`, `src/index.html`, `public/` (favicon, police phonétique et sa licence).
- `src/bank.json` : banque de mots. Les définitions sont encodées au build pour ne pas être lisibles dans la source de la page.
- `immersive/` : la version 3D (Vite, React 18, React Three Fiber 8, drei). Elle ne recopie pas le moteur : `vite.config.js` assemble `src/core.js` et `src/platform-web.js` tels quels, React tenant lieu de Preact, donc mêmes règles et mêmes parties Supabase. `scripts/fonts.mjs` télécharge Strawford (woff2 et woff, le texte 3D ne lit pas le woff2) depuis le Blob privé avant le build. Projet Vercel à part, `dictionaryx-3d`, racine `immersive`. `npm --prefix immersive run dev` sur le port 5175. Chaque joueur choisit une figurine en arrivant (`state.figs`, action `fig` de `TRANS`, `immersive/src/figures.js`) : les sept animaux du pack Farm Animals de Quaternius (CC0), gardés en maillages low-poly dans `immersive/src/scene/figures.json` par `immersive/scripts/figures.mjs` à partir des OBJ du pack, qui restent hors du dépôt, et rendus en argile mate à facettes sur un socle (`immersive/src/scene/Figure.jsx`) ; le socle s'éclaire quand le joueur a écrit et monte en colonne avec le score. Les formes distinguent les joueurs, la couleur reste celle du studio : blanc, orange pour soi et pour le premier.
- `supabase/migrations/` : tables `rooms` (état de la partie en jsonb, `version`), `players` (pseudo, `gone` quand un joueur quitte), `subs` (bluff et vote de chaque joueur pour la manche `rk`), politiques RLS, publication Realtime.

## Déploiement

1. Supabase : créer un projet, ou utiliser celui que l’utilisateur désigne, puis appliquer `supabase/migrations/20261025000000_dictionaryx.sql`. Récupérer l’URL du projet et la clé anon (ou la clé publishable).
2. Vercel : créer le projet depuis ce dossier, définir `SUPABASE_URL` et `SUPABASE_ANON_KEY` pour Production et Preview, déployer. `vercel.json` fixe l’installation, le build, le dossier `dist` et la réécriture `/:code` vers `index.html`.
3. Vérifier en ligne : ouvrir le site dans deux navigateurs, créer une partie dans l’un, la rejoindre avec le code dans l’autre, jouer une manche jusqu’au classement.

## Règles à garder

- Concurrence : tout changement de l’état d’une partie passe par `act()` puis `cas()` (update conditionné sur `version`). Le premier téléphone gagne, les autres relisent et abandonnent. Une nouvelle action de jeu s’ajoute comme entrée de `TRANS` et se teste dans `test/logic.test.mjs` si elle touche les règles.
- Sécurité : RLS volontairement ouvert, puisque quiconque a le code peut jouer. Pour durcir : activer les connexions anonymes de Supabase et limiter l’écriture de `players` et `subs` à `auth.uid()`.
- Nettoyage : les parties inactives peuvent être supprimées avec la requête en commentaire dans la migration, planifiable avec pg_cron.
- Typographie française : dans les sources, `¤` vaut une espace insécable (avant « : » et à l’intérieur des guillemets) et `¦` une espace fine insécable (avant « ; », « ! » et « ? ») ; le build les remplace. Aucun tiret cadratin ou demi-cadratin dans les textes : le build échoue s’il en trouve.
- Design : le langage de fedelo.studio (dépôt `fedelo.studio.website`, `css/variables.css` et `docs/design-system.md`, bibliothèque Figma `KAndrGLOc2YVTXCRFeB3EC`). Sombre uniquement (#080808), Strawford seule en 300, 400 et 500, jamais d'italique (l'emphase passe en Medium), un seul accent orange (`--hot` #ff4a1c) pour le x du logo, les numéros, ce qui compte et le point « en ligne ». Échelle typographique du site déclarée une fois en tête de `src/styles.css`, rien de courant sous 15 px, capitales espacées réservées aux libellés de section (`.kicker`) et à leurs parents. Variante « jeu » du design system : surfaces `--surface` et `--surface-2`, filet `--line-strong`, rayon `--radius-game` (20 px). Les champs sont des boîtes visibles (focus orange), l'action qui fait avancer la partie est une pastille orange pleine de 56 px, les définitions sont des cartes à toucher repérées par une lettre (A, B, C), les étapes de la manche (Bluff, Vote, Verdict) restent visibles en haut, le mot en jeu est posé sur une carte éclairée d'un coin, le chrono est une pastille qui passe à l'orange sous 10 s, chaque joueur a sa couleur vive (`AV_COLORS`). Animations en `transform` et `opacity` seulement. Pas de mode clair ni de shader. Le pied de page signe « Un jeu fedelo.studio » avec le monogramme.
- Polices : Strawford vient du site fedelo.studio (licence réglée pour Dictionaryx). Ses fichiers ne doivent jamais entrer dans le dépôt, qui est public : `public/fonts/strawford-*` est ignoré par git, et les trois woff2 vivent dans le Blob privé `dictionaryx-fonts` du projet Vercel (`fonts/strawford-*-webfont.woff2`). `scripts/build.mjs` les télécharge avec `BLOB_READ_WRITE_TOKEN` quand `public/fonts` ne les a pas, et échoue sur Vercel si le jeton manque. En local, copier les fichiers depuis `fedelo.studio.website/assets/fonts/`. `public/fonts/dico-ipa.woff2` est un sous-ensemble renommé de Gentium Book Plus (licence OFL, voir `public/fonts/OFL.txt`) réservé à la phonétique, Strawford n'ayant pas les symboles API ; servi en un seul fichier pour que les voyelles nasales comme « ɑ̃ » gardent leur tilde au bon endroit. À régénérer avec `scripts/ipa-font.py` si de nouveaux symboles apparaissent dans la banque.
