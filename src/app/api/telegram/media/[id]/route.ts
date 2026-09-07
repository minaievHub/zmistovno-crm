import { requireStaff } from "@/services/auth";
import { loadMedia } from "@/features/telegram/media-service";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();
  try {
    const blob = await loadMedia((await params).id);
    return new Response(blob, {
      headers: {
        "Content-Type": blob.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
