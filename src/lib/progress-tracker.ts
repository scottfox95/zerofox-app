// Global progress tracking utility
const progressStreams = new Map<string, ReadableStreamDefaultController>();
const progressData = new Map<string, any>();

// Helper function to update progress (called from evidence analyzer)
export function updateAnalysisProgress(analysisId: string, update: any) {
  const controller = progressStreams.get(analysisId);
  if (controller) {
    // Merge with existing data
    const currentData = progressData.get(analysisId) || {};
    const newData = { ...currentData, ...update, timestamp: new Date().toISOString() };
    progressData.set(analysisId, newData);
    
    try {
      controller.enqueue(`data: ${JSON.stringify(newData)}\n\n`);
    } catch (error) {
      // Stream might be closed, clean up
      progressStreams.delete(analysisId);
      progressData.delete(analysisId);
    }
  }
}

// Helper function to add interim result
export function addInterimResult(analysisId: string, result: any) {
  const currentData = progressData.get(analysisId) || { interimResults: [] };
  if (!currentData.interimResults) {
    currentData.interimResults = [];
  }
  currentData.interimResults.push({
    ...result,
    timestamp: new Date().toISOString()
  });
  
  const controller = progressStreams.get(analysisId);
  if (controller) {
    try {
      controller.enqueue(`data: ${JSON.stringify(currentData)}\n\n`);
    } catch (error) {
      progressStreams.delete(analysisId);
      progressData.delete(analysisId);
    }
  }
}

// Stream management functions
export function registerProgressStream(analysisId: string, controller: ReadableStreamDefaultController) {
  progressStreams.set(analysisId, controller);
  
  // Send initial progress data
  const initialData = progressData.get(analysisId) || {
    stage: 'initializing',
    progress: 0,
    currentStep: 'Loading analysis configuration...',
    totalSteps: 0,
    completedSteps: 0,
    currentControl: null,
    interimResults: []
  };
  
  controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`);
}

export function unregisterProgressStream(analysisId: string) {
  progressStreams.delete(analysisId);
  progressData.delete(analysisId);
}