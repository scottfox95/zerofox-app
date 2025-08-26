'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ConsoleViewer from '@/components/ConsoleViewer';

interface Analysis {
  id: number;
  frameworkName: string;
  status: 'pending' | 'processing' | 'in_progress' | 'completed' | 'failed';
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  missingControls: number;
  averageConfidence: number;
  createdAt: string;
  completedAt?: string;
  processingTime?: number;
}

interface Framework {
  id: number;
  name: string;
  controlsCount: number;
}

interface Document {
  id: number;
  originalName: string;
  processedAt: string;
}

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<number | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    // Log page access for demonstration
    if (typeof window !== 'undefined') {
      fetch('/api/admin/console-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'info',
          message: 'User accessed analyses page',
          category: 'UI'
        })
      }).catch(() => {}); // Ignore errors for this demo log
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analysesRes, frameworksRes, documentsRes] = await Promise.all([
        fetch('/api/admin/analyses'),
        fetch('/api/admin/frameworks'),
        fetch('/api/admin/processed-documents')
      ]);

      const [analysesData, frameworksData, documentsData] = await Promise.all([
        analysesRes.json(),
        frameworksRes.json(),
        documentsRes.json()
      ]);

      if (analysesData.success) setAnalyses(analysesData.analyses);
      if (frameworksData.success) setFrameworks(frameworksData.frameworks);
      if (documentsData.success) setDocuments(documentsData.documents);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnalysis = async () => {
    if (!selectedFramework) {
      alert('Please select a framework');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkId: selectedFramework,
          documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Analysis started successfully!');
        setShowCreateModal(false);
        setSelectedFramework(null);
        setSelectedDocuments([]);
        fetchData();
      } else {
        alert(`Failed to start analysis: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to start analysis');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId: number) => {
    if (!confirm('Are you sure you want to delete this analysis?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/analyses/${analysisId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
      } else {
        alert(`Failed to delete analysis: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to delete analysis');
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing':
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence Analysis</h1>
          <p className="text-gray-600 mb-6">AI-powered compliance evidence mapping and gap analysis.</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              showConsole 
                ? 'bg-gray-600 text-white hover:bg-gray-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showConsole ? 'Hide Console' : 'Show Console'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Analysis
          </button>
        </div>
      </div>

      {/* Create Analysis Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Start New Analysis</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Framework *
              </label>
              <select
                value={selectedFramework || ''}
                onChange={(e) => setSelectedFramework(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a framework</option>
                {frameworks.map(framework => (
                  <option key={framework.id} value={framework.id}>
                    {framework.name} ({framework.controlsCount} controls)
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documents (optional - leave empty to analyze all)
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                {documents.map(doc => (
                  <label key={doc.id} className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocuments([...selectedDocuments, doc.id]);
                        } else {
                          setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{doc.originalName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAnalysis}
                disabled={creating || !selectedFramework}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Starting...' : 'Start Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Console Viewer */}
      {showConsole && (
        <div className="mb-6">
          <ConsoleViewer 
            height="300px"
            maxLogs={50}
            autoScroll={true}
            categories={['API', 'ANALYSIS', 'AI']}
          />
        </div>
      )}

      {/* Analyses List */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Framework
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Controls
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No analyses found. Start your first analysis to see compliance mapping results.
                  </td>
                </tr>
              ) : (
                analyses.map((analysis) => (
                  <tr 
                    key={analysis.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.href = `/admin/analyses/${analysis.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {analysis.frameworkName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(analysis.status)}`}>
                        {analysis.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        <div>Total: {analysis.totalControls}</div>
                        {analysis.status === 'completed' && (
                          <div className="text-xs space-y-1">
                            <div className="text-green-600">✓ {analysis.compliantControls} compliant</div>
                            <div className="text-yellow-600">⚠ {analysis.partialControls} partial</div>
                            <div className="text-red-600">✗ {analysis.missingControls} missing</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {analysis.status === 'completed' ? `${Math.round(analysis.averageConfidence)}%` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDuration(analysis.processingTime)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(analysis.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {analysis.status === 'completed' && (
                          <Link
                            href={`/admin/analyses/${analysis.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Results
                          </Link>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAnalysis(analysis.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}