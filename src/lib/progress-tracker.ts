// Global progress tracking utility
const progressStreams = new Map<string, ReadableStreamDefaultController>();
const progressData = new Map<string, any>();

// Helper function to update progress (called from evidence analyzer)
export function updateAnalysisProgress(analysisId: string, update: any) {
  console.log(`📡 [Progress Tracker] Attempting to update progress for analysis ${analysisId}:`, update.currentStep);
  const controller = progressStreams.get(analysisId);
  if (controller) {
    console.log(`✅ [Progress Tracker] Controller found for analysis ${analysisId}`);
    // Merge with existing data
    const currentData = progressData.get(analysisId) || {};
    const newData = { ...currentData, ...update, timestamp: new Date().toISOString() };
    progressData.set(analysisId, newData);
    
    try {
      controller.enqueue(`data: ${JSON.stringify(newData)}\n\n`);
      console.log(`📤 [Progress Tracker] Progress update sent for analysis ${analysisId}`);
    } catch (error) {
      console.error(`❌ [Progress Tracker] Failed to send update for analysis ${analysisId}:`, error);
      // Stream might be closed, clean up
      progressStreams.delete(analysisId);
      progressData.delete(analysisId);
    }
  } else {
    console.log(`⚠️ [Progress Tracker] No controller found for analysis ${analysisId} - ${progressStreams.size} total streams`);
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
  console.log(`🔗 [Progress Tracker] Registering stream for analysis ${analysisId}`);
  progressStreams.set(analysisId, controller);
  console.log(`📊 [Progress Tracker] Total active streams: ${progressStreams.size}`);
  
  // Send initial progress data - check for existing data first
  const existingData = progressData.get(analysisId);
  const initialData = existingData || {
    stage: 'initializing',
    progress: 0,
    currentStep: 'Connecting to analysis stream...',
    totalSteps: 0,
    completedSteps: 0,
    currentControl: null,
    interimResults: []
  };
  
  try {
    controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`);
    console.log(`📤 [Progress Tracker] Initial data sent for analysis ${analysisId}:`, initialData.currentStep);
    
    // If no existing data, try to kick-start the analysis progress
    if (!existingData) {
      console.log(`🔍 [Progress Tracker] No existing progress data for analysis ${analysisId}, will send fallback updates`);
      
      // Send a better initial message after a short delay
      setTimeout(() => {
        const fallbackData = {
          stage: 'analysis_processing',
          progress: 15,
          currentStep: 'Analysis in progress - processing documents and controls...',
          totalSteps: 100,
          completedSteps: 15,
          currentControl: null,
          interimResults: []
        };
        
        try {
          controller.enqueue(`data: ${JSON.stringify(fallbackData)}\n\n`);
          console.log(`🔄 [Progress Tracker] Fallback progress sent for analysis ${analysisId}`);
        } catch (err) {
          console.error(`❌ [Progress Tracker] Failed to send fallback for analysis ${analysisId}:`, err);
        }
      }, 2000);
    }
  } catch (error) {
    console.error(`❌ [Progress Tracker] Failed to send initial data for analysis ${analysisId}:`, error);
  }
}

export function unregisterProgressStream(analysisId: string) {
  progressStreams.delete(analysisId);
  progressData.delete(analysisId);
}