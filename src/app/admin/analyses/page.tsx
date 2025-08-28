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
  controlsCount?: number;  // For backwards compatibility
  control_count?: string;  // What the API actually returns
}

interface Document {
  id: number;
  originalName: string;
  processedAt: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  isActive: boolean;
}

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<number | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [testMode, setTestMode] = useState<'quick' | 'full'>('quick');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [customControlCount, setCustomControlCount] = useState<number>(5);

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
      const [analysesRes, frameworksRes, documentsRes, modelsRes] = await Promise.all([
        fetch('/api/admin/analyses'),
        fetch('/api/admin/frameworks'),
        fetch('/api/admin/processed-documents'),
        fetch('/api/admin/ai-models')
      ]);

      const [analysesData, frameworksData, documentsData, modelsData] = await Promise.all([
        analysesRes.json(),
        frameworksRes.json(),
        documentsRes.json(),
        modelsRes.json()
      ]);

      if (analysesData.success) setAnalyses(analysesData.analyses);
      if (frameworksData.success) setFrameworks(frameworksData.frameworks);
      if (documentsData.success) setDocuments(documentsData.documents);
      if (modelsData.success) setAiModels(modelsData.models);
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
          documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
          testMode: testMode,
          selectedModel: selectedModel,
          customControlCount: testMode === 'quick' ? customControlCount : undefined
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

  const estimateCost = (framework: Framework | null, modelId: string, isQuickTest: boolean, customControlCount?: number) => {
    if (!framework) return { cost: 0, controlCount: 0, tokens: 0 };
    
    // Handle both API formats and custom control count
    const totalControlsInFramework = framework.controlsCount || parseInt(framework.control_count || '0');
    const controlCount = customControlCount 
      ? Math.min(customControlCount, totalControlsInFramework)
      : isQuickTest 
        ? Math.min(5, totalControlsInFramework) 
        : totalControlsInFramework;
    const avgTokensPerControl = 8000; // Conservative estimate
    const totalTokens = controlCount * avgTokensPerControl;
    
    // Pricing per 1M tokens (input + output combined estimate)
    const pricing: Record<string, number> = {
      'claude-sonnet': 3.50,
      'gpt-4o': 2.50, 
      'gpt-4o-mini': 0.15,
      'gemini-flash': 0.075
    };
    
    const pricePerMillion = pricing[modelId] || 1.0;
    const cost = (totalTokens / 1000000) * pricePerMillion;
    
    return { cost, controlCount, tokens: totalTokens };
  };

  const getSelectedFramework = () => frameworks.find(f => f.id === selectedFramework);
  const costEstimate = estimateCost(getSelectedFramework() || null, selectedModel, testMode === 'quick', testMode === 'quick' ? customControlCount : undefined);

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

            {/* Testing Presets */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Analysis Configuration</h3>
              
              {/* Quick Preset Toggle */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setTestMode('quick');
                    setSelectedModel('gpt-4o-mini');
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    testMode === 'quick'
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">🚀 Quick Test</div>
                  <div className="text-xs text-gray-600 mt-1">{customControlCount} controls max • GPT-4o Mini</div>
                  <div className="text-xs font-medium text-green-600 mt-1">Cost effective</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setTestMode('full');
                    setSelectedModel('claude-sonnet');
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    testMode === 'full'
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">🎯 Full Analysis</div>
                  <div className="text-xs text-gray-600 mt-1">All controls • Claude Sonnet 4</div>
                  <div className="text-xs font-medium text-orange-600 mt-1">Premium quality</div>
                </button>
              </div>

              {/* Custom Control Count for Quick Test */}
              {testMode === 'quick' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Controls to Test
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={getSelectedFramework()?.controlsCount || parseInt(getSelectedFramework()?.control_count || '100')}
                    value={customControlCount}
                    onChange={(e) => setCustomControlCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter number of controls"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Maximum: {getSelectedFramework()?.controlsCount || parseInt(getSelectedFramework()?.control_count || '0')} controls available in framework
                  </div>
                </div>
              )}

              {/* Advanced Options */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AI Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {aiModels
                      .filter(model => model.isActive)
                      .map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                          {model.id.includes('mini') || model.id.includes('flash') ? ' - Cost Effective' : ''}
                          {model.id.includes('claude') || model.id.includes('gpt-4o') ? ' - Premium' : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Cost Estimate */}
                {selectedFramework && (
                  <div className="bg-white p-3 rounded border">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Estimated cost:</span>
                      <span className={`font-semibold ${costEstimate.cost > 1 ? 'text-orange-600' : 'text-green-600'}`}>
                        ${costEstimate.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {costEstimate.controlCount} controls • ~{costEstimate.tokens.toLocaleString()} tokens
                      {testMode === 'quick' && ' (limited to 5 controls for testing)'}
                    </div>
                  </div>
                )}
              </div>
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