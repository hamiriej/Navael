
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Explicit check for the API key
if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === "YOUR_API_KEY_HERE" || process.env.GOOGLE_API_KEY.trim() === "") {
  const errorMessage =
    'CRITICAL ERROR: GOOGLE_API_KEY is missing, empty, or still a placeholder in your .env file. ' +
    'Genkit AI features will not work. ' +
    'Please ensure GOOGLE_API_KEY is correctly set in your .env file (without NEXT_PUBLIC_ prefix) and that ALL development servers (Next.js and Genkit) have been fully restarted.';
  console.error('🔴🔴🔴 FATAL ERROR: Genkit Initialization Failed - API Key Missing 🔴🔴🔴');
  console.error(errorMessage);
  // Note: This console error will be visible in the terminal running your Genkit dev server (e.g., npm run genkit:dev)
  // The application might still try to proceed but AI calls will fail.
}

export const ai = genkit({
  plugins: [googleAI({apiKey: process.env.GOOGLE_API_KEY})], // Explicitly pass API key
  model: 'googleai/gemini-2.0-flash',
});
