import z from 'zod'

// Centralized environment validation loader. Import this module early to validate and crash fast if missing.
// Validates required variables:
// - DATABASE_URL
// - NEXTAUTH_SECRET
// - NEXTAUTH_URL
// - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET when Gmail connect is enabled
// Optional flag:
// - ENABLE_GMAIL_CONNECT (default: true). Set to 'false' to disable Gmail connect feature.

function parseBool(input: string | undefined, defaultValue = true): boolean {
  if (input == null) return defaultValue
  const v = input.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  ENABLE_GMAIL_CONNECT: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
})

const envVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  ENABLE_GMAIL_CONNECT: process.env.ENABLE_GMAIL_CONNECT,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}

const result = baseSchema.safeParse(envVars)
const missing: string[] = []

if (!result.success) {
  // Collect only required fields from issues
  for (const issue of result.error.issues) {
    const key = issue.path[0] as string
    if (key === 'DATABASE_URL' || key === 'NEXTAUTH_SECRET' || key === 'NEXTAUTH_URL') {
      missing.push(key)
    }
  }
}

const gmailEnabled = parseBool(envVars.ENABLE_GMAIL_CONNECT, true)
if (gmailEnabled) {
  if (!envVars.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID')
  if (!envVars.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET')
}

if (missing.length > 0) {
  const msg = `Missing required environment variables: ${missing.join(', ')}`
  // Structured logging without leaking secret values
  console.error(`[${new Date().toISOString()}][env] ${msg}`)
  // Crash fast to avoid undefined behavior
  throw new Error(msg)
}

// Export typed env for convenience
export const env = {
  DATABASE_URL: envVars.DATABASE_URL!,
  NEXTAUTH_SECRET: envVars.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: envVars.NEXTAUTH_URL!,
  ENABLE_GMAIL_CONNECT: gmailEnabled,
  GOOGLE_CLIENT_ID: envVars.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: envVars.GOOGLE_CLIENT_SECRET,
}

export default env