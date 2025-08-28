import { NextRequest, NextResponse } from 'next/server';
import PerformanceMonitor from '@/lib/performance-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const operationType = searchParams.get('operationType') || undefined;

    // Get comprehensive performance summary
    const [performanceSummary, aiUsageSummary] = await Promise.all([
      PerformanceMonitor.getPerformanceSummary(operationType, hours),
      PerformanceMonitor.getAIUsageSummary(hours)
    ]);

    // Get additional detailed metrics
    const { sql } = await import('@/lib/db');

    // Analysis performance over time
    const analysisPerformance = await sql`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as analysis_count,
        AVG(total_duration) as avg_duration,
        AVG(success_rate) as avg_success_rate,
        AVG(total_ai_tokens) as avg_tokens
      FROM analysis_session_metrics 
      WHERE created_at > NOW() - INTERVAL ${hours + ' hours'}
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `;

    // Control processing performance
    const controlPerformance = await sql`
      SELECT 
        operation_name,
        COUNT(*) as total_operations,
        AVG(duration) as avg_duration,
        MIN(duration) as min_duration,
        MAX(duration) as max_duration,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 as success_rate
      FROM performance_metrics 
      WHERE operation_type = 'control_analysis' 
        AND created_at > NOW() - INTERVAL ${hours + ' hours'}
      GROUP BY operation_name
      ORDER BY avg_duration DESC
    `;

    // Document processing performance
    const documentPerformance = await sql`
      SELECT 
        operation_name,
        COUNT(*) as total_operations,
        AVG(duration) as avg_duration,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 as success_rate,
        AVG((metadata->>'targetDocumentCount')::int) as avg_doc_count,
        AVG((metadata->>'semanticChunkCount')::int) as avg_semantic_chunks,
        AVG((metadata->>'originalChunkCount')::int) as avg_original_chunks
      FROM performance_metrics 
      WHERE operation_type IN ('document_organization', 'data_fetch')
        AND created_at > NOW() - INTERVAL ${hours + ' hours'}
      GROUP BY operation_name
      ORDER BY avg_duration DESC
    `;

    // AI model performance comparison
    const aiModelComparison = await sql`
      SELECT 
        provider,
        model,
        operation_type,
        COUNT(*) as call_count,
        AVG(duration) as avg_duration,
        SUM(total_tokens) as total_tokens,
        AVG(total_tokens) as avg_tokens_per_call,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 as success_rate
      FROM ai_usage_metrics 
      WHERE created_at > NOW() - INTERVAL ${hours + ' hours'}
      GROUP BY provider, model, operation_type
      ORDER BY call_count DESC
    `;

    // Recent errors summary
    const recentErrors = await sql`
      SELECT 
        operation_type,
        operation_name,
        error_message,
        COUNT(*) as error_count,
        MAX(created_at) as latest_error
      FROM performance_metrics 
      WHERE success = false 
        AND created_at > NOW() - INTERVAL ${hours + ' hours'}
      GROUP BY operation_type, operation_name, error_message
      ORDER BY error_count DESC, latest_error DESC
      LIMIT 10
    `;

    // Performance trends (hourly breakdown)
    const performanceTrends = await sql`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        operation_type,
        COUNT(*) as operation_count,
        AVG(duration) as avg_duration,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 as success_rate
      FROM performance_metrics 
      WHERE created_at > NOW() - INTERVAL ${hours + ' hours'}
      GROUP BY hour, operation_type
      ORDER BY hour DESC, operation_type
    `;

    // Resource utilization summary
    const resourceSummary = await sql`
      SELECT 
        'performance_metrics' as table_name,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24_hours,
        AVG(duration) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as avg_duration_24h
      FROM performance_metrics
      
      UNION ALL
      
      SELECT 
        'ai_usage_metrics' as table_name,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24_hours,
        AVG(duration) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as avg_duration_24h
      FROM ai_usage_metrics
      
      UNION ALL
      
      SELECT 
        'analysis_session_metrics' as table_name,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24_hours,
        AVG(total_duration) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as avg_duration_24h
      FROM analysis_session_metrics
    `;

    return NextResponse.json({
      success: true,
      timeframe: `${hours} hours`,
      timestamp: new Date().toISOString(),
      summary: {
        performance: performanceSummary,
        aiUsage: aiUsageSummary
      },
      detailed: {
        analysisPerformance: analysisPerformance.map(row => ({
          hour: row.hour,
          analysisCount: parseInt(row.analysis_count),
          avgDuration: parseFloat(row.avg_duration || 0),
          avgSuccessRate: parseFloat(row.avg_success_rate || 0),
          avgTokens: parseInt(row.avg_tokens || 0)
        })),
        controlPerformance: controlPerformance.map(row => ({
          operationName: row.operation_name,
          totalOperations: parseInt(row.total_operations),
          avgDuration: parseFloat(row.avg_duration),
          minDuration: parseFloat(row.min_duration),
          maxDuration: parseFloat(row.max_duration),
          successRate: parseFloat(row.success_rate)
        })),
        documentPerformance: documentPerformance.map(row => ({
          operationName: row.operation_name,
          totalOperations: parseInt(row.total_operations),
          avgDuration: parseFloat(row.avg_duration),
          successRate: parseFloat(row.success_rate),
          avgDocCount: parseInt(row.avg_doc_count || 0),
          avgSemanticChunks: parseInt(row.avg_semantic_chunks || 0),
          avgOriginalChunks: parseInt(row.avg_original_chunks || 0)
        })),
        aiModelComparison: aiModelComparison.map(row => ({
          provider: row.provider,
          model: row.model,
          operationType: row.operation_type,
          callCount: parseInt(row.call_count),
          avgDuration: parseFloat(row.avg_duration),
          totalTokens: parseInt(row.total_tokens || 0),
          avgTokensPerCall: parseFloat(row.avg_tokens_per_call || 0),
          successRate: parseFloat(row.success_rate)
        })),
        recentErrors: recentErrors.map(row => ({
          operationType: row.operation_type,
          operationName: row.operation_name,
          errorMessage: row.error_message,
          errorCount: parseInt(row.error_count),
          latestError: row.latest_error
        })),
        performanceTrends: performanceTrends.map(row => ({
          hour: row.hour,
          operationType: row.operation_type,
          operationCount: parseInt(row.operation_count),
          avgDuration: parseFloat(row.avg_duration),
          successRate: parseFloat(row.success_rate)
        })),
        resourceSummary: resourceSummary.map(row => ({
          tableName: row.table_name,
          totalRecords: parseInt(row.total_records),
          lastHour: parseInt(row.last_hour),
          last24Hours: parseInt(row.last_24_hours),
          avgDuration24h: parseFloat(row.avg_duration_24h || 0)
        }))
      }
    });

  } catch (error) {
    console.error('Failed to get metrics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics'
    }, { status: 500 });
  }
}

// Cleanup endpoint for old metrics
export async function DELETE(request: NextRequest) {
  try {
    await PerformanceMonitor.cleanupOldMetrics();
    
    return NextResponse.json({
      success: true,
      message: 'Old metrics cleaned up successfully'
    });
  } catch (error) {
    console.error('Failed to cleanup metrics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup metrics'
    }, { status: 500 });
  }
}