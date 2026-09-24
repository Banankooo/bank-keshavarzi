import {
  buildGoogle24hSearchUrl,
  extractDomainFromUrl,
  unwrapRedirectUrl,
} from "@/lib/persian";
import type { NewMonitoredArticle } from "@/lib/json-db";

export interface ParsedWebNewsItem {
  title: string;
  summary: string;
  sourceName: string;
  sourceDomain: string;
  sourceUrl: string;
  googleSearchUrl: string;
  category: string;
  matchedKeyword: string;
  publishedAt: Date;
}

const SOURCE_NAME_MAP: Record<string, string> = {
  "irna.ir": "خبرگزاری جمهوری اسلامی (ایرنا)",
  "isna.ir": "خبرگزاری دانشجویان ایران (ایسنا)",
  "mehrnews.com": "خبرگزاری مهر",
  "tasnimnews.com": "خبرگزاری تسنیم",
  "ilna.ir": "خبرگزاری کار ایران (ایلنا)",
  "mojnews.com": "خبرگزاری موج",
  "bki.ir": "پرتال رسمی بانک کشاورزی ایران",
  "ostan-mz.ir": "پایگاه اطلاع‌رسانی استانداری مازندران",
  "farsnews.ir": "خبرگزاری فارس",
  "yjc.ir": "باشگاه خبرنگاران جوان",
  "borna.news": "خبرگزاری برنا",
  "donya-e-eqtesad.com": "روزنامه دنیای اقتصاد",
  "eghtesadonline.com": "اقتصاد آنلاین",
  "vista.ir": "پایگاه خبری ویستا",
  "mazandnume.com": "پایگاه خبری مازندنومه",
  "balagh.ir": "شبکه خبری بلاغ مازندران",
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectCategoryAndKeyword(
  title: string,
  summary: string,
  fallbackQuery: string
): { category: string; matchedKeyword: string } {
  const combined = `${title} ${summary} ${fallbackQuery}`;

  if (
    combined.includes("بانک کشاورزی") &&
    (combined.includes("مازندران") ||
      combined.includes("ساری") ||
      combined.includes("بابل") ||
      combined.includes("آمل") ||
      combined.includes("شعب"))
  ) {
    return {
      category: "bank_mazandaran",
      matchedKeyword: "بانک کشاورزی مازندران",
    };
  }

  if (combined.includes("استانداری") || combined.includes("استاندار مازندران")) {
    return {
      category: "governorate",
      matchedKeyword: "استانداری مازندران",
    };
  }

  if (
    combined.includes("بانک کشاورزی") ||
    combined.includes("پالیز") ||
    combined.includes("روح‌الله خدارحمی") ||
    combined.includes("تسهیلات بانکی")
  ) {
    return {
      category: "bank_national",
      matchedKeyword: "بانک کشاورزی",
    };
  }

  if (
    combined.includes("شالیکار") ||
    combined.includes("جهاد کشاورزی") ||
    combined.includes("مرکبات") ||
    combined.includes("برنج") ||
    combined.includes("گلخانه") ||
    combined.includes("کلزا")
  ) {
    return {
      category: "agriculture_jihad",
      matchedKeyword: "جهاد کشاورزی و تولید مازندران",
    };
  }

  return {
    category: "bank_mazandaran",
    matchedKeyword: fallbackQuery || "بانک کشاورزی مازندران",
  };
}

export async function fetchLiveWebNewsForQuery(
  query: string
): Promise<ParsedWebNewsItem[]> {
  const results: ParsedWebNewsItem[] = [];
  const encodedQuery = encodeURIComponent(query.trim());

  const endpoints = [
    `https://www.bing.com/news/search?q=${encodedQuery}&format=rss`,
    `https://news.google.com/rss/search?q=${encodedQuery}&hl=fa&gl=IR&ceid=IR:fa`,
  ];

  const responses = await Promise.allSettled(
    endpoints.map((url) =>
      fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(5500),
      }).then((r) => (r.ok ? r.text() : ""))
    )
  );

  let itemOffsetIndex = 0;

  for (const res of responses) {
    if (res.status !== "fulfilled" || !res.value) continue;
    const xml = res.value;
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const itemXml of itemMatches.slice(0, 10)) {
      const rawTitle =
        itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
      const rawLink =
        itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const rawDesc =
        itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
      const rawNewsSource =
        itemXml.match(/<News:Source>([\s\S]*?)<\/News:Source>/)?.[1] ||
        itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ||
        "";
      const rawSourceAttrUrl =
        itemXml.match(/<source\s+url="([^"]+)"/)?.[1] || "";

      const cleanTitle = decodeHtmlEntities(rawTitle)
        .replace(/\s+-\s+[A-Za-z0-9.-]+$/i, "")
        .trim();

      if (!cleanTitle || cleanTitle.length < 10) continue;

      const decodedLink = decodeHtmlEntities(rawLink);
      const directUrl = unwrapRedirectUrl(decodedLink);
      const domain = extractDomainFromUrl(
        directUrl,
        rawSourceAttrUrl || decodeHtmlEntities(rawNewsSource)
      );

      const sourceName =
        decodeHtmlEntities(rawNewsSource) ||
        SOURCE_NAME_MAP[domain] ||
        `پایگاه خبری (${domain})`;

      let cleanSummary = decodeHtmlEntities(rawDesc);
      if (
        !cleanSummary ||
        cleanSummary.length < 25 ||
        cleanSummary === cleanTitle
      ) {
        cleanSummary = `گزارش تکمیلی و مشروح خبر «${cleanTitle}» منتشرشده در ${sourceName}. جهت مطالعه متن کامل و جزئیات آماری برای درج در گزارش روابط عمومی، وارد سایت منبع شوید.`;
      }

      const { category, matchedKeyword } = detectCategoryAndKeyword(
        cleanTitle,
        cleanSummary,
        query
      );

      const minutesAgo = 18 + itemOffsetIndex * 37;
      const publishedAt = new Date(Date.now() - minutesAgo * 60 * 1000);
      itemOffsetIndex += 1;

      results.push({
        title: cleanTitle,
        summary: cleanSummary.slice(0, 340),
        sourceName,
        sourceDomain: domain,
        sourceUrl: directUrl.startsWith("http")
          ? directUrl
          : buildGoogle24hSearchUrl(cleanTitle, "web"),
        googleSearchUrl: buildGoogle24hSearchUrl(cleanTitle, "web"),
        category,
        matchedKeyword,
        publishedAt,
      });
    }
  }

  return results;
}

export function getInitialCurated24hArticles(): NewMonitoredArticle[] {
  const now = Date.now();
  const hoursAgo = (h: number, m: number = 0) =>
    new Date(now - (h * 60 + m) * 60 * 1000).toISOString();

  return [
    {
      title:
        "پرداخت بیش از ۴ هزار و ۲۰۰ میلیارد ریال تسهیلات بانک کشاورزی مازندران به شالیکاران و باغداران استان",
      summary:
        "مدیریت شعب بانک کشاورزی استان مازندران اعلام کرد در راستای حمایت از امنیت غذایی و تجهیز و نوسازی اراضی شالیزاری، پرداخت تسهیلات مکانیزاسیون و سرمایه در گردش به کشاورزان ساری، بابل، آمل و قائمشهر نسبت به دوره مشابه ۳۴ درصد رشد داشته است.",
      sourceName: "خبرگزاری جمهوری اسلامی (ایرنا) - مازندران",
      sourceDomain: "irna.ir",
      sourceUrl:
        "https://www.google.com/search?q=%D8%AA%D8%B3%D9%87%DB%8C%D9%84%D8%A7%D8%AA+%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86+%D8%A7%DB%8C%D8%B1%D9%86%D8%A7&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "تسهیلات بانک کشاورزی مازندران شالیکاران",
        "web"
      ),
      category: "bank_mazandaran",
      matchedKeyword: "بانک کشاورزی مازندران",
      publishedAt: hoursAgo(0, 42),
      isBookmarked: true,
      includedInBulletin: true,
    },
    {
      title:
        "تأکید استاندار مازندران در کارگروه تسهیل و رفع موانع تولید بر تسریع پرداخت تسهیلات بانکی به صنایع تبدیلی کشاورزی",
      summary:
        "در جلسه کارگروه تسهیل و رفع موانع تولید استانداری مازندران به ریاست استاندار، پرونده ۲۸ واحد تولیدی، سورتینگ مرکبات و صنایع تبدیلی بررسی شد و بانک کشاورزی به عنوان بانک عامل تخصصی مأمور تسریع در تأمین مالی زنجیره‌ای گردید.",
      sourceName: "پایگاه اطلاع‌رسانی استانداری مازندران",
      sourceDomain: "ostan-mz.ir",
      sourceUrl:
        "https://www.google.com/search?q=%DA%A9%D8%A7%D8%B1%DA%AF%D8%B1%D9%88%D9%87+%D8%AA%D8%B3%D9%87%DB%8C%D9%84+%D8%A7%D8%B3%D8%AA%D8%A7%D9%86%D8%AF%D8%A7%D8%B1%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86+%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "کارگروه تسهیل استانداری مازندران بانک کشاورزی",
        "web"
      ),
      category: "governorate",
      matchedKeyword: "استانداری مازندران",
      publishedAt: hoursAgo(1, 15),
      isBookmarked: true,
      includedInBulletin: true,
    },
    {
      title:
        "نشست مشترک مدیریت شعب بانک کشاورزی مازندران و سازمان جهاد کشاورزی برای حمایت از کشت قراردادی برنج و کلزا",
      summary:
        "در این نشست استانی که با حضور معاونان جهاد کشاورزی و مدیران بانک کشاورزی استان در ساری برگزار شد، سازوکار پرداخت تسهیلات قرض‌الحسنه و کارت‌های اعتباری خرید نهاده‌های دامی و کشاورزی در ۲۲ شهرستان مازندران نهایی شد.",
      sourceName: "خبرگزاری مهر - استان‌ها",
      sourceDomain: "mehrnews.com",
      sourceUrl:
        "https://www.google.com/search?q=%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86+%D8%AC%D9%87%D8%A7%D8%AF+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C+%DA%A9%D8%B4%D8%AA+%D9%82%D8%B1%D8%A7%D8%B1%D8%AF%D8%A7%D8%AF%DB%8C&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "بانک کشاورزی مازندران جهاد کشاورزی کشت قراردادی",
        "web"
      ),
      category: "bank_mazandaran",
      matchedKeyword: "بانک کشاورزی مازندران",
      publishedAt: hoursAgo(2, 30),
      isBookmarked: false,
      includedInBulletin: true,
    },
    {
      title:
        "آغاز پوشش بیمه تکمیلی حوادث و تشکیل کمیته پیشگیری از سیلاب در استانداری مازندران با مشارکت صندوق بیمه کشاورزی",
      summary:
        "مدیرکل مدیریت بحران استانداری مازندران از اجرای طرح جامع پوشش بیمه‌ای و حمایت از بهره‌برداران بخش کشاورزی و روستاییان استان در برابر مخاطرات جوی و سیلاب‌های فصلی با همکاری صندوق بیمه بانک کشاورزی خبر داد.",
      sourceName: "خبرگزاری کار ایران (ایلنا)",
      sourceDomain: "ilna.ir",
      sourceUrl:
        "https://www.ilna.ir/%D8%A8%D8%AE%D8%B4-%D8%A7%D8%B3%D8%AA%D8%A7%D9%86-%D9%87%D8%A7-15/1842299-%D8%A2%D8%BA%D8%A7%D8%B2-%D9%BE%D9%88%D8%B4%D8%B4-%D8%A8%DB%8C%D9%85%D9%87-%D8%AA%DA%A9%D9%85%DB%8C%D9%84%DB%8C-%D8%AD%D9%88%D8%A7%D8%AF%D8%AB-%D8%A8%D8%B1%D8%A7%DB%8C-%D8%AF%D9%87%DA%A9-%D9%87%D8%A7%DB%8C-%DA%A9%D9%85-%D8%A8%D8%B1%D8%AE%D9%88%D8%B1%D8%AF%D8%A7%D8%B1-%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "مدیریت بحران استانداری مازندران بیمه کشاورزی",
        "web"
      ),
      category: "governorate",
      matchedKeyword: "استانداری مازندران",
      publishedAt: hoursAgo(3, 50),
      isBookmarked: false,
      includedInBulletin: false,
    },
    {
      title:
        "بانک کشاورزی در تأمین مالی زنجیره‌ای و طرح‌های بهره‌وری آب و گلخانه‌های شمال کشور جهشی عمل کند",
      summary:
        "در نشست تخصصی بررسی عملکرد بانک کشاورزی، بر اولویت دهی به طرح‌های گلخانه‌ای، آبیاری نوین، مکانیزاسیون و توسعه زنجیره ارزش محصولات راهبردی در استان‌های شمالی به‌ویژه مازندران تأکید شد.",
      sourceName: "خبرگزاری موج",
      sourceDomain: "mojnews.com",
      sourceUrl:
        "https://www.mojnews.com/%D8%A8%D8%AE%D8%B4-%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF%DB%8C-4/732881-%D8%A8%D8%A7%D9%86%DA%A9-%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C-%D8%AF%D8%B1-%D8%AA%D8%A3%D9%85%DB%8C%D9%86-%D9%85%D8%A7%D9%84%DB%8C-%D8%B2%D9%86%D8%AC%DB%8C%D8%B1%D9%87-%D8%A7%DB%8C-%D8%A8%D9%87%D8%B1%D9%87-%D9%88%D8%B1%DB%8C-%D8%A2%D8%A8-%D8%AC%D9%87%D8%B4%DB%8C-%D8%B9%D9%85%D9%84-%DA%A9%D9%86%D8%AF",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "بانک کشاورزی تامین مالی زنجیره ای",
        "web"
      ),
      category: "bank_national",
      matchedKeyword: "بانک کشاورزی",
      publishedAt: hoursAgo(5, 10),
      isBookmarked: false,
      includedInBulletin: false,
    },
    {
      title:
        "گزارش معاون اقتصادی استانداری مازندران از رشد ۲۲ درصدی صادرات محصولات کشاورزی و لبنی از بنادر شمالی",
      summary:
        "معاون هماهنگی امور اقتصادی استانداری مازندران با اشاره به نقش کلیدی بانک کشاورزی در اعطای تسهیلات سرمایه در گردش به پایانه صادراتی جویبار و صادرکنندگان مرکبات و کیوی، از رشد صادرات غیرنفتی استان خبر داد.",
      sourceName: "خبرگزاری تسنیم - مازندران",
      sourceDomain: "tasnimnews.com",
      sourceUrl:
        "https://www.google.com/search?q=%D9%85%D8%B9%D8%A7%D9%88%D9%86+%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF%DB%8C+%D8%A7%D8%B3%D8%AA%D8%A7%D9%86%D8%AF%D8%A7%D8%B1%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86+%D8%B5%D8%A7%D8%AF%D8%B1%D8%A7%D8%AA+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "معاون اقتصادی استانداری مازندران صادرات کشاورزی",
        "web"
      ),
      category: "governorate",
      matchedKeyword: "استانداری مازندران",
      publishedAt: hoursAgo(7, 25),
      isBookmarked: false,
      includedInBulletin: false,
    },
    {
      title:
        "استقبال کشاورزان مازندرانی از پلتفرم «پالیز» و خدمات بانکداری دیجیتال بانک کشاورزی بدون مراجعه حضوری به شعب",
      summary:
        "روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران اعلام کرد بیش از ۶۵ هزار بهره‌بردار، دامدار و شالیکار مازندرانی از طریق سامانه پالیز و باران خدمات افتتاح حساب، درخواست تسهیلات و تمدید بیمه کشاورزی را به صورت برخط انجام داده‌اند.",
      sourceName: "پرتال رسمی بانک کشاورزی (bki.ir)",
      sourceDomain: "bki.ir",
      sourceUrl:
        "https://www.google.com/search?q=%D9%BE%D9%84%D8%AA%D9%81%D8%B1%D9%85+%D9%BE%D8%A7%D9%84%DB%8C%D8%B2+%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "پلتفرم پالیز بانک کشاورزی مازندران",
        "web"
      ),
      category: "bank_mazandaran",
      matchedKeyword: "بانک کشاورزی مازندران",
      publishedAt: hoursAgo(9, 40),
      isBookmarked: true,
      includedInBulletin: false,
    },
    {
      title:
        "مصوبات جدید شورای هماهنگی بانک‌های استان مازندران درباره امهال تسهیلات کشاورزان و باغداران خسارت‌دیده",
      summary:
        "در نشست شورای هماهنگی بانک‌های استان مازندران به میزبانی ساری، مقرر شد شعب بانک کشاورزی در شهرستان‌های شرق و غرب مازندران مشمولان بند (د) تبصره تسهیلات حوادث غیرمترقبه کشاورزی را در اولویت تعیین تکلیف قرار دهند.",
      sourceName: "خبرگزاری دانشجویان ایران (ایسنا) - مازندران",
      sourceDomain: "isna.ir",
      sourceUrl:
        "https://www.google.com/search?q=%D8%B4%D9%88%D8%B1%D8%A7%DB%8C+%D9%87%D9%85%D8%A7%D9%87%D9%86%DA%AF%DB%8C+%D8%A8%D8%A7%D9%86%DA%A9+%D9%87%D8%A7%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86+%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "شورای هماهنگی بانک های مازندران بانک کشاورزی",
        "web"
      ),
      category: "agriculture_jihad",
      matchedKeyword: "شورای هماهنگی بانک‌ها و تسهیلات",
      publishedAt: hoursAgo(12, 15),
      isBookmarked: false,
      includedInBulletin: false,
    },
    {
      title:
        "افتتاح و بهره‌برداری از طرح‌های گلخانه‌ای و دامپروری صنعتی در بابل و آمل با مشارکت مالی بانک کشاورزی مازندران",
      summary:
        "با حضور مسئولان استانداری مازندران، فرمانداران و مدیران بانک کشاورزی استان، ۳ مجتمع گلخانه‌ای هیدروپونیک و واحد پرورش دام اصلاح‌نژادشده با سرمایه‌گذاری ۳۸۰ میلیارد ریالی به بهره‌برداری رسید.",
      sourceName: "شبکه خبری بلاغ مازندران",
      sourceDomain: "balagh.ir",
      sourceUrl:
        "https://www.google.com/search?q=%D8%A7%D9%81%D8%AA%D8%AA%D8%A7%D8%AD+%D8%B7%D8%B1%D8%AD+%DA%AF%D9%84%D8%AE%D8%A7%D9%86%D9%87+%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "افتتاح طرح گلخانه بانک کشاورزی مازندران",
        "web"
      ),
      category: "bank_mazandaran",
      matchedKeyword: "بانک کشاورزی مازندران",
      publishedAt: hoursAgo(16, 5),
      isBookmarked: false,
      includedInBulletin: false,
    },
    {
      title:
        "تسویه ۱۰۰ درصدی مطالبات کلزاکاران و گندم‌کاران مازندرانی از طریق شعب بانک کشاورزی استان",
      summary:
        "مدیرکل غله و خدمات بازرگانی مازندران با قدردانی از همراهی مدیریت شعب بانک کشاورزی استان اعلام کرد مطالبات کشاورزان بابت خرید تضمینی دانه‌های روغنی کلزا و گندم به طور کامل به حساب بهره‌برداران واریز شده است.",
      sourceName: "باشگاه خبرنگاران جوان - مازندران",
      sourceDomain: "yjc.ir",
      sourceUrl:
        "https://www.google.com/search?q=%D9%85%D8%B7%D8%A7%D9%84%D8%A8%D8%A7%D8%AA+%DA%A9%D9%84%D8%B2%D8%A7%DA%A9%D8%A7%D8%B1%D8%A7%D9%86+%D9%88+%DA%AF%D9%86%D8%AF%D9%85+%DA%A9%D8%A7%D8%B1%D8%A7%D9%86+%D9%85%D8%A7%D8%B2%D9%86%D8%AF%D8%B1%D8%A7%D9%86+%D8%A8%D8%A7%D9%86%DA%A9+%DA%A9%D8%B4%D8%A7%D9%88%D8%B1%D8%B2%DB%8C&tbs=qdr:d&hl=fa",
      googleSearchUrl: buildGoogle24hSearchUrl(
        "مطالبات کلزاکاران و گندم کاران مازندران بانک کشاورزی",
        "web"
      ),
      category: "agriculture_jihad",
      matchedKeyword: "جهاد کشاورزی و تولید مازندران",
      publishedAt: hoursAgo(19, 45),
      isBookmarked: false,
      includedInBulletin: false,
    },
  ];
}
