import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function POST(request: Request) {
  const data = await request.json();
  const level = data.level;
  logger.log(level, data);
  return NextResponse.json({ message: "success" });
}
