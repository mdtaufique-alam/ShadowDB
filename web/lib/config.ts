/**
 * ShadowDB Global Configuration
 * 
 * Centralizing these values makes the project "Scale-Ready". 
 * You can easily point this to a massive model like Llama-3-70B or 
 * change your indexing strategy without touching business logic.
 */

export const config = {
  // LLM Settings (Ollama)
  LLM_MODEL: "llama3.2:3b", // Upgraded for better reasoning on 8GB RAM
  OLLAMA_BASE_URL: "http://127.0.0.1:11434",
  
  // Embedding Settings (Local ONNX)
  EMBEDDING_MODEL: "Xenova/bge-small-en-v1.5",
  
  // Vector Database Settings
  VECTOR_STORE_PATH: ".lancedb",
  TABLE_NAME: "documents",
  
  // Ingestion & Chunking strategy
  // 500 tokens is perfect for RAG context windows, 100 overlap keeps context flowing
  CHUNK_SIZE: 500,
  CHUNK_OVERLAP: 100,
  
  // Watcher Info
  PORT: 3000,
};
