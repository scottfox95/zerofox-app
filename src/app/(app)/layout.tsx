import { ReactNode } from 'react'

export default function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-aravo-gradient text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">ZeroFox Compliance</h1>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}