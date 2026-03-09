import 'dotenv/config';
import process from 'node:process';

export interface AgentConfig {
    projectId?: string;
    location?: string;
    apiKey?: string;
    modelName?: string;
    questionsPerPlay?: number;
    db?: {
        host?: string;
        port?: number;
        user?: string;
        password?: string;
        database?: string;
        max?: number;
    };
}

export function getConfig(): AgentConfig {
    const projectId = process.env['GCP_PROJECT_ID'] || process.env['GOOGLE_CLOUD_PROJECT'];
    const location = process.env['GCP_REGION_AI'] || process.env['GOOGLE_CLOUD_LOCATION'] || 'global';
    const apiKey = process.env['GEMINI_API_KEY'];

    // Provide logging to alert the user about their configuration path
    if (projectId) {
        console.log(`Using Vertex AI for project: ${projectId}`);
    } else {
        console.log("Using standard Gemini API.");
        if (!apiKey) {
            console.error("Warning: GEMINI_API_KEY environment variable is not set.");
            console.error("Please set it before running the agent if using the default AI models.");
        }
    }

    const modelName = process.env['GEMINI_MODEL'] || 'gemini-3-flash-preview';
    const questionsPerPlay = parseInt(process.env['QUESTIONS_PER_PLAY'] || '2', 10);

    const dbConfig: NonNullable<AgentConfig['db']> = {
        host: process.env['INSTANCE_HOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || '5432', 10),
        database: process.env['DB_NAME'] || 'questions',
        max: parseInt(process.env['DB_POOL_MAX'] || '10', 10), // Set 10 connections limit to avoid overwhelming the db instance (limits 100)
    };

    if (process.env['DB_USER']) dbConfig.user = process.env['DB_USER'];
    if (process.env['DB_PASS']) dbConfig.password = process.env['DB_PASS'];

    const result: AgentConfig = { modelName, questionsPerPlay, db: dbConfig };
    if (projectId) {
        result.projectId = projectId;
        result.location = location;
    }
    if (apiKey) result.apiKey = apiKey;

    return result;
}
