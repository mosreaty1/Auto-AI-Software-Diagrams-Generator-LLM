import path from "node:path";

const LANGUAGE_BY_EXTENSION = new Map([
  [".js", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".jsx", "javascript"],
  [".py", "python"],
  [".java", "java"],
  [".cs", "csharp"],
  [".rb", "ruby"],
  [".go", "go"],
]);

export function detectLanguage(filePath, sourceText) {
  if (filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (LANGUAGE_BY_EXTENSION.has(extension)) {
      return LANGUAGE_BY_EXTENSION.get(extension);
    }
  }

  if (/^\s*def\s+\w+/m.test(sourceText)) {
    return "python";
  }
  if (/^\s*(public|private|protected)?\s*(class|interface|enum)\s+\w+/m.test(sourceText)) {
    return "java";
  }
  if (/import\s+java\./.test(sourceText) || /public\s+static\s+void\s+main\s*\(/.test(sourceText)) {
    return "java";
  }
  if (/^\s*(export\s+)?(async\s+)?function\s+\w+/m.test(sourceText) || /=>/.test(sourceText)) {
    return "javascript";
  }
  return "plaintext";
}

function collectMatches(sourceText, pattern, groupIndexes = [1]) {
  const values = [];
  for (const match of sourceText.matchAll(pattern)) {
    for (const groupIndex of groupIndexes) {
      if (match[groupIndex]) {
        values.push(match[groupIndex]);
      }
    }
  }
  return [...new Set(values)];
}

export function extractCodeContext(sourceText, language) {
  const imports = collectMatches(
    sourceText,
    /^(?:import\s+.+?\s+from\s+['"](.+?)['"]|const\s+.+?=\s+require\(['"](.+?)['"]\)|import\s+([\w.*]+);)/gm,
    [1, 2, 3],
  ).filter(Boolean);

  const functions = collectMatches(
    sourceText,
    /(?:async\s+function|function|def|class)\s+([A-Za-z_]\w*)|(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(|(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(/gm,
    [1, 2, 3],
  ).filter(Boolean);

  const classes = collectMatches(sourceText, /class\s+([A-Za-z_]\w*)/gm);
  const methods = collectMatches(
    sourceText,
    /^\s*(?:async\s+)?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{|^\s*(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/gm,
    [1, 2],
  );

  return {
    language,
    imports,
    functions,
    classes,
    methods,
    lineCount: sourceText.split(/\r?\n/).length,
  };
}
