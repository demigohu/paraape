import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
  "access-control-max-age": "86400",
};

/** Wallets call this from an extension origin, so the response has to allow that. */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/** Browser and SSR call this route. The upstream URL never leaves the server. */
export async function POST(request: Request) {
  const upstream = process.env.ROBINHOOD_TESTNET_RPC_URL?.trim();
  if (!upstream) {
    return NextResponse.json(
      { error: "RPC is not configured" },
      { status: 500, headers: corsHeaders },
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Invalid RPC request" },
      { status: 400, headers: corsHeaders },
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "RPC request failed" },
      { status: 502, headers: corsHeaders },
    );
  }

  const text = await upstreamResponse.text();
  return new NextResponse(text, {
    status: upstreamResponse.status,
    headers: {
      ...corsHeaders,
      "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });
}
