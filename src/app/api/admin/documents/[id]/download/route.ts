import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const documentId = parseInt(params.id);
    
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    // Get document with file content
    const documentResult = await sql`
      SELECT d.*, o.name as org_name
      FROM documents d
      LEFT JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = ${documentId}
    `;

    if (documentResult.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documentResult[0] as any;

    // Check user has access to this document's organization
    if (payload.role !== 'admin') {
      const userOrg = await sql`
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = ${payload.userId}
        AND organization_id = ${document.organization_id}
      `;
      
      if (userOrg.length === 0) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (!document.file_content) {
      return NextResponse.json({ error: 'File content not found' }, { status: 404 });
    }

    // Return file with proper headers
    const response = new NextResponse(document.file_content, {
      status: 200,
      headers: {
        'Content-Type': document.file_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.original_name || document.filename}"`,
        'Content-Length': document.file_size?.toString() || document.file_content.length.toString(),
        'Cache-Control': 'private, max-age=3600' // Cache for 1 hour
      }
    });

    return response;

  } catch (error) {
    console.error('Download document error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}