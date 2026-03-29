import * as SQLite from 'expo-sqlite';

let db = null;

export const initDB = async () => {
  if (db) return db;
  
  try {
    // Open DB synchronously in modern Expo SDK
    db = SQLite.openDatabaseSync('ereader.db');

    // Create tables
    db.execAsync(`
      CREATE TABLE IF NOT EXISTS Books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        coverUri TEXT,
        fileUri TEXT UNIQUE,
        lastReadCfi TEXT
      );
      
      CREATE TABLE IF NOT EXISTS Notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER UNIQUE,
        content TEXT,
        FOREIGN KEY (bookId) REFERENCES Books(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS Highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER,
        cfiRange TEXT,
        text TEXT,
        color TEXT,
        FOREIGN KEY (bookId) REFERENCES Books(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS Settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      
      CREATE TABLE IF NOT EXISTS ChatHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER,
        role TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bookId) REFERENCES Books(id) ON DELETE CASCADE
      );
    `);
    
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('ereader.db');
  }
  return db;
};

// Book Queries
export const insertBook = (title, author, coverUri, fileUri) => {
  return getDB().runSync(
    'INSERT OR IGNORE INTO Books (title, author, coverUri, fileUri) VALUES (?, ?, ?, ?)',
    [title, author, coverUri, fileUri]
  );
};

export const getAllBooks = () => {
  return getDB().getAllSync('SELECT * FROM Books ORDER BY id DESC');
};

export const getBookById = (id) => {
  return getDB().getFirstSync('SELECT * FROM Books WHERE id = ?', [id]);
};

export const updateLastReadCfi = (bookId, cfi) => {
  return getDB().runSync('UPDATE Books SET lastReadCfi = ? WHERE id = ?', [cfi, bookId]);
};

export const deleteBook = (id) => {
  return getDB().runSync('DELETE FROM Books WHERE id = ?', [id]);
};

// Notes Queries (1to1 relationship)
export const getNoteForBook = (bookId) => {
  return getDB().getFirstSync('SELECT * FROM Notes WHERE bookId = ?', [bookId]);
};

export const saveNoteForBook = (bookId, content) => {
  return getDB().runSync(
    'INSERT INTO Notes (bookId, content) VALUES (?, ?) ON CONFLICT(bookId) DO UPDATE SET content=excluded.content',
    [bookId, content]
  );
};

// Highlights
export const getHighlights = (bookId) => {
  return getDB().getAllSync('SELECT * FROM Highlights WHERE bookId = ?', [bookId]);
};

export const addHighlight = (bookId, cfiRange, text, color) => {
  return getDB().runSync(
    'INSERT INTO Highlights (bookId, cfiRange, text, color) VALUES (?, ?, ?, ?)',
    [bookId, cfiRange, text, color]
  );
};

export const deleteHighlight = (id) => {
  return getDB().runSync('DELETE FROM Highlights WHERE id = ?', [id]);
};

// Settings (API Key)
export const getSetting = (key) => {
  const row = getDB().getFirstSync('SELECT value FROM Settings WHERE key = ?', [key]);
  return row ? row.value : null;
};

export const saveSetting = (key, value) => {
  return getDB().runSync(
    'INSERT INTO Settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value]
  );
};

// AI Chat History
export const getChatHistory = (bookId) => {
  return getDB().getAllSync(
    'SELECT * FROM ChatHistory WHERE bookId = ? ORDER BY timestamp ASC',
    [bookId]
  );
};

export const addChatHistory = (bookId, role, content) => {
  return getDB().runSync(
    'INSERT INTO ChatHistory (bookId, role, content) VALUES (?, ?, ?)',
    [bookId, role, content]
  );
};

export const clearChatHistory = (bookId) => {
  return getDB().runSync('DELETE FROM ChatHistory WHERE bookId = ?', [bookId]);
};

