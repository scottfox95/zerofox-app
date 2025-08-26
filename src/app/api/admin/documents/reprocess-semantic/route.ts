import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { DocumentIntelligenceService } from '@/lib/document-intelligence';

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    
    if (!documentId) {
      return NextResponse.json({
        success: false,
        error: 'Document ID is required'
      }, { status: 400 });
    }

    console.log(`🔄 Reprocessing document ${documentId} with semantic intelligence...`);

    // Get the document and its chunks
    const documentResult = await sql`
      SELECT * FROM documents WHERE id = ${documentId} AND processed_at IS NOT NULL
    `;

    if (documentResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Document not found or not processed'
      }, { status: 404 });
    }

    const document = documentResult[0];

    // Get existing text chunks to reconstruct the full text
    const chunksResult = await sql`
      SELECT chunk_text FROM text_chunks 
      WHERE document_id = ${documentId} 
      ORDER BY chunk_index
    `;

    if (chunksResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No text chunks found for document'
      }, { status: 404 });
    }

    // Reconstruct full text from chunks
    const fullText = chunksResult.map((chunk: any) => chunk.chunk_text).join(' ');
    
    console.log(`📄 Reconstructed ${fullText.length} characters from ${chunksResult.length} chunks`);

    // Create document intelligence service
    const intelligenceService = new DocumentIntelligenceService();

    // Create a mock file object for classification
    const mockFile = {
      name: document.original_name,
      type: document.file_type,
      size: document.file_size
    } as File;

    // Classify the document
    console.log('🤖 Classifying document...');
    const classification = await intelligenceService.classifyDocument(mockFile, fullText);
    
    // Save classification to database
    await sql`
      INSERT INTO document_classifications (document_id, classification_type, confidence_score, reasoning)
      VALUES (${documentId}, ${classification.type}, ${classification.confidence}, ${classification.reasoning})
      ON CONFLICT (document_id) DO UPDATE SET
        classification_type = EXCLUDED.classification_type,
        confidence_score = EXCLUDED.confidence_score,
        reasoning = EXCLUDED.reasoning
    `;

    // Create semantic chunks
    console.log('🧠 Creating semantic chunks...');
    const semanticChunks = await intelligenceService.createSemanticChunks(
      documentId,
      fullText,
      classification
    );

    console.log(`✅ Reprocessing complete! Created ${semanticChunks.length} semantic chunks`);

    return NextResponse.json({
      success: true,
      message: `Document ${documentId} reprocessed with semantic intelligence`,
      classification,
      semanticChunks: semanticChunks.length
    });

  } catch (error) {
    console.error('Reprocessing failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Reprocessing failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all processed documents that need semantic reprocessing
    const documents = await sql`
      SELECT d.id, d.original_name, d.file_type, d.processed_at,
             COUNT(sc.id) as semantic_chunk_count
      FROM documents d
      LEFT JOIN semantic_chunks sc ON d.id = sc.document_id
      WHERE d.processed_at IS NOT NULL
      GROUP BY d.id, d.original_name, d.file_type, d.processed_at
      HAVING COUNT(sc.id) = 0
      ORDER BY d.processed_at DESC
    `;

    return NextResponse.json({
      success: true,
      documentsNeedingReprocessing: documents
    });

  } catch (error) {
    console.error('Failed to get documents needing reprocessing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get documents'
    }, { status: 500 });
  }
}