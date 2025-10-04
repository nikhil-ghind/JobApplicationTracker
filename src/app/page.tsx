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
        <div>
          <a
            href="/settings/accounts"
            className="inline-block rounded bg-black text-white px-4 py-2"
          >
            Settings
          </a>
        </div>
      </main>
    </div>
  );
}
