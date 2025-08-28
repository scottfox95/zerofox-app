'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  userId: number;
  email: string;
  role: 'admin' | 'client' | 'demo';
}

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Get user info from token
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (error) {
        console.error('Failed to parse token:', error);
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  // Show loading state while determining user role
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const isDemo = user.role === 'demo';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="text-xl font-bold bg-aravo-gradient bg-clip-text text-transparent">
                {isDemo ? 'ZeroFox Demo' : 'ZeroFox Compliance'}
              </Link>
              <div className="flex space-x-6">
                <Link 
                  href="/admin" 
                  className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                >
                  Dashboard
                </Link>
                
                {/* Admin-only navigation items */}
                {isAdmin && (
                  <>
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
                  </>
                )}
                
                {/* Available to all authenticated users */}
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
                
                {/* Admin-only navigation items */}
                {isAdmin && (
                  <>
                    <Link 
                      href="/admin/performance" 
                      className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                    >
                      Performance
                    </Link>
                    <Link 
                      href="/admin/semantic-test" 
                      className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                    >
                      Semantic Test
                    </Link>
                    <Link 
                      href="/admin/users" 
                      className="text-gray-600 hover:text-aravo-red font-medium transition-colors"
                    >
                      Users
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-800">{user.email}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isAdmin ? 'bg-red-100 text-red-800' : 
                  isDemo ? 'bg-blue-100 text-blue-800' : 
                  'bg-green-100 text-green-800'
                }`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="text-sm text-aravo-red hover:underline"
              >
                Logout
              </button>
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