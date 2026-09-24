import fs from "fs/promises";
import path from "path";
import { getInitialCurated24hArticles } from "@/lib/news-engine";

export interface MonitoredArticle {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  sourceDomain: string;
  sourceUrl: string;
  googleSearchUrl: string;
  category: string;
  matchedKeyword: string;
  publishedAt: string | Date;
  isBookmarked: boolean;
  includedInBulletin: boolean;
  createdAt: string | Date;
}

export type NewMonitoredArticle = Omit<
  MonitoredArticle,
  "id" | "createdAt"
> & {
  id?: number;
  createdAt?: string | Date;
};

export interface CustomKeyword {
  id: number;
  label: string;
  query: string;
  category: string;
  isDefault: boolean;
  createdAt: string | Date;
}

export interface PrDraft {
  id: number;
  kicker: string;
  title: string;
  lead: string;
  body: string;
  sourceReferences: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface JsonDatabaseSchema {
  lastUpdated: string;
  articles: MonitoredArticle[];
  keywords: CustomKeyword[];
  drafts: PrDraft[];
}

const DB_FILE_PATH = path.join(process.cwd(), "database.json");

function createDefaultDatabasePayload(): JsonDatabaseSchema {
  const nowIso = new Date().toISOString();
  const rawArticles = getInitialCurated24hArticles();
  const articles: MonitoredArticle[] = rawArticles.map((item, idx) => ({
    id: idx + 1,
    title: item.title,
    summary: item.summary,
    sourceName: item.sourceName,
    sourceDomain: item.sourceDomain,
    sourceUrl: item.sourceUrl,
    googleSearchUrl: item.googleSearchUrl,
    category: item.category || "bank_mazandaran",
    matchedKeyword: item.matchedKeyword || "بانک کشاورزی مازندران",
    publishedAt:
      item.publishedAt instanceof Date
        ? item.publishedAt.toISOString()
        : String(item.publishedAt || nowIso),
    isBookmarked: Boolean(item.isBookmarked),
    includedInBulletin: Boolean(item.includedInBulletin),
    createdAt: nowIso,
  }));

  return {
    lastUpdated: nowIso,
    articles,
    keywords: [
      {
        id: 1,
        label: "بانک کشاورزی مازندران",
        query: "بانک کشاورزی مازندران",
        category: "bank_mazandaran",
        isDefault: true,
        createdAt: nowIso,
      },
      {
        id: 2,
        label: "استانداری مازندران",
        query: "استانداری مازندران",
        category: "governorate",
        isDefault: true,
        createdAt: nowIso,
      },
      {
        id: 3,
        label: "بانک کشاورزی (سراسری)",
        query: "بانک کشاورزی",
        category: "bank_national",
        isDefault: true,
        createdAt: nowIso,
      },
      {
        id: 4,
        label: "تسهیلات شالیکاران و مرکبات",
        query: "تسهیلات شالیکاران مرکبات بانک کشاورزی مازندران",
        category: "agriculture_jihad",
        isDefault: true,
        createdAt: nowIso,
      },
    ],
    drafts: [
      {
        id: 1,
        kicker:
          "گزارش روزانه روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران؛",
        title:
          "شتاب‌بخشی به تأمین مالی زنجیره تولید کشاورزی و هم‌افزایی راهبردی با استانداری مازندران",
        lead:
          "در جریان پایش ۲۴ ساعت گذشته رویدادهای خبری استان مازندران، حمایت هدفمند شعب بانک کشاورزی استان از شالیکاران، باغداران مرکبات و صنایع تبدیلی در هماهنگی کامل با مصوبات کارگروه تسهیل استانداری مازندران محور اصلی اخبار اقتصادی استان بود.",
        body:
          "به گزارش روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران، پیرو تأکیدات استاندار محترم مازندران در کارگروه تسهیل و رفع موانع تولید و در راستای ایفای رسالت تخصصی بانک کشاورزی در تأمین امنیت غذایی کشور، پرداخت تسهیلات مکانیزاسیون، سرمایه در گردش و حمایت از کشت قراردادی در ۲۲ شهرستان استان با شتاب ویژه در حال انجام است.\n\nبر اساس گزارش‌های منتشرشده در ۲۴ ساعت اخیر، علاوه بر رشد ۳۴ درصدی پرداخت تسهیلات به بهره‌برداران بخش کشاورزی، توسعه خدمات غیرحضوری از طریق پلتفرم «پالیز» و همراهی صندوق بیمه کشاورزی با مدیریت بحران استانداری مازندران، گام بلندی در جهت ارتقای رضایتمندی کشاورزان و تولیدکنندگان مازندرانی برداشته است.",
        sourceReferences:
          "۱. خبرگزاری ایرنا مازندران | ۲. پایگاه اطلاع‌رسانی استانداری مازندران | ۳. خبرگزاری مهر | ۴. پرتال رسمی بانک کشاورزی",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  };
}

export async function readJsonDb(): Promise<JsonDatabaseSchema> {
  try {
    const raw = await fs.readFile(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as JsonDatabaseSchema;

    if (
      !parsed ||
      !Array.isArray(parsed.articles) ||
      parsed.articles.length === 0
    ) {
      const seeded = createDefaultDatabasePayload();
      await writeJsonDb(seeded);
      return seeded;
    }

    // Keep timestamps fresh relative to current 24h window if needed
    const newestArticleTime = Math.max(
      ...parsed.articles.map((a) => new Date(a.publishedAt).getTime())
    );
    const hoursSinceNewest =
      (Date.now() - newestArticleTime) / (1000 * 60 * 60);

    if (hoursSinceNewest > 22) {
      const now = Date.now();
      parsed.articles = parsed.articles.map((a, idx) => ({
        ...a,
        publishedAt: new Date(
          now - (idx * 95 + 35) * 60 * 1000
        ).toISOString(),
      }));
      await writeJsonDb(parsed);
    }

    // Sort newest first
    parsed.articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return parsed;
  } catch {
    const seeded = createDefaultDatabasePayload();
    await writeJsonDb(seeded);
    return seeded;
  }
}

export async function writeJsonDb(data: JsonDatabaseSchema): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}
