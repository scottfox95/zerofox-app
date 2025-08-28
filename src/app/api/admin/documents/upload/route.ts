import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessor } from '@/lib/document';
import { verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';

const documentProcessor = new DocumentProcessor();

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const result = await documentProcessor.uploadDocument(file, organizationId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      document: result.document,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}