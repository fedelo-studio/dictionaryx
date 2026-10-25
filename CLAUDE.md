# Dictionaryx

Jeu de bluff multi-écran (le « jeu du dictionnaire »), en français. Site statique sans framework ni bundler : Preact et htm en UMD, synchronisation entre téléphones par Supabase (Postgres et Realtime), hébergement Vercel. Les joueurs n’ont pas de compte : un identifiant aléatoire par téléphone (localStorage), un pseudo, un code de partie de 4 lettres.

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
- Design : une page de dictionnaire sur une liseuse. Literata pour la lecture et les entrées, Geist Mono pour les libellés de l’appareil, une seule encre électrique (`--accent`) pour les entrées et ce qui compte, filets fins plutôt que cartes, sélection en négatif. Texte aligné à gauche, pas de filet d’accent vertical sur les blocs arrondis, animations en opacité et translateX, ombres jamais coupées, vert réservé aux statuts.
- Police phonétique : `public/fonts/dico-ipa.woff2` est un sous-ensemble renommé de Gentium Book Plus (licence OFL, voir `public/fonts/OFL.txt`), servi en un seul fichier pour que les voyelles nasales comme « ɑ̃ » gardent leur tilde au bon endroit. À régénérer avec `scripts/ipa-font.py` si de nouveaux symboles apparaissent dans la banque.
