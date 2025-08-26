import { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="text-xl font-bold bg-aravo-gradient bg-clip-text text-transparent">
                ZeroFox Admin
              </Link>
              <div className="flex space-x-6">
                <Link 
                  href="/admin" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link 
                  href="/admin/ai-models" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  AI Models
                </Link>
                <Link 
                  href="/admin/prompts" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Prompts
                </Link>
                <Link 
                  href="/admin/frameworks" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Frameworks
                </Link>
                <Link 
                  href="/admin/documents" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Documents
                </Link>
                <Link 
                  href="/admin/analyses" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Analyses
                </Link>
                <Link 
                  href="/admin/semantic-test" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Semantic Test
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Admin User</span>
              <Link 
                href="/login" 
                className="text-sm text-aravo-red hover:underline"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}