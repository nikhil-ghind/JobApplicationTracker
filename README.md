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
Use the provided example file and copy it to your local env:
```
# Windows PowerShell
Copy-Item .env.example .env.local

# macOS/Linux
cp .env.example .env.local
```
Edit `.env.local` with your real values. The app reads `process.env.*` in server-side code.

Required variables:
```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<32-byte-hex>"
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/job_tracker?schema=public"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```
Generate a secure NEXTAUTH_SECRET:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Google OAuth (dev) configuration:
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `http://localhost:3000/api/gmail/callback`

3) Setup the database and Prisma
- Apply Prisma schema: `npx prisma migrate deploy`
- (Dev) Create migrations: `npx prisma migrate dev`
- Generate Prisma client: `npx prisma generate`
  - Note: Prisma client is generated to `src/generated/prisma` (ignored by Git); you must generate it locally.

4) Run the development server
- Use Node directly to avoid PowerShell execution policy issues:
```
node node_modules/next/dist/bin/next dev --turbopack
```
Or use package scripts (if your shell allows):
- `npm run dev` or `pnpm dev` or `yarn dev`

5) Open the app
- http://localhost:3000

If you update `.env.local`, restart the dev server so changes are picked up.

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
