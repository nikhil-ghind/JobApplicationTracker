import JobsTable from './JobsTable'

export default function JobsPage() {
  return (
    <main className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Jobs</h1>
      <JobsTable />
    </main>
  )
}