// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('DOM Integrity Tests', () => {
    beforeAll(() => {
        // Load the HTML file into the jsdom environment
        const htmlPath = path.resolve(__dirname, '../../public/index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');
        document.documentElement.innerHTML = html;
    });

    it('should have all critical interactive IDs present in index.html', () => {
        const requiredIds = [
            'generate-section',
            'assessment-section',
            'result-section',
            'generate-btn',
            'evaluate-btn',
            'reset-btn',
            'answer-input',
            'login-btn',
            'logout-btn',
            'edit-username-btn',
            'auth-status',
            'username-setup-group',
            'username-input',
            'save-username-btn',
            'username-error',
            'save-user-loader',
            'leaderboard-list',
            'landing-section',
            'app-shell',
            'tab-quiz',
            'tab-leaderboard',
            'quiz-view',
            'leaderboard-view',
            'context-display',
            'question-display',
            'result-title',
            'feedback-display',
            'sources-display',
            'expected-display',
            'gen-status',
            'eval-status',
            'scenario-ribbon',
            'score-display',
            'podium-1-name',
            'podium-1-id',
            'podium-1-pts',
            'podium-2-name',
            'podium-2-id',
            'podium-2-pts',
            'podium-3-name',
            'podium-3-id',
            'podium-3-pts'
        ];

        for (const id of requiredIds) {
            const el = document.getElementById(id);
            expect(el, `Missing critical DOM element ID: "${id}"`).not.toBeNull();
        }
    });

    it('should NOT contain deprecated IDs', () => {
        const deprecatedIds = [
            'stats-ribbon' // Removed during redesign, caused classList null error
        ];

        for (const id of deprecatedIds) {
            const el = document.getElementById(id);
            expect(el, `Found deprecated DOM element ID: "${id}"`).toBeNull();
        }
    });
});
