import { NextRequest, NextResponse } from 'next/server';
import { llmService } from '@/lib/llm-service';
import { vectorStore } from '@/lib/vector-store';
import { ingestionWorker } from '@/lib/ingestion-worker';
import { config } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    // 1. Pause background indexing to prioritize search resources
    ingestionWorker.pause();

    // 2. Embed query
    const queryVector = await llmService.getEmbedding(query);

    // 3. Semantic search
    const results = await vectorStore.search(queryVector, 5);
    const chunks = results.filter((r: any) => r._distance < 0.85);

    if (chunks.length === 0) {
      ingestionWorker.resume();
      return NextResponse.json({ 
        answer: "I checked your indexed files, but I couldn't find any relevant information.", 
        sources: [] 
      });
    }

    const context = chunks.map((c: any, i: number) => 
      `[Source ${i+1}: ${c.path}]\n${c.text}`
    ).join('\n\n---\n\n');

    const assistantPrompt = `### ROLE
You are ShadowDB, a highly intelligent and technical AI research assistant. Your task is to provide comprehensive, grounded, and well-structured answers based ONLY on the provided local documents.

### GUIDELINES
1. **Persona**: Be technical, professional, and helpful. Write like a senior engineer explaining concepts to a peer.
2. **Structure**: 
   - Start with a high-level conceptual overview.
   - Use bolded headers for distinct sections.
   - Use bullet points for readability.
   - Use code blocks for technical snippets found in the context.
3. **Grounding**: ONLY use information from the provided [Context]. Do not hallucinate external knowledge. If the context doesn't contain the answer, politely state: "I don't have enough local information to answer that specifically."
4. **Style**: Use clean Markdown formatting. Focus on "The What" and "The How."

### CONTEXT
${context}

### USER QUERY
${query}

### SYNTHESIZED RESPONSE:`;

    // 4. Stream response from Ollama
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(`${config.OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            body: JSON.stringify({
              model: config.LLM_MODEL,
              prompt: assistantPrompt,
              stream: true
            })
          });

          if (!response.body) throw new Error("No response body from Ollama");
          
          const reader = response.body.getReader();
          
          // Initial metadata chunk
          const metadata = JSON.stringify({ 
            sources: chunks.map((c: any) => ({ path: c.path, snippet: c.text.slice(0, 100) })) 
          });
          controller.enqueue(encoder.encode(`METADATA:${metadata}\n`));

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split('\n');
            
            for (const line of lines) {
              if (!line.trim()) continue;
              const json = JSON.parse(line);
              if (json.response) {
                controller.enqueue(encoder.encode(json.response));
              }
              if (json.done) break;
            }
          }
        } catch (e) {
          console.error("Streaming error:", e);
        } finally {
          ingestionWorker.resume();
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    ingestionWorker.resume();
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
