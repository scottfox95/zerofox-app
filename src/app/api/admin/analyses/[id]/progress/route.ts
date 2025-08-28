import { NextRequest, NextResponse } from 'next/server';
import { registerProgressStream, unregisterProgressStream } from '@/lib/progress-tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const analysisId = params.id;
  
  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Register this stream with the progress tracker
      registerProgressStream(analysisId, controller);
      
      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        unregisterProgressStream(analysisId);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}