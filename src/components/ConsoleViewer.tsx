'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  category?: string;
  data?: any;
}

interface ConsoleViewerProps {
  height?: string;
  maxLogs?: number;
  autoScroll?: boolean;
  categories?: string[];
}

export default function ConsoleViewer({ 
  height = '400px', 
  maxLogs = 100,
  autoScroll = true,
  categories = []
}: ConsoleViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const [showData, setShowData] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initialize with existing logs
    fetchLogs();

    // Set up real-time streaming
    setupEventSource();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (isAutoScrollEnabled && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isAutoScrollEnabled]);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/admin/console-logs?limit=100');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const setupEventSource = () => {
    try {
      const eventSource = new EventSource('/api/admin/console-stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'logs') {
            setLogs(parsed.data.map((log: any) => ({
              ...log,
              timestamp: new Date(log.timestamp)
            })));
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        // Try to reconnect after a delay
        setTimeout(setupEventSource, 5000);
      };
    } catch (error) {
      console.error('Failed to setup event source:', error);
      setIsConnected(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/admin/console-logs', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      case 'debug': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'API': return 'bg-green-100 text-green-800';
      case 'ANALYSIS': return 'bg-purple-100 text-purple-800';
      case 'AI': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (selectedCategory && log.category !== selectedCategory) return false;
    if (selectedLevel && log.level !== selectedLevel) return false;
    return true;
  }).slice(0, maxLogs);

  const uniqueCategories = Array.from(new Set(logs.map(log => log.category).filter(Boolean)));
  const levels = ['info', 'warn', 'error', 'debug'];

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold">Console Viewer</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
              className={`px-3 py-1 text-sm rounded ${
                isAutoScrollEnabled 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Auto-scroll
            </button>
            <button
              onClick={() => setShowData(!showData)}
              className={`px-3 py-1 text-sm rounded ${
                showData 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Show Data
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 text-sm border rounded-md"
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-1 text-sm border rounded-md"
          >
            <option value="">All Levels</option>
            {levels.map(level => (
              <option key={level} value={level}>{level.toUpperCase()}</option>
            ))}
          </select>

          <span className="text-sm text-gray-500">
            {filteredLogs.length} logs
          </span>
        </div>
      </div>

      {/* Log Content */}
      <div 
        ref={logContainerRef}
        className="overflow-y-auto font-mono text-xs"
        style={{ height }}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No logs to display
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredLogs.map((log) => (
              <div key={log.id} className={`p-2 rounded text-xs ${getLevelColor(log.level)}`}>
                <div className="flex items-start space-x-2">
                  <span className="text-gray-500 whitespace-nowrap">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  
                  {log.category && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                      {log.category}
                    </span>
                  )}
                  
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  
                  <span className="flex-1 break-words">
                    {log.message}
                  </span>
                </div>
                
                {showData && log.data && (
                  <div className="mt-1 ml-4 p-2 bg-gray-100 rounded text-xs">
                    <pre className="whitespace-pre-wrap overflow-hidden">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}