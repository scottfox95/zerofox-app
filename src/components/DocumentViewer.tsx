'use client';

import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, Search } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - use the version that matches react-pdf
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.3.93/build/pdf.worker.mjs';
}

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  documentName: string;
  evidenceText: string;
  pageNumber?: number;
}

export default function DocumentViewer({
  isOpen,
  onClose,
  documentId,
  documentName,
  evidenceText,
  pageNumber
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(pageNumber || 1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>(evidenceText);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [highlightTimeout, setHighlightTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      setCurrentPage(pageNumber || 1);
      setSearchText(evidenceText);
      setDocumentUrl(`/api/admin/documents/${documentId}/view`);
      setLoading(true);
      setError(null);
    }
  }, [isOpen, documentId, pageNumber, evidenceText]);

  // Highlight text after page loads
  useEffect(() => {
    if (!loading && evidenceText && isOpen) {
      // Clear any existing timeout
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }

      // Delay highlighting to ensure PDF is fully rendered
      const timeout = setTimeout(() => {
        highlightTextInPDF(evidenceText);
      }, 1000);

      setHighlightTimeout(timeout);
    }

    return () => {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }
    };
  }, [loading, currentPage, evidenceText, isOpen]);

  const highlightTextInPDF = (text: string) => {
    try {
      // Find text layer elements
      const textLayer = document.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) return;

      // Remove existing highlights
      const existingHighlights = textLayer.querySelectorAll('.evidence-highlight');
      existingHighlights.forEach(el => el.classList.remove('evidence-highlight'));

      // Search for text spans that contain the evidence text
      const textSpans = textLayer.querySelectorAll('span');
      const searchTerms = text.toLowerCase().split(' ').filter(term => term.length > 3); // Only search for words longer than 3 chars

      textSpans.forEach(span => {
        const spanText = span.textContent?.toLowerCase() || '';
        
        // Check if this span contains any of our search terms
        const hasMatch = searchTerms.some(term => spanText.includes(term));
        
        if (hasMatch) {
          span.classList.add('evidence-highlight');
        }
      });

    } catch (error) {
      console.warn('Could not highlight text in PDF:', error);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load document. Please try again.');
    setLoading(false);
  };

  const changePage = (offset: number) => {
    setCurrentPage(prevPage => {
      const newPage = Math.max(1, Math.min(numPages, prevPage + offset));
      // Re-highlight after page change
      setTimeout(() => highlightTextInPDF(evidenceText), 500);
      return newPage;
    });
  };

  const zoomIn = () => setScale(prev => Math.min(3, prev + 0.2));
  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {documentName}
            </h3>
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {numPages}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => changePage(-1)}
                  disabled={currentPage <= 1}
                  className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => changePage(1)}
                  disabled={currentPage >= numPages}
                  className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={zoomOut}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 min-w-16 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            
            <a
              href={documentUrl || '#'}
              download={documentName}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
              title="Download document"
            >
              <Download className="h-4 w-4" />
            </a>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b bg-yellow-50">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Evidence Text:</span>
            <div className="flex-1 bg-yellow-100 border border-yellow-300 rounded px-3 py-1">
              <span className="text-sm text-yellow-900">{searchText}</span>
            </div>
            <span className="text-xs text-yellow-700">Highlighted in document</span>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading document...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                <div className="text-red-700 text-center">
                  <p className="font-medium">Error Loading Document</p>
                  <p className="text-sm mt-2">{error}</p>
                </div>
              </div>
            </div>
          )}

          {documentUrl && !error && (
            <div className="flex justify-center">
              <div className="shadow-lg">
                <Document
                  file={documentUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading page...</span>
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderAnnotationLayer={false}
                    renderTextLayer={true}
                  />
                </Document>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              Document ID: {documentId} • {documentName}
            </div>
            <div className="flex items-center space-x-4">
              <span>Use Ctrl+F to search within the document</span>
              <button
                onClick={() => setCurrentPage(pageNumber || 1)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Go to Evidence Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}