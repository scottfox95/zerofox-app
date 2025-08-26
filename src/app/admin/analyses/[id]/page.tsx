'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MarkdownViewer from '@/components/MarkdownViewer';

interface EvidenceItem {
  id: number;
  documentId: number;
  documentName?: string;
  chunkId: number;
  evidenceText: string;
  pageNumber?: number;
  chunkIndex: number;
  confidence: number;
  relevanceScore: number;
}

interface EvidenceMapping {
  id: number;
  controlId: number;
  controlTitle: string;
  controlDescription: string;
  status: 'compliant' | 'partial' | 'missing';
  confidenceScore: number;
  reasoning: string;
  evidenceItems: EvidenceItem[];
}

interface Analysis {
  id: number;
  frameworkName: string;
  status: string;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  missingControls: number;
  averageConfidence: number;
  processingTime?: number;
  createdAt: string;
  completedAt?: string;
}

interface GapSummary {
  missingControls: Array<{
    id: number;
    title: string;
    description: string;
    importance: string;
  }>;
  lowConfidenceControls: Array<{
    id: number;
    title: string;
    confidence: number;
    reasoning: string;
  }>;
  recommendations: string[];
}

interface AnalysisResults {
  analysis: Analysis;
  evidenceMappings: EvidenceMapping[];
  gapSummary: GapSummary;
}

export default function AnalysisResultsPage() {
  const params = useParams();
  const analysisId = params.id;
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'gaps'>('overview');
  const [selectedMapping, setSelectedMapping] = useState<EvidenceMapping | null>(null);
  
  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{
    documentId: number;
    documentName: string;
    evidenceText: string;
    pageNumber?: number;
  } | null>(null);
  const [evidenceLineNumbers, setEvidenceLineNumbers] = useState<{[key: string]: number}>({});

  // Helper function to calculate line number from evidence text
  const calculateLineNumber = async (documentId: number, evidenceText: string): Promise<number> => {
    try {
      const response = await fetch(`/api/admin/documents/${documentId}/markdown`);
      if (!response.ok) return 1;
      
      const markdownContent = await response.text();
      const lines = markdownContent.split('\n');
      
      // Find the line containing the evidence text (or part of it)
      const searchText = evidenceText.trim().substring(0, 50).toLowerCase();
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(searchText)) {
          return i + 1; // Line numbers start at 1
        }
      }
      
      // Fallback: try to find any significant words from the evidence
      const words = evidenceText.split(' ').filter(w => w.length > 4);
      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        for (const word of words.slice(0, 3)) {
          if (lineLower.includes(word.toLowerCase())) {
            return i + 1;
          }
        }
      }
      
      return 1; // Default to line 1 if not found
    } catch {
      return 1;
    }
  };

  useEffect(() => {
    if (analysisId) {
      fetchResults();
    }
  }, [analysisId]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/admin/analyses/${analysisId}`);
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        
        // Calculate line numbers for all evidence items
        const evidenceMappings = data.results.evidenceMappings || [];
        const lineNumbers: {[key: string]: number} = {};
        
        for (const mapping of evidenceMappings) {
          for (const evidence of mapping.evidenceItems) {
            const key = `${evidence.documentId}-${evidence.id}`;
            calculateLineNumber(evidence.documentId, evidence.evidenceText)
              .then(lineNum => {
                setEvidenceLineNumbers(prev => ({
                  ...prev,
                  [key]: lineNum
                }));
              })
              .catch(() => {
                // Fallback to chunk-based approximation
                setEvidenceLineNumbers(prev => ({
                  ...prev,
                  [key]: (evidence.chunkIndex * 25) + 1
                }));
              });
          }
        }
      } else {
        console.error('Failed to fetch results:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-700 bg-green-100';
      case 'partial': return 'text-yellow-700 bg-yellow-100';
      case 'missing': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleEvidenceClick = (evidence: EvidenceItem) => {
    setSelectedDocument({
      documentId: evidence.documentId,
      documentName: evidence.documentName || `Document ${evidence.documentId}`,
      evidenceText: evidence.evidenceText,
      pageNumber: evidence.pageNumber
    });
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setSelectedDocument(null);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Analysis not found or failed to load.
        </div>
      </div>
    );
  }

  const { analysis, evidenceMappings, gapSummary } = results;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
          <Link href="/admin/analyses" className="hover:text-blue-600">Analyses</Link>
          <span>›</span>
          <span>{analysis.frameworkName}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{analysis.frameworkName}</h1>
        <p className="text-gray-600">Analysis completed on {new Date(analysis.completedAt || analysis.createdAt).toLocaleString()}</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', count: null },
            { id: 'evidence', label: 'Evidence Mappings', count: evidenceMappings.length },
            { id: 'gaps', label: 'Gap Analysis', count: gapSummary.missingControls.length + gapSummary.lowConfidenceControls.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-900">{analysis.totalControls}</div>
              <div className="text-gray-600">Total Controls</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{analysis.compliantControls}</div>
              <div className="text-gray-600">Compliant</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600">{analysis.partialControls}</div>
              <div className="text-gray-600">Partial</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600">{analysis.missingControls}</div>
              <div className="text-gray-600">Missing</div>
            </div>
          </div>

          {/* Compliance Distribution */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Compliance Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-32 text-sm text-gray-600">Compliant</div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
                  <div 
                    className="bg-green-500 h-4 rounded-full" 
                    style={{ width: `${(analysis.compliantControls / analysis.totalControls) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm font-medium">{Math.round((analysis.compliantControls / analysis.totalControls) * 100)}%</div>
              </div>
              <div className="flex items-center">
                <div className="w-32 text-sm text-gray-600">Partial</div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
                  <div 
                    className="bg-yellow-500 h-4 rounded-full" 
                    style={{ width: `${(analysis.partialControls / analysis.totalControls) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm font-medium">{Math.round((analysis.partialControls / analysis.totalControls) * 100)}%</div>
              </div>
              <div className="flex items-center">
                <div className="w-32 text-sm text-gray-600">Missing</div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
                  <div 
                    className="bg-red-500 h-4 rounded-full" 
                    style={{ width: `${(analysis.missingControls / analysis.totalControls) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm font-medium">{Math.round((analysis.missingControls / analysis.totalControls) * 100)}%</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Average Confidence</div>
                <div className={`text-2xl font-bold ${getConfidenceColor(analysis.averageConfidence)}`}>
                  {Math.round(analysis.averageConfidence)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Processing Time</div>
                <div className="text-2xl font-bold text-gray-900">
                  {analysis.processingTime ? `${Math.round(analysis.processingTime / 1000)}s` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Tab */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          {evidenceMappings.map((mapping) => (
            <div key={mapping.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{mapping.controlTitle}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(mapping.status)}`}>
                      {mapping.status}
                    </span>
                    <span className={`text-sm font-medium ${getConfidenceColor(mapping.confidenceScore)}`}>
                      {Math.round(mapping.confidenceScore)}% confidence
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{mapping.controlDescription}</p>
                  <p className="text-sm text-gray-700">{mapping.reasoning}</p>
                </div>
              </div>

              {/* Evidence Items */}
              {mapping.evidenceItems && mapping.evidenceItems.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Supporting Evidence ({mapping.evidenceItems.length})</h4>
                  <div className="space-y-2">
                    {mapping.evidenceItems.map((evidence, idx) => (
                      <div 
                        key={evidence.id || idx} 
                        onClick={() => handleEvidenceClick(evidence)}
                        className="bg-gray-50 p-3 rounded border-l-4 border-blue-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors group"
                        title="Click to view source document"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-xs text-gray-500 group-hover:text-blue-600">
                            <span className="font-medium">{evidence.documentName || `Document ${evidence.documentId}`}</span>
                            <span> • Line {evidenceLineNumbers[`${evidence.documentId}-${evidence.id}`] || '...'}</span>
                            <span className="ml-2 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              📄 View Document
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Confidence: {Math.round(evidence.confidence)}% | Relevance: {Math.round(evidence.relevanceScore)}%
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 group-hover:text-gray-900">{evidence.evidenceText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gap Analysis Tab */}
      {activeTab === 'gaps' && (
        <div className="space-y-6">
          {/* Recommendations */}
          {gapSummary.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {gapSummary.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-blue-800 text-sm">• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing Controls */}
          {gapSummary.missingControls.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Missing Controls ({gapSummary.missingControls.length})</h3>
                <p className="text-sm text-gray-600">Controls with no supporting evidence found in documents</p>
              </div>
              <div className="divide-y">
                {gapSummary.missingControls.map((control) => (
                  <div key={control.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{control.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{control.description}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                        {control.importance} priority
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Confidence Controls */}
          {gapSummary.lowConfidenceControls.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Low Confidence Controls ({gapSummary.lowConfidenceControls.length})</h3>
                <p className="text-sm text-gray-600">Controls that need additional or clearer evidence</p>
              </div>
              <div className="divide-y">
                {gapSummary.lowConfidenceControls.map((control) => (
                  <div key={control.id} className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{control.title}</h4>
                      <span className={`text-sm font-medium ${getConfidenceColor(control.confidence)}`}>
                        {Math.round(control.confidence)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{control.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Gaps Found */}
          {gapSummary.missingControls.length === 0 && gapSummary.lowConfidenceControls.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-green-600 text-4xl mb-2">✓</div>
              <h3 className="text-lg font-semibold text-green-900">No Significant Gaps Found</h3>
              <p className="text-green-800 text-sm">All controls have sufficient evidence with good confidence scores.</p>
            </div>
          )}
        </div>
      )}

      {/* Markdown Viewer Modal */}
      {selectedDocument && (
        <MarkdownViewer
          isOpen={viewerOpen}
          onClose={closeViewer}
          documentId={selectedDocument.documentId}
          documentName={selectedDocument.documentName}
          evidenceText={selectedDocument.evidenceText}
        />
      )}
    </div>
  );
}