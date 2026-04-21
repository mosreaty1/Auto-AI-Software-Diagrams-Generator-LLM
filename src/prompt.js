function buildPersona(language) {
  return [
    `You are a senior software architect and runtime analyst specializing in ${language}.`,
    "Inspect the flow carefully and prefer sequence correctness over pretty formatting.",
    "Return two PlantUML diagrams: one sequence diagram and one class diagram.",
  ].join(" ");
}

export function buildStructuredPrompt({ language, sourceText, codeContext }) {
  const instructions = [
    "Analyze the provided code and generate two diagrams.",
    "Output exactly two PlantUML blocks wrapped in ```plantuml.",
    "The first PlantUML block must be a sequence diagram.",
    "The second PlantUML block must be a class diagram.",
    "For the sequence diagram, focus on call ordering, conditions, data hand-offs, and invoked collaborators.",
    "For the class diagram, declare every discovered class separately as its own PlantUML class block.",
    "Do not merge multiple classes into one abstraction or omit small supporting classes when they participate in the design.",
    "For the class diagram, include important fields, important methods, and relationships between classes.",
    "Prefer readable associations, dependencies, and composition links between explicit class nodes.",
    "Preserve function names, class names, and import-level dependencies when they are relevant.",
  ];

  return {
    persona: buildPersona(language),
    language,
    instructions,
    toolContext: codeContext,
    sourceText,
    promptText: [
      buildPersona(language),
      "",
      "Instructions:",
      ...instructions.map((entry, index) => `${index + 1}. ${entry}`),
      "",
      "Tool context:",
      JSON.stringify(codeContext, null, 2),
      "",
      "Code:",
      "```",
      sourceText,
      "```",
    ].join("\n"),
  };
}
