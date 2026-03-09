import pkg from 'pg';
const { Pool } = pkg;

import { getConfig } from './config.js';
import type { AssessmentQuestion } from './types.js';

const config = getConfig();

export const pool = new Pool(config.db);

// Define the table schema
const initSql = `
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    question TEXT NOT NULL,
    context TEXT NOT NULL,
    referenceAnswer TEXT NOT NULL,
    citations TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS leaderboard (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    score INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL
  );
`;

// Initialize database async
// Initialize database async
let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
    if (!initPromise) {
        initPromise = (async () => {
            await pool.query(initSql);
            try {
                await pool.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS citations TEXT NOT NULL DEFAULT '[]'`);
            } catch (e: any) {
                // Ignore if column already exists (42701)
                if (e.code !== '42701') {
                    console.error("Migration error:", e);
                }
            }
        })();
    }
    return initPromise;
}

// Call init automatically, but allow await if needed.
initDb().catch(console.error);

/**
 * Inserts a new generated question into the database.
 */
export async function insertQuestion(q: AssessmentQuestion, topic: string) {
    const query = `
    INSERT INTO questions (id, topic, question, context, referenceAnswer, citations)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(id) DO UPDATE SET
      topic = EXCLUDED.topic,
      question = EXCLUDED.question,
      context = EXCLUDED.context,
      referenceAnswer = EXCLUDED.referenceAnswer,
      citations = EXCLUDED.citations
  `;
    const citationsStr = JSON.stringify(q.citations ?? []);
    await pool.query(query, [q.id, topic, q.question, q.context, q.referenceAnswer, citationsStr]);
}

/**
 * Retrieves a random question from the database.
 * Optional: filter by topic.
 */
export async function getRandomQuestion(topic?: string): Promise<AssessmentQuestion | null> {
    let result;
    if (topic) {
        result = await pool.query('SELECT * FROM questions WHERE topic LIKE $1 ORDER BY RANDOM() LIMIT 1', [`%${topic}%`]);
    } else {
        result = await pool.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
    }

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id,
        topic: row.topic,
        question: row.question,
        context: row.context,
        referenceAnswer: row.referenceanswer, // psql lowercases column names in result objects
        citations: row.citations ? JSON.parse(row.citations) : []
    } as AssessmentQuestion;
}

/**
 * Gets the total count of questions in the database.
 */
export async function getQuestionCount(): Promise<number> {
    const result = await pool.query('SELECT COUNT(*) as count FROM questions');
    return parseInt(result.rows[0].count, 10);
}

/**
 * Inserts a new leaderboard score.
 */
export async function insertLeaderboardScore(id: string, userId: string, score: number) {
    const query = `
    INSERT INTO leaderboard (id, user_id, score)
    VALUES ($1, $2, $3)
  `;
    await pool.query(query, [id, userId, score]);
}

/**
 * Retrieves a username by their Firebase UID.
 */
export async function getUserName(uid: string): Promise<string | null> {
    const result = await pool.query('SELECT username FROM users WHERE uid = $1', [uid]);
    if (result.rows.length === 0) return null;
    return result.rows[0].username;
}

/**
 * Adds or updates a username for a Firebase UID.
 */
export async function setUserName(uid: string, username: string): Promise<void> {
    const query = `
    INSERT INTO users (uid, username)
    VALUES ($1, $2)
    ON CONFLICT(uid) DO UPDATE SET
      username = EXCLUDED.username
  `;
    await pool.query(query, [uid, username]);
}

/**
 * Retrieves the top 10 leaderboard scores.
 */
export async function getLeaderboard(): Promise<Array<{ id: string, score: number }>> {
    const result = await pool.query(`
        SELECT COALESCE(users.username, leaderboard.user_id) as id, leaderboard.score 
        FROM leaderboard 
        LEFT JOIN users ON leaderboard.user_id = users.uid
        ORDER BY leaderboard.score DESC, leaderboard.created_at ASC 
        LIMIT 10
    `);
    return result.rows;
}
