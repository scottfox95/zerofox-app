import { NextRequest, NextResponse } from 'next/server';
import { EvidenceAnalyzer } from '@/lib/evidence-analysis';

const analyzer = new EvidenceAnalyzer();

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

    const results = await analyzer.getAnalysisResults(analysisId);
    
    if (!results) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      results
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

    const result = await analyzer.deleteAnalysis(analysisId);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

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