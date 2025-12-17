# Boardly - Realtime Collaborative Whiteboard

A Miro-like clone built with Next.js 14, Liveblocks, BetterAuth, and NeonDB.

## 🚀 Setup

### 1. Environment Variables
Create a `.env` file in the root:

```env
DATABASE_URL="postgresql://..."  # Your NeonDB URL
BETTER_AUTH_SECRET="your-generated-secret"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
LIVEBLOCKS_SECRET_KEY="sk_..."   # Get from liveblocks.io
```

### 2. Database
Push the schema to your NeonDB:

```bash
npx prisma db push
```

### 3. Run
Start the development server:

```bash
npm run dev
```

## 🏗️ Architecture

- **Auth**: BetterAuth (Email/Pass) with Prisma Adapter.
- **Database**: NeonDB (Postgres) via Prisma.
- **Realtime**: Liveblocks (Presence & Storage).
- **State**: Zustand (Client UI state) + Liveblocks (Shared state).
- **Canvas**: SVG-based infinite canvas with Matrix transformations.

## 🛠️ Features
- Authentication & Dashboard
- Create Boards
- Infinite Pan & Zoom (Wheel / Space+Drag)
- Realtime Cursors
- Insert Rectangles, Ellipses, Sticky Notes
- Drag & Drop objects
- Multi-user sync