/**
 * APSRTC SmartTrack Database Connection Manager
 * Manages SQLite connection with WAL mode, foreign keys, and query helpers.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');
const logger = require('../utils/logger');

let db = null;

function getDb() {
  if (db) return db;

  const dbPath = path.isAbsolute(config.DB_PATH) 
    ? config.DB_PATH 
    : path.resolve(__dirname, '..', config.DB_PATH);

  logger.info(`Connecting to SQLite Database at: ${dbPath}`);

  // Auto-create directory if not exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    db = new Database(dbPath, {
      verbose: config.NODE_ENV === 'debug' ? console.log : null,
    });

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -64000'); // 64MB cache

    logger.info('Database connected successfully (WAL Mode & Foreign Keys ON).');

    // Run schema if tables don't exist
    const schemaFile = path.join(__dirname, '../../database/schema/schema.sqlite.sql');
    if (fs.existsSync(schemaFile)) {
      const schemaSql = fs.readFileSync(schemaFile, 'utf8');
      db.exec(schemaSql);
    }

    return db;
  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    throw error;
  }
}

/**
 * Execute a query with parameters and return array of rows
 */
function queryAll(sql, params = []) {
  const statement = getDb().prepare(sql);
  return statement.all(params);
}

/**
 * Execute a query with parameters and return a single row
 */
function queryOne(sql, params = []) {
  const statement = getDb().prepare(sql);
  return statement.get(params);
}

/**
 * Execute an INSERT/UPDATE/DELETE query
 */
function run(sql, params = []) {
  const statement = getDb().prepare(sql);
  return statement.run(params);
}

/**
 * Execute multiple queries within a transaction
 */
function transaction(callback) {
  const txn = getDb().transaction(callback);
  return txn();
}

/**
 * Close database connection
 */
function closeDb() {
  if (db) {
    logger.info('Closing database connection...');
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  queryAll,
  queryOne,
  run,
  transaction,
  closeDb
};
