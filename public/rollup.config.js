import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import dotenv from 'dotenv';
import path from 'path';

// Load the root .env file so Rollup can see the variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const production = !process.env.ROLLUP_WATCH;

export default {
    input: 'src/app.ts',
    output: {
        file: 'app.js',
        format: 'iife',
        sourcemap: !production
    },
    plugins: [
        replace({
            preventAssignment: true,
            values: {
                'process.env.FIREBASE_API_KEY': JSON.stringify(process.env.FIREBASE_API_KEY),
                'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN || `${process.env.GCP_PROJECT_ID}.firebaseapp.com`),
                'process.env.GCP_PROJECT_ID': JSON.stringify(process.env.GCP_PROJECT_ID || "YOUR_PROJECT_ID")
            }
        }),
        resolve(),
        typescript(),
        production && terser()
    ]
};
