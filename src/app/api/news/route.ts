import { NextRequest, NextResponse } from "next/server";
import { readJsonDb, writeJsonDb } from "@/lib/json-db";
import { fetchLiveWebNewsForQuery } from "@/lib/news-engine";

export const dynamic = "force-static";

export async function GET(request: NextRequest) {
  try {
    const dbData = await readJsonDb();

    const { searchParams } = new URL(request.url);
    const liveQuery = searchParams.get("q")?.trim();
    const triggerLiveRefresh = searchParams.get("refresh") === "1";

    if (triggerLiveRefresh || liveQuery) {
      const queriesToFetch = liveQuery
        ? [liveQuery]
        : ["بانک کشاورزی", "استانداری مازندران"];

      const existingTitles = new Set(
        dbData.articles.map((a) => a.title.trim().slice(0, 50))
      );
      let nextId =
        dbData.articles.reduce((max, a) => Math.max(max, a.id), 0) + 1;
      let changed = false;

      for (const q of queriesToFetch) {
        try {
          const liveItems = await fetchLiveWebNewsForQuery(q);
          for (const item of liveItems) {
            const titleKey = item.title.trim().slice(0, 50);
            if (!existingTitles.has(titleKey)) {
              existingTitles.add(titleKey);
              dbData.articles.push({
                id: nextId++,
                title: item.title,
                summary: item.summary,
                sourceName: item.sourceName,
                sourceDomain: item.sourceDomain,
                sourceUrl: item.sourceUrl,
                googleSearchUrl: item.googleSearchUrl,
                category: item.category,
                matchedKeyword: item.matchedKeyword,
                publishedAt: item.publishedAt.toISOString(),
                isBookmarked: false,
                includedInBulletin: false,
                createdAt: new Date().toISOString(),
              });
              changed = true;
            }
          }
        } catch {
          // Continue gracefully if external feed times out
        }
      }

      if (changed) {
        dbData.articles.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        );
        await writeJsonDb(dbData);
      }
    }

    return NextResponse.json({
      status: "ok",
      storageFile: "database.json",
      fetchedAt: new Date().toISOString(),
      articles: dbData.articles,
      keywords: dbData.keywords,
      drafts: dbData.drafts,
    });
  } catch (error) {
    console.error("Error in GET /api/news:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "خطا در بازیابی اطلاعات از فایل database.json",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const dbData = await readJsonDb();
    const body = await request.json();
    const { action } = body;

    if (action === "live_search") {
      const query = String(body.query || "بانک کشاورزی مازندران").trim();
      const liveItems = await fetchLiveWebNewsForQuery(query);

      const existingTitles = new Set(
        dbData.articles.map((a) => a.title.trim().slice(0, 50))
      );
      let nextId =
        dbData.articles.reduce((max, a) => Math.max(max, a.id), 0) + 1;

      let addedCount = 0;
      for (const item of liveItems) {
        const titleKey = item.title.trim().slice(0, 50);
        if (!existingTitles.has(titleKey)) {
          existingTitles.add(titleKey);
          dbData.articles.push({
            id: nextId++,
            title: item.title,
            summary: item.summary,
            sourceName: item.sourceName,
            sourceDomain: item.sourceDomain,
            sourceUrl: item.sourceUrl,
            googleSearchUrl: item.googleSearchUrl,
            category: item.category,
            matchedKeyword: item.matchedKeyword,
            publishedAt: item.publishedAt.toISOString(),
            isBookmarked: false,
            includedInBulletin: false,
            createdAt: new Date().toISOString(),
          });
          addedCount += 1;
        }
      }

      dbData.articles.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      await writeJsonDb(dbData);

      return NextResponse.json({
        status: "ok",
        addedCount,
        liveFoundCount: liveItems.length,
        articles: dbData.articles,
      });
    }

    if (action === "toggle_bookmark") {
      const articleId = Number(body.id);
      dbData.articles = dbData.articles.map((a) =>
        a.id === articleId ? { ...a, isBookmarked: !a.isBookmarked } : a
      );
      await writeJsonDb(dbData);
      return NextResponse.json({ status: "ok", articles: dbData.articles });
    }

    if (action === "toggle_bulletin") {
      const articleId = Number(body.id);
      dbData.articles = dbData.articles.map((a) =>
        a.id === articleId
          ? { ...a, includedInBulletin: !a.includedInBulletin }
          : a
      );
      await writeJsonDb(dbData);
      return NextResponse.json({ status: "ok", articles: dbData.articles });
    }

    if (action === "add_keyword") {
      const label = String(body.label || "").trim();
      const query = String(body.query || label).trim();
      const category = String(body.category || "bank_mazandaran");

      if (label) {
        const nextKwId =
          dbData.keywords.reduce((max, k) => Math.max(max, k.id), 0) + 1;
        dbData.keywords.push({
          id: nextKwId,
          label,
          query,
          category,
          isDefault: false,
          createdAt: new Date().toISOString(),
        });
        await writeJsonDb(dbData);
      }

      return NextResponse.json({ status: "ok", keywords: dbData.keywords });
    }

    if (action === "delete_keyword") {
      const id = Number(body.id);
      dbData.keywords = dbData.keywords.filter((k) => k.id !== id);
      await writeJsonDb(dbData);
      return NextResponse.json({ status: "ok", keywords: dbData.keywords });
    }

    if (action === "save_draft") {
      const kicker = String(body.kicker || "").trim();
      const title = String(body.title || "").trim();
      const lead = String(body.lead || "").trim();
      const bodyText = String(body.body || "").trim();
      const sourceReferences = String(body.sourceReferences || "").trim();
      const nowIso = new Date().toISOString();

      if (dbData.drafts.length > 0) {
        dbData.drafts[0] = {
          ...dbData.drafts[0],
          kicker,
          title,
          lead,
          body: bodyText,
          sourceReferences,
          updatedAt: nowIso,
        };
      } else {
        dbData.drafts.push({
          id: 1,
          kicker,
          title,
          lead,
          body: bodyText,
          sourceReferences,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      await writeJsonDb(dbData);
      return NextResponse.json({ status: "ok", drafts: dbData.drafts });
    }

    return NextResponse.json(
      { status: "error", message: "عملیات نامعتبر است" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in POST /api/news:", error);
    return NextResponse.json(
      { status: "error", message: "خطا در پردازش درخواست" },
      { status: 500 }
    );
  }
}
