import { invokeTextWithProvider } from "./providers.js";

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function tokenize(code) {
  return code.match(/[A-Za-z_]\w*|[{}()[\].,;:+\-*/=<>!&|]+|\d+|".*?"|'.*?'/g) ?? [];
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 100 : (intersection / union) * 100;
}

function lineDiffScore(originalCode, reconstructedCode) {
  const originalLines = originalCode.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const reconstructedLines = reconstructedCode.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const overlap = originalLines.filter((line) => reconstructedLines.includes(line)).length;
  return originalLines.length === 0 ? 100 : (overlap / originalLines.length) * 100;
}

function structuralScore(originalCode, reconstructedCode) {
  const originalNames = new Set(originalCode.match(/[A-Za-z_]\w*(?=\s*\()/g) ?? []);
  const reconstructedNames = new Set(reconstructedCode.match(/[A-Za-z_]\w*(?=\s*\()/g) ?? []);
  const overlap = [...originalNames].filter((name) => reconstructedNames.has(name)).length;
  return originalNames.size === 0 ? 100 : (overlap / originalNames.size) * 100;
}

function astShapeScore(originalCode, reconstructedCode) {
  const keywords = [
    "if",
    "else",
    "for",
    "while",
    "switch",
    "try",
    "catch",
    "return",
    "await",
    "async",
    "class",
    "function",
  ];

  const originalCounts = Object.fromEntries(
    keywords.map((keyword) => [keyword, (originalCode.match(new RegExp(`\\b${keyword}\\b`, "g")) ?? []).length]),
  );
  const reconstructedCounts = Object.fromEntries(
    keywords.map((keyword) => [keyword, (reconstructedCode.match(new RegExp(`\\b${keyword}\\b`, "g")) ?? []).length]),
  );

  const deltas = keywords.map((keyword) =>
    Math.abs(originalCounts[keyword] - reconstructedCounts[keyword]),
  );

  const totalOriginal = keywords.reduce((sum, keyword) => sum + originalCounts[keyword], 0);
  const distance = deltas.reduce((sum, value) => sum + value, 0);
  if (totalOriginal === 0) {
    return 100;
  }

  return clampScore(100 - ((distance / totalOriginal) * 100));
}

async function semanticScore(originalCode, reconstructedCode) {
  const fallback = jaccard(
    tokenize(originalCode).slice(0, 300),
    tokenize(reconstructedCode).slice(0, 300),
  );

  const providerName = process.env.JUDGE_PROVIDER;
  if (!providerName) {
    return fallback;
  }

  const promptText = [
    "Score the semantic equivalence between two code snippets from 0 to 100.",
    "Consider control flow, intent, function boundaries, and side effects more than formatting.",
    "Return JSON only in the shape: {\"semanticScore\": 0}",
    "",
    "Original:",
    "```",
    originalCode,
    "```",
    "",
    "Reconstructed:",
    "```",
    reconstructedCode,
    "```",
  ].join("\n");

  const response = await invokeTextWithProvider(providerName, promptText);
  if (!response.ok) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(response.rawText);
    return clampScore(Number(parsed.semanticScore));
  } catch {
    return fallback;
  }
}

export async function scoreAccuracy({ language, originalCode, reconstructedCode }) {
  if (!reconstructedCode || !reconstructedCode.trim()) {
    return {
      ast: null,
      tokens: null,
      lineDiff: null,
      semantic: null,
      structural: null,
      final: null,
      error: "Reconstructed code is empty, so accuracy could not be calculated.",
    };
  }

  const ast = astShapeScore(originalCode, reconstructedCode);
  const tokens = jaccard(tokenize(originalCode), tokenize(reconstructedCode));
  const lineDiff = lineDiffScore(originalCode, reconstructedCode);
  const semantic = await semanticScore(originalCode, reconstructedCode, language);
  const structural = structuralScore(originalCode, reconstructedCode);

  const final = clampScore(
    (0.3 * ast) +
      (0.2 * tokens) +
      (0.2 * lineDiff) +
      (0.2 * semantic) +
      (0.1 * structural),
  );

  return {
    ast,
    tokens,
    lineDiff,
    semantic,
    structural,
    final,
  };
}
