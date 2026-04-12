const STATUS_PATTERN = /(\d{3})\s/;

const NETWORK_KEYWORDS = [
  "connection reset",
  "connection refused",
  "timed out",
  "timeout",
  "network",
  "econnrefused",
  "enotfound",
  "econnaborted",
  "failed to stream body",
];

const extractStatus = (message: string): number | null => {
  const match = STATUS_PATTERN.exec(message);
  if (!match) return null;
  const code = Number(match[1]);
  if (code < 100 || code > 599) return null;
  return code;
};

const isQuotaError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return lower.includes("storagequota") || lower.includes("quotaexceeded");
};

const isNetworkError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return NETWORK_KEYWORDS.some((keyword) => lower.includes(keyword));
};

export const classifyError = (rawMessage: string): string => {
  if (!rawMessage) return "errors.unknown";

  if (isQuotaError(rawMessage)) return "errors.quotaExceeded";

  const status = extractStatus(rawMessage);

  if (status !== null) {
    switch (status) {
      case 401:
        return "errors.authExpired";
      case 403:
        return "errors.forbidden";
      case 404:
        return "errors.notFound";
      case 429:
        return "errors.rateLimited";
      case 500:
      case 502:
      case 503:
      case 504:
        return "errors.serverError";
      default:
        return "errors.unknown";
    }
  }

  if (isNetworkError(rawMessage)) return "errors.networkError";

  return "errors.unknown";
};
