// lib/database.ts - COMPLETE UPDATED CODE
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/upwork_assistant'

const pool = new Pool({
  user: 'postgres',
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  host: 'localhost', 
  database: 'upwork_assistant',
  password: 'postgres',
  port: 5432,
})

export async function initDB() {
  try {
    console.log('🔄 Database initialization...')
    
    // Users table
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Sessions table created/verified')

    // Proposals table - WITH DUPLICATE PREVENTION
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
        UNIQUE(user_id, job_id)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Upwork accounts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upwork_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        upwork_user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Upwork accounts table created/verified')

    // Password reset tokens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Password reset tokens table created/verified')

    console.log('🎉 All database tables created successfully!')
  } catch (error) {
    console.error('❌ Database initialization error:', error)
    throw error
  }
}

export default pool
