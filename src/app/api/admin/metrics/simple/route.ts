import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { sql } = await import('@/lib/db');

    // Simple queries to check if data exists
    const performanceCount = await sql`SELECT COUNT(*) as count FROM performance_metrics`;
    const aiUsageCount = await sql`SELECT COUNT(*) as count FROM ai_usage_metrics`;
    const analysisSessionCount = await sql`SELECT COUNT(*) as count FROM analysis_session_metrics`;

    // Recent performance metrics
    const recentPerformance = await sql`
      SELECT operation_type, operation_name, duration, success, created_at 
      FROM performance_metrics 
      ORDER BY created_at DESC 
      LIMIT 10
    `;

    // Recent AI usage
    const recentAI = await sql`
      SELECT provider, model, operation_type, total_tokens, duration, success, created_at 
      FROM ai_usage_metrics 
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    // Recent analysis sessions
    const recentAnalyses = await sql`
      SELECT analysis_id, total_duration, controls_processed, ai_calls_count, total_ai_tokens, success_rate, created_at
      FROM analysis_session_metrics 
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    return NextResponse.json({
      success: true,
      counts: {
        performanceMetrics: parseInt(performanceCount[0].count),
        aiUsageMetrics: parseInt(aiUsageCount[0].count),
        analysisSessionMetrics: parseInt(analysisSessionCount[0].count)
      },
      recent: {
        performance: recentPerformance,
        aiUsage: recentAI,
        analyses: recentAnalyses
      }
    });

  } catch (error) {
    console.error('Failed to get simple metrics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics'
    }, { status: 500 });
  }
}