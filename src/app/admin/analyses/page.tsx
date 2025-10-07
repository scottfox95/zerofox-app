'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
  const [analysisScope, setAnalysisScope] = useState<'full' | 'focused'>('full');
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet');
  const [frameworkControls, setFrameworkControls] = useState<any[]>([]);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loadingControls, setLoadingControls] = useState(false);

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

  const fetchFrameworkControls = async (frameworkId: number) => {
    setLoadingControls(true);
    try {
      const response = await fetch(`/api/admin/frameworks/${frameworkId}`);
      const data = await response.json();
      if (data.success && data.controls) {
        setFrameworkControls(data.controls);
      }
    } catch (error) {
      console.error('Failed to fetch controls:', error);
    } finally {
      setLoadingControls(false);
    }
  };

  const handleFrameworkChange = (frameworkId: number | null) => {
    setSelectedFramework(frameworkId);
    setSelectedControls([]);
    setExpandedCategories(new Set());
    if (frameworkId) {
      fetchFrameworkControls(frameworkId);
    } else {
      setFrameworkControls([]);
    }
  };

  const getControlsByCategory = () => {
    const grouped = new Map<string, any[]>();
    frameworkControls.forEach(control => {
      const category = control.category || 'Uncategorized';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(control);
    });
    return grouped;
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleCategoryControls = (category: string, controlIds: string[]) => {
    const allSelected = controlIds.every(id => selectedControls.includes(id));
    if (allSelected) {
      setSelectedControls(selectedControls.filter(id => !controlIds.includes(id)));
    } else {
      const newSelected = new Set([...selectedControls, ...controlIds]);
      setSelectedControls(Array.from(newSelected));
    }
  };

  const toggleControl = (controlId: string) => {
    if (selectedControls.includes(controlId)) {
      setSelectedControls(selectedControls.filter(id => id !== controlId));
    } else {
      setSelectedControls([...selectedControls, controlId]);
    }
  };

  const handleCreateAnalysis = async () => {
    if (!selectedFramework) {
      alert('Please select a framework');
      return;
    }

    if (analysisScope === 'focused' && selectedControls.length === 0) {
      alert('Please select at least one control for focused analysis');
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
          selectedModel: selectedModel,
          selectedControlIds: analysisScope === 'focused' ? selectedControls : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        router.push(`/admin/analyses/${data.analysisId}`);
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

  const estimateCost = (framework: Framework | null, modelId: string, scope: 'full' | 'focused', selectedControlIds: string[]) => {
    if (!framework) return { cost: 0, controlCount: 0, tokens: 0 };
    
    const totalControlsInFramework = framework.controlsCount || parseInt(framework.control_count || '0');
    const controlCount = scope === 'focused' ? selectedControlIds.length : totalControlsInFramework;
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
  const costEstimate = estimateCost(getSelectedFramework() || null, selectedModel, analysisScope, selectedControls);

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
            onClick={() => {
              setShowCreateModal(true);
              setSelectedFramework(null);
              setSelectedDocuments([]);
              setAnalysisScope('full');
              setSelectedControls([]);
              setExpandedCategories(new Set());
              setFrameworkControls([]);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Analysis
          </button>
        </div>
      </div>

      {/* Create Analysis Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-6">Start New Analysis</h2>
            
            {/* Framework Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Framework *
              </label>
              <select
                value={selectedFramework || ''}
                onChange={(e) => handleFrameworkChange(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a framework</option>
                {frameworks.map(framework => (
                  <option key={framework.id} value={framework.id}>
                    {framework.name} ({framework.control_count || framework.controlsCount} controls)
                  </option>
                ))}
              </select>
            </div>

            {/* Analysis Scope */}
            {selectedFramework && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Analysis Scope *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnalysisScope('full')}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      analysisScope === 'full'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <div className="font-medium text-gray-900">🎯 Full Analysis</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Analyze all {getSelectedFramework()?.control_count || getSelectedFramework()?.controlsCount} controls
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAnalysisScope('focused')}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      analysisScope === 'focused'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <div className="font-medium text-gray-900">🔍 Focused Analysis</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Select specific controls to analyze
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Control Selection for Focused Analysis */}
            {analysisScope === 'focused' && selectedFramework && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Controls *
                </label>
                {loadingControls ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading controls...</span>
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                    {Array.from(getControlsByCategory().entries()).map(([category, controls]) => {
                      const controlIds = controls.map(c => c.control_id);
                      const allSelected = controlIds.every(id => selectedControls.includes(id));
                      const someSelected = controlIds.some(id => selectedControls.includes(id));
                      const isExpanded = expandedCategories.has(category);
                      
                      return (
                        <div key={category} className="border-b border-gray-200 last:border-b-0">
                          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100">
                            <button
                              type="button"
                              onClick={() => toggleCategory(category)}
                              className="flex-1 flex items-center text-left"
                            >
                              <span className="text-gray-600 mr-2">
                                {isExpanded ? '▼' : '▶'}
                              </span>
                              <span className="font-medium text-gray-900">{category}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                ({controls.length} control{controls.length !== 1 ? 's' : ''})
                              </span>
                            </button>
                            <label className="flex items-center ml-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someSelected && !allSelected;
                                }}
                                onChange={() => toggleCategoryControls(category, controlIds)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-600">Select all</span>
                            </label>
                          </div>
                          
                          {isExpanded && (
                            <div className="bg-white">
                              {controls.map(control => (
                                <label
                                  key={control.id}
                                  className="flex items-start px-4 py-3 hover:bg-gray-50 cursor-pointer border-t border-gray-100"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedControls.includes(control.control_id)}
                                    onChange={() => toggleControl(control.control_id)}
                                    className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="ml-3 flex-1">
                                    <div className="font-medium text-sm text-gray-900">
                                      {control.control_id} - {control.title}
                                    </div>
                                    {control.description && (
                                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {control.description || control.requirement_text}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedControls.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {selectedControls.length} control{selectedControls.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}

            {/* AI Model Selection */}
            {selectedFramework && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Model *
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {aiModels
                    .filter(model => model.isActive)
                    .map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </option>
                    ))
                  }
                </select>
              </div>
            )}

            {/* Cost Estimate */}
            {selectedFramework && (analysisScope === 'full' || selectedControls.length > 0) && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Estimated Cost:</span>
                  <span className={`text-lg font-bold ${costEstimate.cost > 1 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${costEstimate.cost.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {costEstimate.controlCount} controls • ~{costEstimate.tokens.toLocaleString()} tokens • {selectedModel}
                </div>
              </div>
            )}

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
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedFramework(null);
                  setSelectedDocuments([]);
                  setAnalysisScope('full');
                  setSelectedControls([]);
                  setExpandedCategories(new Set());
                  setFrameworkControls([]);
                }}
                disabled={creating}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAnalysis}
                disabled={creating || !selectedFramework || (analysisScope === 'focused' && selectedControls.length === 0)}
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