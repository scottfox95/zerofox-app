import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/admin/analyses/[id]/org-number
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const analysisId = parseInt(params.id);
    if (isNaN(analysisId)) {
      return NextResponse.json(
        { error: 'Invalid analysis ID' },
        { status: 400 }
      );
    }

    // Get the user's organization ID
    const userOrgResult = await sql`
      SELECT organization_id 
      FROM user_organizations uo
      WHERE uo.user_id = ${payload.userId}
      LIMIT 1
    `;

    if (userOrgResult.length === 0) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const organizationId = userOrgResult[0].organization_id;

    // Get the creation time of the current analysis
    const currentAnalysisResult = await sql`
      SELECT created_at, organization_id
      FROM analyses 
      WHERE id = ${analysisId}
    `;

    if (currentAnalysisResult.length === 0) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const currentAnalysis = currentAnalysisResult[0];

    // Verify the user has access to this analysis (same organization)
    if (currentAnalysis.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Count analyses for this organization created before or at the same time as this analysis
    // This gives us the organization-specific sequence number
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM analyses 
      WHERE organization_id = ${organizationId}
        AND created_at <= ${currentAnalysis.created_at}
    `;

    const orgNumber = parseInt(countResult[0].count);

    return NextResponse.json({
      success: true,
      orgNumber,
      analysisId,
      organizationId
    });

  } catch (error) {
    console.error('Get analysis org number error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get analysis number' },
      { status: 500 }
    );
  }
}