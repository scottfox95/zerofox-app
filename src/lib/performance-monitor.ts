import { sql } from './db';

export interface PerformanceMetric {
  id?: number;
  operationType: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  createdAt?: Date;
}

export interface AIUsageMetric {
  id?: number;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
  operationType: string;
  duration: number;
  success: boolean;
  createdAt?: Date;
}

export interface DatabaseMetric {
  id?: number;
  queryType: string;
  queryName: string;
  duration: number;
  rowsAffected?: number;
  success: boolean;
  errorMessage?: string;
  createdAt?: Date;
}

export interface AnalysisSessionMetrics {
  id?: number;
  analysisId: number;
  totalDuration: number;
  controlsProcessed: number;
  documentsProcessed: number;
  aiCallsCount: number;
  totalAITokens: number;
  averageControlTime: number;
  successRate: number;
  createdAt?: Date;
}

class PerformanceTimer {
  private startTime: number;
  private operationType: string;
  private operationName: string;
  private metadata: Record<string, any> = {};

  constructor(operationType: string, operationName: string, metadata: Record<string, any> = {}) {
    this.operationType = operationType;
    this.operationName = operationName;
    this.metadata = metadata;
    this.startTime = Date.now();
  }

  addMetadata(key: string, value: any) {
    this.metadata[key] = value;
  }

  async end(success: boolean = true, errorMessage?: string): Promise<PerformanceMetric> {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const metric: PerformanceMetric = {
      operationType: this.operationType,
      operationName: this.operationName,
      startTime: this.startTime,
      endTime,
      duration,
      metadata: this.metadata,
      success,
      errorMessage
    };

    // Store in database asynchronously (don't block the operation)
    PerformanceMonitor.recordMetric(metric).catch(console.error);

    return metric;
  }
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private aiMetrics: AIUsageMetric[] = [];
  private dbMetrics: DatabaseMetric[] = [];

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  // Create a new performance timer
  static startTimer(operationType: string, operationName: string, metadata?: Record<string, any>): PerformanceTimer {
    return new PerformanceTimer(operationType, operationName, metadata);
  }

  // Record a completed metric
  static async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      await sql`
        INSERT INTO performance_metrics (
          operation_type,
          operation_name,
          start_time,
          end_time,
          duration,
          metadata,
          success,
          error_message
        )
        VALUES (
          ${metric.operationType},
          ${metric.operationName},
          to_timestamp(${metric.startTime / 1000}),
          to_timestamp(${(metric.endTime || Date.now()) / 1000}),
          ${metric.duration},
          ${JSON.stringify(metric.metadata || {})},
          ${metric.success},
          ${metric.errorMessage || null}
        )
      `;
    } catch (error) {
      // Don't let monitoring failures break the application
      console.error('Failed to record performance metric:', error);
    }
  }

  // Record AI usage metrics
  static async recordAIUsage(metric: AIUsageMetric): Promise<void> {
    try {
      await sql`
        INSERT INTO ai_usage_metrics (
          provider,
          model,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cost,
          operation_type,
          duration,
          success
        )
        VALUES (
          ${metric.provider},
          ${metric.model},
          ${metric.promptTokens || null},
          ${metric.completionTokens || null},
          ${metric.totalTokens || null},
          ${metric.cost || null},
          ${metric.operationType},
          ${metric.duration},
          ${metric.success}
        )
      `;
    } catch (error) {
      console.error('Failed to record AI usage metric:', error);
    }
  }

  // Record database query metrics
  static async recordDatabaseMetric(metric: DatabaseMetric): Promise<void> {
    try {
      await sql`
        INSERT INTO database_metrics (
          query_type,
          query_name,
          duration,
          rows_affected,
          success,
          error_message
        )
        VALUES (
          ${metric.queryType},
          ${metric.queryName},
          ${metric.duration},
          ${metric.rowsAffected || null},
          ${metric.success},
          ${metric.errorMessage || null}
        )
      `;
    } catch (error) {
      console.error('Failed to record database metric:', error);
    }
  }

  // Record analysis session metrics
  static async recordAnalysisSession(metric: AnalysisSessionMetrics): Promise<void> {
    try {
      await sql`
        INSERT INTO analysis_session_metrics (
          analysis_id,
          total_duration,
          controls_processed,
          documents_processed,
          ai_calls_count,
          total_ai_tokens,
          average_control_time,
          success_rate
        )
        VALUES (
          ${metric.analysisId},
          ${metric.totalDuration},
          ${metric.controlsProcessed},
          ${metric.documentsProcessed},
          ${metric.aiCallsCount},
          ${metric.totalAITokens},
          ${metric.averageControlTime},
          ${metric.successRate}
        )
      `;
    } catch (error) {
      console.error('Failed to record analysis session metric:', error);
    }
  }

  // Get performance summary
  static async getPerformanceSummary(
    operationType?: string, 
    hours: number = 24
  ): Promise<{
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    slowestOperations: Array<{ operationName: string; avgDuration: number; count: number }>;
    errorSummary: Array<{ operationName: string; errorCount: number; errorRate: number }>;
  }> {
    try {
      const whereClause = operationType 
        ? sql`WHERE operation_type = ${operationType} AND created_at > NOW() - INTERVAL '${hours} hours'`
        : sql`WHERE created_at > NOW() - INTERVAL '${hours} hours'`;

      // Get overall metrics
      const [summary] = await sql`
        SELECT 
          COUNT(*) as total_operations,
          AVG(duration) as average_duration,
          AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 as success_rate
        FROM performance_metrics 
        ${whereClause}
      `;

      // Get slowest operations
      const slowestOps = await sql`
        SELECT 
          operation_name,
          AVG(duration) as avg_duration,
          COUNT(*) as count
        FROM performance_metrics 
        ${whereClause}
        GROUP BY operation_name
        ORDER BY avg_duration DESC
        LIMIT 10
      `;

      // Get error summary
      const errorSummary = await sql`
        SELECT 
          operation_name,
          COUNT(*) FILTER (WHERE NOT success) as error_count,
          COUNT(*) as total_count,
          (COUNT(*) FILTER (WHERE NOT success)::float / COUNT(*)) * 100 as error_rate
        FROM performance_metrics 
        ${whereClause}
        GROUP BY operation_name
        HAVING COUNT(*) FILTER (WHERE NOT success) > 0
        ORDER BY error_rate DESC
        LIMIT 10
      `;

      return {
        totalOperations: parseInt(summary.total_operations) || 0,
        averageDuration: parseFloat(summary.average_duration) || 0,
        successRate: parseFloat(summary.success_rate) || 0,
        slowestOperations: slowestOps.map(op => ({
          operationName: op.operation_name,
          avgDuration: parseFloat(op.avg_duration),
          count: parseInt(op.count)
        })),
        errorSummary: errorSummary.map(err => ({
          operationName: err.operation_name,
          errorCount: parseInt(err.error_count),
          errorRate: parseFloat(err.error_rate)
        }))
      };
    } catch (error) {
      console.error('Failed to get performance summary:', error);
      return {
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        slowestOperations: [],
        errorSummary: []
      };
    }
  }

  // Get AI usage summary
  static async getAIUsageSummary(hours: number = 24): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    averageDuration: number;
    byProvider: Array<{ provider: string; calls: number; tokens: number; cost: number }>;
    byOperation: Array<{ operationType: string; calls: number; tokens: number; avgDuration: number }>;
  }> {
    try {
      // Overall summary
      const [summary] = await sql`
        SELECT 
          COUNT(*) as total_calls,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(duration) as average_duration
        FROM ai_usage_metrics 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
      `;

      // By provider
      const byProvider = await sql`
        SELECT 
          provider,
          COUNT(*) as calls,
          SUM(total_tokens) as tokens,
          SUM(cost) as cost
        FROM ai_usage_metrics 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY provider
        ORDER BY tokens DESC
      `;

      // By operation type
      const byOperation = await sql`
        SELECT 
          operation_type,
          COUNT(*) as calls,
          SUM(total_tokens) as tokens,
          AVG(duration) as avg_duration
        FROM ai_usage_metrics 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY operation_type
        ORDER BY tokens DESC
      `;

      return {
        totalCalls: parseInt(summary.total_calls) || 0,
        totalTokens: parseInt(summary.total_tokens) || 0,
        totalCost: parseFloat(summary.total_cost) || 0,
        averageDuration: parseFloat(summary.average_duration) || 0,
        byProvider: byProvider.map(p => ({
          provider: p.provider,
          calls: parseInt(p.calls),
          tokens: parseInt(p.tokens) || 0,
          cost: parseFloat(p.cost) || 0
        })),
        byOperation: byOperation.map(o => ({
          operationType: o.operation_type,
          calls: parseInt(o.calls),
          tokens: parseInt(o.tokens) || 0,
          avgDuration: parseFloat(o.avg_duration)
        }))
      };
    } catch (error) {
      console.error('Failed to get AI usage summary:', error);
      return {
        totalCalls: 0,
        totalTokens: 0,
        totalCost: 0,
        averageDuration: 0,
        byProvider: [],
        byOperation: []
      };
    }
  }

  // Cleanup old metrics (keep last 30 days)
  static async cleanupOldMetrics(): Promise<void> {
    try {
      await Promise.all([
        sql`DELETE FROM performance_metrics WHERE created_at < NOW() - INTERVAL '30 days'`,
        sql`DELETE FROM ai_usage_metrics WHERE created_at < NOW() - INTERVAL '30 days'`,
        sql`DELETE FROM database_metrics WHERE created_at < NOW() - INTERVAL '30 days'`
      ]);
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
    }
  }
}

export default PerformanceMonitor;