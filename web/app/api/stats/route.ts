import { NextResponse } from 'next/server';
import { vectorStore } from '@/lib/vector-store';

export async function GET() {
  const stats = await vectorStore.getStats();
  const docs = await vectorStore.listDocuments();
  const vectors = await vectorStore.getVectorSample(10);
  
  return NextResponse.json({
    ...stats,
    docs,
    vectorSamples: vectors.map(v => ({ id: v.id, path: v.path, text: v.text.substring(0, 50) }))
  });
}
