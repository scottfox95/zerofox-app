import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken, createUser } from '@/lib/auth';

// GET /api/admin/users - Get all users (admin only)
export async function GET(request: NextRequest) {
  try {
    // Get user info from token
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all users with their organization info
    const users = await sql`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.created_at,
        o.id as organization_id,
        o.name as organization_name
      FROM users u
      LEFT JOIN user_organizations uo ON u.id = uo.user_id
      LEFT JOIN organizations o ON uo.organization_id = o.id
      ORDER BY u.created_at DESC
    `;

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
        organizationId: user.organization_id,
        organizationName: user.organization_name
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    // Get user info from token
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, password, role, organizationId, organizationMode, newOrganizationName } = body;
    
    console.log('Create user request:', {
      email,
      name,
      role,
      organizationId,
      organizationMode,
      newOrganizationName
    });

    // Validate required fields
    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: 'Email, name, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate organization data
    if (organizationMode === 'new' && !newOrganizationName?.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required when creating a new organization' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['admin', 'client', 'demo'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, client, or demo' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Handle organization creation or selection
    let finalOrganizationId = organizationId;
    let organizationName = '';

    if (organizationMode === 'new' && role !== 'admin') {
      // Create new organization
      try {
        console.log('Creating new organization:', newOrganizationName.trim());
        
        // First check if organization already exists
        const existingOrg = await sql`
          SELECT id, name FROM organizations WHERE name = ${newOrganizationName.trim()}
        `;
        
        if (existingOrg.length > 0) {
          console.log('Organization already exists:', existingOrg[0]);
          return NextResponse.json(
            { error: `Organization name "${newOrganizationName.trim()}" already exists. Please choose a different name.` },
            { status: 400 }
          );
        }
        
        console.log('No existing organization found, creating new one...');
        const newOrgResult = await sql`
          INSERT INTO organizations (name)
          VALUES (${newOrganizationName.trim()})
          RETURNING id, name
        `;
        
        if (newOrgResult.length === 0) {
          throw new Error('No result returned from organization insert');
        }
        
        finalOrganizationId = newOrgResult[0].id;
        organizationName = newOrgResult[0].name;
        console.log('Successfully created organization:', { id: finalOrganizationId, name: organizationName });
      } catch (error) {
        console.error('Failed to create organization:', error);
        console.error('Error details:', {
          message: error?.message || 'No error message',
          code: error?.code || 'No error code',
          constraint: error?.constraint || 'No constraint',
          detail: error?.detail || 'No detail',
          stack: error?.stack || 'No stack trace'
        });
        
        return NextResponse.json(
          { error: `Failed to create organization: ${error?.message || 'Unknown database error'}` },
          { status: 500 }
        );
      }
    } else if (organizationMode === 'existing' && role !== 'admin') {
      // Get existing organization name for response
      try {
        const orgResult = await sql`
          SELECT name FROM organizations WHERE id = ${organizationId}
        `;
        organizationName = orgResult[0]?.name || '';
      } catch (error) {
        console.warn('Failed to get organization name:', error);
      }
    }

    // Create user in auth system
    console.log('Creating user with role:', role);
    const user = await createUser(email, password, name, role);
    
    if (!user) {
      console.error('User creation failed - createUser returned null');
      return NextResponse.json(
        { error: 'Failed to create user in authentication system' },
        { status: 500 }
      );
    }
    
    console.log('User created successfully:', { id: user.id, email: user.email, role: user.role });

    // Add user to organization if specified and not admin
    if (finalOrganizationId && role !== 'admin') {
      try {
        await sql`
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES (${user.id}, ${finalOrganizationId}, 'member')
          ON CONFLICT (user_id, organization_id) DO NOTHING
        `;
      } catch (orgError) {
        console.warn('Failed to add user to organization:', orgError);
      }
    }

    const successMessage = organizationMode === 'new' && organizationName
      ? `User created successfully and assigned to new organization "${organizationName}"`
      : organizationName
      ? `User created successfully and assigned to organization "${organizationName}"`
      : 'User created successfully';

    return NextResponse.json({
      success: true,
      message: successMessage,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      organization: organizationName ? {
        id: finalOrganizationId,
        name: organizationName
      } : null
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}