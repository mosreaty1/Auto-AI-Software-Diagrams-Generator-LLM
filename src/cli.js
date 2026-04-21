#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "./pipeline.js";
import { loadEnvFile } from "./env.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function sanitizeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function writeDiagramOutputs(result, reportPath) {
  const reportBaseName = path.basename(reportPath, ".json");
  const diagramsDir = path.join(path.dirname(reportPath), `${reportBaseName}-diagrams`);
  await mkdir(diagramsDir, { recursive: true });

  const successfulGenerations = result.generations.filter((entry) => entry.ok);
  const writtenDiagrams = [];

  for (const generation of successfulGenerations) {
    const providerName = sanitizeName(generation.provider);
    const sequencePumlPath = path.join(diagramsDir, `${providerName}-sequence.puml`);
    const classPumlPath = path.join(diagramsDir, `${providerName}-class.puml`);
    await writeFile(sequencePumlPath, generation.diagram.sequence, "utf8");
    await writeFile(classPumlPath, generation.diagram.classDiagram, "utf8");

    writtenDiagrams.push({
      provider: generation.provider,
      sequencePumlPath,
      classPumlPath,
      sequencePngUrl: generation.renderArtifacts?.sequence?.pngUrl ?? null,
      classPngUrl: generation.renderArtifacts?.classDiagram?.pngUrl ?? null,
      isWinner: generation.provider === result.winner.provider,
    });
  }

  const galleryPath = path.join(diagramsDir, "index.html");
  const galleryHtml = [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>Diagram Gallery</title>",
    "  <style>",
    "    body { font-family: Arial, sans-serif; margin: 24px; background: #f7f7f7; color: #222; }",
    "    .card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px; }",
    "    .winner { border-color: #2a7a2a; box-shadow: 0 0 0 2px rgba(42,122,42,.12); }",
    "    img { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; background: white; }",
    "    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }",
    "  </style>",
    "</head>",
    "<body>",
    `  <h1>Diagram Gallery</h1>`,
    `  <p>Winner: <strong>${result.winner.provider}</strong></p>`,
    ...writtenDiagrams.flatMap((diagram) => [
      `  <section class="card${diagram.isWinner ? " winner" : ""}">`,
      `    <h2>${diagram.provider}${diagram.isWinner ? " (winner)" : ""}</h2>`,
      `    <h3>Sequence Diagram</h3>`,
      `    <p>PlantUML file: <code>${diagram.sequencePumlPath}</code></p>`,
      diagram.sequencePngUrl
        ? `    <p><a href="${diagram.sequencePngUrl}">Open rendered sequence PNG</a></p>`
        : "    <p>No sequence render URL available.</p>",
      diagram.sequencePngUrl
        ? `    <img src="${diagram.sequencePngUrl}" alt="${diagram.provider} sequence diagram" />`
        : "",
      `    <h3>Class Diagram</h3>`,
      `    <p>PlantUML file: <code>${diagram.classPumlPath}</code></p>`,
      diagram.classPngUrl
        ? `    <p><a href="${diagram.classPngUrl}">Open rendered class PNG</a></p>`
        : "    <p>No class render URL available.</p>",
      diagram.classPngUrl
        ? `    <img src="${diagram.classPngUrl}" alt="${diagram.provider} class diagram" />`
        : "",
      "  </section>",
    ]),
    "</body>",
    "</html>",
  ].join("\n");

  await writeFile(galleryPath, galleryHtml, "utf8");

  return {
    diagramsDir,
    galleryPath,
    writtenDiagrams,
  };
}

async function main() {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));
  if (!args.file && !args["diff-file"]) {
    throw new Error("Provide --file <path> or --diff-file <path>.");
  }

  const result = await runPipeline({
    filePath: args.file,
    diffPath: args["diff-file"],
    explicitLanguage: args.language,
  });

  const outputDir = path.resolve(process.cwd(), "reports");
  const outputPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.join(outputDir, `diagram-report-${Date.now()}.json`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
  const diagramOutputs = await writeDiagramOutputs(result, outputPath);

  console.log(`Report written to ${outputPath}`);
  console.log(`Diagram gallery: ${diagramOutputs.galleryPath}`);
  console.log(`Winner: ${result.winner.provider} (${result.winner.score}/100)`);
  if (typeof result.accuracy.final === "number") {
    console.log(`Accuracy: ${result.accuracy.final.toFixed(2)}%`);
  } else {
    console.log(`Accuracy: unavailable (${result.accuracy.error})`);
  }

  for (const diagram of diagramOutputs.writtenDiagrams) {
    console.log(`${diagram.provider} sequence file: ${diagram.sequencePumlPath}`);
    console.log(`${diagram.provider} class file: ${diagram.classPumlPath}`);
    if (diagram.sequencePngUrl) {
      console.log(`${diagram.provider} sequence PNG URL: ${diagram.sequencePngUrl}`);
    }
    if (diagram.classPngUrl) {
      console.log(`${diagram.provider} class PNG URL: ${diagram.classPngUrl}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
