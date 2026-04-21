function captureBlocks(text, label) {
  const pattern = new RegExp(`\`\`\`${label}\\s*([\\s\\S]*?)\`\`\``, "ig");
  return [...text.matchAll(pattern)].map((match) => match[1].trim());
}

function normalizePlantUml(block) {
  if (!block) {
    return "";
  }

  return block.startsWith("@startuml") ? block : `@startuml\n${block}\n@enduml`;
}

export function extractDiagramBlocks(text) {
  const plantumlBlocks = captureBlocks(text, "plantuml");

  return {
    sequence: normalizePlantUml(plantumlBlocks[0] ?? ""),
    classDiagram: normalizePlantUml(plantumlBlocks[1] ?? ""),
  };
}
