'use client';

import { useAnalysisProgress, ProgressData } from '@/hooks/useAnalysisProgress';
import { useState, useEffect } from 'react';

interface ProgressiveAnalysisProps {
  analysisId: string;
  onComplete?: (analysisId: string) => void;
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div 
        className="h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

function StageIndicator({ stage }: { stage: ProgressData['stage'] }) {
  const stages = [
    { key: 'initializing', label: 'Initializing', icon: '⚙️' },
    { key: 'document_preparation', label: 'Document Prep', icon: '📄' },
    { key: 'analysis_starting', label: 'Starting Analysis', icon: '🚀' },
    { key: 'analysis_processing', label: 'Processing Controls', icon: '🔍' },
    { key: 'finalizing', label: 'Finalizing', icon: '✅' },
    { key: 'completed', label: 'Completed', icon: '🎉' }
  ];

  return (
    <div className="flex items-center justify-between mb-6">
      {stages.map((stageInfo, index) => {
        const isActive = stageInfo.key === stage;
        const isCompleted = stages.findIndex(s => s.key === stage) > index;
        
        return (
          <div key={stageInfo.key} className="flex flex-col items-center relative flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2 transition-all duration-300 ${
              isActive 
                ? 'bg-blue-500 text-white scale-110 shadow-lg animate-pulse' 
                : isCompleted 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-400'
            }`}>
              {stageInfo.icon}
            </div>
            <span className={`text-xs text-center font-medium transition-colors duration-300 ${
              isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
            }`}>
              {stageInfo.label}
            </span>
            {index < stages.length - 1 && (
              <div className={`absolute top-5 left-1/2 w-full h-0.5 transition-colors duration-500 ${
                isCompleted ? 'bg-green-300' : 'bg-gray-200'
              }`} style={{ left: '50%', width: '100%', zIndex: -1 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CurrentControlCard({ currentControl }: { currentControl: ProgressData['currentControl'] }) {
  if (!currentControl) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-blue-600">
            Control {currentControl.index} of {currentControl.total}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(((currentControl.index - 1) / currentControl.total) * 100)}% of controls
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{currentControl.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2">{currentControl.description}</p>
    </div>
  );
}

function RunningTotalsCard({ runningTotals }: { runningTotals: ProgressData['runningTotals'] }) {
  if (!runningTotals) return null;

  const total = runningTotals.compliant + runningTotals.partial + runningTotals.missing;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-gray-900 mb-3">Running Totals</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{runningTotals.compliant}</div>
          <div className="text-xs text-gray-600">Compliant</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{runningTotals.partial}</div>
          <div className="text-xs text-gray-600">Partial</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{runningTotals.missing}</div>
          <div className="text-xs text-gray-600">Missing</div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Compliance Rate</span>
            <span>{Math.round((runningTotals.compliant / total) * 100)}%</span>
          </div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(runningTotals.compliant / total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InterimResultsStream({ interimResults }: { interimResults: ProgressData['interimResults'] }) {
  if (!interimResults || interimResults.length === 0) return null;

  // Show only the last 5 results to avoid overwhelming the UI
  const recentResults = interimResults.slice(-5);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
        Latest Results
      </h3>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {recentResults.map((result, index) => (
          <div 
            key={`${result.control.id}-${result.timestamp}`}
            className="flex items-center justify-between p-2 bg-white rounded border animate-slide-in text-sm"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {result.type === 'control_completed' ? (
                <>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    result.control.status === 'compliant' 
                      ? 'bg-green-500' 
                      : result.control.status === 'partial' 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                  }`}></div>
                  <span className="truncate font-medium">{result.control.title}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    result.control.status === 'compliant' 
                      ? 'bg-green-100 text-green-700' 
                      : result.control.status === 'partial' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {result.control.status}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span className="truncate font-medium">{result.control.title}</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium flex-shrink-0">
                    Failed
                  </span>
                </>
              )}
            </div>
            {result.control.confidence && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {Math.round(result.control.confidence)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProgressiveAnalysis({ analysisId, onComplete }: ProgressiveAnalysisProps) {
  const { progressData, connected, error, isComplete } = useAnalysisProgress(analysisId);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);

  useEffect(() => {
    if (isComplete && !hasCompletedOnce) {
      setHasCompletedOnce(true);
      if (onComplete) {
        // Give a small delay to let the final progress update show
        setTimeout(() => onComplete(analysisId), 2000);
      }
    }
  }, [isComplete, hasCompletedOnce, onComplete, analysisId]);

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 font-medium">Progress Tracking Error</div>
        <div className="text-red-500 text-sm mt-1">{error}</div>
        <div className="text-gray-500 text-xs mt-2">Analysis is still running, but progress updates are unavailable.</div>
      </div>
    );
  }

  if (!connected || !progressData) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Connecting to analysis stream...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Analysis in Progress</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live Updates</span>
        </div>
      </div>

      {/* Stage Progress */}
      <StageIndicator stage={progressData.stage} />

      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">{progressData.currentStep}</span>
          <span className="text-gray-500">{Math.round(progressData.progress)}%</span>
        </div>
        <ProgressBar progress={progressData.progress} />
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Step {progressData.completedSteps} of {progressData.totalSteps}</span>
          {progressData.timestamp && (
            <span>Updated {new Date(progressData.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Current Control Being Processed */}
      <CurrentControlCard currentControl={progressData.currentControl} />

      {/* Running Totals */}
      <RunningTotalsCard runningTotals={progressData.runningTotals} />

      {/* Real-time Results Stream */}
      <InterimResultsStream interimResults={progressData.interimResults} />

      {/* Document Statistics */}
      {progressData.documentsProcessed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Analysis Scope</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">{progressData.documentsProcessed}</div>
              <div className="text-xs text-gray-600">Documents</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">{progressData.semanticChunks || 0}</div>
              <div className="text-xs text-gray-600">Semantic Chunks</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">{progressData.textChunks || 0}</div>
              <div className="text-xs text-gray-600">Text Chunks</div>
            </div>
          </div>
        </div>
      )}

      {/* Final Results Summary */}
      {progressData.finalResults && progressData.completed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 animate-fade-in">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-lg mr-3">
              ✓
            </div>
            <h3 className="text-lg font-semibold text-green-800">Analysis Complete!</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{progressData.finalResults.compliant}</div>
              <div className="text-sm text-gray-600">Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{progressData.finalResults.partial}</div>
              <div className="text-sm text-gray-600">Partial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{progressData.finalResults.missing}</div>
              <div className="text-sm text-gray-600">Missing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{progressData.finalResults.averageConfidence}%</div>
              <div className="text-sm text-gray-600">Avg Confidence</div>
            </div>
          </div>
          
          <div className="text-center text-sm text-gray-600">
            Processing completed in {progressData.finalResults.processingTime} seconds
          </div>
        </div>
      )}
    </div>
  );
}