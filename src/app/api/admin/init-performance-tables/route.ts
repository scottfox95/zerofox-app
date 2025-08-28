import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sql } = await import('@/lib/db');

    // Create performance metrics table
    await sql`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        operation_type VARCHAR(100) NOT NULL,
        operation_name VARCHAR(200) NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        duration INTEGER, -- milliseconds
        metadata JSONB DEFAULT '{}',
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create AI usage metrics table
    await sql`
      CREATE TABLE IF NOT EXISTS ai_usage_metrics (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        cost DECIMAL(10, 6), -- Cost in dollars
        operation_type VARCHAR(100) NOT NULL,
        duration INTEGER NOT NULL, -- milliseconds
        success BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create database metrics table
    await sql`
      CREATE TABLE IF NOT EXISTS database_metrics (
        id SERIAL PRIMARY KEY,
        query_type VARCHAR(50) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
        query_name VARCHAR(200) NOT NULL,
        duration INTEGER NOT NULL, -- milliseconds
        rows_affected INTEGER,
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create analysis session metrics table
    await sql`
      CREATE TABLE IF NOT EXISTS analysis_session_metrics (
        id SERIAL PRIMARY KEY,
        analysis_id INTEGER NOT NULL,
        total_duration INTEGER NOT NULL, -- milliseconds
        controls_processed INTEGER NOT NULL,
        documents_processed INTEGER NOT NULL,
        ai_calls_count INTEGER NOT NULL,
        total_ai_tokens INTEGER,
        average_control_time DECIMAL(10, 2), -- milliseconds
        success_rate DECIMAL(5, 2), -- percentage
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_time ON performance_metrics(operation_type, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_time ON ai_usage_metrics(provider, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_database_metrics_type_time ON database_metrics(query_type, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analysis_session_analysis_id ON analysis_session_metrics(analysis_id)`;

    return NextResponse.json({
      success: true,
      message: 'Performance monitoring tables created successfully',
      tables: [
        'performance_metrics',
        'ai_usage_metrics', 
        'database_metrics',
        'analysis_session_metrics'
      ]
    });

  } catch (error) {
    console.error('Failed to create performance tables:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create performance tables'
    }, { status: 500 });
  }
}