# Diagram Analysis Pipeline

This project turns pushed code or diffs into sequence and class diagrams, judges them across multiple LLMs, reconstructs code from the strongest diagram set, and produces an accuracy report.

## What it does

1. Builds a structured prompt from code, imports, function signatures, and detected language.
2. Sends the prompt to 5 LLM providers in parallel.
3. Extracts sequence and class PlantUML blocks from each response.
4. Uses a judge model to score the diagram candidates.
5. Reconstructs code from the winning diagram.
6. Compares reconstructed code against the original using structural, textual, and optional semantic checks.
7. Writes a JSON report for CI or post-push automation.

## Quick start

1. Create a `.env` file from `.env.example`.
2. Provide at least one API key for generation and one for judging.
   The default 5-provider fanout is DeepSeek, Anthropic, Gemini, Mistral, and Groq.
3. Run:

```bash
node ./src/cli.js --file path/to/source.js
```

Or pass a diff directly:

```bash
node ./src/cli.js --diff-file path/to/diff.patch --language javascript
```

## Outputs

Reports are written to `reports/diagram-report-<timestamp>.json`.

Each report includes:

- prompt metadata
- per-provider raw responses and extracted diagrams
- judge rankings
- chosen diagram
- reconstructed code
- scoring breakdown
- render URLs for sequence and class PlantUML PNGs

Each run also writes:

- `.puml` files for both sequence and class diagrams for every successful provider
- a simple HTML gallery you can open locally to view rendered diagrams

## Notes

- The first version is intentionally dependency-light and uses built-in Node APIs.
- Semantic scoring uses an LLM when a judge provider key is available; otherwise it falls back to heuristic scoring.
- AST scoring is heuristic by default. You can later swap in `acorn`, `@babel/parser`, or language-specific parsers without changing the pipeline contract.

## Hook / CI usage

Example post-push or CI invocation:

```bash
node ./src/cli.js --file src/service.js --out reports/latest.json
```

You can also wrap it in your own git hook to pass `git diff --cached` or a changed file list.

Java test example:

```bash
node ./src/cli.js --file samples/OrderService.java
```

After the run, open the printed `index.html` file inside the generated `reports/...-diagrams/` folder.

Minimal hook-style wrapper:

```bash
node ./src/hook-entry.js src/service.js
```
