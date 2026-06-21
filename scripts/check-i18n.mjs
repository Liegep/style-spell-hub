import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/i18n/app-text.ts"), "utf8");

const enKeys = readKeys("en");
const esKeys = readKeys("es");
const duplicateEn = findDuplicates(enKeys);
const duplicateEs = findDuplicates(esKeys);

const missingEs = enKeys.filter((key) => !esKeys.includes(key));
const missingEn = esKeys.filter((key) => !enKeys.includes(key));

if (missingEs.length || missingEn.length || duplicateEn.length || duplicateEs.length) {
  console.error("i18n check failed.");
  if (duplicateEn.length) console.error(`Duplicate English keys:\n${duplicateEn.map((key) => `- ${key}`).join("\n")}`);
  if (duplicateEs.length) console.error(`Duplicate Spanish keys:\n${duplicateEs.map((key) => `- ${key}`).join("\n")}`);
  if (missingEs.length) console.error(`Missing Spanish keys:\n${missingEs.map((key) => `- ${key}`).join("\n")}`);
  if (missingEn.length) console.error(`Missing English keys:\n${missingEn.map((key) => `- ${key}`).join("\n")}`);
  process.exit(1);
}

console.log(`i18n check passed: ${enKeys.length} app phrases are paired in EN/ES.`);

function readKeys(language) {
  const block = readLanguageBlock(language);
  const keys = [];
  const propertyPattern = /(?:^|\n)\s*"([^"]+)"\s*:/g;
  let match;

  while ((match = propertyPattern.exec(block))) {
    keys.push(match[1]);
  }

  return keys.sort();
}

function findDuplicates(keys) {
  return keys.filter((key, index) => keys.indexOf(key) !== index);
}

function readLanguageBlock(language) {
  const marker = `  ${language}: {`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find ${language} app text block.`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`Could not read ${language} app text block.`);
}
