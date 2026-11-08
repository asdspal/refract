import { NextResponse } from "next/server";

export function correlationId(): string {
  return `req_${crypto.randomUUID()}`;
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; correlationId?: string } = {},
): NextResponse {
  const cid = init.correlationId ?? correlationId();
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { "X-Correlation-Id": cid },
  });
}
