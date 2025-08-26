-- Add semantic chunking and document organization tables

-- Semantic chunks table (replaces basic text_chunks for better analysis)
CREATE TABLE IF NOT EXISTS semantic_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  topic VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  semantic_summary TEXT,
  relevance_score INTEGER DEFAULT 50 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT semantic_chunks_document_index UNIQUE (document_id, chunk_index)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_category ON semantic_chunks(category);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_relevance ON semantic_chunks(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_document_category ON semantic_chunks(document_id, category);

-- Organized documents table (master LLM-optimized documents)
CREATE TABLE IF NOT EXISTS organized_documents (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  master_markdown TEXT NOT NULL,
  document_count INTEGER NOT NULL DEFAULT 0,
  categories JSONB NOT NULL DEFAULT '[]',
  total_chunks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attribution mappings table (tracks source attribution in master document)
CREATE TABLE IF NOT EXISTS attribution_mappings (
  id SERIAL PRIMARY KEY,
  organized_document_id INTEGER NOT NULL REFERENCES organized_documents(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_name VARCHAR(255) NOT NULL,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient attribution lookups
CREATE INDEX IF NOT EXISTS idx_attribution_mappings_organized_doc ON attribution_mappings(organized_document_id);
CREATE INDEX IF NOT EXISTS idx_attribution_mappings_line_range ON attribution_mappings(organized_document_id, line_start, line_end);

-- Document classifications table
CREATE TABLE IF NOT EXISTS document_classifications (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  classification_type VARCHAR(50) NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_document_classification UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_classifications_type ON document_classifications(classification_type);