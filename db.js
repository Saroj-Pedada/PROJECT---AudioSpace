const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'audiospace.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

const insertUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
    const [saltHex, hashHex] = stored.split(':');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(expected, actual);
}

// Returns the new user, or null if the email is already registered.
function createUser(name, email, password) {
    try {
        const { lastInsertRowid } = insertUser.run(name, email, hashPassword(password));
        return { id: Number(lastInsertRowid), name };
    } catch (err) {
        if (err.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(err.message)) return null;
        throw err;
    }
}

// Returns the user if the credentials match, otherwise null.
function authenticate(email, password) {
    const user = findUserByEmail.get(email);
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    return { id: user.id, name: user.name };
}

module.exports = { createUser, authenticate };
