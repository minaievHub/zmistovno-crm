import { NextResponse } from "next/server";
import { requireStaff } from "@/services/auth";
import { storeMedia } from "@/features/telegram/media-service";
export async function POST(request: Request) {
  await requireStaff();
  if (Number(request.headers.get("content-length") || 0) > 4.5 * 1024 * 1024)
    return NextResponse.json({ error: "Файл завеликий" }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Оберіть файл");
    return NextResponse.json(await storeMedia(file));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не вдалося завантажити" },
      { status: 400 },
    );
  }
}
