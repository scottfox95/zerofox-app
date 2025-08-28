import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/admin/analyses/[id] - Get analysis results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = parseInt(params.id);
    
    if (isNaN(analysisId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid analysis ID' },
        { status: 400 }
      );
    }

    // Get analysis details directly from database to avoid circular imports
    const analysisResult = await sql`
      SELECT * FROM analyses WHERE id = ${analysisId}
    `;
    
    if (analysisResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const analysis = analysisResult[0];

    // Get evidence mappings with control details
    const evidenceMappings = await sql`
      SELECT 
        em.*,
        c.control_id as control_id_string,
        c.category,
        c.subcategory
      FROM evidence_mappings em
      LEFT JOIN controls c ON em.control_id::integer = c.id
      WHERE em.analysis_id = ${analysisId}
      ORDER BY em.control_id
    `;

    // Get evidence items with document names
    const evidenceItems = await sql`
      SELECT ei.*, em.control_id, d.original_name as document_name
      FROM evidence_items ei
      JOIN evidence_mappings em ON ei.evidence_mapping_id = em.id
      JOIN documents d ON ei.document_id = d.id
      WHERE em.analysis_id = ${analysisId}
      ORDER BY em.control_id, ei.relevance_score DESC
    `;

    // Get documents used - only documents that have evidence items for this analysis
    const documents = await sql`
      SELECT DISTINCT d.id, d.original_name, d.file_type, d.file_size, d.processed_at
      FROM documents d
      JOIN evidence_items ei ON d.id = ei.document_id
      JOIN evidence_mappings em ON ei.evidence_mapping_id = em.id
      WHERE em.analysis_id = ${analysisId}
      ORDER BY d.original_name
    `;

    // Group evidence items by evidence mapping ID for proper nesting
    const evidenceItemsMap = new Map();
    evidenceItems.forEach(ei => {
      if (!evidenceItemsMap.has(ei.evidence_mapping_id)) {
        evidenceItemsMap.set(ei.evidence_mapping_id, []);
      }
      evidenceItemsMap.get(ei.evidence_mapping_id).push({
        id: ei.id,
        evidenceMappingId: ei.evidence_mapping_id,
        controlId: ei.control_id,
        documentId: ei.document_id,
        documentName: ei.document_name, // Now properly populated from JOIN
        chunkId: ei.chunk_id,
        evidenceText: ei.evidence_text,
        pageNumber: ei.page_number,
        chunkIndex: ei.chunk_index,
        confidence: ei.confidence,
        relevanceScore: ei.relevance_score,
        createdAt: ei.created_at
      });
    });

    // Calculate average confidence from evidence mappings
    const validConfidenceScores = evidenceMappings
      .map(em => parseFloat(em.confidence_score || 0))
      .filter(score => score > 0);
    const calculatedAverageConfidence = validConfidenceScores.length > 0 
      ? validConfidenceScores.reduce((sum, score) => sum + score, 0) / validConfidenceScores.length 
      : 0;

    const results = {
      analysis: {
        id: analysis.id,
        frameworkName: analysis.framework_name,
        status: analysis.status,
        totalControls: analysis.total_controls,
        compliantControls: analysis.compliant_controls,
        partialControls: analysis.partial_controls,
        missingControls: analysis.missing_controls,
        averageConfidence: Math.round(calculatedAverageConfidence * 100) / 100, // Round to 2 decimal places
        startedAt: analysis.started_at,
        completedAt: analysis.completed_at,
        processingTime: analysis.processing_time,
        createdAt: analysis.created_at
      },
      evidenceMappings: evidenceMappings.map(em => ({
        id: em.id,
        controlId: em.control_id,
        controlTitle: em.control_title,
        controlDescription: em.control_description,
        controlIdString: em.control_id_string, // Now includes the JOIN result like "A.5.1"
        controlCategory: em.category,
        controlSubcategory: em.subcategory,
        status: em.status,
        confidenceScore: parseFloat(em.confidence_score || 0),
        reasoning: em.reasoning,
        createdAt: em.created_at,
        evidenceItems: evidenceItemsMap.get(em.id) || [] // Nest evidence items
      })),
      documents: documents.map(d => ({
        id: d.id,
        originalName: d.original_name,
        fileType: d.file_type,
        fileSize: d.file_size,
        processedAt: d.processed_at
      })),
      gapSummary: {
        missingControls: [],
        lowConfidenceControls: [],
        recommendations: []
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      ...results
    });
  } catch (error) {
    console.error('Get analysis results error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analysis results' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/analyses/[id] - Delete analysis
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = parseInt(params.id);
    
    if (isNaN(analysisId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid analysis ID' },
        { status: 400 }
      );
    }

    // Delete analysis and related data
    await sql`DELETE FROM evidence_items WHERE evidence_mapping_id IN (
      SELECT id FROM evidence_mappings WHERE analysis_id = ${analysisId}
    )`;
    await sql`DELETE FROM evidence_mappings WHERE analysis_id = ${analysisId}`;
    await sql`DELETE FROM analyses WHERE id = ${analysisId}`;
    

    return NextResponse.json({ 
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error) {
    console.error('Delete analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete analysis' },
      { status: 500 }
    );
  }
}