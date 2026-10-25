# Dictionaryx

Le jeu du dictionnaire, chacun sur son téléphone. Un mot rare tombe sur tous les écrans, chacun invente une fausse définition crédible, puis tout le monde vote pour celle qu’il croit vraie.

- Pas de compte : un pseudo suffit.
- Chaque partie a un code de 4 lettres et un lien direct, par exemple `dictionaryx-nine.vercel.app/ZABL`.
- Deux modes : une banque de 130 mots rares avec leur phonétique, ou « vrai dictionnaire », où un meneur différent à chaque manche choisit un mot dans un dictionnaire et recopie sa définition.
- Points : +2 si tu trouves la vraie définition, +1 pour chaque joueur qui mord à ton bluff, +3 pour le meneur si personne ne trouve.

## Mettre en ligne avec Claude Code

1. Dézippe le dossier et ouvre-le dans Claude Code.
2. Demande : « Déploie Dictionaryx en suivant CLAUDE.md ».
3. Claude Code crée la base Supabase (ou utilise celle que tu lui indiques), applique la migration, renseigne les deux variables d’environnement sur Vercel et déploie.
4. Ouvre l’adresse Vercel, crée une partie et envoie le lien à tes amis.

Il faut un compte Supabase et un compte Vercel ; les offres gratuites suffisent pour jouer entre amis.

## En local

```bash
npm install
cp .env.example .env   # puis renseigne SUPABASE_URL et SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
npm test               # vérifie les règles et la banque de mots
```

## Ajouter des mots

Les mots vivent dans `src/bank.json`, une ligne par mot : `[mot, terminaison féminine, phonétique, nature, registre, définition]`. Si la phonétique d’un nouveau mot utilise un symbole absent des autres, relance `python3 scripts/ipa-font.py`.
