import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = process.argv[2] || resolve(__dirname, "render-sample-results.jsonl");

const lines = readFileSync(path, "utf-8").split("\n").filter(l => l.trim());
const results = lines.map(l => JSON.parse(l));

const ok = results.filter(r => r.ok).length;
const fail = results.filter(r => !r.ok).length;
console.log(`Total: ${results.length} | OK: ${ok} (${((ok / results.length) * 100).toFixed(1)}%) | Fail: ${fail}`);
console.log();

// Categorize errors
const cats = new Map<string, { count: number; examples: string[] }>();

function categorize(error: string): string {
  if (error.includes("Timeout")) return "timeout";
  if (error.includes("setup() to complete")) return "setup_timeout";
  if (error.includes("Worker exited")) return "worker_crash";
  if (error.includes("is not defined")) {
    const m = error.match(/(\w+) is not defined/);
    return m ? `undefined: ${m[1]}` : "undefined_var";
  }
  if (error.includes("is not a function")) return "not_a_function";
  if (error.includes("is not a constructor")) return "not_a_constructor";
  if (error.includes("Cannot read properties of")) return "null_property_access";
  if (error.includes("did not produce a function")) return "not_a_sketch_function";
  if (error.includes("SyntaxError") || error.includes("Unexpected token")) return "syntax_error";
  if (error.includes("Maximum call stack")) return "stack_overflow";
  if (error.includes("loadImage") || error.includes("loadFont") || error.includes("loadModel")) return "missing_asset";
  return "other";
}

for (const r of results.filter(r => !r.ok)) {
  const cat = categorize(r.error || "unknown");
  const entry = cats.get(cat) || { count: 0, examples: [] };
  entry.count++;
  if (entry.examples.length < 3) entry.examples.push(`#${r.id} "${r.title}": ${(r.error || "").slice(0, 120)}`);
  cats.set(cat, entry);
}

console.log("--- Error breakdown ---");
const sorted = [...cats.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [cat, { count, examples }] of sorted) {
  console.log(`\n  ${cat}: ${count} (${((count / fail) * 100).toFixed(1)}%)`);
  for (const ex of examples) {
    console.log(`    ${ex}`);
  }
}

// Aggregate "undefined: X" into a summary
const undefinedVars = new Map<string, number>();
for (const r of results.filter(r => !r.ok)) {
  const m = (r.error || "").match(/(\w+) is not defined/);
  if (m) undefinedVars.set(m[1], (undefinedVars.get(m[1]) || 0) + 1);
}
if (undefinedVars.size > 0) {
  console.log("\n--- Undefined variables (top 20) ---");
  const topVars = [...undefinedVars.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [name, n] of topVars) {
    console.log(`  ${name}: ${n}`);
  }
}

// Detailed dumps for fixable categories
for (const cat of ["null_property_access", "not_a_function", "not_a_constructor", "other", "setup_timeout"]) {
  const entries = results.filter((r: any) => !r.ok && categorize(r.error || "unknown") === cat);
  if (entries.length === 0) continue;
  console.log(`\n--- ${cat} (all ${entries.length}) ---`);
  for (const r of entries) {
    console.log(`  #${r.id} "${r.title}": ${(r.error || "").slice(0, 200)}`);
  }
}

// Duration stats for successful renders
const durations = results.filter(r => r.ok).map(r => r.duration_ms).sort((a: number, b: number) => a - b);
if (durations.length > 0) {
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p90 = durations[Math.floor(durations.length * 0.9)];
  const p99 = durations[Math.floor(durations.length * 0.99)];
  const max = durations[durations.length - 1];
  console.log(`\n--- Duration stats (successful renders) ---`);
  console.log(`  p50: ${p50}ms | p90: ${p90}ms | p99: ${p99}ms | max: ${max}ms`);
}
