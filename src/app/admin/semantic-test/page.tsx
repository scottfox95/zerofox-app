'use client';

import { useState } from 'react';

export default function SemanticTestPage() {
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [organizationStatus, setOrganizationStatus] = useState<string>('');
  const [reprocessStatus, setReprocessStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runMigration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/migrate-semantic', {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        setMigrationStatus(`✅ Migration successful! Tables created: ${result.tablesCreated.join(', ')}`);
      } else {
        setMigrationStatus(`❌ Migration failed: ${result.error}`);
      }
    } catch (error) {
      setMigrationStatus(`❌ Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const reprocessDocuments = async () => {
    setLoading(true);
    try {
      // First get documents that need reprocessing
      const response = await fetch('/api/admin/documents/reprocess-semantic');
      const result = await response.json();
      
      if (!result.success || !result.documentsNeedingReprocessing.length) {
        setReprocessStatus('ℹ️ No documents need semantic reprocessing');
        return;
      }

      const docs = result.documentsNeedingReprocessing;
      setReprocessStatus(`🔄 Found ${docs.length} documents to reprocess. Starting semantic processing...`);

      // Reprocess each document
      let successCount = 0;
      for (const doc of docs) {
        try {
          const reprocessResponse = await fetch('/api/admin/documents/reprocess-semantic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: doc.id })
          });
          
          const reprocessResult = await reprocessResponse.json();
          if (reprocessResult.success) {
            successCount++;
            console.log(`✅ Reprocessed ${doc.original_name}: ${reprocessResult.semanticChunks} chunks`);
          } else {
            console.error(`❌ Failed to reprocess ${doc.original_name}: ${reprocessResult.error}`);
          }
        } catch (error) {
          console.error(`❌ Error reprocessing ${doc.original_name}:`, error);
        }
      }

      setReprocessStatus(`✅ Reprocessing complete! Successfully processed ${successCount}/${docs.length} documents with semantic intelligence.`);
    } catch (error) {
      setReprocessStatus(`❌ Reprocessing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const organizeDocuments = async () => {
    setLoading(true);
    try {
      // First get list of documents
      const docsResponse = await fetch('/api/admin/documents');
      const docsResult = await docsResponse.json();
      
      if (!docsResult.success || !docsResult.documents.length) {
        setOrganizationStatus('❌ No documents found to organize');
        return;
      }

      const documentIds = docsResult.documents.map((doc: any) => doc.id);
      
      // Organize them into master document
      const response = await fetch('/api/admin/documents/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: 1,
          documentIds
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOrganizationStatus(`✅ Documents organized successfully! Master document created with ${result.organizedDocument.totalChunks} semantic chunks across ${result.organizedDocument.categories.length} categories.`);
      } else {
        setOrganizationStatus(`❌ Organization failed: ${result.error}`);
      }
    } catch (error) {
      setOrganizationStatus(`❌ Organization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const viewOrganizedDocument = async () => {
    try {
      const response = await fetch('/api/admin/documents/organize?organizationId=1');
      const result = await response.json();
      
      if (result.success) {
        // Open new window with the markdown content
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head>
                <title>Organized Master Document</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; line-height: 1.6; }
                  pre { background: #f5f5f5; padding: 20px; border-radius: 8px; overflow-x: auto; }
                  h1, h2, h3 { color: #333; }
                  hr { margin: 30px 0; border: none; border-top: 1px solid #ddd; }
                </style>
              </head>
              <body>
                <pre>${result.organizedDocument.master_markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              </body>
            </html>
          `);
        }
      } else {
        alert(`Failed to get organized document: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Semantic Intelligence Test Panel
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Database Migration</h2>
          <p className="text-gray-600 mb-4">
            Run the database migration to create semantic tables (semantic_chunks, organized_documents, attribution_mappings, document_classifications).
          </p>
          <button
            onClick={runMigration}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Migration'}
          </button>
          {migrationStatus && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="text-sm">{migrationStatus}</pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">2. Semantic Reprocessing</h2>
          <p className="text-gray-600 mb-4">
            Reprocess existing documents with semantic intelligence (classification, topic-based chunking, categorization). 
            Required for documents processed before semantic features were added.
          </p>
          <button
            onClick={reprocessDocuments}
            disabled={loading}
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Reprocessing...' : 'Reprocess Documents'}
          </button>
          {reprocessStatus && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="text-sm">{reprocessStatus}</pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibent mb-4">3. Document Organization</h2>
          <p className="text-gray-600 mb-4">
            Organize all processed documents into an LLM-optimized master document with semantic chunking and attribution tracking.
          </p>
          <button
            onClick={organizeDocuments}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Organizing...' : 'Organize Documents'}
          </button>
          {organizationStatus && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="text-sm">{organizationStatus}</pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibent mb-4">4. View Master Document</h2>
          <p className="text-gray-600 mb-4">
            View the generated LLM-optimized master document with full attribution tracking.
          </p>
          <button
            onClick={viewOrganizedDocument}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            View Master Document
          </button>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400">
          <h3 className="font-semibold text-yellow-800">Testing Flow:</h3>
          <ol className="mt-2 text-yellow-700 list-decimal list-inside">
            <li>Run the migration to create semantic tables</li>
            <li><strong>Reprocess existing documents</strong> with semantic intelligence (classification + semantic chunking)</li>
            <li>Organize documents to create the master document</li>
            <li>View the master document to see semantic organization</li>
            <li>Run evidence analysis to test the improved mapping</li>
          </ol>
        </div>
      </div>
    </div>
  );
}