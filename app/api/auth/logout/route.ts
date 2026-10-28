import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/session";

export async function GET(request: NextRequest) {
  const BASE_URL = process.env.ATLASSIAN_CALLBACK_URL ? new URL(process.env.ATLASSIAN_CALLBACK_URL).origin : new URL(request.url).origin;
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.redirect(new URL("/", BASE_URL));
}