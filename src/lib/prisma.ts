import { PrismaClient } from '@/generated/prisma';

// Ensure a single PrismaClient instance across hot reloads in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const isDev = process.env.NODE_ENV === 'development';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log queries in development; avoid logging PII by not emitting params
    log: isDev
      ? [
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
          { level: 'info', emit: 'stdout' },
          { level: 'query', emit: 'event' },
        ]
      : [
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
  });

// Dev-only query event handler (no params to avoid PII leakage)
if (isDev) {
  prisma.$on('query' as never, (e) => {
    // Log minimal metadata: target and duration only
    console.log(`[prisma] duration=${(e as any).duration}ms`);
  });
}

// Cache the client in dev to prevent multiple instances
if (isDev) {
  globalForPrisma.prisma = prisma;
}

export default prisma;