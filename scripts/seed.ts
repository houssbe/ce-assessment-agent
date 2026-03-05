import { CEAssessmentAgent } from '../src/agent.js';
import { db, insertQuestion } from '../src/db.js';
import { getConfig } from '../src/config.js';

const PRODUCT_CATEGORIES = [
    "Cloud AI",
    "Data Cloud (e.g., BigQuery, Cloud SQL, AlloyDB, Spanner)",
    "Modern Infrastructure (e.g., GKE, Cloud Run)",
];

const config = getConfig();
const QUESTIONS_PER_PLAY = config.questionsPerPlay ?? 2;

async function seed() {
    console.log("=== Starting Batch Question Generation ===");
    console.log(`Targeting ${PRODUCT_CATEGORIES.length} Google Cloud Categories, ${QUESTIONS_PER_PLAY} questions each.`);

    const agent = new CEAssessmentAgent();

    for (const play of PRODUCT_CATEGORIES) {
        console.log(`\n\n--- Generating for Category: ${play} ---`);
        for (let i = 1; i <= QUESTIONS_PER_PLAY; i++) {
            console.log(`\n[${i}/${QUESTIONS_PER_PLAY}] Generating question...`);
            try {
                const question = await agent.generateQuestion(play, async (step) => {
                    console.log(`  -> Agent: ${step}`);
                });

                insertQuestion(question, play);
                console.log(`  ✅ Successfully saved question: ${question.id}`);
                console.log(`     Topic: ${play}`);
                console.log(`     Question length: ${question.question.length} chars`);
            } catch (error) {
                console.error(`  ❌ Failed to generate question for play "${play}":`);
                console.error(error);
            }
        }
    }

    const countObj = db.prepare('SELECT COUNT(*) as count FROM questions').get() as { count: number };
    console.log(`\n=== Seeding Complete ===`);
    console.log(`Total questions in database: ${countObj.count}`);
}

seed().catch(err => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
});
