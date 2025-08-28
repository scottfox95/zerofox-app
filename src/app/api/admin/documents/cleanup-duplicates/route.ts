import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { DocumentIntelligenceService } from '@/lib/document-intelligence';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting duplicate document cleanup...');
    
    // Find documents with duplicate names
    const duplicatesQuery = await sql`
      SELECT original_name, array_agg(id ORDER BY created_at DESC) as document_ids, COUNT(*) as duplicate_count
      FROM documents 
      GROUP BY original_name 
      HAVING COUNT(*) > 1
    `;
    
    console.log(`Found ${duplicatesQuery.length} sets of duplicate documents`);
    
    let totalRemoved = 0;
    let totalReprocessed = 0;
    
    for (const duplicateSet of duplicatesQuery) {
      const { original_name, document_ids, duplicate_count } = duplicateSet;
      console.log(`\n📄 Processing duplicates for: ${original_name} (${duplicate_count} copies)`);
      
      // Keep the first document (most recent), remove the others
      const [keepDocId, ...removeDocIds] = document_ids;
      
      console.log(`  ✅ Keeping document ID: ${keepDocId}`);
      console.log(`  🗑️  Removing document IDs: [${removeDocIds.join(', ')}]`);
      
      // Remove duplicate documents and their associated data
      for (const docId of removeDocIds) {
        // Delete associated chunks first (to avoid foreign key constraints)
        await sql`DELETE FROM text_chunks WHERE document_id = ${docId}`;
        await sql`DELETE FROM semantic_chunks WHERE document_id = ${docId}`;
        
        // Delete the document record
        await sql`DELETE FROM documents WHERE id = ${docId}`;
        totalRemoved++;
      }
      
      // Check if the remaining document has semantic chunks
      const semanticChunkCount = await sql`
        SELECT COUNT(*) as count FROM semantic_chunks WHERE document_id = ${keepDocId}
      `;
      
      if (semanticChunkCount[0].count === 0) {
        console.log(`  🔄 Document ${keepDocId} has no semantic chunks, reprocessing...`);
        
        try {
          // Get the document details
          const documentResult = await sql`
            SELECT * FROM documents WHERE id = ${keepDocId} AND processed_at IS NOT NULL
          `;

          if (documentResult.length > 0) {
            const document = documentResult[0];

            // Get existing text chunks to reconstruct the full text
            const chunksResult = await sql`
              SELECT chunk_text FROM text_chunks 
              WHERE document_id = ${keepDocId} 
              ORDER BY chunk_index
            `;

            if (chunksResult.length > 0) {
              // Reconstruct full text from chunks
              const fullText = chunksResult.map((chunk: any) => chunk.chunk_text).join(' ');
              
              console.log(`    📄 Reconstructed ${fullText.length} characters from ${chunksResult.length} chunks`);

              const intelligenceService = new DocumentIntelligenceService();

              // Create a mock file object for classification
              const mockFile = {
                name: document.original_name,
                type: document.file_type,
                size: document.file_size
              } as File;

              // Classify the document
              console.log('    🤖 Classifying document...');
              const classification = await intelligenceService.classifyDocument(mockFile, fullText);
              
              // Save classification to database
              await sql`
                INSERT INTO document_classifications (document_id, classification_type, confidence_score, reasoning)
                VALUES (${keepDocId}, ${classification.type}, ${classification.confidence}, ${classification.reasoning})
                ON CONFLICT (document_id) DO UPDATE SET
                  classification_type = EXCLUDED.classification_type,
                  confidence_score = EXCLUDED.confidence_score,
                  reasoning = EXCLUDED.reasoning
              `;

              // Create semantic chunks
              console.log('    🧠 Creating semantic chunks...');
              const semanticChunks = await intelligenceService.createSemanticChunks(
                keepDocId,
                fullText,
                classification
              );

              console.log(`  ✅ Reprocessed semantic chunks for document ${keepDocId}: ${semanticChunks.length} chunks created`);
              totalReprocessed++;
            } else {
              console.log(`  ⚠️ No text chunks found for document ${keepDocId}`);
            }
          } else {
            console.log(`  ⚠️ Document ${keepDocId} not found or not processed`);
          }
        } catch (error) {
          console.error(`  ❌ Failed to reprocess document ${keepDocId}:`, error);
        }
      } else {
        console.log(`  ✅ Document ${keepDocId} already has ${semanticChunkCount[0].count} semantic chunks`);
      }
    }
    
    // Clean up any organized documents (force recreation)
    await sql`DELETE FROM organized_documents WHERE organization_id = 1`;
    console.log('🔄 Cleared organized documents cache');
    
    console.log(`\n🎉 Cleanup completed:`);
    console.log(`  - Removed ${totalRemoved} duplicate documents`);
    console.log(`  - Reprocessed ${totalReprocessed} documents for semantic analysis`);
    
    return NextResponse.json({
      success: true,
      message: `Cleanup completed successfully`,
      details: {
        duplicatesFound: duplicatesQuery.length,
        documentsRemoved: totalRemoved,
        documentsReprocessed: totalReprocessed
      }
    });
    
  } catch (error) {
    console.error('❌ Duplicate cleanup failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}