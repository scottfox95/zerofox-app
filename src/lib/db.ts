import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL environment variable is required');
}

export const sql = neon(process.env.NEON_DATABASE_URL);

// Database schema initialization - Essential tables only
export const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing ZeroFox Compliance database...');

    // Users and organizations - First create table, then add missing columns
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add password_hash column if it doesn't exist
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_organizations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, organization_id)
      )
    `;

    // Frameworks and controls
    await sql`
      CREATE TABLE IF NOT EXISTS frameworks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        version VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS controls (
        id SERIAL PRIMARY KEY,
        framework_id INTEGER REFERENCES frameworks(id) ON DELETE CASCADE,
        control_id VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(framework_id, control_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS custom_frameworks (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS custom_framework_controls (
        id SERIAL PRIMARY KEY,
        custom_framework_id INTEGER REFERENCES custom_frameworks(id) ON DELETE CASCADE,
        control_id VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        source_framework_id INTEGER REFERENCES frameworks(id),
        source_control_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Documents and processing
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size INTEGER NOT NULL,
        upload_path VARCHAR(500),
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS text_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        page_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Analysis and evidence
    await sql`
      CREATE TABLE IF NOT EXISTS analyses (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        framework_id INTEGER REFERENCES frameworks(id),
        custom_framework_id INTEGER REFERENCES custom_frameworks(id),
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        ai_model VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        CHECK ((framework_id IS NOT NULL AND custom_framework_id IS NULL) OR 
               (framework_id IS NULL AND custom_framework_id IS NOT NULL))
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS evidence_mappings (
        id SERIAL PRIMARY KEY,
        analysis_id INTEGER REFERENCES analyses(id) ON DELETE CASCADE,
        control_id VARCHAR(100) NOT NULL,
        confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
        status VARCHAR(20) DEFAULT 'found' CHECK (status IN ('found', 'partial', 'missing')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS evidence_items (
        id SERIAL PRIMARY KEY,
        evidence_mapping_id INTEGER REFERENCES evidence_mappings(id) ON DELETE CASCADE,
        text_chunk_id INTEGER REFERENCES text_chunks(id) ON DELETE CASCADE,
        evidence_text TEXT NOT NULL,
        confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
        reasoning TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // AI models and prompts
    await sql`
      CREATE TABLE IF NOT EXISTS ai_models (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
        model_id VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        config JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ai_prompts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_type VARCHAR(50) NOT NULL,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Database tables initialized successfully');
    return { success: true, message: 'Database initialized successfully' };

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

// Test database connection
export const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection successful:', result[0]);
    return { success: true, timestamp: result[0].current_time };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};