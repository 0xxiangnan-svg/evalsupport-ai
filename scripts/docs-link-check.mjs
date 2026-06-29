import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const roots = ["README.md", "SECURITY.md", "docs", ".github"];
const markdownFiles = roots.flatMap(collectMarkdownFiles).sort();
const failures = [];

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const ignoredTargetPattern = /^(https?:|mailto:|#)/i;

function collectMarkdownFiles(target) {
  if (!existsSync(target)) {
    return [];
  }

  const stats = statSync(target);
  if (stats.isFile()) {
    return target.endsWith(".md") ? [target] : [];
  }

  return readdirSync(target)
    .flatMap((entry) => collectMarkdownFiles(path.join(target, entry)))
    .filter(Boolean);
}

function stripFragment(value) {
  return value.split("#")[0];
}

function normalizeMarkdownTarget(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

for (const file of markdownFiles) {
  const content = readFileSync(file, "utf8");
  const directory = path.dirname(file);

  for (const match of content.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1].trim();
    const targetWithoutFragment = stripFragment(rawTarget);
    if (!targetWithoutFragment || ignoredTargetPattern.test(rawTarget)) {
      continue;
    }

    const normalizedTarget = normalizeMarkdownTarget(targetWithoutFragment);
    const resolved = path.resolve(directory, normalizedTarget);
    const relativeResolved = path.relative(process.cwd(), resolved);

    if (relativeResolved.startsWith("..") || path.isAbsolute(relativeResolved)) {
      failures.push(`${file}: link escapes repository: ${rawTarget}`);
      continue;
    }

    if (!existsSync(resolved)) {
      failures.push(`${file}: missing link target: ${rawTarget}`);
    }
  }
}

if (failures.length) {
  console.error("Docs link check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Docs link check passed: ${markdownFiles.length} markdown files inspected.`);
