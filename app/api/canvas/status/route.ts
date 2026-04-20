import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCanvasStatusResponse } from "@/lib/integrations/canvas/auth";

export async function GET() {
  const cookieStore = await cookies();

  return NextResponse.json(getCanvasStatusResponse(cookieStore), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
