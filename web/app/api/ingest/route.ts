import { NextRequest, NextResponse } from 'next/server';
import { ingestionWorker } from '@/lib/ingestion-worker';

export async function POST(req: NextRequest) {
  try {
    const { event_type, path, timestamp } = await req.json();
    
    // Quick validation
    if (!path || !event_type) {
      return NextResponse.json({ success: false, error: 'Invalid event data' }, { status: 400 });
    }

    // Producer Pattern: Just push to the queue and return immediately
    // The heavy work (FS read, hashing, embedding, LanceDB) happens in the background worker
    await ingestionWorker.enqueue({
      path,
      eventType: event_type,
      timestamp: timestamp || Date.now()
    });

    return NextResponse.json({ 
      success: true, 
      message: `Enqueued ${path.split('/').pop()} for production processing`
    });

  } catch (error: any) {
    console.error('❌ API Ingestion error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
