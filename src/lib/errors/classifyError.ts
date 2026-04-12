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
  "request failed",
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
    switch (true) {
      case status === 401:
        return "errors.authExpired";
      case status === 403:
        return "errors.forbidden";
      case status === 404:
        return "errors.notFound";
      case status === 429:
        return "errors.rateLimited";
      case status >= 500:
        return "errors.serverError";
    }
  }

  if (isNetworkError(rawMessage)) return "errors.networkError";

  return "errors.unknown";
};
