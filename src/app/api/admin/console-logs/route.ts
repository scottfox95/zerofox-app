import { NextRequest, NextResponse } from 'next/server';
import { consoleLogger } from '@/lib/console-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const level = searchParams.get('level') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');

    const logs = consoleLogger.getLogs(category, level).slice(0, limit);

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Console logs API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { level, message, category, data } = await request.json();
    consoleLogger.log(level || 'info', message || 'Manual log entry', category, data);
    
    return NextResponse.json({
      success: true,
      message: 'Log entry added'
    });
  } catch (error) {
    console.error('Console logs POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add log entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    consoleLogger.clear();
    return NextResponse.json({
      success: true,
      message: 'Logs cleared'
    });
  } catch (error) {
    console.error('Console logs clear error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}