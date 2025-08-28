import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    console.log('🔍 Debug: Checking organizations table...');
    
    // Check if organizations table exists and get all organizations
    const organizations = await sql`
      SELECT * FROM organizations ORDER BY id ASC
    `;
    
    console.log('🔍 Found organizations:', organizations);
    
    // Check the table schema
    const schemaInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position
    `;
    
    console.log('🔍 Organizations table schema:', schemaInfo);
    
    // Check for any constraints on the table
    const constraints = await sql`
      SELECT conname, contype, confupdtype, confdeltype, confmatchtype
      FROM pg_constraint 
      WHERE conrelid = 'organizations'::regclass
    `;
    
    console.log('🔍 Organizations table constraints:', constraints);
    
    return NextResponse.json({
      success: true,
      organizations,
      schema: schemaInfo,
      constraints
    });
  } catch (error) {
    console.error('🔍 Debug error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}