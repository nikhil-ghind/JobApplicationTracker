# Job Tracker

A Next.js app to track job applications with Gmail integration and NextAuth.

## Prerequisites
- Node.js 18+ (recommend 20+)
- A PostgreSQL database
- Google OAuth credentials (Client ID and Client Secret)

## Installation

1) Clone and install dependencies
- npm: `npm install`
- pnpm: `pnpm install`
- yarn: `yarn install`

2) Configure environment variables
Create a `.env` file in the project root:

```
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_a_long_random_string

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

To generate a secure NEXTAUTH_SECRET you can use Node:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3) Setup the database and Prisma
- Apply Prisma schema: `npx prisma migrate deploy`
- (Dev) If you need to create migrations: `npx prisma migrate dev`
- Generate Prisma client (optional, included in postinstall normally): `npx prisma generate`

4) Run the development server
- Use Node directly to avoid PowerShell execution policy issues:
```
node node_modules/next/dist/bin/next dev --turbopack
```
Or use package scripts (if your shell allows):
- `npm run dev` or `pnpm dev` or `yarn dev`

5) Open the app
- http://localhost:3000

## Authentication Flow
- Visiting `/` requires authentication and will redirect unauthenticated users to `/signin`.
- Sign in using email/password (Credentials provider) or Google OAuth.
- After sign-in, you will be redirected to `/`.

## Gmail Integration
- Connect Gmail at `/settings/accounts`.
- The app stores access and refresh tokens for Gmail and automatically refreshes tokens when needed.

## Useful Commands
- Build: `npm run build` (or `pnpm build`, `yarn build`)
- Start production: `npm run start`
- Lint: `npm run lint`
- Prisma Studio: `npx prisma studio`

## Notes
- Ensure your Google OAuth consent screen is configured and the redirect URI includes: `http://localhost:3000/api/gmail/callback`.
- For production deployments, set proper environment variables and secure NEXTAUTH_SECRET.
