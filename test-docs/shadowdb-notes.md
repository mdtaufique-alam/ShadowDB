# ShadowDB Technical Notes

## What is RAG?

RAG stands for Retrieval-Augmented Generation. It is a pattern where instead of asking
an AI model to answer from memory, you first retrieve relevant documents from a local database
and then pass those documents as context to the model. This allows the AI to answer questions
about your specific files and data without any cloud uploads.

## How Chunking Works

When a file is indexed by ShadowDB, it is split into chunks of 500 tokens each with 100 tokens
of overlap between consecutive chunks. This overlap ensures that important context at the
boundary between chunks is not lost. Chunking is critical - bad chunking leads to poor AI answers.

## Why LanceDB?

LanceDB is a vector database that runs entirely on your local filesystem. It stores embeddings
as Lance format columnar data which allows for extremely fast nearest-neighbor search using
cosine similarity. It supports millions of vectors with sub-20ms search latency even on a laptop.

## Rust Ownership

The Rust file watcher uses the `notify` crate which leverages OS-level filesystem events
(FSEvents on macOS, inotify on Linux). This is far more efficient than polling. Rust's
ownership system guarantees that the watcher channel cannot have race conditions - the compiler
enforces this at compile time, not at runtime.

## Embedding Model

BGE-small-en-v1.5 is a sentence embedding model optimized for retrieval tasks. It produces
384-dimensional vectors. These vectors represent the semantic meaning of text - similar concepts
produce vectors that are close together in 384-dimensional space, which is what cosine similarity
measures.
