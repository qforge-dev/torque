#!/usr/bin/env bun
/**
 * Generate StackBlitz templates from examples
 *
 * This script:
 * 1. Clears existing template directories (except _templates)
 * 2. Reads all .ts files from examples/
 * 3. For each example:
 *    - Creates a folder in stackblitz-templates/
 *    - Copies the example as index.ts with BYOK wrapper
 *    - Generates package.json, README, tsconfig, .stackblitzrc from templates
 * 4. Extracts metadata from example comments
 */

import {
  readdirSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "fs";
import { join, basename } from "path";

const EXAMPLES_DIR = join(process.cwd(), "examples");
const TEMPLATES_DIR = join(process.cwd(), "stackblitz-templates");
const TEMPLATE_SOURCE_DIR = join(TEMPLATES_DIR, "_templates");

interface ExampleMetadata {
  name: string;
  title: string;
  description: string;
}

/**
 * Extract metadata from example file comments
 */
function extractMetadata(examplePath: string): ExampleMetadata {
  const content = readFileSync(examplePath, "utf-8");
  const name = basename(examplePath, ".ts");

  // Extract title and description from JSDoc comment
  const commentMatch = content.match(
    /\/\*\*\s*\n\s*\*\s*(.+?)\s*\n\s*\*\s*\n([\s\S]*?)\*\//
  );

  let title = name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  let description = `Learn how to use Torque with this ${title.toLowerCase()} example.`;

  if (commentMatch) {
    title = commentMatch[1]!.trim();

    // Extract description lines (lines starting with * in the comment block)
    const descLines = commentMatch[2]!
      .split("\n")
      .map((line) => line.trim().replace(/^\*\s*/, ""))
      .filter((line) => line && !line.startsWith("This example"));

    if (descLines.length > 0) {
      description = descLines.join(" ");
    }
  }

  return { name, title, description };
}

/**
 * Wrap example code with BYOK check
 */
function wrapWithBYOK(content: string, metadata: ExampleMetadata): string {
  // Find all import statements
  const lines = content.split("\n");
  const commentLines: string[] = [];
  const importLines: string[] = [];
  const codeLines: string[] = [];

  let inComment = false;
  let inImport = false;
  let pastImports = false;

  for (const line of lines) {
    // Handle JSDoc comments
    if (line.trim().startsWith("/**")) {
      inComment = true;
    }

    if (inComment) {
      commentLines.push(line);
      if (line.trim().endsWith("*/")) {
        inComment = false;
      }
      continue;
    }

    // Skip empty lines before imports
    if (!pastImports && !inImport && line.trim() === "") {
      continue;
    }

    // Start of import statement
    if (!pastImports && line.trim().startsWith("import ")) {
      inImport = true;
      const updatedLine = line.replace(
        /from ['"]\.\.\//g,
        'from "@qforge/torque'
      );
      importLines.push(updatedLine);

      // Check if import ends on same line
      if (line.includes(";")) {
        inImport = false;
      }
      continue;
    }

    // Continuation of multi-line import
    if (inImport) {
      const updatedLine = line.replace(
        /from ['"]\.\.\//g,
        'from "@qforge/torque'
      );
      importLines.push(updatedLine);

      // Check if import ends
      if (line.includes(";") || line.includes("from ")) {
        inImport = false;
      }
      continue;
    }

    // After imports
    pastImports = true;
    codeLines.push(line);
  }

  const byokCheck = `
// Get API key from environment variable
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: OPENAI_API_KEY not found!");
  console.log("\\n📝 To add your API key:");
  console.log("1. Click the 🔒 icon in the bottom left corner");
  console.log("2. Add: OPENAI_API_KEY=your-key-here");
  console.log("3. Run this script again\\n");
  process.exit(1);
}

console.log("✅ API key loaded successfully!");
console.log("🚀 Starting dataset generation...\\n");
`;

  return [
    commentLines.join("\n"),
    "",
    importLines.join("\n"),
    byokCheck,
    codeLines.join("\n"),
  ].join("\n");
}

/**
 * Process template file with replacements
 */
function processTemplate(
  templateContent: string,
  metadata: ExampleMetadata
): string {
  return templateContent
    .replace(/\{\{EXAMPLE_NAME\}\}/g, metadata.name)
    .replace(/\{\{EXAMPLE_TITLE\}\}/g, metadata.title)
    .replace(/\{\{EXAMPLE_DESCRIPTION\}\}/g, metadata.description);
}

/**
 * Clear existing template directories (except _templates)
 */
function clearExistingTemplates() {
  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true });
    return;
  }

  const entries = readdirSync(TEMPLATES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "_templates") {
      const dirPath = join(TEMPLATES_DIR, entry.name);
      console.log(`  Removing ${entry.name}/`);
      rmSync(dirPath, { recursive: true, force: true });
    }
  }
}

/**
 * Generate template for a single example
 */
function generateTemplate(exampleFile: string) {
  const examplePath = join(EXAMPLES_DIR, exampleFile);
  const metadata = extractMetadata(examplePath);
  const templateDir = join(TEMPLATES_DIR, metadata.name);

  console.log(`\n📦 Generating template: ${metadata.name}`);
  console.log(`   Title: ${metadata.title}`);

  // Create template directory
  mkdirSync(templateDir, { recursive: true });

  // Read and wrap example code
  const exampleContent = readFileSync(examplePath, "utf-8");
  const wrappedContent = wrapWithBYOK(exampleContent, metadata);
  writeFileSync(join(templateDir, "index.ts"), wrappedContent);

  // Copy and process template files
  const templateFiles = [
    "package.json",
    "tsconfig.json",
    ".stackblitzrc",
    "README.md",
  ];

  for (const file of templateFiles) {
    const templatePath = join(TEMPLATE_SOURCE_DIR, file);
    const templateContent = readFileSync(templatePath, "utf-8");
    const processedContent = processTemplate(templateContent, metadata);
    writeFileSync(join(templateDir, file), processedContent);
  }

  console.log(`   ✅ Generated in stackblitz-templates/${metadata.name}/`);
}

/**
 * Main execution
 */
function main() {
  console.log("🚀 Generating StackBlitz templates from examples...\n");

  // Step 1: Clear existing templates
  console.log("🧹 Clearing existing templates...");
  clearExistingTemplates();

  // Step 2: Read all example files
  const exampleFiles = readdirSync(EXAMPLES_DIR)
    .filter((file) => file.endsWith(".ts"))
    .sort();

  console.log(`\n📂 Found ${exampleFiles.length} examples`);

  // Step 3: Generate template for each example
  for (const exampleFile of exampleFiles) {
    generateTemplate(exampleFile);
  }

  console.log("\n✨ Template generation complete!");
  console.log(
    `\n📁 Generated ${exampleFiles.length} templates in stackblitz-templates/\n`
  );
}

main();
