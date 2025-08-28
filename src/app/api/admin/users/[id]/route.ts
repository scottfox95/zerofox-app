import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// PATCH /api/admin/users/[id] - Update user (admin only)
export async function PATCH(
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
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, role, organizationId } = body;

    // Validate required fields
    if (!name || !role) {
      return NextResponse.json(
        { error: 'Name and role are required' },
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

    // Check if user exists
    const existingUser = await sql`
      SELECT id, email, role FROM users WHERE id = ${userId}
    `;

    if (existingUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Don't allow users to edit themselves (to prevent accidental role changes)
    if (userId === payload.userId) {
      return NextResponse.json(
        { error: 'Cannot edit your own account' },
        { status: 403 }
      );
    }

    // Update user
    const updatedUser = await sql`
      UPDATE users 
      SET name = ${name}, role = ${role}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING id, email, name, role, updated_at
    `;

    // Handle organization assignment
    if (role !== 'admin' && organizationId) {
      // Remove existing organization assignments
      await sql`
        DELETE FROM user_organizations WHERE user_id = ${userId}
      `;
      
      // Add new organization assignment
      await sql`
        INSERT INTO user_organizations (user_id, organization_id, role)
        VALUES (${userId}, ${organizationId}, 'member')
        ON CONFLICT (user_id, organization_id) DO UPDATE SET
          role = 'member'
      `;
    } else if (role === 'admin') {
      // Remove organization assignments for admin users
      await sql`
        DELETE FROM user_organizations WHERE user_id = ${userId}
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user (admin only)
export async function DELETE(
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
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check if user exists and get their role
    const userResult = await sql`
      SELECT id, email, role FROM users WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult[0];

    // Don't allow deleting admin users (safety measure)
    if (user.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin users' },
        { status: 403 }
      );
    }

    // Don't allow users to delete themselves
    if (userId === payload.userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    // Delete user organization relationships first
    await sql`
      DELETE FROM user_organizations WHERE user_id = ${userId}
    `;

    // Delete the user
    await sql`
      DELETE FROM users WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: `User ${user.email} deleted successfully`
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}