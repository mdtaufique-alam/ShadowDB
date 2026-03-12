import * as lancedb from "@lancedb/lancedb";
import path from "path";

class VectorStore {
  private static instance: VectorStore;
  private db: lancedb.Connection | null = null;
  private readonly TABLE_NAME = "documents";

  private constructor() {}

  public static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  private async getDB() {
    if (!this.db) {
      const dbPath = path.join(process.cwd(), ".lancedb");
      this.db = await lancedb.connect(dbPath);
    }
    return this.db;
  }

  private initPromise: Promise<void> | null = null;

  /**
   * Safe table initialization that handles concurrent workers.
   * Returns true if THIS CALL created the table.
   */
  private async ensureInitialized(docs?: any[]): Promise<boolean> { // docs made optional again to support calls from search, etc.
    if (this.initPromise) {
      await this.initPromise;
      return false; // Someone else initialized it
    }

    // If initPromise is null, we need to create it.
    // This promise will resolve once the table is confirmed to exist.
    let createdThisCall = false;
    this.initPromise = (async () => {
      const db = await this.getDB();
      const tables = await db.tableNames();
      
      if (!tables.includes(this.TABLE_NAME)) {
        console.log("🗄️ Initializing LanceDB with Explicit Production Schema...");
        
        // Ensure the FIRST batch is valid and defines the schema correctly
        const initialSafeDocs = docs ? docs.filter(d => d.hash && d.vector) : [];
        if (initialSafeDocs.length === 0) {
           // If table doesn't exist and no docs are provided, or provided docs are invalid,
           // we can't initialize. Reset initPromise and throw, as this indicates an improper first call.
           this.initPromise = null; // Allow future attempts to initialize
           throw new Error("Cannot initialize table: first batch must include valid documents to define schema.");
        }
        
        await db.createTable(this.TABLE_NAME, initialSafeDocs);
        console.log("✨ Table created successfully with production fields.");
        createdThisCall = true;
      }
      // If table already exists, or was just created, the promise resolves.
    })();

    await this.initPromise;
    return createdThisCall; 
  }

  public async addDocuments(docs: any[]) {
    if (docs.length === 0) return;
    
    // We filter FIRST to ensure initialization batch is also clean
    const safeDocs = docs.filter(d => d.hash && d.vector);
    if (safeDocs.length === 0) return;

    const db = await this.getDB();
    const created = await this.ensureInitialized(safeDocs);

    // If we were NOT the one who created the table, we need to add our docs
    if (!created) {
      const table = await db.openTable(this.TABLE_NAME);
      try {
        await table.add(safeDocs);
        console.log(`✅ Added ${safeDocs.length} chunks to vector store.`);
      } catch (e: any) {
        if (e.message.includes("Found field not in schema")) {
          console.error("❌ Schema Mismatch: Found field not in schema. Clearing .lancedb and restarting is recommended.");
        }
        throw e;
      }
    } else {
       console.log(`✨ Table created and seeded with ${safeDocs.length} chunks.`);
    }
  }

  public async getAllHashes(): Promise<Map<string, string>> {
    try {
      await this.ensureInitialized();
      const db = await this.getDB();
      const table = await db.openTable(this.TABLE_NAME);
      
      // Select only path and hash to minimize memory usage
      const results = await table.query()
        .select(['path', 'hash'])
        .limit(10000) // Large enough for most projects
        .toArray();

      const map = new Map<string, string>();
      results.forEach((r: any) => {
        if (r.path && r.hash) {
          map.set(r.path, r.hash);
        }
      });
      return map;
    } catch (e) {
      console.warn("⚠️ Could not retrieve hashes from vector store (likely empty or new).");
      return new Map();
    }
  }

  public async search(vector: number[], limit: number = 5) {
    await this.ensureInitialized(); // No docs needed for search, table must already exist
    const db = await this.getDB();
    const table = await db.openTable(this.TABLE_NAME);
    const results = await table
      .search(vector)
      .limit(limit)
      .toArray();
    return results;
  }

  public async deleteByPath(path: string) {
    await this.ensureInitialized();
    const db = await this.getDB();
    const table = await db.openTable(this.TABLE_NAME);
    await table.delete(`path = "${path}"`);
    console.log(`🗑️ Deleted chunks for: ${path}`);
  }

  public async listDocuments() {
    try {
      const db = await this.getDB();
      const tables = await db.tableNames();
      if (!tables.includes(this.TABLE_NAME)) return [];
      
      const table = await db.openTable(this.TABLE_NAME);
      const allRows = await table.query().select(["path", "text"]).toArray();
      
      const docMap = new Map();
      allRows.forEach(row => {
        if (!docMap.has(row.path)) {
          docMap.set(row.path, { path: row.path, chunks: 0, preview: row.text.substring(0, 100) });
        }
        docMap.get(row.path).chunks++;
      });
      
      return Array.from(docMap.values());
    } catch (e) {
      return [];
    }
  }

  public async getVectorSample(limit: number = 10) {
    try {
      const db = await this.getDB();
      const tables = await db.tableNames();
      if (!tables.includes(this.TABLE_NAME)) return [];
      
      const table = await db.openTable(this.TABLE_NAME);
      return await table.query().limit(limit).toArray();
    } catch (e) {
      return [];
    }
  }

  public async getStats() {
    try {
      const db = await this.getDB();
      const tables = await db.tableNames();
      if (!tables.includes(this.TABLE_NAME)) {
        return { files: 0, vectors: 0 };
      }
      const table = await db.openTable(this.TABLE_NAME);
      
      // Get unique file count and total vector count
      const totalVectors = await table.countRows();
      
      // For unique files, we'll use a search or aggregate if supported
      // Since LanceDB Node API is evolving, a simple distinct count on 'path'
      const allRows = await table.query().select(["path"]).toArray();
      const uniqueFiles = new Set(allRows.map(r => r.path)).size;

      return {
        files: uniqueFiles,
        vectors: totalVectors
      };
    } catch (e) {
      return { files: 0, vectors: 0 };
    }
  }
}

export const vectorStore = VectorStore.getInstance();
