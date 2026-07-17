// _shared/response.ts — JSON response helpers for Edge Functions

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

/** 200 OK with JSON body */
export function ok(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { headers: HEADERS });
}

/** Error response with status code */
export function error(
  message: string,
  status = 500,
  detail?: string,
): Response {
  const body: Record<string, string> = { error: message };
  if (detail) body.detail = detail;
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** 404 Not Found */
export function notFound(resource = "Resource"): Response {
  return error(`${resource} not found`, 404);
}

/** 403 Forbidden with role hint */
export function forbidden(detail: string): Response {
  return new Response(
    JSON.stringify({ error: "Forbidden", detail }),
    { status: 403, headers: HEADERS },
  );
}

/** 400 Bad Request */
export function badRequest(detail: string): Response {
  return error("Bad request", 400, detail);
}

/** Handle CORS preflight */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: HEADERS });
}
