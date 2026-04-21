import { deflateRawSync } from "node:zlib";

const PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function append3Bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return [
    PLANTUML_ALPHABET[c1],
    PLANTUML_ALPHABET[c2],
    PLANTUML_ALPHABET[c3],
    PLANTUML_ALPHABET[c4],
  ].join("");
}

function encodePlantUml(text) {
  const bytes = deflateRawSync(Buffer.from(text, "utf8"));
  let encoded = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const b1 = bytes[index];
    const b2 = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const b3 = index + 2 < bytes.length ? bytes[index + 2] : 0;
    encoded += append3Bytes(b1, b2, b3);
  }

  return encoded;
}

export function buildDiagramArtifacts(diagram) {
  return {
    sequence: {
      source: diagram.sequence,
      pngUrl: `https://www.plantuml.com/plantuml/png/${encodePlantUml(diagram.sequence)}`,
    },
    classDiagram: {
      source: diagram.classDiagram,
      pngUrl: `https://www.plantuml.com/plantuml/png/${encodePlantUml(diagram.classDiagram)}`,
    },
  };
}
