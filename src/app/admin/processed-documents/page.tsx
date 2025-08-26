'use client';

import { useState, useEffect } from 'react';

interface Document {
  id: number;
  originalName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  processedAt: string | null;
  createdAt: string;
  chunkCount: number;
  uploadPath: string;
  hasMarkdown: boolean;
}

interface TextChunk {
  id: number;
  document_id: number;
  chunk_text: string;
  chunk_index: number;
  page_number?: number;
  created_at: string;
}

export default function ProcessedDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ document: Document; chunks: TextChunk[] } | null>(null);
  const [isViewingDocument, setIsViewingDocument] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [viewMode, setViewMode] = useState<'chunks' | 'markdown'>('chunks');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    console.log('📋 Loading documents from fresh API...');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/processed-documents', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📋 Received ${data.count} documents from database`);
        console.log('📋 Documents:', data.documents);
        setDocuments(data.documents || []);
      } else {
        console.error('📋 Failed to load documents:', response.status);
      }
    } catch (error) {
      console.error('📋 Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDocumentSelection = (documentId: number) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    setSelectedDocuments(prev => {
      if (prev.size === documents.length) {
        return new Set();
      } else {
        return new Set(documents.map(doc => doc.id));
      }
    });
  };

  const viewDocument = async (documentId: number) => {
    try {
      console.log(`📄 Viewing document ${documentId}...`);
      const response = await fetch(`/api/admin/processed-documents/${documentId}`, {
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📄 Loaded document with ${data.chunks.length} chunks`);
        setSelectedDocument(data);
        setIsViewingDocument(true);
      } else {
        alert('Failed to load document details');
      }
    } catch (error) {
      console.error('Error loading document details:', error);
      alert('Error loading document details');
    }
  };

  const loadMarkdownContent = async (documentId: number) => {
    setIsLoadingMarkdown(true);
    try {
      const response = await fetch(`/api/admin/documents/${documentId}/markdown`);
      if (response.ok) {
        const markdown = await response.text();
        setMarkdownContent(markdown);
      } else {
        setMarkdownContent('No markdown content available');
      }
    } catch (error) {
      console.error('Error loading markdown:', error);
      setMarkdownContent('Error loading markdown content');
    } finally {
      setIsLoadingMarkdown(false);
    }
  };

  const bulkDeleteDocuments = async () => {
    if (selectedDocuments.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedDocuments.size} documents? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    let successCount = 0;

    try {
      for (const documentId of selectedDocuments) {
        try {
          const response = await fetch('/api/admin/documents/delete-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId })
          });

          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to delete document ${documentId}:`, error);
        }
      }

      alert(`Successfully deleted ${successCount} documents.`);
      setSelectedDocuments(new Set());
      await loadDocuments(); // Reload fresh data
      
    } catch (error) {
      alert('Bulk delete operation failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getFileTypeLabel = (fileType: string): string => {
    const typeMap: { [key: string]: string } = {
      'text/plain': 'TXT',
      'text/markdown': 'MD',
      'text/x-markdown': 'MD',
      'application/json': 'JSON',
      'application/pdf': 'PDF',
      'text/html': 'HTML',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX'
    };
    return typeMap[fileType] || fileType;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Processed Documents</h1>
        <div className="text-center py-8 text-gray-500">
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  if (isViewingDocument && selectedDocument) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Document Viewer</h1>
          <button
            onClick={() => setIsViewingDocument(false)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Documents
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="border-b border-gray-200 pb-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{selectedDocument.document.originalName}</h2>
            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <div>ID: {selectedDocument.document.id}</div>
              <div>Type: {getFileTypeLabel(selectedDocument.document.fileType)}</div>
              <div>Size: {formatFileSize(selectedDocument.document.fileSize)}</div>
              <div>Chunks: {selectedDocument.chunks.length}</div>
              <div>Uploaded: {formatDate(selectedDocument.document.createdAt)}</div>
              {selectedDocument.document.processedAt && (
                <div>Processed: {formatDate(selectedDocument.document.processedAt)}</div>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode('chunks')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                viewMode === 'chunks'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📋 Text Chunks ({selectedDocument.chunks.length})
            </button>
            <button
              onClick={() => {
                setViewMode('markdown');
                if (!markdownContent) {
                  loadMarkdownContent(selectedDocument.document.id);
                }
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                viewMode === 'markdown'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📄 Markdown Preview
            </button>
          </div>

          {viewMode === 'chunks' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Text Chunks ({selectedDocument.chunks.length})
              </h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {selectedDocument.chunks.map((chunk, index) => (
                  <div key={chunk.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-blue-600">
                        Chunk {index + 1}
                      </span>
                      {chunk.page_number && (
                        <span className="text-xs text-gray-500">Page {chunk.page_number}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {chunk.chunk_text}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {chunk.chunk_text.length} characters
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Markdown Preview
              </h3>
              
              {isLoadingMarkdown ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Loading markdown content...</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                    {markdownContent}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Processed Documents</h1>
        <div className="text-sm text-gray-600">
          Showing exactly what's in the database
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Documents in Database ({documents.length})
          </h2>
          
          {documents.length > 0 && (
            <div className="flex items-center space-x-3">
              <button
                onClick={loadDocuments}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
              >
                🔄 Refresh
              </button>
              
              {selectedDocuments.size > 0 && (
                <button
                  onClick={bulkDeleteDocuments}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    isDeleting
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isDeleting ? 'Deleting...' : `Delete Selected (${selectedDocuments.size})`}
                </button>
              )}
              
              <button
                onClick={toggleSelectAll}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {selectedDocuments.size === documents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No documents found in database</p>
            <p className="text-sm mt-1">Upload documents to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${
                  selectedDocuments.has(doc.id) ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedDocuments.has(doc.id)}
                    onChange={() => toggleDocumentSelection(doc.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  
                  <div className="text-2xl">
                    {getFileTypeLabel(doc.file_type) === 'PDF' ? '📄' : 
                     getFileTypeLabel(doc.file_type) === 'JSON' ? '📋' : 
                     getFileTypeLabel(doc.file_type) === 'DOCX' ? '📝' : 
                     getFileTypeLabel(doc.file_type) === 'MD' ? '📄' : '📄'}
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-900">{doc.originalName}</div>
                    <div className="text-sm text-gray-600 space-x-4">
                      <span>ID: {doc.id}</span>
                      <span>{getFileTypeLabel(doc.fileType)}</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{doc.chunkCount} chunks</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-xs mr-3">
                    {doc.processedAt ? (
                      <span className="text-green-600 font-semibold">✅ Processed</span>
                    ) : (
                      <span className="text-yellow-600 font-semibold">⏳ Pending</span>
                    )}
                  </div>
                  
                  {doc.processedAt && (
                    <button
                      onClick={() => viewDocument(doc.id)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      👁️ View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}