#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

const AGENTS_DIR = "agents";
const POINTER_RE = /@agents\/([a-zA-Z0-9_\-./]+)/g;

function trimTrailingPunctuation(value) {
  return value.replace(/[.,;:!?)\]]+$/g, "");
}

function listMarkdownFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(dir, entry.name));
}

function check() {
  const files = listMarkdownFiles(AGENTS_DIR);
  const errors = [];
  const agents = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let parsed;
    try {
      parsed = parseFrontmatter(content);
    } catch (err) {
      errors.push(`${file}: invalid frontmatter — ${err.message}`);
      continue;
    }

    const { frontmatter } = parsed;
    const hasName = typeof frontmatter?.name === "string";
    const hasDescription = typeof frontmatter?.description === "string";

    if (!hasName) errors.push(`${file}: agent frontmatter missing 'name'`);
    if (!hasDescription)
      errors.push(`${file}: agent frontmatter missing 'description'`);
    if (hasName && hasDescription) agents.push(file);
  }

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = POINTER_RE.exec(content)) !== null) {
      const target = trimTrailingPunctuation(match[1]);
      const targetPath = path.join(AGENTS_DIR, target);
      if (!fs.existsSync(targetPath)) {
        errors.push(`${file}: points to missing @agents/${target}`);
      }
    }
  }

  if (errors.length) {
    console.error("Errors:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`Checked ${files.length} files: ${agents.length} agents. No errors.`);
}

check();
