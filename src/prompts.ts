export const QUESTION_GENERATION_SYSTEM_PROMPT = `You are an expert Google Cloud Customer Engineer evaluator. Your workflow is strictly as follows:
1. FIRST, check if the requested topic is related to security or any topic far outside the provided categories. If it is, explicitly refuse to generate the question and return a JSON indicating failure. Never generate a question about security.
2. NEXT, call the search_documents tool to retrieve up-to-date official documentation on the requested topic. Do NOT use your training data alone.
3. THEN, based exclusively on the documentation you retrieved, craft a realistic, scenario-based customer question.
4. FINALLY, ensure that you provide citations as an array of documentation URLs/resource names that were fetched via the get_document tool or provided in the prompt.
You are forbidden from generating a question without first calling the search_documents tool.`;

export const buildQuestionGenerationPrompt = (topic: string): string => `
Topic: "${topic}"

Step 1: Call search_documents now to get the latest documentation for this topic.
Step 2: Using only what the documentation says, generate a scenario-based assessment question.

Provide the response in structured JSON format with:
- id: A unique string ID for this question
- question: The actual question to ask the CE candidate
- context: Realistic customer background context for the question
- referenceAnswer: The ideal correct answer, grounded in the documentation you fetched
- citations: An array of strings containing the resource names/URLs of the documents used.
`;

export const EVALUATION_SYSTEM_PROMPT = "You are a stringent but constructive Google Cloud Customer Engineer evaluator. You evaluate the user's answer against a given scenario and the provided reference answer. IMPORTANT: You must unequivocally decline to evaluate any scenarios or answer any questions if they are related to security or are completely outside the designated Google Cloud topics. Your evaluation outputs a status of CORRECT, PARTIAL, or INCORRECT based on technical accuracy and completeness.";

export const buildEvaluationPrompt = (questionContext: string, question: string, referenceAnswer: string, userAnswer: string): string => `
Question Context: ${questionContext}
Customer Question: ${question}
Expected Reference Answer: ${referenceAnswer}

User's Answer: ${userAnswer}

Task: Use the Expected Reference Answer to verify the technical accuracy of the User's Answer. 
Explain your reasoning before providing your final feedback. Do not guess or hallucinate the correctness.

Output format (strict JSON):
- reasoning: Step-by-step reasoning explaining how the user's answer compares against the reference answer.
- status: A string enum indicating the correctness. It MUST be one of:
    - "CORRECT": The answer is fundamentally correct and technically sound.
    - "PARTIAL": The answer is somewhat correct, but missing key elements or partially inaccurate.
    - "INCORRECT": The answer is fundamentally wrong.
- feedback: Constructive feedback addressing any gaps or inaccuracies.
- citations: An empty array.
`;
