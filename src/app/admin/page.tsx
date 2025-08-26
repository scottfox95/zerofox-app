'use client';

import { useState } from 'react';

export default function AdminDashboard() {
  const [dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [message, setMessage] = useState('');
  const [adminCreated, setAdminCreated] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const testConnection = async () => {
    try {
      const response = await fetch('/api/admin/init-db', { method: 'GET' });
      const data = await response.json();
      
      if (response.ok) {
        setDbStatus('connected');
        setMessage(`Database connected! Timestamp: ${data.timestamp}`);
      } else {
        setDbStatus('error');
        setMessage(`Connection failed: ${data.details}`);
      }
    } catch (error) {
      setDbStatus('error');
      setMessage('Failed to test connection');
    }
  };

  const initializeDatabase = async () => {
    setIsInitializing(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/init-db', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setDbInitialized(true);
        setDbStatus('connected');
        setMessage('Database initialized successfully!');
      } else {
        setMessage(`Error: ${data.details}`);
      }
    } catch (error) {
      setMessage('Error: Failed to initialize database');
    } finally {
      setIsInitializing(false);
    }
  };

  const createAdmin = async () => {
    setIsCreatingAdmin(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@zerofox.com',
          password: 'admin123',
          name: 'Admin User'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAdminCreated(true);
        setMessage('Admin user created! Email: admin@zerofox.com, Password: admin123');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error: Failed to create admin user');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Admin Dashboard</h2>
        <p className="text-gray-600 mb-6">Welcome to the ZeroFox Compliance admin panel.</p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">🔧 Database Setup</h3>
          <div className="text-blue-700 text-sm space-y-2 mb-4">
            <p><strong>Status:</strong> Initialize your NeonDB connection and tables</p>
            <p><strong>Required:</strong> All essential tables for compliance management</p>
          </div>
          
          {message && (
            <div className={`p-3 rounded-lg mb-4 ${
              dbStatus === 'connected' || dbInitialized
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message}
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={testConnection}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Test Connection
            </button>
            
            <button
              onClick={initializeDatabase}
              disabled={isInitializing || dbInitialized}
              className="bg-aravo-gradient text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInitializing ? 'Initializing...' : dbInitialized ? 'Database Ready' : 'Initialize Database'}
            </button>
            
            <button
              onClick={createAdmin}
              disabled={isCreatingAdmin || adminCreated || !dbInitialized}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingAdmin ? 'Creating Admin...' : adminCreated ? 'Admin Created' : 'Create Admin User'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">AI Models</h3>
          <p className="text-gray-600 text-sm mb-4">Manage AI model configurations</p>
          <div className="mt-4">
            <a
              href="/admin/ai-models"
              className="inline-flex items-center px-3 py-2 bg-aravo-gradient text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Configure Models
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">System Prompts</h3>
          <p className="text-gray-600 text-sm mb-4">Configure and optimize AI analysis prompts</p>
          <div className="mt-4">
            <a
              href="/admin/prompts"
              className="inline-flex items-center px-3 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors"
            >
              🤖 Manage Prompts
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Frameworks</h3>
          <p className="text-gray-600 text-sm mb-4">Standardize compliance frameworks</p>
          <div className="mt-4">
            <a
              href="/admin/frameworks"
              className="inline-flex items-center px-3 py-2 bg-aravo-gradient text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Manage Frameworks
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Document Upload</h3>
          <p className="text-gray-600 text-sm mb-4">Upload and process compliance documents</p>
          <div className="mt-4">
            <a
              href="/admin/documents"
              className="inline-flex items-center px-3 py-2 bg-aravo-gradient text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              📄 Upload Documents
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Processed Documents</h3>
          <p className="text-gray-600 text-sm mb-4">View and manage processed documents</p>
          <div className="mt-4">
            <a
              href="/admin/processed-documents"
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              📋 View Documents
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Evidence Analysis</h3>
          <p className="text-gray-600 text-sm mb-4">AI-powered compliance mapping</p>
          <div className="mt-4">
            <a
              href="/admin/analyses"
              className="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
              🔍 Run Analysis
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Custom Frameworks</h3>
          <p className="text-gray-600 text-sm mb-4">Build custom compliance frameworks</p>
          <div className="text-xs text-gray-500">Ready for Task 5</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">System Status</h3>
          <p className="text-gray-600 text-sm mb-4">Monitor system health</p>
          <div className="text-xs text-gray-500">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>App: Running</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${
                dbStatus === 'connected' ? 'bg-green-500' : 
                dbStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`}></div>
              <span>Database: {
                dbStatus === 'connected' ? 'Connected' : 
                dbStatus === 'error' ? 'Error' : 'Unknown'
              }</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Auth: Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}