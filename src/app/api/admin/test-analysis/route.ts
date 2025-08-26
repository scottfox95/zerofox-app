import { NextRequest, NextResponse } from 'next/server';
import { EvidenceAnalyzer } from '@/lib/evidence-analysis';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing complete analysis workflow...');
    
    // Get a framework to test with
    const { sql } = await import('@/lib/db');
    const frameworks = await sql`
      SELECT id, name FROM frameworks 
      WHERE id IN (SELECT DISTINCT framework_id FROM controls)
      LIMIT 1
    `;
    
    if (frameworks.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No frameworks with controls found for testing'
      });
    }
    
    const framework = frameworks[0];
    console.log(`🧪 Testing with framework: ${framework.name} (ID: ${framework.id})`);
    
    // Start analysis
    const analyzer = new EvidenceAnalyzer();
    const result = await analyzer.startAnalysis(
      1, // organization_id
      framework.id, // framework_id
      [13] // document_ids - use the document we know exists
    );
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: `Analysis failed to start: ${result.error}`,
        step: 'startAnalysis'
      });
    }
    
    console.log(`🧪 Analysis started with ID: ${result.analysisId}`);
    
    // Give it a moment to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check analysis status
    const analysisStatus = await sql`
      SELECT * FROM analyses WHERE id = ${result.analysisId}
    `;
    
    if (analysisStatus.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Analysis record not found after creation'
      });
    }
    
    const analysis = analysisStatus[0];
    console.log(`🧪 Analysis status: ${analysis.status}`);
    
    return NextResponse.json({
      success: true,
      message: 'Test analysis workflow completed',
      analysisId: result.analysisId,
      frameworkTested: framework.name,
      analysisStatus: analysis.status,
      totalControls: analysis.total_controls,
      processingStarted: !!analysis.started_at
    });
    
  } catch (error) {
    console.error('Test analysis failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test analysis failed',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}