import { readJsonDb } from "@/lib/json-db";

export const dynamic = "force-static";

export async function GET() {
  try {
    const db = await readJsonDb();
    return Response.json({
      ok: true,
      storage: "database.json",
      articlesCount: db.articles.length,
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
