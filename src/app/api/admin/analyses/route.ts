import { NextRequest, NextResponse } from 'next/server';
import { EvidenceAnalyzer } from '@/lib/evidence-analysis';
import { consoleLogger } from '@/lib/console-logger';

const analyzer = new EvidenceAnalyzer();

// GET /api/admin/analyses - Get all analyses for organization
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    consoleLogger.apiCall('GET', '/api/admin/analyses');
    const organizationId = 1; // Default org for now
    
    const analyses = await analyzer.getAnalysesList(organizationId);
    const duration = Date.now() - startTime;
    
    consoleLogger.apiCall('GET', '/api/admin/analyses', 200, duration, { count: analyses.length });
    return NextResponse.json({ 
      success: true, 
      analyses 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    consoleLogger.apiCall('GET', '/api/admin/analyses', 500, duration, { error: error instanceof Error ? error.message : 'Unknown error' });
    console.error('Get analyses error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analyses' },
      { status: 500 }
    );
  }
}

// POST /api/admin/analyses - Start new analysis
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    consoleLogger.apiCall('POST', '/api/admin/analyses');
    const body = await request.json();
    const { frameworkId, documentIds, testMode, selectedModel, customControlCount } = body;
    
    if (!frameworkId) {
      const duration = Date.now() - startTime;
      consoleLogger.apiCall('POST', '/api/admin/analyses', 400, duration, { error: 'Framework ID is required' });
      return NextResponse.json(
        { success: false, error: 'Framework ID is required' },
        { status: 400 }
      );
    }

    const organizationId = 1; // Default org for now
    consoleLogger.info('Starting analysis request', 'API', { 
      frameworkId, 
      documentIds: documentIds?.length || 'all',
      testMode,
      selectedModel,
      customControlCount
    });
    
    const result = await analyzer.startAnalysis(
      organizationId, 
      frameworkId, 
      documentIds,
      {
        testMode: testMode,
        selectedModel: selectedModel,
        customControlCount: customControlCount
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (!result.success) {
      consoleLogger.apiCall('POST', '/api/admin/analyses', 400, duration, { error: result.error });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    consoleLogger.apiCall('POST', '/api/admin/analyses', 200, duration, { analysisId: result.analysisId });
    return NextResponse.json({ 
      success: true, 
      analysisId: result.analysisId,
      message: 'Analysis started successfully'
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    consoleLogger.apiCall('POST', '/api/admin/analyses', 500, duration, { error: error instanceof Error ? error.message : 'Unknown error' });
    console.error('Start analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}