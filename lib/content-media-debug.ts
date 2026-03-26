export const CONTENT_MEDIA_DEBUG_QUERY_PARAM = "debugContentMedia";
export const CONTENT_MEDIA_DEBUG_STORAGE_KEY = "engage-debug-content-media";
export const CONTENT_MEDIA_DEBUG_HEADER = "x-engage-debug-content-media";
export const CONTENT_MEDIA_DEBUG_REQUEST_ID_HEADER = "x-engage-debug-request-id";

type SharedContentMedia = {
  image?: unknown;
  video?: unknown;
};

type DebugContext = {
  enabled: boolean;
  requestId?: string;
};

const DEBUG_PREFIX = "[engage:content-media]";

export const createContentMediaDebugRequestId = (scope: string) =>
  `${scope}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const summarizeMediaUrl = (value: unknown) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const commaIndex = trimmed.indexOf(",");
    const header = commaIndex >= 0 ? trimmed.slice(0, commaIndex) : trimmed;
    return {
      kind: "data",
      header,
      length: trimmed.length,
    };
  }

  if (trimmed.startsWith("/")) {
    const [pathname, search = ""] = trimmed.split("?");
    return {
      kind: "path",
      pathname,
      hasQuery: Boolean(search),
    };
  }

  try {
    const url = new URL(trimmed);
    return {
      kind: "url",
      origin: url.origin,
      pathname: url.pathname,
      hasQuery: Boolean(url.search),
    };
  } catch {
    return {
      kind: "string",
      preview: trimmed.slice(0, 120),
      length: trimmed.length,
    };
  }
};

export const summarizeSharedMedia = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const media = value as SharedContentMedia;
  const image = summarizeMediaUrl(media.image);
  const video = summarizeMediaUrl(media.video);

  if (!image && !video) {
    return null;
  }

  return {
    ...(image ? { image } : {}),
    ...(video ? { video } : {}),
  };
};

export const extractContentJsonMediaSummary = (contentJson: string) => {
  try {
    const parsed = JSON.parse(contentJson) as { media?: SharedContentMedia };
    return summarizeSharedMedia(parsed.media);
  } catch {
    return null;
  }
};

export const isContentMediaDebugEnabledInBrowser = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const url = new URL(window.location.href);
  const queryValue = url.searchParams.get(CONTENT_MEDIA_DEBUG_QUERY_PARAM);

  try {
    if (queryValue === "1") {
      window.localStorage.setItem(CONTENT_MEDIA_DEBUG_STORAGE_KEY, "1");
      return true;
    }

    if (queryValue === "0") {
      window.localStorage.removeItem(CONTENT_MEDIA_DEBUG_STORAGE_KEY);
      return false;
    }

    return (
      window.localStorage.getItem(CONTENT_MEDIA_DEBUG_STORAGE_KEY) === "1"
    );
  } catch {
    return queryValue === "1";
  }
};

export const buildContentMediaDebugHeaders = (
  enabled: boolean,
  requestId?: string,
) =>
  enabled
    ? {
        [CONTENT_MEDIA_DEBUG_HEADER]: "1",
        ...(requestId
          ? { [CONTENT_MEDIA_DEBUG_REQUEST_ID_HEADER]: requestId }
          : {}),
      }
    : {};

export const getContentMediaDebugContext = (
  requestOrHeaders: Request | Headers,
): DebugContext => {
  const headers =
    requestOrHeaders instanceof Headers
      ? requestOrHeaders
      : requestOrHeaders.headers;

  return {
    enabled: headers.get(CONTENT_MEDIA_DEBUG_HEADER) === "1",
    requestId: headers.get(CONTENT_MEDIA_DEBUG_REQUEST_ID_HEADER) ?? undefined,
  };
};

export const logContentMediaDebug = (
  scope: string,
  payload: unknown,
  context?: DebugContext,
) => {
  if (context && !context.enabled) {
    return;
  }

  const suffix = context?.requestId ? ` (${context.requestId})` : "";
  console.info(`${DEBUG_PREFIX} ${scope}${suffix}`, payload);
};
