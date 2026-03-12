import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { llmService } from './llm-service';
import { vectorStore } from './vector-store';
import { eventService } from './event-service';
import { config } from './config';

interface IngestionJob {
  path: string;
  eventType: string;
  timestamp: number;
  retryCount: number;
}

class IngestionWorker {
  private static instance: IngestionWorker;
  private queue: IngestionJob[] = [];
  private activeWorkers = 0;
  private readonly MAX_WORKERS = 2; // Silicon sweet spot for parallel embedding + search
  private fileHashMap = new Map<string, string>(); // Path -> Hash
  private isPaused = false;
  private isInitialized = false;

  private constructor() {
    this.init();
    this.startWorkerLoop();
  }

  public static getInstance(): IngestionWorker {
    if (!IngestionWorker.instance) {
      IngestionWorker.instance = new IngestionWorker();
    }
    return IngestionWorker.instance;
  }

  private async init() {
    if (this.isInitialized) return;
    try {
      console.log("🔄 Syncing Ingestion Worker with LanceDB Hash Cache...");
      const hashes = await vectorStore.getAllHashes();
      this.fileHashMap = hashes;
      this.isInitialized = true;
      console.log(`✅ Synced ${hashes.size} file fingerprints from persistent storage.`);
    } catch (e) {
      console.warn("⚠️ Could not sync hash cache on startup.");
    }
  }

  public pause() {
    this.isPaused = true;
    console.log("⏸️ Ingestion Worker Paused (Search Priority Mode)");
  }

  public resume() {
    this.isPaused = false;
    console.log("▶️ Ingestion Worker Resumed");
    this.processNext();
  }

  public async enqueue(job: Omit<IngestionJob, 'retryCount'>) {
    if (!this.isInitialized) await this.init();
    console.log(`📦 Queueing job: ${job.path}`);
    this.queue.push({ ...job, retryCount: 0 });
    this.processNext();
  }

  private startWorkerLoop() {
    setInterval(() => this.processNext(), 1000);
  }

  private async processNext() {
    if (this.isPaused || this.activeWorkers >= this.MAX_WORKERS || this.queue.length === 0) return;

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;
    try {
      await this.processJob(job);
    } catch (err: any) {
      console.error(`❌ Job failed: ${job.path}`, err);
      if (job.retryCount < 2) {
        this.queue.push({ ...job, retryCount: job.retryCount + 1 });
      }
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  private async processJob(job: IngestionJob) {
    const { path, eventType, timestamp } = job;
    const fileName = path.split('/').pop() || 'unknown';

    if (eventType === 'Deleted') {
      await vectorStore.deleteByPath(path);
      this.fileHashMap.delete(path);
      this.broadcastStatus(path, 'deleted', 'Removed from index');
      return;
    }

    try {
      this.broadcastStatus(path, 'hashing', 'Checking for changes');
      const content = await fs.readFile(path, 'utf-8');
      
      // 1. File Hashing Optimization
      const currentHash = crypto.createHash('sha256').update(content).digest('hex');
      if (this.fileHashMap.get(path) === currentHash && eventType !== 'Initial') {
        this.broadcastStatus(path, 'skipped', 'No content changes detected');
        return;
      }
      this.fileHashMap.set(path, currentHash);

      // 2. Chunking
      this.broadcastStatus(path, 'chunking', 'Splitting into semantic blocks');
      const chunks = llmService.chunkText(content, config.CHUNK_SIZE, config.CHUNK_OVERLAP);
      
      // 3. Batch Embedding
      this.broadcastStatus(path, 'embedding', `Generating embeddings for ${chunks.length} chunks`);
      const documents = [];
      const batchSize = 5;
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await Promise.all(batch.map(c => llmService.getEmbedding(c)));
        
        for (let j = 0; j < batch.length; j++) {
          documents.push({
            id: `${fileName}-${timestamp}-${i + j}`,
            vector: embeddings[j],
            text: batch[j],
            path: path,
            timestamp: timestamp,
            hash: currentHash,
            chunk_index: i + j
          });
        }
      }

      // 4. Batch Store
      this.broadcastStatus(path, 'indexing', `Storing ${documents.length} vectors in LanceDB`);
      if (eventType === 'Modified') {
        await vectorStore.deleteByPath(path);
      }
      await vectorStore.addDocuments(documents);

      const stats = await vectorStore.getStats();
      this.broadcastStatus(path, 'success', `Indexed ${documents.length} fragments`, stats);

    } catch (err: any) {
      this.broadcastStatus(path, 'error', err.message);
      throw err;
    }
  }

  private broadcastStatus(path: string, status: string, msg: string, stats?: any) {
    eventService.broadcast({
      type: 'index',
      data: {
        path: path.split('/').pop(),
        fullPath: path,
        status,
        msg,
        stats
      }
    });
  }
}

export const ingestionWorker = IngestionWorker.getInstance();
