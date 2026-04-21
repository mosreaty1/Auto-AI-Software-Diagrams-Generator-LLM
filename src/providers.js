import { extractDiagramBlocks } from "./response-parsing.js";

function pickEnv(key, fallback = "") {
  return process.env[key] || fallback;
}

class LlmProvider {
  constructor({ name, endpoint, apiKey, model, headers, buildBody, extractText }) {
    this.name = name;
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.headers = headers;
    this.buildBody = buildBody;
    this.extractText = extractText;
  }

  async invoke(promptText) {
    if (!this.apiKey) {
      return {
        ok: false,
        provider: this.name,
        error: `Missing API key for ${this.name}`,
      };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...this.headers(this.apiKey),
        },
        body: JSON.stringify(this.buildBody(this.model, promptText)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          provider: this.name,
          error: `${this.name} failed with ${response.status}: ${errorText.slice(0, 300)}`,
        };
      }

      const payload = await response.json();
      return {
        ok: true,
        provider: this.name,
        rawText: this.extractText(payload),
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async generateDiagram(prompt) {
    const response = await this.invoke(prompt.promptText);
    if (!response.ok) {
      return response;
    }

    const diagram = extractDiagramBlocks(response.rawText);
    if (
      !diagram.sequence ||
      diagram.sequence === "@startuml\n\n@enduml" ||
      !diagram.classDiagram ||
      diagram.classDiagram === "@startuml\n\n@enduml"
    ) {
      return {
        ok: false,
        provider: this.name,
        rawText: response.rawText,
        error: "Missing sequence or class PlantUML block in response.",
      };
    }

    return {
      ok: true,
      provider: this.name,
      rawText: response.rawText,
      diagram,
    };
  }
}

function createProviders() {
  return [
    new LlmProvider({
      name: "deepseek",
      endpoint: "https://api.deepseek.com/chat/completions",
      apiKey: pickEnv("DEEPSEEK_API_KEY"),
      model: pickEnv("DEEPSEEK_MODEL", "deepseek-reasoner"),
      headers: (apiKey) => ({ authorization: `Bearer ${apiKey}` }),
      buildBody: (model, promptText) => ({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content: promptText }],
      }),
      extractText: (payload) => payload.choices?.[0]?.message?.content ?? "",
    }),
    new LlmProvider({
      name: "anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiKey: pickEnv("ANTHROPIC_API_KEY"),
      model: pickEnv("ANTHROPIC_MODEL", "claude-opus-4-7"),
      headers: (apiKey) => ({
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      }),
      buildBody: (model, promptText) => ({
        model,
        max_tokens: 1800,
        messages: [{ role: "user", content: promptText }],
      }),
      extractText: (payload) =>
        payload.content?.map((item) => item.text).filter(Boolean).join("\n") ?? "",
    }),
    new LlmProvider({
      name: "gemini",
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${pickEnv("GEMINI_MODEL", "gemini-1.5-flash")}:generateContent?key=${pickEnv("GEMINI_API_KEY")}`,
      apiKey: pickEnv("GEMINI_API_KEY"),
      model: pickEnv("GEMINI_MODEL", "gemini-1.5-flash"),
      headers: () => ({}),
      buildBody: (_, promptText) => ({
        contents: [{ parts: [{ text: promptText }] }],
      }),
      extractText: (payload) =>
        payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "",
    }),
    new LlmProvider({
      name: "mistral",
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      apiKey: pickEnv("MISTRAL_API_KEY"),
      model: pickEnv("MISTRAL_MODEL", "mistral-small-2603"),
      headers: (apiKey) => ({ authorization: `Bearer ${apiKey}` }),
      buildBody: (model, promptText) => ({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content: promptText }],
      }),
      extractText: (payload) => payload.choices?.[0]?.message?.content ?? "",
    }),
    new LlmProvider({
      name: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: pickEnv("GROQ_API_KEY"),
      model: pickEnv("GROQ_MODEL", "openai/gpt-oss-120b"),
      headers: (apiKey) => ({ authorization: `Bearer ${apiKey}` }),
      buildBody: (model, promptText) => ({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content: promptText }],
      }),
      extractText: (payload) => payload.choices?.[0]?.message?.content ?? "",
    }),
  ];
}

export function getProviders() {
  return createProviders();
}

export async function invokeTextWithProvider(providerName, promptText) {
  const provider = getProviders().find((entry) => entry.name === providerName);
  if (!provider) {
    return {
      ok: false,
      provider: providerName,
      error: `Unknown provider: ${providerName}`,
    };
  }

  return provider.invoke(promptText);
}

function heuristicJudge(candidates, sourceText) {
  return [...candidates]
    .map((candidate) => {
      const functions = new Set(sourceText.match(/[A-Za-z_]\w*(?=\s*\()/g) ?? []);
      const classes = new Set(sourceText.match(/\b[A-Z][A-Za-z0-9_]*(?=\s*[({])/g) ?? []);
      const sequenceText = candidate.diagram.sequence;
      const classText = candidate.diagram.classDiagram;
      const matchedFunctions = [...functions].filter((name) => sequenceText.includes(name)).length;
      const matchedClasses = [...classes].filter((name) => classText.includes(name)).length;
      const completeness = Math.min(100, matchedFunctions * 8);
      const correctness = sequenceText.includes("@startuml") ? 80 : 50;
      const sequenceAccuracy = /->|activate|deactivate/.test(sequenceText) ? 82 : 55;
      const classCoverage = classes.size === 0 ? 100 : Math.min(100, (matchedClasses / classes.size) * 100);
      const score = Math.round(
        (completeness * 0.35) +
        (correctness * 0.25) +
        (sequenceAccuracy * 0.25) +
        (classCoverage * 0.15),
      );

      return {
        ...candidate,
        metrics: { completeness, correctness, sequenceAccuracy, classCoverage },
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
}

async function invokeJudgeWithProvider({ promptText }) {
  const judgeProvider = process.env.JUDGE_PROVIDER || "gemini";
  const provider = getProviders().find((entry) => entry.name === judgeProvider);
  if (!provider || !provider.apiKey) {
    return null;
  }

  const response = await provider.invoke(promptText);
  return response.ok ? response.rawText : null;
}

export async function judgeCandidates({ language, sourceText, candidates }) {
  const promptText = [
    `You are an expert judge of ${language} sequence diagrams.`,
    "Score each candidate from 0-100 for completeness, correctness, sequence accuracy, and class coverage.",
    "Return JSON only in the shape: {\"rankings\":[{\"provider\":\"...\",\"completeness\":0,\"correctness\":0,\"sequenceAccuracy\":0,\"classCoverage\":0,\"score\":0}]}",
    "",
    "Original code:",
    "```",
    sourceText,
    "```",
    "",
    "Candidates:",
    ...candidates.map(
      (candidate) => [
        `Provider: ${candidate.provider}`,
        "Sequence PlantUML:",
        "```plantuml",
        candidate.diagram.sequence,
        "```",
        "Class PlantUML:",
        "```plantuml",
        candidate.diagram.classDiagram,
        "```",
      ].join("\n"),
    ),
  ].join("\n");

  const judgeResponse = await invokeJudgeWithProvider({ promptText });
  if (!judgeResponse) {
    return heuristicJudge(candidates, sourceText);
  }

  try {
    const parsed = JSON.parse(judgeResponse);
    const ranked = parsed.rankings.map((entry) => {
      const candidate = candidates.find((item) => item.provider === entry.provider);
      return {
        ...candidate,
        metrics: {
          completeness: entry.completeness,
          correctness: entry.correctness,
          sequenceAccuracy: entry.sequenceAccuracy,
          classCoverage: entry.classCoverage,
        },
        score: entry.score,
      };
    });

    return ranked.sort((left, right) => right.score - left.score);
  } catch {
    return heuristicJudge(candidates, sourceText);
  }
}

export async function reconstructFromDiagram({ language, sourceText, winner }) {
  const providerName = process.env.RECONSTRUCTION_PROVIDER || "deepseek";
  const providers = getProviders();
  const orderedProviders = [
    ...providers.filter((entry) => entry.name === providerName),
    ...providers.filter((entry) => entry.name === winner.provider && entry.name !== providerName),
    ...providers.filter((entry) => entry.name !== providerName && entry.name !== winner.provider),
  ];

  const promptText = [
    `Reconstruct ${language} code from the following winning diagrams.`,
    "Use both the sequence and class diagrams. Preserve likely function signatures, classes, fields, and control flow. Return code only.",
    "",
    "Original code for grounding:",
    "```",
    sourceText,
    "```",
    "",
    "Winning Sequence PlantUML:",
    "```plantuml",
    winner.diagram.sequence,
    "```",
    "",
    "Winning Class PlantUML:",
    "```plantuml",
    winner.diagram.classDiagram,
    "```",
  ].join("\n");

  const errors = [];

  for (const provider of orderedProviders) {
    const response = await provider.invoke(promptText);
    if (!response.ok) {
      errors.push(`${provider.name}: ${response.error}`);
      continue;
    }

    const code = response.rawText.replace(/^```[\w-]*\n?|\n```$/g, "").trim();
    if (!code) {
      errors.push(`${provider.name}: empty reconstruction response`);
      continue;
    }

    return {
      provider: provider.name,
      code,
      rawText: response.rawText,
      error: null,
      attempts: errors,
    };
  }

  return {
    provider: orderedProviders[0]?.name ?? providerName,
    code: "",
    rawText: "",
    error: errors.join("\n"),
    attempts: errors,
  };
}
