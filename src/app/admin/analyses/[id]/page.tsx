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
  controlCategory?: string;
  controlSubcategory?: string;
  controlIdString?: string;
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

interface Document {
  id: number;
  originalName: string;
  fileType: string;
  fileSize: number;
  processedAt: string;
  createdAt: string;
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'documents'>('overview');
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
      const [analysisResponse, documentsResponse] = await Promise.all([
        fetch(`/api/admin/analyses/${analysisId}`),
        fetch('/api/admin/processed-documents')
      ]);
      
      const [analysisData, documentsData] = await Promise.all([
        analysisResponse.json(),
        documentsResponse.json()
      ]);
      
      if (analysisData.success) {
        setResults(analysisData.results);
        
        // Calculate line numbers for all evidence items
        const evidenceMappings = analysisData.results.evidenceMappings || [];
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
        console.error('Failed to fetch results:', analysisData.error);
      }
      
      if (documentsData.success) {
        setDocuments(documentsData.documents || []);
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
            { id: 'documents', label: 'Documents', count: documents.length }
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
        <div className="space-y-6">
          {evidenceMappings.map((mapping) => (
            <div key={mapping.id} className="bg-white rounded-lg shadow">
              {/* Control Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      {mapping.controlIdString && (
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-mono rounded-md border">
                          {mapping.controlIdString}
                        </span>
                      )}
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(mapping.status)}`}>
                        {mapping.status}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(mapping.confidenceScore)}`}>
                        {Math.round(mapping.confidenceScore)}% confidence
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{mapping.controlTitle}</h3>
                    
                    {/* Control Metadata */}
                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
                      {mapping.controlCategory && (
                        <div className="flex items-center">
                          <span className="font-medium">Category:</span>
                          <span className="ml-1 text-gray-800">{mapping.controlCategory}</span>
                        </div>
                      )}
                      {mapping.controlSubcategory && (
                        <div className="flex items-center">
                          <span className="font-medium">Subcategory:</span>
                          <span className="ml-1 text-gray-800">{mapping.controlSubcategory}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-gray-700 text-sm leading-relaxed">{mapping.controlDescription}</p>
                  </div>
                </div>

                {/* Analysis Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4">Analysis Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Specificity:</div>
                        <div className="text-gray-800 text-sm leading-relaxed">
                          {mapping.evidenceItems.length > 0 
                            ? `High - ${mapping.evidenceItems.length} specific evidence item${mapping.evidenceItems.length === 1 ? '' : 's'} directly address${mapping.evidenceItems.length === 1 ? 'es' : ''} this control`
                            : 'Low - No specific evidence found that directly addresses this control'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Completeness:</div>
                        <div className="text-gray-800 text-sm leading-relaxed">
                          {mapping.status === 'compliant' 
                            ? 'Complete - Evidence covers all aspects of the requirement'
                            : mapping.status === 'partial'
                            ? 'Partial - Evidence covers some but not all aspects of the requirement'  
                            : 'Incomplete - No evidence found to demonstrate compliance'
                          }
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Assessment:</div>
                      <div className="text-gray-800 text-sm leading-relaxed">{mapping.reasoning}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supporting Evidence */}
              {mapping.evidenceItems && mapping.evidenceItems.length > 0 && (
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Supporting Evidence ({mapping.evidenceItems.length})</h4>
                  <div className="space-y-3">
                    {mapping.evidenceItems.map((evidence, idx) => (
                      <div 
                        key={evidence.id || idx} 
                        onClick={() => handleEvidenceClick(evidence)}
                        className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-200 cursor-pointer transition-all group"
                        title="Click to view source document"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center text-sm text-gray-600 group-hover:text-blue-700">
                            <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{evidence.documentName || `Document ${evidence.documentId}`}</span>
                            <span className="mx-2">•</span>
                            <span>Line {evidenceLineNumbers[`${evidence.documentId}-${evidence.id}`] || '...'}</span>
                            <span className="ml-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              📄 View Document
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-1">Confidence:</span>
                              <span className={`font-medium ${getConfidenceColor(evidence.confidence)}`}>
                                {Math.round(evidence.confidence)}%
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-1">Relevance:</span>
                              <span className={`font-medium ${getConfidenceColor(evidence.relevanceScore)}`}>
                                {Math.round(evidence.relevanceScore)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <blockquote className="text-sm text-gray-800 italic border-l-3 border-blue-300 pl-3 group-hover:text-gray-900">
                          "{evidence.evidenceText}"
                        </blockquote>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Evidence Found */}
              {(!mapping.evidenceItems || mapping.evidenceItems.length === 0) && (
                <div className="p-6 text-center">
                  <div className="text-gray-400 text-4xl mb-2">📋</div>
                  <h4 className="text-gray-600 font-medium mb-1">No Supporting Evidence Found</h4>
                  <p className="text-gray-500 text-sm">No documents contain evidence that directly addresses this control requirement.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Analysis Documents</h3>
              <p className="text-sm text-gray-600 mt-1">Documents that were processed and used for this compliance analysis</p>
            </div>
            <div className="divide-y divide-gray-200">
              {documents.map((document) => (
                <div key={document.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{document.originalName}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                            <span>Type: {document.fileType.toUpperCase()}</span>
                            <span>Size: {(document.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                            <span>Processed: {new Date(document.processedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDocument({
                          documentId: document.id,
                          documentName: document.originalName,
                          evidenceText: '',
                          pageNumber: undefined
                        });
                        setViewerOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>View Document</span>
                    </button>
                  </div>
                </div>
              ))}
              
              {documents.length === 0 && (
                <div className="p-12 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
                  <p className="text-gray-600">No processed documents are available for this analysis.</p>
                </div>
              )}
            </div>
          </div>
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