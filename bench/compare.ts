/**
 * Benchmark baseline comparison logic.
 *
 * Compares current benchmark results against a saved baseline and prints
 * a formatted table to stderr, flagging regressions > 10%.
 */

export interface BenchResult {
  cold_ms: number;
  warm_ms: number;
  warm_p50: number;
  warm_p99: number;
  peak_heap_mb: number;
  png_bytes: number;
}

export interface BenchReport {
  timestamp: string;
  node_version: string;
  platform: string;
  results: Record<string, BenchResult>;
}

/** Compute percentage change: (current - baseline) / baseline * 100 */
function pctChange(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : Infinity;
  return ((current - baseline) / baseline) * 100;
}

/** Format a number with a fixed number of decimal places */
function fmt(n: number, decimals: number = 1): string {
  return n.toFixed(decimals);
}

/** Pad a string to a fixed width (right-padded) */
function padRight(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

/** Pad a string to a fixed width (left-padded) */
function padLeft(s: string, width: number): string {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}

/** Format the delta with sign and regression flag */
function formatDelta(current: number, baseline: number, unit: string = "ms"): { text: string; regression: boolean } {
  const delta = current - baseline;
  const pct = pctChange(current, baseline);
  const sign = delta >= 0 ? "+" : "";
  const regression = pct > 10;
  const status = regression ? "REGRESSION" : delta < 0 ? "faster" : "ok";
  const text = `${sign}${fmt(delta)}${unit} (${sign}${fmt(pct)}%) ${status}`;
  return { text, regression };
}

/**
 * Compare current benchmark results against a baseline and print a
 * formatted table to stderr. Flags regressions where any metric is
 * more than 10% slower than baseline.
 */
export function compareBenchmarks(current: BenchReport, baseline: BenchReport): { hasRegressions: boolean } {
  const allNames = new Set([...Object.keys(current.results), ...Object.keys(baseline.results)]);
  const sortedNames = [...allNames].sort();

  let hasRegressions = false;

  // Header
  const COL_NAME = 22;
  const COL_WARM = 14;
  const COL_DELTA = 36;
  const COL_STATUS = 14;

  const header = [
    padRight("Benchmark", COL_NAME),
    padLeft("Warm (ms)", COL_WARM),
    padLeft("Delta", COL_DELTA),
    padLeft("Status", COL_STATUS),
  ].join("  ");

  const separator = "-".repeat(header.length);

  process.stderr.write("\n" + header + "\n");
  process.stderr.write(separator + "\n");

  for (const name of sortedNames) {
    const cur = current.results[name];
    const base = baseline.results[name];

    if (!cur && base) {
      // Benchmark was removed
      process.stderr.write(
        padRight(name, COL_NAME) + "  " + padLeft("REMOVED", COL_WARM) + "\n",
      );
      continue;
    }

    if (cur && !base) {
      // New benchmark
      process.stderr.write(
        padRight(name, COL_NAME) +
          "  " +
          padLeft(fmt(cur.warm_ms), COL_WARM) +
          "  " +
          padLeft("NEW", COL_DELTA) +
          "\n",
      );
      continue;
    }

    if (!cur || !base) continue;

    // Compare warm_ms (primary metric)
    const warmDelta = formatDelta(cur.warm_ms, base.warm_ms);

    // Also check cold_ms and p99
    const coldDelta = formatDelta(cur.cold_ms, base.cold_ms);
    const p99Delta = formatDelta(cur.warm_p99, base.warm_p99);

    const anyRegression = warmDelta.regression || coldDelta.regression || p99Delta.regression;
    if (anyRegression) hasRegressions = true;

    const statusIcon = anyRegression ? "!! REGR" : cur.warm_ms < base.warm_ms ? "ok (faster)" : "ok";

    process.stderr.write(
      [
        padRight(name, COL_NAME),
        padLeft(fmt(cur.warm_ms), COL_WARM),
        padLeft(warmDelta.text, COL_DELTA),
        padLeft(statusIcon, COL_STATUS),
      ].join("  ") + "\n",
    );
  }

  process.stderr.write(separator + "\n");

  // Summary
  if (hasRegressions) {
    process.stderr.write("\n!! Regressions detected (>10% slower than baseline)\n\n");
  } else {
    process.stderr.write("\nNo regressions detected.\n\n");
  }

  // Metadata comparison
  process.stderr.write(`Baseline: ${baseline.timestamp} | ${baseline.node_version} | ${baseline.platform}\n`);
  process.stderr.write(`Current:  ${current.timestamp} | ${current.node_version} | ${current.platform}\n\n`);

  return { hasRegressions };
}
