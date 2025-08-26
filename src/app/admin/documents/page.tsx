'use client';

import { useState, useRef } from 'react';

interface ProcessingResult {
  totalChunks: number;
  totalCharacters: number;
  processingTime: number;
}

export default function DocumentsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProcessingStatus('Uploading document...');

    try {
      // Step 1: Upload document metadata
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/admin/documents/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      setProcessingStatus('Processing document...');

      // Step 2: Process document content
      const processFormData = new FormData();
      processFormData.append('file', file);
      processFormData.append('documentId', uploadResult.document.id.toString());
      
      const processResponse = await fetch('/api/admin/documents/process', {
        method: 'POST',
        body: processFormData
      });

      if (!processResponse.ok) {
        const error = await processResponse.json();
        throw new Error(error.error || 'Processing failed');
      }

      const processResult: ProcessingResult = await processResponse.json();
      
      setProcessingStatus(
        `✅ Document processed successfully! Created ${processResult.totalChunks} chunks from ${processResult.totalCharacters} characters in ${processResult.processingTime}ms. Check the "Processed Documents" page to view results.`
      );

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setProcessingStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
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
              <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
            </div>
            
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.md,.json,.pdf,.docx,.xlsx,.html,.htm"
                disabled={isUploading}
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
                {isUploading ? '⏳ Processing...' : '📁 Choose File'}
              </label>
            </div>

            {processingStatus && (
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
        
        {processingStatus && (
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