import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || 
  'postgresql://postgres:postgres@localhost:5432/upwork_assistant'

const pool = new Pool({
  user: 'postgres',
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout
  host: 'localhost', 
  database: 'upwork_assistant',
  password: 'postgres',
  port: 5432,
})

// Test connection function
export async function testConnection() {
  try {
    const client = await pool.connect()
    console.log('✅ Database connection successful')
    client.release()
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Initialize all tables with proper foreign keys
export async function initDB() {
  try {
    console.log('🔄 Database initialization...')
    
    // First ensure we can connect
    await testConnection()

    // Users table (must be first because others reference it)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        company_name VARCHAR(255),
        timezone VARCHAR(100) DEFAULT 'Asia/Karachi',
        profile_photo TEXT,
        subscription_plan VARCHAR(50) DEFAULT 'Trial',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Users table created/verified')

    // Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_token (token)
      )
    `)
    console.log('✅ Sessions table created/verified')

    // **CRITICAL FIX: Upwork accounts table (FIXED COLUMNS)**
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upwork_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type VARCHAR(50) DEFAULT 'bearer',
        expires_in INTEGER DEFAULT 86400,
        upwork_user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_access_token (access_token)
      )
    `)
    console.log('✅ Upwork accounts table created/verified')

    // **NEW: Jobs cache table**
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cached_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        job_id VARCHAR(255) NOT NULL,
        source VARCHAR(50) DEFAULT 'upwork',
        title TEXT,
        description TEXT,
        budget TEXT,
        posted_date TIMESTAMP,
        client_info JSONB DEFAULT '{}',
        skills TEXT[] DEFAULT '{}',
        proposals INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        category VARCHAR(100),
        duration VARCHAR(50),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, job_id),
        INDEX idx_user_source (user_id, source),
        INDEX idx_created_at (created_at)
      )
    `)
    console.log('✅ Jobs cache table created/verified')

    // Proposals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proposals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        job_id VARCHAR(255),
        job_title TEXT,
        job_description TEXT,
        client_info JSONB DEFAULT '{}',
        budget VARCHAR(100),
        skills TEXT[] DEFAULT '{}',
        generated_proposal TEXT,
        edited_proposal TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        ai_model VARCHAR(100),
        temperature DECIMAL(3,2),
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, job_id),
        INDEX idx_user_status (user_id, status),
        INDEX idx_created_at (created_at)
      )
    `)
    console.log('✅ Proposals table created/verified')

    // Proposal edits for AI training
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proposal_edits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        job_id VARCHAR(255),
        original_proposal TEXT,
        edited_proposal TEXT,
        edit_reason TEXT,
        learned_patterns TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at)
      )
    `)
    console.log('✅ Proposal edits table created/verified')

    // Prompt settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prompt_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        basic_info JSONB,
        validation_rules JSONB,
        proposal_templates JSONB,
        ai_settings JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Prompt settings table created/verified')

    // User settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ User settings table created/verified')

    // Password reset tokens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_user_id (user_id)
      )
    `)
    console.log('✅ Password reset tokens table created/verified')

    // **NEW: Upwork OAuth states table (for security)**
    await pool.query(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        state_token VARCHAR(255) UNIQUE NOT NULL,
        redirect_uri TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
        INDEX idx_state_token (state_token),
        INDEX idx_user_id (user_id)
      )
    `)
    console.log('✅ OAuth states table created/verified')

    // **NEW: API logs table (for debugging)**
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        endpoint VARCHAR(255),
        method VARCHAR(10),
        status_code INTEGER,
        response_time INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_user_endpoint (user_id, endpoint)
      )
    `)
    console.log('✅ API logs table created/verified')

    console.log('🎉 All database tables created successfully!')
    return true
    
  } catch (error: any) {
    console.error('❌ Database initialization error:', error)
    throw error
  }
}

// Helper function to log API calls
export async function logAPICall(
  userId: number | null,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number,
  errorMessage?: string
) {
  try {
    await pool.query(
      `INSERT INTO api_logs 
       (user_id, endpoint, method, status_code, response_time, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, endpoint, method, statusCode, responseTime, errorMessage]
    )
  } catch (error) {
    console.error('Failed to log API call:', error)
  }
}

// Helper function to store OAuth state
export async function storeOAuthState(userId: number, stateToken: string, redirectUri: string) {
  try {
    await pool.query(
      `INSERT INTO oauth_states (user_id, state_token, redirect_uri)
       VALUES ($1, $2, $3)`,
      [userId, stateToken, redirectUri]
    )
    return true
  } catch (error) {
    console.error('Failed to store OAuth state:', error)
    return false
  }
}

// Helper function to verify OAuth state
export async function verifyOAuthState(stateToken: string) {
  try {
    const result = await pool.query(
      `SELECT user_id, redirect_uri FROM oauth_states 
       WHERE state_token = $1 
       AND expires_at > CURRENT_TIMESTAMP`,
      [stateToken]
    )
    
    if (result.rows.length > 0) {
      // Delete the used state
      await pool.query(
        'DELETE FROM oauth_states WHERE state_token = $1',
        [stateToken]
      )
      return result.rows[0]
    }
    return null
  } catch (error) {
    console.error('Failed to verify OAuth state:', error)
    return null
  }
}

// Helper function to save Upwork tokens
export async function saveUpworkTokens(
  userId: number, 
  accessToken: string, 
  refreshToken?: string,
  tokenType: string = 'bearer',
  expiresIn: number = 86400
) {
  try {
    await pool.query(
      `INSERT INTO upwork_accounts 
       (user_id, access_token, refresh_token, token_type, expires_in, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_type = EXCLUDED.token_type,
         expires_in = EXCLUDED.expires_in,
         updated_at = NOW()`,
      [userId, accessToken, refreshToken || null, tokenType, expiresIn]
    )
    return true
  } catch (error: any) {
    console.error('Failed to save Upwork tokens:', error.message)
    return false
  }
}

// Helper function to get Upwork tokens
export async function getUpworkTokens(userId: number) {
  try {
    const result = await pool.query(
      `SELECT access_token, refresh_token, token_type, expires_in, created_at
       FROM upwork_accounts WHERE user_id = $1`,
      [userId]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Failed to get Upwork tokens:', error)
    return null
  }
}

// Helper function to delete Upwork tokens
export async function deleteUpworkTokens(userId: number) {
  try {
    await pool.query(
      'DELETE FROM upwork_accounts WHERE user_id = $1',
      [userId]
    )
    return true
  } catch (error) {
    console.error('Failed to delete Upwork tokens:', error)
    return false
  }
}

// Helper function to cache jobs
export async function cacheJobs(userId: number, jobs: any[]) {
  try {
    // First delete old cached jobs for this user
    await pool.query(
      'DELETE FROM cached_jobs WHERE user_id = $1',
      [userId]
    )
    
    // Insert new jobs
    for (const job of jobs.slice(0, 50)) { // Limit to 50 jobs
      await pool.query(
        `INSERT INTO cached_jobs 
         (user_id, job_id, source, title, description, budget, posted_date, 
          client_info, skills, proposals, verified, category, duration, raw_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (user_id, job_id) 
         DO UPDATE SET 
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           budget = EXCLUDED.budget,
           posted_date = EXCLUDED.posted_date,
           client_info = EXCLUDED.client_info,
           skills = EXCLUDED.skills,
           proposals = EXCLUDED.proposals,
           verified = EXCLUDED.verified,
           category = EXCLUDED.category,
           duration = EXCLUDED.duration,
           raw_data = EXCLUDED.raw_data,
           updated_at = NOW()`,
        [
          userId,
          job.id || `job_${Date.now()}`,
          job.source || 'upwork',
          job.title,
          job.description,
          job.budget,
          job.postedDate ? new Date(job.postedDate) : new Date(),
          JSON.stringify(job.client || {}),
          job.skills || [],
          job.proposals || 0,
          job.verified || false,
          job.category || 'General',
          job.duration || 'Ongoing',
          JSON.stringify(job)
        ]
      )
    }
    console.log(`✅ Cached ${Math.min(jobs.length, 50)} jobs for user ${userId}`)
    return true
  } catch (error: any) {
    console.error('Failed to cache jobs:', error.message)
    return false
  }
}

// Helper function to get cached jobs
export async function getCachedJobs(userId: number, limit: number = 20) {
  try {
    const result = await pool.query(
      `SELECT * FROM cached_jobs 
       WHERE user_id = $1 
       ORDER BY posted_date DESC 
       LIMIT $2`,
      [userId, limit]
    )
    return result.rows
  } catch (error) {
    console.error('Failed to get cached jobs:', error)
    return []
  }
}

export default pool