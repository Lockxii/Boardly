# Boardly - Tableau Blanc Collaboratif Temps Réel


![Aperçu](public/logo.svg)

## 🚀 Installation

### 1. Variables d'Environnement
Créez un fichier `.env` à la racine du projet :

```env
DATABASE_URL="postgresql://..."  # Votre URL NeonDB
BETTER_AUTH_SECRET="votre-secret-genere"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
LIVEBLOCKS_SECRET_KEY="sk_..."   # Obtenez votre clé sur liveblocks.io
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
- **Temps Réel** : Liveblocks (Presence & Storage) pour la collaboration instantanée.
- **État** : Zustand (État UI local) + Liveblocks (État partagé).
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
