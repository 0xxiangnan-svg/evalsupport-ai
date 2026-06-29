import { execFile, spawn } from "node:child_process";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const MOCK_AI_URL = process.env.MOCK_AI_URL ?? "http://127.0.0.1:4010/v1";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const isWindows = process.platform === "win32";
const managedProcesses = [];

function log(message) {
  console.log(`\n==> ${message}`);
}

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawnNpm(args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${npmCommand} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function isAppReady() {
  try {
    const response = await fetch(`${APP_URL}/api/runtime/status`);
    return response.ok;
  } catch {
    return false;
  }
}

async function isMockReady() {
  try {
    const response = await fetch(`${MOCK_AI_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function startManagedProcess(args, logPrefix) {
  const child = spawnNpm(args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${logPrefix}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${logPrefix}] ${chunk}`);
  });

  managedProcesses.push(child);
  return child;
}

function spawnNpm(args, options) {
  if (!isWindows) {
    return spawn(npmCommand, args, options);
  }

  return spawn(`${npmCommand} ${args.map(quoteShellArg).join(" ")}`, [], {
    ...options,
    shell: true,
  });
}

function quoteShellArg(value) {
  if (/^[A-Za-z0-9_:/.-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

async function waitFor(name, check, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`${name} did not become ready in ${timeoutMs}ms`);
}

async function ensureRuntime() {
  if (!(await isMockReady())) {
    log("Starting mock OpenAI-compatible API");
    startManagedProcess(["run", "mock:ai"], "mock-ai");
    await waitFor("mock AI", isMockReady);
  } else {
    log("Mock OpenAI-compatible API is already running");
  }

  if (!(await isAppReady())) {
    log("Starting production Next.js server");
    startManagedProcess(
      ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"],
      "app",
    );
    await waitFor("app", isAppReady);
  } else {
    log("App server is already running");
  }
}

async function cleanup() {
  await Promise.all(
    managedProcesses.map((child) => stopManagedProcess(child)),
  );
}

function stopManagedProcess(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed || child.pid == null) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 3_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    if (isWindows) {
      execFile(
        "taskkill",
        ["/pid", String(child.pid), "/t", "/f"],
        () => undefined,
      );
      return;
    }

    child.kill();
  });
}

try {
  log("Repository safety check");
  await runNpm(["run", "test:safety"]);

  log("Docs link check");
  await runNpm(["run", "test:docs"]);

  log("Lint");
  await runNpm(["run", "lint"]);

  log("Unit tests");
  await runNpm(["test"]);

  log("Production build");
  await runNpm(["run", "build"]);

  await ensureRuntime();

  log("Runtime smoke test");
  await runNpm(["run", "test:smoke"]);

  log("Conversation regression");
  await runNpm(["run", "test:conversation"]);

  log("Admin regression");
  await runNpm(["run", "test:admin"]);

  console.log("\nPortfolio check passed.");
} catch (error) {
  console.error(
    `\nPortfolio check failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await cleanup();
}
