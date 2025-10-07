import { NextRequest, NextResponse } from 'next/server';
import { EvidenceAnalyzer } from '@/lib/evidence-analysis';
import { consoleLogger } from '@/lib/console-logger';
import { verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';

const analyzer = new EvidenceAnalyzer();

// GET /api/admin/analyses - Get all analyses for organization
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    // Get user info from token
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    consoleLogger.apiCall('GET', '/api/admin/analyses');

    // Get user's organization ID
    let organizationId = 1; // Default fallback
    let analyses;

    if (payload.role === 'admin') {
      // Admin sees all analyses across all organizations
      analyses = await sql`
        SELECT * FROM analyses 
        ORDER BY created_at DESC
      `;
      
      // Transform to match the interface
      analyses = analyses.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        frameworkId: row.framework_id,
        frameworkName: row.framework_name || '',
        status: row.status,
        totalControls: row.total_controls,
        compliantControls: row.compliant_controls,
        partialControls: row.partial_controls,
        missingControls: row.missing_controls,
        averageConfidence: row.average_confidence,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        processingTime: row.processing_time,
        createdAt: row.created_at
      }));
    } else {
      // Get user's organization
      const userOrg = await sql`
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = ${payload.userId}
        LIMIT 1
      `;
      
      if (userOrg.length > 0) {
        organizationId = userOrg[0].organization_id;
      }
      
      analyses = await analyzer.getAnalysesList(organizationId);
    }
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
    // Get user info from token
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    consoleLogger.apiCall('POST', '/api/admin/analyses');
    const body = await request.json();
    const { frameworkId, documentIds, selectedModel, selectedControlIds } = body;
    
    if (!frameworkId) {
      const duration = Date.now() - startTime;
      consoleLogger.apiCall('POST', '/api/admin/analyses', 400, duration, { error: 'Framework ID is required' });
      return NextResponse.json(
        { success: false, error: 'Framework ID is required' },
        { status: 400 }
      );
    }

    // Get user's organization ID
    let organizationId = 1; // Default fallback
    if (payload.role !== 'admin') {
      const userOrg = await sql`
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = ${payload.userId}
        LIMIT 1
      `;
      
      if (userOrg.length > 0) {
        organizationId = userOrg[0].organization_id;
      }
    }
    consoleLogger.info('Starting analysis request', 'API', { 
      frameworkId, 
      documentIds: documentIds?.length || 'all',
      selectedModel,
      selectedControlIds: selectedControlIds?.length || 'all'
    });
    
    const result = await analyzer.startAnalysis(
      organizationId, 
      frameworkId, 
      documentIds,
      {
        selectedModel: selectedModel,
        selectedControlIds: selectedControlIds
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