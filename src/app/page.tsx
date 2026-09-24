import React from "react";
import { readJsonDb } from "@/lib/json-db";
import NewsPortalClient from "@/components/NewsPortalClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dbData = await readJsonDb();

  return (
    <NewsPortalClient
      initialArticles={dbData.articles}
      initialKeywords={dbData.keywords}
      initialDraft={dbData.drafts[0] || null}
    />
  );
}
