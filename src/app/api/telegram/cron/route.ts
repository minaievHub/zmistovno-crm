import { timingSafeEqual } from "node:crypto";
import { TelegramService } from "@/features/telegram/service";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET,
    value = request.headers.get("authorization") || "";
  if (
    !expected ||
    value.length !== ("Bearer " + expected).length ||
    !timingSafeEqual(Buffer.from(value), Buffer.from("Bearer " + expected))
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json({
      processed: await new TelegramService().publishDue(),
    });
  } catch {
    return Response.json(
      { error: "Scheduler failed. Check server configuration." },
      { status: 500 },
    );
  }
}
