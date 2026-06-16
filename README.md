# Boardly - Tableau Blanc Collaboratif Temps Réel

[![Déployé sur Vercel](https://img.shields.io/badge/Vercel-Déployé-black?logo=vercel)](https://boardly-r3xr.vercel.app/)

**Lien du site :** [https://boardly-r3xr.vercel.app/](https://boardly-r3xr.vercel.app/)

![Aperçu](public/logo.svg)

## 🚀 Installation

### 1. Variables d'Environnement
Créez un fichier `.env` à la racine du projet :

```env
DATABASE_URL="postgresql://..."          # URL NeonDB (pooled, ajouter ?pgbouncer=true en prod)
DATABASE_URL_UNPOOLED="postgresql://..."  # URL directe Neon (migrations Prisma)
BETTER_AUTH_SECRET="votre-secret-genere"  # openssl rand -base64 32 (≥ 16 caractères, requis en prod)
BETTER_AUTH_URL="http://localhost:5173"
LIVEBLOCKS_SECRET_KEY="sk_..."            # Collaboration temps réel (serveur uniquement)
GOOGLE_AI_API_KEY=""                       # Fred AI / Gemini (serveur uniquement)
```

Voir `.env.example` pour la liste complète.

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

Le client tourne sur `http://localhost:5173` (l'API Express sur `http://localhost:3001`, proxifiée via `/api`).

## 🧪 Qualité

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint
npm test            # vitest
```

## 🏗️ Architecture

- **Auth** : BetterAuth (Email/Mot de passe) avec Adaptateur Prisma, rate-limiting activé.
- **Base de données** : NeonDB (PostgreSQL) via Prisma ORM.
- **Temps Réel** : Liveblocks (curseurs/présence + diffusion des patches canvas). Le client se connecte directement à l'infrastructure WebSocket de Liveblocks ; la Function serverless ne fait que signer un token d'accès court. Persistance du board via REST (`GET`/`PUT /api/boards/:id/content`) avec concurrence optimiste (`rev`).
- **État** : Zustand (canvas local) + Prisma (persistance board).
- **Canvas** : Moteur SVG performant avec transformations matricielles (Zoom/Pan) et viewport culling.
- **Styling** : Tailwind CSS v4 (plugin Vite) + shadcn/ui.
- **Sécurité** : validation Zod des requêtes, garde SSRF sur les fetchs d'URL, partage de board par token d'invitation.

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

## 🚢 Déploiement (Vercel)

Boardly se déploie entièrement sur Vercel — aucun serveur de sockets séparé n'est requis :

- L'API Express est packagée en une seule Function serverless (`api/index.ts`, `maxDuration` 30s).
- Le temps réel passe par Liveblocks : le client se connecte directement à l'infra WebSocket de Liveblocks, donc la limite serverless de 30s n'affecte pas la collaboration.
- `npm run vercel-build` lance `prisma generate` puis `tsc -b && vite build`.

Variables d'environnement Vercel (Production + Preview) :

- `DATABASE_URL` — URL Neon **pooled**, avec `?pgbouncer=true&connection_limit=1`.
- `DATABASE_URL_UNPOOLED` — URL Neon directe (utilisée par Prisma comme `directUrl`).
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32` (le boot échoue si absent en prod).
- `BETTER_AUTH_URL` — `https://<votre-domaine>.vercel.app`.
- `LIVEBLOCKS_SECRET_KEY`, `GOOGLE_AI_API_KEY`.

> Mise à jour du schéma : `npm run db:push` en local avec `DATABASE_URL` pointant sur la base cible. En production, `server/schema-sync.ts` applique des correctifs idempotents (colonnes/index) au démarrage.
