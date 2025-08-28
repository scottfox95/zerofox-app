'use client';

import { useState, useEffect, useRef } from 'react';

export interface ProgressData {
  stage: 'initializing' | 'document_preparation' | 'analysis_starting' | 'analysis_processing' | 'finalizing' | 'completed';
  progress: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  currentControl?: {
    id: number;
    title: string;
    description: string;
    index: number;
    total: number;
  } | null;
  runningTotals?: {
    compliant: number;
    partial: number;
    missing: number;
  };
  interimResults?: Array<{
    type: 'control_completed' | 'control_failed';
    control: {
      id: number;
      title: string;
      control_id?: string;
      status?: string;
      confidence?: number;
      evidenceCount?: number;
      error?: string;
    };
    summary: {
      processed: number;
      remaining: number;
      compliant: number;
      partial: number;
      missing: number;
    };
    timestamp: string;
  }>;
  finalResults?: {
    totalControls: number;
    compliant: number;
    partial: number;
    missing: number;
    averageConfidence: number;
    processingTime: number;
  };
  documentsProcessed?: number;
  semanticChunks?: number;
  textChunks?: number;
  completed?: boolean;
  timestamp?: string;
}

export function useAnalysisProgress(analysisId: string | null) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!analysisId) {
      setProgressData(null);
      setConnected(false);
      return;
    }

    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/admin/analyses/${analysisId}/progress`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressData;
        setProgressData(data);
      } catch (err) {
        console.error('Failed to parse progress data:', err);
        setError('Failed to parse progress data');
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setError('Connection to progress stream failed');
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [analysisId]);

  return {
    progressData,
    connected,
    error,
    isComplete: progressData?.completed || false
  };
}