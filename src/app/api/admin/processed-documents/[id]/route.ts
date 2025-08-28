import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`📄 GET document details for ID: ${params.id}`);
  
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

    const documentId = parseInt(params.id);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Get document details with organization filtering
    let documentResult;
    if (payload.role === 'admin') {
      // Admin can access any document
      documentResult = await sql`
        SELECT * FROM documents WHERE id = ${documentId}
      `;
    } else {
      // Client and demo users can only access their organization's documents
      documentResult = await sql`
        SELECT d.* FROM documents d
        INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
        WHERE d.id = ${documentId} AND uo.user_id = ${payload.userId}
      `;
    }

    if (documentResult.length === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Get document chunks
    const chunksResult = await sql`
      SELECT * FROM text_chunks 
      WHERE document_id = ${documentId}
      ORDER BY chunk_index
    `;

    console.log(`📄 Found document with ${chunksResult.length} chunks`);

    return NextResponse.json({
      success: true,
      document: documentResult[0],
      chunks: chunksResult
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('📄 Get document details error:', error);
    return NextResponse.json(
      { error: 'Failed to get document details' },
      { status: 500 }
    );
  }
}