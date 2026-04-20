/**
 * Retry helper dengan exponential backoff untuk Gemini API calls
 * Membantu mengatasi network errors dan temporary API issues
 */

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const BACKOFF_MULTIPLIER = 2;

/**
 * Eksekusi function dengan automatic retry dan exponential backoff
 * @param {Function} fn - Function yang akan di-retry
 * @param {Object} options - {maxRetries, initialDelay, backoffMultiplier, name}
 * @returns {Promise}
 */
async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries || MAX_RETRIES;
  const initialDelay = options.initialDelay || INITIAL_DELAY;
  const backoffMultiplier = options.backoffMultiplier || BACKOFF_MULTIPLIER;
  const fnName = options.name || "operation";

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(
        `[Attempt ${attempt}/${maxRetries + 1}] Menjalankan: ${fnName}`,
      );
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      const msg = error.message || "";

      // Cek apakah error adalah retryable
      const isRetryable = isRetryableError(error);

      if (!isRetryable) {
        console.error(`[${fnName}] Non-retryable error: ${msg}`);
        throw error;
      }

      if (attempt > maxRetries) {
        console.error(`[${fnName}] Max retries (${maxRetries}) tercapai`);
        throw error;
      }

      console.warn(
        `[${fnName}] Attempt ${attempt} gagal: ${msg}. Retry dalam ${delay}ms...`,
      );
      await sleep(delay);
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Tentukan apakah error dapat di-retry
 */
function isRetryableError(error) {
  const msg = (error.message || "").toLowerCase();

  // Network errors - bisa di-retry
  if (
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("fetch") ||
    msg.includes("network")
  ) {
    return true;
  }

  // Rate limit / quota errors - bisa di-retry
  if (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return true;
  }

  // Timeout errors - bisa di-retry
  if (
    msg.includes("timeout") ||
    msg.includes("enotfound") ||
    msg.includes("hang up")
  ) {
    return true;
  }

  // Temporary server errors (500, 502, 503) - bisa di-retry
  if (
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("temporarily")
  ) {
    return true;
  }

  return false;
}

/**
 * Helper untuk sleep/delay
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  retryWithBackoff,
  isRetryableError,
  sleep,
  MAX_RETRIES,
  INITIAL_DELAY,
  BACKOFF_MULTIPLIER,
};
