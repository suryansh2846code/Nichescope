import { spawn } from "bun";

const services = [
  { name: "API", cmd: ["bun", "run", "src/index.ts"] },
  { name: "FRONTEND", cmd: ["bun", "--hot", "src/frontend/server.ts"] },
  { name: "WORKER:SCRAPE", cmd: ["bun", "run", "src/workers/scrapeWorker.ts"] },
  // { name: "WORKER:DISCOVER", cmd: ["bun", "run", "src/workers/hashtagDiscoveryWorker.ts"] },
  { name: "WORKER:INFLUENCER_DISCOVER", cmd: ["bun", "run", "src/workers/influencerDiscoveryWorker.ts"] },
  { name: "WORKER:COMMENT_SCRAPE", cmd: ["bun", "run", "src/workers/commentScrapeWorker.ts"] },
  { name: "WORKER:COMMENT_ANALYZE", cmd: ["bun", "run", "src/workers/commentAnalysisWorker.ts"] },
  { name: "WORKER:ANALYZE", cmd: ["bun", "run", "src/workers/aiAnalysisWorker.ts"] },
  { name: "WORKER:USER", cmd: ["bun", "run", "src/workers/userIntelligenceWorker.ts"] },
  { name: "WORKER:EMBEDDING", cmd: ["bun", "run", "src/workers/embeddingWorker.ts"] },
  { name: "WORKER:MONITORING", cmd: ["bun", "run", "src/workers/monitoringWorker.ts"] },
  { name: "WORKER:QUALIFICATION", cmd: ["bun", "run", "src/workers/leadQualificationWorker.ts"] },
];

const colors = {
  reset: "\x1b[0m",
  API: "\x1b[36m",           // Cyan
  FRONTEND: "\x1b[32m",      // Green
  "WORKER:SCRAPE": "\x1b[33m", // Yellow
  // "WORKER:DISCOVER": "\x1b[35m", // Magenta
  "WORKER:INFLUENCER_DISCOVER": "\x1b[35m", // Magenta
  "WORKER:COMMENT_SCRAPE": "\x1b[95m", // Bright Magenta
  "WORKER:COMMENT_ANALYZE": "\x1b[91m", // Bright Red
  "WORKER:ANALYZE": "\x1b[34m", // Blue
  "WORKER:USER": "\x1b[96m",   // Bright Cyan
  "WORKER:EMBEDDING": "\x1b[92m", // Bright Green
  "WORKER:MONITORING": "\x1b[93m", // Bright Yellow
  "WORKER:QUALIFICATION": "\x1b[95m", // Bright Magenta
};

const activeProcesses: ReturnType<typeof Bun.spawn>[] = [];

async function streamOutput(name: string, stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const color = colors[name as keyof typeof colors] || colors.reset;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last partial line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          console.log(`${color}[${name}]${colors.reset} ${line}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading stream for ${name}:`, err);
  }
}

console.log("Starting NicheScope services...");

for (const service of services) {
  console.log(`Starting ${service.name}: ${service.cmd.join(" ")}`);
  const proc = Bun.spawn(service.cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });
  activeProcesses.push(proc);

  streamOutput(service.name, proc.stdout);
  streamOutput(service.name, proc.stderr);
}

// Cleanup on termination
function cleanup() {
  console.log("\nTerminating all services...");
  for (const proc of activeProcesses) {
    proc.kill();
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Prevent script from exiting immediately
setInterval(() => {}, 1000);
