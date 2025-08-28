import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Simple GET /api/admin/analyses/[id]/simple - Get basic analysis info
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

    // Get analysis details directly from database
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

    // Get evidence mappings for this analysis
    const evidenceMappings = await sql`
      SELECT em.*, 
             COUNT(ei.id) as evidence_count
      FROM evidence_mappings em
      LEFT JOIN evidence_items ei ON em.id = ei.evidence_mapping_id
      WHERE em.analysis_id = ${analysisId}
      GROUP BY em.id
      ORDER BY em.control_id
    `;

    // Get documents used in this analysis
    const documents = await sql`
      SELECT DISTINCT d.id, d.original_name, d.file_type, d.file_size, d.processed_at
      FROM documents d
      JOIN text_chunks tc ON d.id = tc.document_id
      JOIN evidence_items ei ON tc.id = ei.chunk_id
      JOIN evidence_mappings em ON ei.evidence_mapping_id = em.id
      WHERE em.analysis_id = ${analysisId}
      ORDER BY d.original_name
    `;

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysis.id,
        frameworkName: analysis.framework_name,
        status: analysis.status,
        totalControls: analysis.total_controls,
        compliantControls: analysis.compliant_controls,
        partialControls: analysis.partial_controls,
        missingControls: analysis.missing_controls,
        averageConfidence: parseFloat(analysis.average_confidence),
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
        status: em.status,
        confidenceScore: em.confidence_score,
        reasoning: em.reasoning,
        evidenceCount: em.evidence_count,
        createdAt: em.created_at
      })),
      documents: documents.map(d => ({
        id: d.id,
        originalName: d.original_name,
        fileType: d.file_type,
        fileSize: d.file_size,
        processedAt: d.processed_at
      }))
    });
    
  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get analysis' },
      { status: 500 }
    );
  }
}