import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const secretPattern = /sk-[A-Za-z0-9]{20,}/g;
const forbiddenPathPattern =
  /(^|[\\/])(\.env|node_modules|\.next|\.vercel|coverage|build|out)([\\/]|$)|\.env\.local$/;
const binaryExtensionPattern =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|woff2?|ttf|otf)$/i;

function gitListFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const files = gitListFiles();
const failures = [];

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");

  if (forbiddenPathPattern.test(normalized)) {
    failures.push(`forbidden path: ${file}`);
    continue;
  }

  if (binaryExtensionPattern.test(normalized)) {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    failures.push(`unreadable text file: ${file}`);
    continue;
  }

  const matches = content.match(secretPattern);
  if (matches?.length) {
    failures.push(`possible API key in ${file}: ${matches.length} match(es)`);
  }
}

if (failures.length) {
  console.error("Repository safety check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Repository safety check passed: ${files.length} files inspected.`);
