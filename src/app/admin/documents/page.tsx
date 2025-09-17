'use client';

import { useState, useRef, useEffect } from 'react';

interface ProcessingResult {
  totalChunks: number;
  totalCharacters: number;
  processingTime: number;
}

interface ProcessingProgress {
  step: 'upload' | 'convert' | 'chunk' | 'embed' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  details?: string;
}

export default function DocumentsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [completedUploads, setCompletedUploads] = useState<Array<{id: number, name: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // TODO: Add localStorage persistence later
  // Check for ongoing processing on component mount
  // useEffect(() => {
  //   if (typeof window !== 'undefined' && !currentDocumentId) {
  //     const savedDocId = localStorage.getItem('processingDocumentId');
  //     if (savedDocId) {
  //       const docId = parseInt(savedDocId);
  //       setCurrentDocumentId(docId);
  //       setIsUploading(true);
  //       setIsPolling(true);
  //     }
  //   }
  // }, []);
  
  // Save current document ID to localStorage
  // useEffect(() => {
  //   if (typeof window !== 'undefined') {
  //     if (currentDocumentId) {
  //       localStorage.setItem('processingDocumentId', currentDocumentId.toString());
  //     } else {
  //       localStorage.removeItem('processingDocumentId');
  //     }
  //   }
  // }, [currentDocumentId]);


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Process files one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await processFile(file, i + 1, files.length);
    }

    // Clear file input after all uploads complete
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File, currentFile: number, totalFiles: number) => {

    setIsUploading(true);
    setProcessingStatus('');
    const filePrefix = totalFiles > 1 ? `File ${currentFile}/${totalFiles}: ` : '';
    setProgress({ step: 'upload', message: `${filePrefix}Uploading ${file.name}...`, progress: 20 });

    try {
      // Step 1: Upload document (stored in database)
      const formData = new FormData();
      formData.append('file', file);

      setProgress({ step: 'upload', message: `${filePrefix}Saving ${file.name} to database...`, progress: 40 });

      const uploadResponse = await fetch('/api/admin/documents/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      const documentId = uploadResult.document.id;
      // Step 2: Start processing document content
      setProgress({ step: 'convert', message: `${filePrefix}Processing ${file.name}...`, progress: 90 });
      
      // Start processing in background
      fetch('/api/admin/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: documentId.toString() })
      }).then(async (processResponse) => {
        if (!processResponse.ok) {
          const error = await processResponse.json();
          setProgress({ step: 'error', message: error.error || 'Processing failed', progress: 0 });
          setIsUploading(false);
          setProcessingStatus(`❌ Error: ${error.error || 'Processing failed'}`);
          return;
        }

        // Processing completed successfully
        const result = await processResponse.json();
        setProgress({ step: 'complete', message: `${filePrefix}${file.name} processed successfully!`, progress: 100 });
        
        // Add to completed uploads
        setCompletedUploads(prev => [...prev, { id: documentId, name: file.name }]);
        
        // If this is the last file, show final status after a brief delay
        if (currentFile === totalFiles) {
          setTimeout(() => {
            setIsUploading(false);
            setProgress(null);
            if (totalFiles === 1) {
              setProcessingStatus(`✅ ${file.name} uploaded and processed successfully!`);
            } else {
              setProcessingStatus(`✅ All ${totalFiles} documents uploaded and processed successfully!`);
            }
            
            // Clear status after 5 seconds to allow new uploads
            setTimeout(() => {
              setProcessingStatus('');
              setCompletedUploads([]);
            }, 5000);
          }, 500);
        }
      }).catch((error) => {
        console.error('Processing error:', error);
        setProgress({ step: 'error', message: error.message, progress: 0 });
        setIsUploading(false);
        setProcessingStatus(`❌ Error: ${error.message}`);
      });

    } catch (error) {
      setProgress({ step: 'error', message: error instanceof Error ? error.message : 'Unknown error', progress: 0 });
      setProcessingStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Document Upload</h1>
        <div className="text-sm text-gray-600">
          Task 3: Upload & process compliance documents
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Document</h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="space-y-4">
            <div className="text-gray-600">
              <p className="text-lg">📄 Upload compliance documents for processing</p>
              <p className="text-sm mt-2">Supported formats: PDF, DOCX, XLSX, HTML, TXT, MD, JSON</p>
              <p className="text-xs text-gray-500">Maximum file size: 10MB each • Multiple files supported</p>
            </div>
            
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.md,.json,.pdf,.docx,.xlsx,.html,.htm"
                disabled={isUploading}
                multiple
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-flex items-center px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors ${
                  isUploading
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-aravo-gradient text-white hover:opacity-90'
                }`}
              >
                {isUploading ? (
                progress ? `⏳ ${progress.message}` : '⏳ Processing...'
              ) : '📁 Choose Files'}
              </label>
            </div>

            {/* Progress Indicator */}
            {progress && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{progress.message}</span>
                  <span className="text-gray-500">{progress.progress}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-aravo-gradient h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  {progress.step === 'upload' && (
                    <>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>Uploading file to server...</span>
                    </>
                  )}
                  {progress.step === 'convert' && (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span>Converting document format...</span>
                    </>
                  )}
                  {progress.step === 'chunk' && (
                    <>
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span>Breaking document into chunks...</span>
                    </>
                  )}
                  {progress.step === 'embed' && (
                    <>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                      <span>Generating semantic embeddings...</span>
                    </>
                  )}
                  {progress.step === 'complete' && (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Processing complete!</span>
                    </>
                  )}
                  {progress.step === 'error' && (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span>Error occurred during processing</span>
                    </>
                  )}
                </div>
                
                {progress.details && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {progress.details}
                  </div>
                )}
              </div>
            )}
            
            {/* Completed Uploads During Processing */}
            {completedUploads.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm font-medium text-green-800 mb-2">
                  ✅ Completed uploads:
                </div>
                <ul className="text-xs text-green-700 space-y-1">
                  {completedUploads.map((upload, index) => (
                    <li key={upload.id} className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span>{upload.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Final Status Message */}
            {processingStatus && !progress && (
              <div className={`p-3 rounded-lg text-sm ${
                processingStatus.includes('❌') 
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : processingStatus.includes('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {processingStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status and Navigation */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Status</h2>
        
        {/* Current Processing Status */}
        {progress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-800">{progress.message}</div>
                {progress.details && (
                  <div className="text-xs text-blue-600 mt-1">{progress.details}</div>
                )}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                    <span>Progress</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-blue-600">
              ℹ️ Processing typically completes in a few seconds. Status will update automatically when finished.
            </div>
          </div>
        )}
        
        {/* Final Status */}
        {processingStatus && !progress && (
          <div className={`p-4 rounded-lg text-sm mb-4 ${
            processingStatus.includes('❌') 
              ? 'bg-red-50 text-red-700 border border-red-200'
              : processingStatus.includes('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {processingStatus}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            Documents are processed and stored securely in the database.
          </p>
          <a
            href="/admin/processed-documents"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            📋 View Processed Documents
          </a>
        </div>
      </div>
    </div>
  );
}