import { NextResponse } from 'next/server';
import { initializeDatabase, testConnection } from '@/lib/db';

export async function POST() {
  try {
    // Test connection first
    console.log('🔧 Testing database connection...');
    const connectionTest = await testConnection();
    
    if (!connectionTest.success) {
      throw new Error('Database connection failed');
    }

    // Initialize database tables
    console.log('🔧 Initializing database tables...');
    const result = await initializeDatabase();
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      timestamp: connectionTest.timestamp
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize database',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Just test the connection for status check
    const result = await testConnection();
    
    return NextResponse.json({
      success: true,
      message: 'Database connection is working',
      timestamp: result.timestamp
    });

  } catch (error) {
    console.error('Database connection test error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection failed',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}