// In-memory console logger for real-time monitoring
interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  category?: string;
  data?: any;
}

class ConsoleLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  log(level: LogEntry['level'], message: string, category?: string, data?: any) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      category,
      data
    };

    this.logs.unshift(entry); // Add to beginning for newest-first order
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener([...this.logs]); // Send copy to prevent mutations
      } catch (error) {
        console.error('Error notifying log listener:', error);
      }
    });
  }

  info(message: string, category?: string, data?: any) {
    this.log('info', message, category, data);
  }

  warn(message: string, category?: string, data?: any) {
    this.log('warn', message, category, data);
  }

  error(message: string, category?: string, data?: any) {
    this.log('error', message, category, data);
  }

  debug(message: string, category?: string, data?: any) {
    this.log('debug', message, category, data);
  }

  // API call specific logging
  apiCall(method: string, url: string, status?: number, duration?: number, data?: any) {
    const statusEmoji = status ? (status < 300 ? '✅' : status < 400 ? '🔄' : '❌') : '📤';
    const durationText = duration ? ` (${duration}ms)` : '';
    this.info(`${statusEmoji} ${method} ${url}${durationText}`, 'API', { method, url, status, duration, data });
  }

  // Analysis specific logging  
  analysisStep(step: string, details?: string, data?: any) {
    this.info(`🔍 ${step}${details ? `: ${details}` : ''}`, 'ANALYSIS', data);
  }

  // AI processing logging
  aiCall(model: string, prompt: string, response?: string, tokens?: number) {
    const tokenText = tokens ? ` (${tokens} tokens)` : '';
    this.info(`🤖 ${model}${tokenText}`, 'AI', { prompt: prompt.substring(0, 100) + '...', response: response?.substring(0, 100) + '...', tokens });
  }

  getLogs(category?: string, level?: string): LogEntry[] {
    let filteredLogs = [...this.logs];
    
    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    return filteredLogs;
  }

  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    
    // Send current logs immediately
    listener([...this.logs]);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener([]));
  }
}

// Export singleton instance
export const consoleLogger = new ConsoleLogger();
export type { LogEntry };