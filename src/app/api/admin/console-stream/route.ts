import { NextRequest } from 'next/server';
import { consoleLogger } from '@/lib/console-logger';

export async function GET(request: NextRequest) {
  // Set up Server-Sent Events
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to log updates
      const unsubscribe = consoleLogger.subscribe((logs) => {
        try {
          const data = JSON.stringify({ type: 'logs', data: logs.slice(0, 100) });
          const message = `data: ${data}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('Error sending log update:', error);
        }
      });

      // Send initial heartbeat
      const heartbeat = () => {
        try {
          const message = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          // Stream might be closed
        }
      };

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(heartbeat, 30000);

      // Cleanup on stream close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch (error) {
          // Stream might already be closed
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}