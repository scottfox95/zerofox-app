'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Search, Download, ChevronUp, ChevronDown } from 'lucide-react';

interface MarkdownViewerProps {
  documentId: number;
  documentName: string;
  evidenceText: string;
  isOpen: boolean;
  onClose: () => void;
}

interface HighlightMatch {
  start: number;
  end: number;
  text: string;
}

export default function MarkdownViewer({
  documentId,
  documentName,
  evidenceText,
  isOpen,
  onClose
}: MarkdownViewerProps) {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentMatch, setCurrentMatch] = useState<number>(0);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [highlights, setHighlights] = useState<HighlightMatch[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<(HTMLElement | null)[]>([]);

  // Load markdown content
  useEffect(() => {
    if (!isOpen || !documentId) return;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/admin/documents/${documentId}/markdown`);
        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.statusText}`);
        }
        
        const content = await response.text();
        setMarkdownContent(content);
        
        // Auto-highlight the evidence text when document loads
        if (evidenceText.trim()) {
          setSearchTerm(evidenceText);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [isOpen, documentId, evidenceText]);

  // Handle search and highlighting
  useEffect(() => {
    if (!markdownContent || !searchTerm.trim()) {
      setHighlights([]);
      setTotalMatches(0);
      setCurrentMatch(0);
      return;
    }

    // Find all matches using a more sophisticated approach
    const matches: HighlightMatch[] = [];
    const searchTermLower = searchTerm.toLowerCase();
    const contentLower = markdownContent.toLowerCase();
    
    // Try exact match first
    let index = 0;
    while ((index = contentLower.indexOf(searchTermLower, index)) !== -1) {
      matches.push({
        start: index,
        end: index + searchTerm.length,
        text: markdownContent.slice(index, index + searchTerm.length)
      });
      index += searchTerm.length;
    }

    // If no exact matches, try progressive substring matching for evidence text
    if (matches.length === 0 && searchTerm === evidenceText) {
      // Try progressively smaller substrings (phrases) before falling back to individual words
      const words = evidenceText.split(/\s+/);
      
      // Try phrases of decreasing length (5, 4, 3 words)
      for (let phraseLength = Math.min(5, words.length); phraseLength >= 3; phraseLength--) {
        for (let i = 0; i <= words.length - phraseLength; i++) {
          const phrase = words.slice(i, i + phraseLength).join(' ').toLowerCase();
          let phraseIndex = 0;
          while ((phraseIndex = contentLower.indexOf(phrase, phraseIndex)) !== -1) {
            matches.push({
              start: phraseIndex,
              end: phraseIndex + phrase.length,
              text: markdownContent.slice(phraseIndex, phraseIndex + phrase.length)
            });
            phraseIndex += phrase.length;
          }
          if (matches.length > 0) break; // Found phrase matches, stop here
        }
        if (matches.length > 0) break; // Found matches, don't try shorter phrases
      }
      
      // Only if no phrase matches found, fall back to individual significant words
      if (matches.length === 0) {
        const significantWords = words.filter(w => w.length > 4); // Only longer words
        for (const word of significantWords.slice(0, 3)) { // Limit to first 3 significant words
          const wordLower = word.toLowerCase();
          let wordIndex = 0;
          while ((wordIndex = contentLower.indexOf(wordLower, wordIndex)) !== -1) {
            matches.push({
              start: wordIndex,
              end: wordIndex + word.length,
              text: markdownContent.slice(wordIndex, wordIndex + word.length)
            });
            wordIndex += word.length;
          }
        }
      }
    }

    // Sort matches by position and remove overlaps
    const uniqueMatches = matches
      .sort((a, b) => a.start - b.start)
      .filter((match, index, array) => {
        if (index === 0) return true;
        return match.start >= array[index - 1].end;
      });

    setHighlights(uniqueMatches);
    setTotalMatches(uniqueMatches.length);
    setCurrentMatch(uniqueMatches.length > 0 ? 1 : 0);
  }, [markdownContent, searchTerm, evidenceText]);

  // Scroll to current highlight
  useEffect(() => {
    if (currentMatch > 0 && highlightRefs.current[currentMatch - 1]) {
      highlightRefs.current[currentMatch - 1]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentMatch]);

  // Navigation functions
  const navigateMatch = (direction: 'next' | 'prev') => {
    if (totalMatches === 0) return;
    
    if (direction === 'next') {
      setCurrentMatch(prev => prev >= totalMatches ? 1 : prev + 1);
    } else {
      setCurrentMatch(prev => prev <= 1 ? totalMatches : prev - 1);
    }
  };

  // Render highlighted content
  const renderHighlightedContent = (content: string) => {
    if (highlights.length === 0) {
      return <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{content}</div>;
    }

    const parts = [];
    let lastIndex = 0;

    highlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {content.slice(lastIndex, highlight.start)}
          </span>
        );
      }

      // Add highlighted text
      const isCurrentMatch = index + 1 === currentMatch;
      parts.push(
        <span
          key={`highlight-${index}`}
          ref={el => { highlightRefs.current[index] = el; }}
          className={`${
            isCurrentMatch 
              ? 'bg-yellow-300 text-black ring-2 ring-yellow-500' 
              : 'bg-yellow-100 text-black'
          } px-1 rounded font-medium`}
        >
          {highlight.text}
        </span>
      );

      lastIndex = highlight.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key="text-final">
          {content.slice(lastIndex)}
        </span>
      );
    }

    return <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{parts}</div>;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {documentName}
            </h3>
            <p className="text-sm text-gray-600">Markdown View</p>
          </div>
          
          {/* Search Controls */}
          <div className="flex items-center space-x-2 mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search in document..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-64"
              />
            </div>
            
            {totalMatches > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  {currentMatch} of {totalMatches}
                </span>
                <button
                  onClick={() => navigateMatch('prev')}
                  className="p-1 hover:bg-gray-200 rounded"
                  disabled={totalMatches === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateMatch('next')}
                  className="p-1 hover:bg-gray-200 rounded"
                  disabled={totalMatches === 0}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const blob = new Blob([markdownContent], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${documentName}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Download Markdown"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 mb-2">Error loading document</p>
                <p className="text-gray-600 text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <div 
              ref={contentRef}
              className="h-full overflow-auto p-6 bg-white"
              style={{ lineHeight: '1.6' }}
            >
              {renderHighlightedContent(markdownContent)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}