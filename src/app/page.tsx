import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/signin')
  return (
    <div className="p-8">
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Welcome</h2>
        <p className="text-sm">You are signed in.</p>
        <div className="flex items-center gap-2">
          <a
            href="/settings/accounts"
            className="inline-block rounded bg-black text-white px-4 py-2"
          >
            Settings
          </a>
          <a
            href="/jobs"
            className="inline-block rounded bg-blue-600 text-white px-4 py-2"
          >
            Jobs Table
          </a>
          <a
            href="/kanban"
            className="inline-block rounded bg-green-600 text-white px-4 py-2"
          >
            Kanban View
          </a>
        </div>
      </main>
    </div>
  );
}
