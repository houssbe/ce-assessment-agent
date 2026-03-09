import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import type { AssessmentQuestion, AssessmentResult } from "./types.js";
import { AssessmentQuestionSchema, EvaluationOutputSchema } from "./types.js";
import { type AgentConfig, getConfig } from "./config.js";
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationPrompt,
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationPrompt,
} from "./prompts.js";

const MCP_SERVER_URL = "https://developerknowledge.googleapis.com/mcp";

/** JSON schema for the evaluation response */
const EVALUATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    reasoning: { type: Type.STRING },
    status: { type: Type.STRING, enum: ["CORRECT", "INCORRECT", "PARTIAL"] },
    feedback: { type: Type.STRING },
  },
  required: ["reasoning", "status", "feedback"],
};

/** JSON schema for batch question generation (array of questions) */
const QUESTION_ARRAY_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      question: { type: Type.STRING },
      context: { type: Type.STRING },
      referenceAnswer: { type: Type.STRING },
      citations: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["id", "question", "context", "referenceAnswer"],
  },
};

export class GCPKnowledgeService {
  private genai: GoogleGenAI;
  private modelName: string;
  private auth: GoogleAuth;
  /** Eagerly initialised auth client — avoids 401 on the first callMCP call. */
  private authReady: Promise<void>;

  constructor(config: AgentConfig = getConfig()) {
    this.modelName = config.modelName ?? "gemini-3.1-flash-lite-preview";

    if (config.projectId) {
      this.genai = new GoogleGenAI({
        vertexai: true,
        project: config.projectId,
        location: config.location ?? "global",
      });
    } else if (config.apiKey) {
      this.genai = new GoogleGenAI({ apiKey: config.apiKey });
    } else {
      this.genai = new GoogleGenAI({});
    }

    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    // Warm up the auth client eagerly by fetching the access token directly.
    this.authReady = this.auth
      .getAccessToken()
      .then(() => {
        console.log(`[Auth] ✅ GoogleAuth access token acquired.`);
      })
      .catch((err) => {
        console.error("[Auth] ❌ GoogleAuth token fetch failed:", err);
      });
  }

  /**
   * Helper to make stateless POST JSON-RPC requests to the Developer Knowledge MCP Server.
   * The server only supports stateless HTTP POST requests, not standard SSE.
   */
  private async callMCP(method: string, params: any): Promise<any> {
    console.log(`\n[MCP] ---> Sending request to Developer Knowledge Server`);
    console.log(`[MCP] Method: ${method}, Params:`, JSON.stringify(params));

    // Ensure the token has been successfully fetched at least once
    await this.authReady;
    const token = await this.auth.getAccessToken();

    const config = getConfig();
    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    // The Developer Knowledge API requires a quota project header
    if (config.projectId) {
      authHeaders["x-goog-user-project"] = config.projectId;
    }

    const res = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: AbortSignal.timeout(60_000), // 60s timeout to prevent indefinite hangs
    });

    if (!res.ok) {
      throw new Error(`MCP API Error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    if (data.error) {
      console.error(`[MCP] <--- Error from server:`, data.error.message);
      throw new Error(`MCP RPC Error: ${data.error.message}`);
    }

    console.log(
      `[MCP] <--- Received response successfully (Length: ${JSON.stringify(data.result).length} chars)`,
    );
    return data.result;
  }



  /**
   * Searches the MCP Developer Knowledge API and returns raw snippets.
   * Use this to pre-fetch documentation before calling generateQuestions.
   */
  async searchSnippets(
    query: string,
  ): Promise<{ snippets: string; parentNames: string[] }> {
    console.log(`\n[Pre-fetch] 🔎 Searching: "${query}"`);
    const searchResult = await this.callMCP("tools/call", {
      name: "search_documents",
      arguments: { query },
    });
    // The MCP response wraps chunks in content[0].text as a JSON string
    const rawText = searchResult.content?.[0]?.text;
    const parsed = rawText ? JSON.parse(rawText) : searchResult;
    const chunks: Array<{ parent?: string; [key: string]: any }> =
      Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.chunks ?? []);
    const parentNames = [
      ...new Set(chunks.map((c) => c.parent).filter(Boolean)),
    ] as string[];
    const snippets = chunks
      .map((c) => c["content"] ?? c["text"] ?? "")
      .filter(Boolean)
      .join("\n\n");
    console.log(
      `[Pre-fetch] ✅ ${chunks.length} snippets (${snippets.length} chars), ${parentNames.length} parent doc(s)`,
    );
    return { snippets, parentNames };
  }

  /**
   * Generates multiple assessment questions in a single LLM call.
   * Accepts pre-fetched snippets to avoid MCP calls during generation.
   */
  async generateQuestions(
    topic: string,
    count: number,
    prefetched?: { snippets: string; parentNames: string[] },
    onProgress?: (step: string) => Promise<void>,
  ): Promise<AssessmentQuestion[]> {
    await onProgress?.(`Generating ${count} question(s) for "${topic}"...`);

    let prompt = buildQuestionGenerationPrompt(topic);

    // Inject pre-fetched snippets if available
    if (prefetched && prefetched.snippets.length > 0) {
      const citationList = prefetched.parentNames.join(", ") || "N/A";
      prompt = `=== OFFICIAL DOCUMENTATION (fetched live from Developer Knowledge API) ===
[Document Sources]: ${citationList}
${prefetched.snippets}
=== END OF DOCUMENTATION ===

${prompt}

IMPORTANT: Generate exactly ${count} DIFFERENT questions. Each question MUST be specifically about "${topic}" — do NOT generate questions about other Google Cloud products even if they appear in the documentation. Base them exclusively on the documentation above. For the "citations" field, use these document resource names: ${citationList}`;
    } else {
      prompt += `\n\nGenerate exactly ${count} DIFFERENT questions.`;
    }

    const response = await this.genai.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: {
        systemInstruction: QUESTION_GENERATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: QUESTION_ARRAY_SCHEMA,
      },
    });

    const text = response.text ?? "";
    if (!text) throw new Error("Model produced no response.");

    try {
      const cleaned = text.replace(/```json\n?|```/g, "").trim();
      const raw = JSON.parse(cleaned);
      const questions = (Array.isArray(raw) ? raw : [raw]).map((q) => {
        // Override LLM-generated citations with actual parent document names
        // from the search results — these are in the correct `documents/...` format
        // that batch_get_documents requires.
        if (prefetched?.parentNames?.length) {
          if (Array.isArray(q.citations) && q.citations.length > 0) {
            const validCitations = q.citations.filter((c: string) =>
              prefetched.parentNames.includes(c),
            );
            q.citations =
              validCitations.length > 0
                ? validCitations
                : prefetched.parentNames;
          } else {
            q.citations = prefetched.parentNames;
          }
        }
        return AssessmentQuestionSchema.parse(q);
      });
      console.log(
        `[Gemini] ✅ Generated ${questions.length} question(s) for "${topic}"`,
      );
      return questions;
    } catch (err) {
      console.error("Failed to parse batch question JSON:", text);
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid question format generated: ${detail}`);
    }
  }

  /**
   * Generates a single assessment question (convenience wrapper).
   */
  async generateQuestion(
    topic: string = "Vertex AI core capabilities",
    onProgress?: (step: string) => Promise<void>,
  ): Promise<AssessmentQuestion> {
    const questions = await this.generateQuestions(
      topic,
      1,
      undefined,
      onProgress,
    );
    if (!questions.length) throw new Error("No questions generated.");
    return questions[0]!;
  }

  /**
   * Evaluates the user's answer against the generated question using ground truth documentation.
   */
  async evaluateAnswer(
    question: AssessmentQuestion,
    userAnswer: string,
    onProgress?: (step: string) => Promise<void>,
  ): Promise<AssessmentResult> {
    await onProgress?.("Evaluating answer against reference answer...");

    const prompt = buildEvaluationPrompt(
      question.context ?? "N/A",
      question.question,
      question.referenceAnswer ?? "",
      userAnswer,
    );

    const response = await this.genai.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: {
        systemInstruction: EVALUATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: EVALUATION_SCHEMA,
      },
    });

    const text = response.text ?? "";
    if (!text) throw new Error("Model produced no response.");

    try {
      const cleaned = text.replace(/```json\n?|```/g, "").trim();
      // Zod validates the raw model output shape before we enrich it.
      // This prevents isCorrect being a string like "true", or feedback being absent.
      const raw = EvaluationOutputSchema.parse(JSON.parse(cleaned));
      return {
        questionId: question.id,
        status: raw.status,
        reasoning: raw.reasoning,
        feedback: raw.feedback,
        sourcesUsed: question.citations ?? [],
        citations: question.citations ?? [],
      } satisfies AssessmentResult;
    } catch (err) {
      console.error("Failed to parse/validate evaluation JSON:", text);
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid evaluation format generated: ${detail}`);
    }
  }
}
