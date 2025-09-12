import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('📄 GET /api/admin/documents - Starting direct database query...');
  
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

    let documents;

    if (payload.role === 'admin') {
      // Admin sees all documents
      documents = await sql`
        SELECT d.*, COUNT(tc.id) as chunk_count
        FROM documents d
        LEFT JOIN text_chunks tc ON d.id = tc.document_id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;
    } else {
      // Client/demo users see only their organization's documents
      const userOrgs = await sql`
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = ${payload.userId}
      `;
      
      if (userOrgs.length === 0) {
        return NextResponse.json({ 
          success: true, 
          documents: [] 
        });
      }

      const orgIds = userOrgs.map(org => org.organization_id);
      
      documents = await sql`
        SELECT d.*, COUNT(tc.id) as chunk_count
        FROM documents d
        LEFT JOIN text_chunks tc ON d.id = tc.document_id
        WHERE d.organization_id = ANY(${orgIds})
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;
    }
    
    console.log(`📄 Retrieved ${documents.length} documents from database`);
    
    // Log document IDs for debugging
    if (documents.length > 0) {
      console.log(`📄 Document IDs: ${documents.map(d => d.id).join(', ')}`);
    }
    
    return NextResponse.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('📄 Get documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}