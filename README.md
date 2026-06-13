# Boardly - Tableau Blanc Collaboratif Temps Réel

[![Déployé sur Vercel](https://img.shields.io/badge/Vercel-Déployé-black?logo=vercel)](https://boardly-r3xr.vercel.app/)

**Lien du site :** [https://boardly-r3xr.vercel.app/](https://boardly-r3xr.vercel.app/)

![Aperçu](public/logo.svg)

## 🚀 Installation

### 1. Variables d'Environnement
Créez un fichier `.env` à la racine du projet :

```env
DATABASE_URL="postgresql://..."  # Votre URL NeonDB
BETTER_AUTH_SECRET="votre-secret-genere"
BETTER_AUTH_URL="http://localhost:5173"
GOOGLE_AI_API_KEY=""
```

### 2. Base de Données
Poussez le schéma vers votre base de données NeonDB :

```bash
npx prisma db push
```

### 3. Lancement
Démarrez le serveur de développement :

```bash
npm run dev
```

Rendez-vous sur `http://localhost:3000`.

## 🏗️ Architecture

- **Auth** : BetterAuth (Email/Mot de passe) avec Adaptateur Prisma.
- **Base de données** : NeonDB (PostgreSQL) via Prisma ORM.
- **Temps Réel** : Socket.io (curseurs + sync board instantanée). Fallback HTTP si WebSocket indisponible.
- **État** : Zustand (canvas local) + Prisma (persistance board).
- **Canvas** : Moteur SVG performant avec transformations matricielles (Zoom/Pan).
- **Styling** : Tailwind CSS + shadcn/ui.

## 🛠️ Fonctionnalités

- **Authentification & Dashboard** : Gestion de compte et de tableaux.
- **Canvas Infini** : Panoramique et Zoom fluides (Molette / Ctrl+Molette).
- **Collaboration Temps Réel** : Curseurs des autres utilisateurs et mises à jour en direct.
- **Outils de Dessin** :
    - Rectangles, Ellipses (Double-clic pour ajouter du texte).
    - Sticky Notes (Notes adhésives).
    - Texte libre.
    - Images (Upload via la barre d'outils).
- **Édition Avancée** :
    - Déplacement et Redimensionnement (Ratio conservé avec Shift).
    - Changement de couleur (Fond et Texte).
    - Alignement de texte et Polices.
    - Sélection multiple (Lasso).
    - Suppression (Touche Suppr ou Bouton).
- **Modèles** : Choix entre Vide, Grille ou Plan (Blueprint) à la création.

## Déploiement Vercel + Railway Socket.io

Vercel déploie l'API Express comme une Function serverless, donc le serveur Socket.io local (`server/index.ts`) ne tourne pas en production Vercel. Par défaut, Boardly désactive donc Socket.io sur Vercel et garde la collaboration via fallback HTTP.

Pour garder le frontend sur Vercel et mettre seulement le serveur Socket.io sur Railway :

1. Railway → New Project → Deploy from GitHub repo → `Lockxii/Boardly`.
2. Variables Railway :
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET` = même valeur que Vercel
   - `BETTER_AUTH_URL=https://boardly-r3xr.vercel.app`
   - `REALTIME_AUTH_SECRET` = même valeur que Vercel, optionnel si `BETTER_AUTH_SECRET` est partagé
   - `GOOGLE_AI_API_KEY`, optionnel pour les routes IA si utilisées sur Railway
3. Settings → Networking → Generate Domain.
4. Dans Vercel, ajoutez :
   - `VITE_SOCKET_URL=https://votre-domaine.up.railway.app`
   - `REALTIME_SERVER_URL=https://votre-domaine.up.railway.app`
   - `REALTIME_AUTH_SECRET` = même valeur que Railway, optionnel si `BETTER_AUTH_SECRET` est partagé
5. Redeploy Railway, puis redeploy Vercel.

Le frontend Vercel récupère un token court via `/api/realtime/token`, puis se connecte à Socket.io sur Railway avec ce token. Quand une sauvegarde board passe par l'API Vercel, Vercel envoie aussi l'événement à Railway via `REALTIME_SERVER_URL`.

Railway lancera `npm run build`, puis `npm start`. Le script `start` démarre le serveur Node avec Socket.io.
