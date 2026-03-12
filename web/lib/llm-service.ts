import { pipeline } from '@xenova/transformers';
import { config } from './config';

class LLMService {
  private static instance: LLMService;
  private embedder: any;

  private constructor() {}

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  public async init() {
    if (!this.embedder) {
      console.log(`🧠 Loading local embedding model (${config.EMBEDDING_MODEL})...`);
      // We use a small, fast model for local inference
      this.embedder = await pipeline('feature-extraction', config.EMBEDDING_MODEL);
      console.log('✅ Embedding model loaded.');
    }
  }

  public async getEmbedding(text: string): Promise<number[]> {
    await this.init();
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  public chunkText(
    text: string, 
    size: number = config.CHUNK_SIZE, 
    overlap: number = config.CHUNK_OVERLAP
  ): string[] {
    // 1. Pre-split by semantic boundaries (headers or double newlines)
    const sections = text.split(/(?=^#{1,6}\s+)/m); 
    const chunks: string[] = [];

    for (const section of sections) {
      const words = section.trim().split(/\s+/);
      let start = 0;

      while (start < words.length) {
        const end = start + size;
        const chunk = words.slice(start, end).join(' ');
        
        // Add minimal metadata context if it's a long section
        chunks.push(chunk);
        
        start += (size - overlap);
        if (start >= words.length) break;
      }
    }

    return chunks.length > 0 ? chunks : [text];
  }
}

export const llmService = LLMService.getInstance();
