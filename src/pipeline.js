import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildStructuredPrompt } from "./prompt.js";
import { detectLanguage, extractCodeContext } from "./source-analysis.js";
import { getProviders, judgeCandidates, reconstructFromDiagram } from "./providers.js";
import { buildDiagramArtifacts } from "./renderers.js";
import { scoreAccuracy } from "./scoring.js";

async function readOptionalFile(filePath) {
  if (!filePath) {
    return null;
  }
  return readFile(path.resolve(process.cwd(), filePath), "utf8");
}

export async function runPipeline({ filePath, diffPath, explicitLanguage }) {
  const [sourceText, diffText] = await Promise.all([
    readOptionalFile(filePath),
    readOptionalFile(diffPath),
  ]);

  const effectiveSource = sourceText ?? diffText;
  if (!effectiveSource) {
    throw new Error("No source input was loaded.");
  }

  const language = explicitLanguage ?? detectLanguage(filePath ?? diffPath, effectiveSource);
  const codeContext = extractCodeContext(effectiveSource, language);
  const prompt = buildStructuredPrompt({
    language,
    sourceText: effectiveSource,
    codeContext,
  });

  const providers = getProviders();
  const generationResults = await Promise.all(
    providers.map((provider) => provider.generateDiagram(prompt)),
  );

  const successfulCandidates = generationResults.filter((candidate) => candidate.ok);
  if (successfulCandidates.length === 0) {
    const debugSummary = generationResults
      .map((candidate) => {
        const error = candidate.error ?? "Unknown error";
        return `${candidate.provider}: ${error}`;
      })
      .join("\n");

    throw new Error(`No provider returned a valid diagram candidate.\n${debugSummary}`);
  }

  const ranking = await judgeCandidates({
    language,
    sourceText: effectiveSource,
    candidates: successfulCandidates,
  });

  const winner = ranking[0];
  const reconstructed = await reconstructFromDiagram({
    language,
    sourceText: effectiveSource,
    winner,
  });

  const accuracy = await scoreAccuracy({
    language,
    originalCode: effectiveSource,
    reconstructedCode: reconstructed.code,
  });

  return {
    createdAt: new Date().toISOString(),
    input: {
      filePath: filePath ?? null,
      diffPath: diffPath ?? null,
      language,
    },
    prompt,
    generations: generationResults.map((candidate) => ({
      ...candidate,
      renderArtifacts: candidate.ok ? buildDiagramArtifacts(candidate.diagram) : null,
    })),
    ranking,
    winner,
    reconstruction: reconstructed,
    accuracy,
  };
}
