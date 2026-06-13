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
- **Temps Réel** : Présence HTTP + auto-save (WebSocket à venir via Socket.io).
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
