import "server-only";

import type { CanvasApiAssignment, CanvasApiCourse } from "@/lib/integrations/canvas/types";

type CanvasQueryValue = string | number | boolean | Array<string | number | boolean>;
type CanvasQuery = Record<string, CanvasQueryValue | null | undefined>;

type CanvasClientOptions = {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

export class CanvasApiError extends Error {
  status: number;
  url: string;
  body: string | null;

  constructor(message: string, options: { status: number; url: string; body: string | null }) {
    super(message);
    this.name = "CanvasApiError";
    this.status = options.status;
    this.url = options.url;
    this.body = options.body;
  }
}

function appendQueryValue(params: URLSearchParams, key: string, value: CanvasQueryValue) {
  if (Array.isArray(value)) {
    value.forEach((item) => params.append(key, String(item)));
    return;
  }

  params.append(key, String(value));
}

function buildUrl(baseUrl: string, input: string, query?: CanvasQuery) {
  const url = new URL(input, baseUrl);

  if (!query) {
    return url;
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value == null) {
      return;
    }

    appendQueryValue(url.searchParams, key, value);
  });

  return url;
}

function getNextPageUrl(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const links = linkHeader.split(",");
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") {
      return match[1];
    }
  }

  return null;
}

export function createCanvasClient({
  baseUrl,
  accessToken,
  fetchImpl = fetch,
}: CanvasClientOptions) {
  async function requestPage<T>(input: string, query?: CanvasQuery) {
    const url = buildUrl(baseUrl, input, query);
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json+canvas-string-ids",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new CanvasApiError(`Canvas request failed with status ${response.status}.`, {
        status: response.status,
        url: url.toString(),
        body,
      });
    }

    return {
      data: (await response.json()) as T,
      nextPageUrl: getNextPageUrl(response.headers.get("link")),
    };
  }

  async function fetchAllPages<T>(input: string, query?: CanvasQuery) {
    const items: T[] = [];
    let nextInput: string | null = input;
    let nextQuery: CanvasQuery | undefined = query;

    while (nextInput) {
      const page: { data: T[]; nextPageUrl: string | null } = await requestPage<T[]>(
        nextInput,
        nextQuery,
      );
      items.push(...page.data);
      nextInput = page.nextPageUrl;
      nextQuery = undefined;
    }

    return items;
  }

  return {
    getCourses() {
      return fetchAllPages<CanvasApiCourse>("/api/v1/courses", {
        per_page: 100,
        enrollment_type: "student",
        "include[]": ["term", "favorites"],
      });
    },
    getCourseAssignments(courseId: string) {
      return fetchAllPages<CanvasApiAssignment>(`/api/v1/courses/${courseId}/assignments`, {
        per_page: 100,
        "include[]": ["submission"],
      });
    },
  };
}
