import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// GET /api/admin/documents/progress?id={documentId}
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('id');

    if (!documentId || isNaN(Number(documentId))) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Query the document and its processing status
    const result = await sql`
      SELECT 
        d.id,
        d.filename,
        d.created_at,
        COUNT(tc.id) as text_chunks_count,
        COUNT(sc.id) as semantic_chunks_count
      FROM documents d
      LEFT JOIN text_chunks tc ON tc.document_id = d.id
      LEFT JOIN semantic_chunks sc ON sc.document_id = d.id
      WHERE d.id = ${documentId}
      GROUP BY d.id, d.filename, d.created_at
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const doc = result[0];
    
    // Determine progress based on document state
    let progress;
    
    // Convert to numbers for reliable comparison
    const textChunks = parseInt(doc.text_chunks_count) || 0;
    const semanticChunks = parseInt(doc.semantic_chunks_count) || 0;
    
    if (semanticChunks > 0) {
      // Document is fully processed - has semantic chunks
      progress = {
        step: 'complete',
        message: 'Document processed successfully',
        progress: 100,
        details: `Created ${textChunks} text chunks and ${semanticChunks} semantic chunks`
      };
    } else if (textChunks > 0) {
      // Document is being processed - has text chunks but no semantic chunks yet
      
      // Check if processing is actually complete (backup detection)
      if (doc.processed_at && textChunks > 0) {
        // Has processed_at timestamp and text chunks - likely complete but semantic count is wrong
        progress = {
          step: 'complete',
          message: 'Document processed successfully',
          progress: 100,
          details: `Created ${textChunks} text chunks${semanticChunks > 0 ? ` and ${semanticChunks} semantic chunks` : ''}`
        };
      } else {
        // Still processing
        const estimatedProgress = Math.max(0, Math.min(90, 70 + Math.floor(textChunks * 0.1)));
        progress = {
          step: 'embed',
          message: 'Generating semantic embeddings...',
          progress: estimatedProgress,
          details: `Processing ${textChunks} text chunks`
        };
      }
    } else {
      // Just uploaded, conversion in progress
      const timeSinceUpload = Date.now() - new Date(doc.created_at).getTime();
      
      // If document has been processing for more than 5 minutes with processed_at, assume complete
      if (doc.processed_at && timeSinceUpload > 300000) { // 5 minutes
        progress = {
          step: 'complete',
          message: 'Document processing completed',
          progress: 100,
          details: `Document processed successfully`
        };
      } else {
        // Still processing - use time-based estimate
        const timeBasedProgress = Math.max(0, Math.min(25, timeSinceUpload / 2000)); // Faster progression
        const estimatedProgress = Math.max(50, Math.min(80, 50 + timeBasedProgress));
        
        progress = {
          step: 'chunk',
          message: 'Breaking document into chunks...',
          progress: Math.round(estimatedProgress),
          details: `Converting ${doc.filename}`
        };
      }
    }

    return NextResponse.json({
      success: true,
      progress,
      document: {
        id: doc.id,
        filename: doc.filename,
        textChunks: doc.text_chunks_count,
        semanticChunks: doc.semantic_chunks_count
      }
    });

  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check progress' },
      { status: 500 }
    );
  }
}