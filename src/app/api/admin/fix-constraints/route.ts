import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    console.log('🔧 Fixing user role constraints...');
    
    // First, check current users and their roles
    const currentUsers = await sql`
      SELECT id, email, role FROM users
    `;
    console.log('Current users before fix:', currentUsers);
    
    // Update any invalid roles to 'admin' (since they're likely existing admin users)
    const updateResult = await sql`
      UPDATE users 
      SET role = 'admin' 
      WHERE role NOT IN ('admin', 'client', 'demo')
    `;
    console.log('✅ Updated invalid roles:', updateResult);
    
    // Check users after update
    const updatedUsers = await sql`
      SELECT id, email, role FROM users
    `;
    console.log('Users after update:', updatedUsers);
    
    // Drop the existing constraint
    await sql`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_role_check
    `;
    console.log('✅ Dropped old constraint');
    
    // Add the new constraint with correct values
    await sql`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'client', 'demo'))
    `;
    console.log('✅ Added new constraint');
    
    // Verify the new constraint
    const newConstraint = await sql`
      SELECT conname, contype
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass AND conname = 'users_role_check'
    `;
    
    console.log('New constraint:', newConstraint);
    
    // Test the constraint by checking current users
    const users = await sql`
      SELECT id, email, role FROM users
    `;
    console.log('Current users:', users);
    
    return NextResponse.json({
      success: true,
      message: 'User role constraints fixed successfully',
      beforeUsers: currentUsers,
      afterUsers: updatedUsers,
      finalUsers: users,
      constraintFixed: true
    });
  } catch (error) {
    console.error('❌ Error fixing constraints:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}