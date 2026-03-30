/**
 * Performance monitoring utilities for tracking operation duration
 */

const timings: Record<string, number[]> = {};

/**
 * Start a performance timer with a given label.
 * Returns a function that stops the timer and records the duration.
 *
 * @param label - Unique label for this timing measurement
 * @returns A function to call when the operation completes
 */
export function startTimer(label: string): () => void {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    if (!timings[label]) {
      timings[label] = [];
    }
    timings[label].push(duration);

    // Log in development mode
    if (__DEV__) {
      console.log(`[PERF] ${label}: ${duration}ms`);
      if (duration > 1000) {
        console.warn(`[PERF WARNING] ${label} took ${duration}ms`);
      }
    }
  };
}

/**
 * Get a performance report with aggregated statistics for all measurements
 *
 * @returns Object with average, max, and count for each label
 */
export function getPerformanceReport(): Record<
  string,
  { avg: number; max: number; count: number }
> {
  const report: Record<string, { avg: number; max: number; count: number }> =
    {};
  for (const [label, times] of Object.entries(timings)) {
    if (times.length > 0) {
      report[label] = {
        avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        max: Math.max(...times),
        count: times.length,
      };
    }
  }
  return report;
}

/**
 * Clear all recorded timing measurements
 */
export function clearTimings(): void {
  Object.keys(timings).forEach((k) => delete timings[k]);
}

/**
 * Get all raw timing measurements (for advanced analysis)
 */
export function getRawTimings(): Record<string, number[]> {
  return { ...timings };
}
