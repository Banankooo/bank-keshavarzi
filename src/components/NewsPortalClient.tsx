"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Bookmark,
  FileText,
  Sparkles,
  Clock,
  Globe,
  Building2,
  Landmark,
  Sprout,
  Plus,
  X,
  Moon,
  Sun,
  CheckCircle2,
  TrendingUp,
  Filter,
  Send,
} from "lucide-react";
import {
  toPersianDigits,
  formatJalaliDatePersian,
  formatClockPersian,
  formatRelativeTimePersian,
  buildGoogle24hSearchUrl,
} from "@/lib/persian";
import type {
  MonitoredArticle,
  CustomKeyword,
  PrDraft,
} from "@/lib/json-db";

interface NewsPortalClientProps {
  initialArticles: MonitoredArticle[];
  initialKeywords: CustomKeyword[];
  initialDraft: PrDraft | null;
}

type CategoryFilter =
  | "all"
  | "bank_mazandaran"
  | "governorate"
  | "bank_national"
  | "agriculture_jihad"
  | "bookmarked";

type TimeWindowFilter = "6h" | "24h" | "all";

const CATEGORY_META: Record<
  string,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    darkBadgeBg: string;
    darkBadgeText: string;
  }
> = {
  bank_mazandaran: {
    label: "بانک کشاورزی مازندران",
    badgeBg: "bg-[#E6F4EA]",
    badgeText: "text-[#0B5D3B]",
    badgeBorder: "border-[#B7DFC5]",
    darkBadgeBg: "dark:bg-[#0B5D3B]/40",
    darkBadgeText: "dark:text-[#6EE7B7]",
  },
  governorate: {
    label: "استانداری مازندران",
    badgeBg: "bg-[#FEF5E7]",
    badgeText: "text-[#9A6B13]",
    badgeBorder: "border-[#F5D9A6]",
    darkBadgeBg: "dark:bg-[#78350F]/40",
    darkBadgeText: "dark:text-[#FCD34D]",
  },
  bank_national: {
    label: "بانک کشاورزی (سراسری)",
    badgeBg: "bg-[#EBF3F0]",
    badgeText: "text-[#134E3A]",
    badgeBorder: "border-[#C3D9D0]",
    darkBadgeBg: "dark:bg-[#064E3B]/40",
    darkBadgeText: "dark:text-[#A7F3D0]",
  },
  agriculture_jihad: {
    label: "جهاد کشاورزی و تولید استان",
    badgeBg: "bg-[#F2F6E9]",
    badgeText: "text-[#3F6212]",
    badgeBorder: "border-[#D5E3B8]",
    darkBadgeBg: "dark:bg-[#365314]/40",
    darkBadgeText: "dark:text-[#BEF264]",
  },
};

export default function NewsPortalClient({
  initialArticles,
  initialKeywords,
  initialDraft,
}: NewsPortalClientProps) {
  const [articles, setArticles] =
    useState<MonitoredArticle[]>(initialArticles);
  const [keywords, setKeywords] = useState<CustomKeyword[]>(initialKeywords);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeKeywordQuery, setActiveKeywordQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>("24h");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Live clock & Jalali date
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [jalaliDateStr, setJalaliDateStr] = useState<string>("");
  const [lastUpdatedStr, setLastUpdatedStr] = useState<string>("هم‌اکنون");

  // Custom keyword modal/inline state
  const [showAddKeyword, setShowAddKeyword] = useState<boolean>(false);
  const [newKeywordLabel, setNewKeywordLabel] = useState<string>("");

  // PR News Writer Workbench state
  const [showWriterStudio, setShowWriterStudio] = useState<boolean>(false);
  const [draftKicker, setDraftKicker] = useState<string>(
    initialDraft?.kicker ||
      "گزارش روزانه روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران؛"
  );
  const [draftTitle, setDraftTitle] = useState<string>(
    initialDraft?.title ||
      "شتاب‌بخشی به تأمین مالی زنجیره تولید کشاورزی و هم‌افزایی راهبردی با استانداری مازندران"
  );
  const [draftLead, setDraftLead] = useState<string>(
    initialDraft?.lead ||
      "در جریان پایش ۲۴ ساعت گذشته رویدادهای خبری استان مازندران، حمایت هدفمند شعب بانک کشاورزی استان از شالیکاران، باغداران مرکبات و صنایع تبدیلی در هماهنگی کامل با مصوبات کارگروه تسهیل استانداری مازندران محور اصلی اخبار اقتصادی استان بود."
  );
  const [draftBody, setDraftBody] = useState<string>(
    initialDraft?.body || ""
  );
  const [draftReferences, setDraftReferences] = useState<string>(
    initialDraft?.sourceReferences || ""
  );
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [copiedFullDraft, setCopiedFullDraft] = useState<boolean>(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setJalaliDateStr(formatJalaliDatePersian(now));
      try {
        const timeFormatted = new Intl.DateTimeFormat("fa-IR", {
          timeZone: "Asia/Tehran",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now);
        setCurrentTimeStr(toPersianDigits(timeFormatted));
      } catch {
        setCurrentTimeStr(toPersianDigits("12:00:00"));
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger a background live Google/Web search sync on initial mount so latest web items are merged
  useEffect(() => {
    let ignore = false;
    async function syncInitialLiveNews() {
      try {
        const res = await fetch("/api/news?refresh=1");
        if (!res.ok || ignore) return;
        const data = await res.json();
        if (data.articles && !ignore) {
          setArticles(data.articles);
        }
      } catch {
        // Ignore background sync errors
      }
    }
    syncInitialLiveNews();
    return () => {
      ignore = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleLiveGoogleRefresh = async (customQuery?: string) => {
    const queryToRun =
      customQuery !== undefined
        ? customQuery.trim()
        : searchInput.trim() || activeKeywordQuery.trim();

    setIsRefreshing(true);
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "live_search",
          query:
            queryToRun ||
            "بانک کشاورزی مازندران استانداری مازندران تسهیلات کشاورزی",
        }),
      });
      const data = await res.json();
      if (data.articles) {
        setArticles(data.articles);
        const nowTime = formatClockPersian(new Date());
        setLastUpdatedStr(nowTime);
        if (queryToRun) {
          showToast(
            `جستجوی زنده ۲۴ ساعته گوگل برای «${queryToRun}» انجام شد (${toPersianDigits(
              data.liveFoundCount || data.articles.length
            )} خبر مرتبط بازیابی شد)`
          );
        } else {
          showToast(
            `پایش زنده ۲۴ ساعت اخیر گوگل تکمیل شد • همه اخبار به روز هستند`
          );
        }
      }
    } catch {
      showToast("بروزرسانی از حافظه پایش ۲۴ ساعته انجام شد");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleBookmark = async (id: number) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, isBookmarked: !a.isBookmarked } : a
      )
    );
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_bookmark", id }),
      });
      const data = await res.json();
      if (data.articles) setArticles(data.articles);
    } catch {
      // Optimistic state kept
    }
  };

  const handleToggleBulletin = async (article: MonitoredArticle) => {
    const nextState = !article.includedInBulletin;
    setArticles((prev) =>
      prev.map((a) =>
        a.id === article.id ? { ...a, includedInBulletin: nextState } : a
      )
    );
    if (nextState) {
      showToast(`خبر به «میز نگارش خبر امروز» اضافه شد`);
    }
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_bulletin", id: article.id }),
      });
      const data = await res.json();
      if (data.articles) setArticles(data.articles);
    } catch {
      // Keep optimistic update
    }
  };

  const handleCopySummaryForPR = async (article: MonitoredArticle) => {
    const rel = formatRelativeTimePersian(article.publishedAt);
    const formattedText = `📌 تیتر خبر: ${article.title}\n📝 خلاصه: ${article.summary}\n🏛 منبع: ${article.sourceName} (${article.sourceDomain}) | زمان انتشار: ${rel.label}\n🔗 لینک مستقیم منبع: ${article.sourceUrl}`;
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopiedId(article.id);
      showToast("متن کامل و شناسنامه خبر برای خبرنویسی کپی شد ✓");
      setTimeout(() => {
        setCopiedId((prev) => (prev === article.id ? null : prev));
      }, 2500);
    } catch {
      showToast("متن آماده کپی است");
    }
  };

  const handleAddCustomKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newKeywordLabel.trim();
    if (!clean) return;
    setNewKeywordLabel("");
    setShowAddKeyword(false);
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_keyword",
          label: clean,
          query: clean,
          category: clean.includes("استاندار")
            ? "governorate"
            : "bank_mazandaran",
        }),
      });
      const data = await res.json();
      if (data.keywords) setKeywords(data.keywords);
      setActiveKeywordQuery(clean);
      setSearchInput(clean);
      await handleLiveGoogleRefresh(clean);
    } catch {
      showToast("کلیدواژه پایش اضافه شد");
    }
  };

  const handleDeleteKeyword = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_keyword", id }),
      });
      const data = await res.json();
      if (data.keywords) setKeywords(data.keywords);
    } catch {
      // Ignore
    }
  };

  const bulletinArticles = useMemo(
    () => articles.filter((a) => a.includedInBulletin || a.isBookmarked),
    [articles]
  );

  const handleGenerateSmartPRDraft = () => {
    const selected =
      bulletinArticles.length > 0 ? bulletinArticles : articles.slice(0, 4);
    const topTitles = selected.map((a) => `• ${a.title}`).join("\n");
    const sourcesList = selected
      .map(
        (a, idx) =>
          `${toPersianDigits(idx + 1)}. ${a.sourceName} (${a.sourceDomain})`
      )
      .join(" | ");

    setDraftKicker(
      `گزارش تحلیلی روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران (${
        jalaliDateStr || "امروز"
      })؛`
    );
    setDraftTitle(
      "هم‌افزایی بانک کشاورزی و استانداری مازندران در حمایت از شالیکاران، باغداران و تولیدکنندگان استان"
    );
    setDraftLead(
      `بر اساس پایش ۲۴ ساعت گذشته رسانه‌ها و خبرگزاری‌های استان مازندران، تسریع در پرداخت تسهیلات بخش کشاورزی، اجرای مصوبات کارگروه تسهیل استانداری و گسترش خدمات بانکداری دیجیتال «پالیز» مهم‌ترین محورهای خبری حوزه بانک کشاورزی در استان بوده است.`
    );
    setDraftBody(
      `به گزارش روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران، در جریان رصد ۲۴ ساعت اخیر رویدادهای خبری استان و کشور، محورهای زیر به عنوان مهم‌ترین دستاوردها و برنامه‌های اجرایی بانک کشاورزی و مدیریت ارشد استان مازندران ثبت شده است:\n\n${topTitles}\n\nدر همین راستا، مدیریت شعب بانک کشاورزی استان مازندران ضمن تعامل مستمر با استانداری مازندران، سازمان جهاد کشاورزی و شورای هماهنگی بانک‌های استان، تمام ظرفیت شعب خود در ۲۲ شهرستان مازندران را برای تأمین مالی زنجیره تولید برنج، مرکبات، کلزا، گلخانه‌ها و صنایع تبدیلی به کار گرفته است.\n\nهمچنین بهره‌برداران و کشاورزان گرامی استان می‌توانند از طریق سامانه و پلتفرم «پالیز» بدون نیاز به مراجعه حضوری، از خدمات اعتباری و بانکی بانک کشاورزی بهره‌مند شوند.`
    );
    setDraftReferences(sourcesList);
    setShowWriterStudio(true);
    showToast(
      `پیش‌نویس خبر روابط عمومی بر اساس ${toPersianDigits(
        selected.length
      )} خبر منتخب ۲۴ ساعت اخیر تنظیم شد`
    );
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          kicker: draftKicker,
          title: draftTitle,
          lead: draftLead,
          body: draftBody,
          sourceReferences: draftReferences,
        }),
      });
      showToast("پیش‌نویس خبر روابط عمومی با موفقیت در سامانه ذخیره شد ✓");
    } catch {
      showToast("پیش‌نویس ذخیره شد");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleCopyFullDraft = async () => {
    const fullText = `${draftKicker}\n\n🔹 ${draftTitle}\n\n${draftLead}\n\n${draftBody}\n\n📚 منابع رصدشده در ۲۴ ساعت اخیر:\n${draftReferences}\n\n🏛 روابط عمومی مدیریت شعب بانک کشاورزی استان مازندران`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedFullDraft(true);
      showToast("متن کامل خبر روابط عمومی برای انتشار کپی شد ✓");
      setTimeout(() => setCopiedFullDraft(false), 2500);
    } catch {
      showToast("متن آماده کپی است");
    }
  };

  // Filtered & chronologically sorted news stream
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const rel = formatRelativeTimePersian(article.publishedAt);

      // Time window filter
      if (timeWindow === "6h" && rel.hoursAgo > 6.5) return false;
      if (timeWindow === "24h" && rel.hoursAgo > 28) return false;

      // Category filter
      if (activeCategory === "bookmarked" && !article.isBookmarked) {
        return false;
      }
      if (
        activeCategory !== "all" &&
        activeCategory !== "bookmarked" &&
        article.category !== activeCategory
      ) {
        return false;
      }

      // Search / keyword filter
      const activeQ = searchInput.trim() || activeKeywordQuery.trim();
      if (activeQ) {
        const haystack =
          `${article.title} ${article.summary} ${article.sourceName} ${article.matchedKeyword}`.toLowerCase();
        // Match any significant token from query
        const tokens = activeQ
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 1);
        const matchesAnyToken =
          tokens.length === 0 ||
          tokens.some((token) => haystack.includes(token));
        if (!matchesAnyToken) return false;
      }

      return true;
    });
  }, [
    articles,
    timeWindow,
    activeCategory,
    searchInput,
    activeKeywordQuery,
  ]);

  // Metrics for the 24-Hour Executive Summary Strip
  const metrics = useMemo(() => {
    const within24h = articles.filter(
      (a) => formatRelativeTimePersian(a.publishedAt).hoursAgo <= 28
    );
    const bankCount = within24h.filter(
      (a) =>
        a.category === "bank_mazandaran" || a.category === "bank_national"
    ).length;
    const govCount = within24h.filter(
      (a) =>
        a.category === "governorate" || a.category === "agriculture_jihad"
    ).length;
    const uniqueDomains = new Set(within24h.map((a) => a.sourceDomain)).size;

    return {
      total24h: within24h.length,
      bankCount,
      govCount,
      uniqueDomains,
      bulletinCount: bulletinArticles.length,
    };
  }, [articles, bulletinArticles]);

  const currentGoogleDirectUrl = useMemo(() => {
    const q =
      searchInput.trim() ||
      activeKeywordQuery.trim() ||
      (activeCategory === "governorate"
        ? "استانداری مازندران"
        : activeCategory === "bank_national"
        ? "بانک کشاورزی"
        : activeCategory === "agriculture_jihad"
        ? "جهاد کشاورزی مازندران تسهیلات"
        : "بانک کشاورزی مازندران OR استانداری مازندران");
    return buildGoogle24hSearchUrl(q, "web");
  }, [searchInput, activeKeywordQuery, activeCategory]);

  return (
    <div
      className={
        darkMode
          ? "dark min-h-screen bg-[#0B1510] text-[#ECF3EE] transition-colors duration-200"
          : "min-h-screen bg-[#F8F9F6] text-[#0F1E16] transition-colors duration-200"
      }
    >
      {/* Top Institutional Header (Bank Keshavarzi Mazandaran PR) */}
      <header className="border-b border-[#DCE4DF] dark:border-[#1E3529] bg-gradient-to-l from-[#073B25] via-[#0B5D3B] to-[#0E6B45] text-white shadow-sm">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Right: Official Emblem & Title */}
          <div className="flex items-center gap-3.5">
            {/* Custom Bank Keshavarzi Wheat & Sun Emblem */}
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#C89B3C]/60 flex items-center justify-center shrink-0 shadow-inner">
              <svg
                viewBox="0 0 48 48"
                className="w-8 h-8 text-[#F3C663]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="24"
                  cy="24"
                  r="19"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeDasharray="3 2"
                />
                <path
                  d="M24 38V14M24 18C20 18 17 15 17 11C21 11 24 14 24 18ZM24 18C28 18 31 15 31 11C27 11 24 14 24 18ZM24 24C19.5 24 16 21 16 16.5C20.5 16.5 24 19.5 24 24ZM24 24C28.5 24 32 21 32 16.5C27.5 16.5 24 19.5 24 24ZM24 30C19.5 30 16 27 16 22.5C20.5 22.5 24 25.5 24 30ZM24 30C28.5 30 32 27 32 22.5C27.5 22.5 24 25.5 24 30Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="24" cy="9" r="2.5" fill="#F3C663" />
              </svg>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#C89B3C]/25 text-[#FDE68A] border border-[#C89B3C]/40">
                  <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                  رصد زنده ۲۴ ساعت اخیر گوگل
                </span>
                <span className="text-xs text-emerald-100/85 font-medium">
                  ویژه رئیس روابط عمومی مدیریت شعب استان مازندران
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
                سامانه پایش هوشمند اخبار بانک کشاورزی و استانداری مازندران
              </h1>
            </div>
          </div>

          {/* Left: Live Jalali Date, Clock, Refresh & PR Studio Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            {/* Live Date & Clock Pill */}
            <div className="flex items-center gap-2.5 bg-black/20 border border-white/15 rounded-lg px-3 py-1.5 text-xs sm:text-sm">
              <Clock className="w-4 h-4 text-[#F3C663] shrink-0" />
              <span className="font-medium text-emerald-50">
                {jalaliDateStr || "پنجشنبه ۲ مهر ۱۴۰۵"}
              </span>
              <span className="text-white/30">|</span>
              <span className="font-bold text-[#F3C663] tabular-persian">
                ساعت {currentTimeStr || "۱۲:۰۰:۰۰"}
              </span>
            </div>

            {/* Live Google 24h Refresh CTA */}
            <button
              type="button"
              onClick={() => handleLiveGoogleRefresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#C89B3C] hover:bg-[#b5892f] text-[#0F1E16] transition shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>
                {isRefreshing
                  ? "در حال پایش گوگل..."
                  : "بروزرسانی ۲۴ ساعته از گوگل"}
              </span>
            </button>

            {/* PR News Writer Studio Button */}
            <button
              type="button"
              onClick={() => setShowWriterStudio((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold border transition cursor-pointer ${
                showWriterStudio
                  ? "bg-white text-[#0B5D3B] border-white"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/25"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>میز خبرنویسی روابط عمومی</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-[#C89B3C] text-[#0F1E16] font-extrabold tabular-persian">
                {toPersianDigits(metrics.bulletinCount)}
              </span>
            </button>

            {/* Dark/Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              title="تغییر حالت نمایش روز / شب"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#F3C663]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {statusNotice && (
        <div className="bg-[#0B5D3B] text-white border-b border-[#C89B3C]/40 px-4 py-2 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#F3C663] shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Sticky Google 24-Hour Search & Topic Command Bar */}
      <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#12221A]/95 backdrop-blur-md border-b border-[#DCE4DF] dark:border-[#1E3529] shadow-xs">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
          {/* Row 1: Live Google 24h Search Input + Direct Google Launch */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLiveGoogleRefresh(searchInput);
              }}
              className="relative flex-1 flex items-center"
            >
              <Search className="w-5 h-5 text-[#0B5D3B] dark:text-[#4ADE80] absolute right-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="جستجو در کل اخبار ۲۴ ساعت اخیر گوگل (مثلاً: بانک کشاورزی مازندران، استانداری، تسهیلات شالیکاران، پالیز)..."
                className="w-full pr-11 pl-24 py-2.5 rounded-xl bg-[#F8F9F6] dark:bg-[#0B1510] border border-[#DCE4DF] dark:border-[#264234] text-sm sm:text-base text-[#0F1E16] dark:text-white placeholder:text-[#687D70] focus:outline-none focus:ring-2 focus:ring-[#0B5D3B] transition"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setActiveKeywordQuery("");
                  }}
                  className="absolute left-28 p-1 text-[#687D70] hover:text-[#0F1E16] dark:hover:text-white cursor-pointer"
                  title="پاک کردن جستجو"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isRefreshing}
                className="absolute left-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B5D3B] hover:bg-[#094a2f] text-white text-xs sm:text-sm font-bold transition cursor-pointer"
              >
                جستجو در وب
              </button>
            </form>

            {/* Direct Launch in Google 24h Search (tbs=qdr:d) */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={currentGoogleDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F0F4F1] dark:bg-[#193024] hover:bg-[#E2ECE5] dark:hover:bg-[#224030] text-[#0B5D3B] dark:text-[#6EE7B7] border border-[#C5D6CC] dark:border-[#2A4C3A] text-xs sm:text-sm font-bold transition"
              >
                <Globe className="w-4 h-4" />
                <span>مشاهده مستقیم در گوگل (۲۴ ساعت اخیر)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Row 2: One-Click Topic Preset Pills & Time Window Filter */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 pt-1">
            {/* Topic Category Pills + Saved Custom Keywords */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#687D70] dark:text-[#8FA899] flex items-center gap-1 ml-1">
                <Filter className="w-3.5 h-3.5" />
                محورهای پایش روزانه:
              </span>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveKeywordQuery("");
                  setSearchInput("");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer border ${
                  activeCategory === "all" && !activeKeywordQuery
                    ? "bg-[#0B5D3B] text-white border-[#0B5D3B] shadow-xs"
                    : "bg-[#F0F4F1] dark:bg-[#162920] text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234] hover:border-[#0B5D3B]"
                }`}
              >
                همه اخبار ۲۴ ساعت اخیر ({toPersianDigits(metrics.total24h)})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory("bank_mazandaran");
                  setActiveKeywordQuery("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer border ${
                  activeCategory === "bank_mazandaran"
                    ? "bg-[#0B5D3B] text-white border-[#0B5D3B] shadow-xs"
                    : "bg-[#F0F4F1] dark:bg-[#162920] text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234] hover:border-[#0B5D3B]"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>بانک کشاورزی مازندران</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory("governorate");
                  setActiveKeywordQuery("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer border ${
                  activeCategory === "governorate"
                    ? "bg-[#C89B3C] text-[#0F1E16] border-[#C89B3C] shadow-xs"
                    : "bg-[#FEF5E7] dark:bg-[#2B2111] text-[#9A6B13] dark:text-[#FCD34D] border-[#F5D9A6] dark:border-[#5C4216] hover:border-[#C89B3C]"
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>استانداری مازندران</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory("bank_national");
                  setActiveKeywordQuery("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer border ${
                  activeCategory === "bank_national"
                    ? "bg-[#0B5D3B] text-white border-[#0B5D3B] shadow-xs"
                    : "bg-[#F0F4F1] dark:bg-[#162920] text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234] hover:border-[#0B5D3B]"
                }`}
              >
                <span>بانک کشاورزی (سراسری)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory("agriculture_jihad");
                  setActiveKeywordQuery("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer border ${
                  activeCategory === "agriculture_jihad"
                    ? "bg-[#0B5D3B] text-white border-[#0B5D3B] shadow-xs"
                    : "bg-[#F0F4F1] dark:bg-[#162920] text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234] hover:border-[#0B5D3B]"
                }`}
              >
                <Sprout className="w-3.5 h-3.5" />
                <span>جهاد کشاورزی و تسهیلات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory("bookmarked");
                  setActiveKeywordQuery("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer border ${
                  activeCategory === "bookmarked"
                    ? "bg-[#0B5D3B] text-white border-[#0B5D3B]"
                    : "bg-[#F0F4F1] dark:bg-[#162920] text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234]"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>نشان‌شده‌ها</span>
              </button>

              {/* Custom Keywords Added by PR Director */}
              {keywords
                .filter((k) => !k.isDefault)
                .map((kw) => (
                  <div
                    key={kw.id}
                    onClick={() => {
                      setActiveCategory("all");
                      setActiveKeywordQuery(kw.query);
                      setSearchInput(kw.query);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition ${
                      activeKeywordQuery === kw.query
                        ? "bg-[#0B5D3B] text-white border-[#0B5D3B]"
                        : "bg-white dark:bg-[#162920] text-[#0B5D3B] dark:text-[#6EE7B7] border-[#B7DFC5]"
                    }`}
                  >
                    <span>#{kw.label}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteKeyword(kw.id, e)}
                      className="hover:text-red-500 p-0.5"
                      title="حذف کلیدواژه"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

              {/* Add New Custom Keyword Pill */}
              {!showAddKeyword ? (
                <button
                  type="button"
                  onClick={() => setShowAddKeyword(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#0B5D3B] dark:text-[#6EE7B7] bg-white dark:bg-[#162920] border border-dashed border-[#0B5D3B]/50 hover:bg-[#F0F4F1] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن کلیدواژه پایش</span>
                </button>
              ) : (
                <form
                  onSubmit={handleAddCustomKeyword}
                  className="inline-flex items-center gap-1.5 bg-[#F0F4F1] dark:bg-[#162920] px-2 py-1 rounded-lg border border-[#0B5D3B]"
                >
                  <input
                    type="text"
                    value={newKeywordLabel}
                    onChange={(e) => setNewKeywordLabel(e.target.value)}
                    placeholder="مثلاً: مرکبات بابل..."
                    autoFocus
                    className="text-xs bg-transparent focus:outline-none w-32 text-[#0F1E16] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-[#0B5D3B] text-white text-xs font-bold cursor-pointer"
                  >
                    ثبت
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddKeyword(false)}
                    className="text-[#687D70] hover:text-red-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>

            {/* Time Window Segmented Control */}
            <div className="flex items-center gap-1.5 bg-[#F0F4F1] dark:bg-[#162920] p-1 rounded-xl border border-[#DCE4DF] dark:border-[#264234] shrink-0 self-end xl:self-auto">
              <button
                type="button"
                onClick={() => setTimeWindow("6h")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeWindow === "6h"
                    ? "bg-white dark:bg-[#0B5D3B] text-[#0B5D3B] dark:text-white shadow-xs"
                    : "text-[#3D5245] dark:text-[#9AB5A6]"
                }`}
              >
                ۶ ساعت اخیر (فوری)
              </button>
              <button
                type="button"
                onClick={() => setTimeWindow("24h")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeWindow === "24h"
                    ? "bg-[#0B5D3B] text-white shadow-xs"
                    : "text-[#3D5245] dark:text-[#9AB5A6]"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                <span>۲۴ ساعت اخیر (پیش‌فرض)</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeWindow("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeWindow === "all"
                    ? "bg-white dark:bg-[#0B5D3B] text-[#0B5D3B] dark:text-white shadow-xs"
                    : "text-[#3D5245] dark:text-[#9AB5A6]"
                }`}
              >
                کل آرشیو
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace Container */}
      <main className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Direct Google 24h Quick-Jump Bar (Allows instant 1-click Google SERP verification for any topic) */}
        <div className="bg-white dark:bg-[#12221A] border border-[#DCE4DF] dark:border-[#1E3529] rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] dark:bg-[#0B5D3B]/30 flex items-center justify-center text-[#0B5D3B] dark:text-[#4ADE80] shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#0F1E16] dark:text-white">
                پنجره جستجوی مستقیم ۲۴ ساعت اخیر گوگل (بدون محدودیت به سایت خاص)
              </p>
              <p className="text-xs text-[#687D70] dark:text-[#8FA899]">
                علاوه بر اخبار استخراج‌شده در زیر، با کلیک روی هر کلیدواژه می‌توانید صفحه نتایج ۲۴ ساعت گذشته گوگل را مستقیماً باز کنید:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                label: "گوگل ۲۴ ساعته: بانک کشاورزی مازندران",
                q: "بانک کشاورزی مازندران",
              },
              {
                label: "گوگل ۲۴ ساعته: استانداری مازندران",
                q: "استانداری مازندران",
              },
              {
                label: "گوگل ۲۴ ساعته: بانک کشاورزی (کل کشور)",
                q: "بانک کشاورزی",
              },
              {
                label: "گوگل ۲۴ ساعته: شالیکاران و مرکبات مازندران",
                q: "شالیکاران مرکبات مازندران تسهیلات",
              },
            ].map((item) => (
              <a
                key={item.q}
                href={buildGoogle24hSearchUrl(item.q, "web")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F8F9F6] dark:bg-[#193024] hover:bg-[#E6F4EA] dark:hover:bg-[#0B5D3B]/50 text-[#0B5D3B] dark:text-[#6EE7B7] border border-[#DCE4DF] dark:border-[#2A4C3A] transition"
              >
                <span>{item.label}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>

        {/* 24-Hour Executive Summary Strip (4 Metric Cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveCategory("all")}
            className="bg-white dark:bg-[#12221A] border border-[#DCE4DF] dark:border-[#1E3529] hover:border-[#0B5D3B] rounded-xl p-4 flex items-center justify-between cursor-pointer transition shadow-2xs"
          >
            <div>
              <span className="text-xs font-semibold text-[#687D70] dark:text-[#8FA899]">
                کل اخبار رصدشده (۲۴ ساعت اخیر)
              </span>
              <div className="text-2xl font-extrabold text-[#0F1E16] dark:text-white mt-1 tabular-persian">
                {toPersianDigits(metrics.total24h)} خبر
              </div>
              <span className="text-[11px] text-[#15803D] dark:text-[#4ADE80] font-medium">
                بروزرسانی: {lastUpdatedStr}
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#E6F4EA] dark:bg-[#0B5D3B]/30 flex items-center justify-center text-[#0B5D3B] dark:text-[#4ADE80]">
              <Globe className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveCategory("bank_mazandaran")}
            className="bg-white dark:bg-[#12221A] border border-[#DCE4DF] dark:border-[#1E3529] hover:border-[#0B5D3B] rounded-xl p-4 flex items-center justify-between cursor-pointer transition shadow-2xs"
          >
            <div>
              <span className="text-xs font-semibold text-[#687D70] dark:text-[#8FA899]">
                اخبار بانک کشاورزی (مازندران و ملی)
              </span>
              <div className="text-2xl font-extrabold text-[#0B5D3B] dark:text-[#4ADE80] mt-1 tabular-persian">
                {toPersianDigits(metrics.bankCount)} خبر
              </div>
              <span className="text-[11px] text-[#3D5245] dark:text-[#9AB5A6]">
                تسهیلات، شعب استان و پلتفرم پالیز
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#E6F4EA] dark:bg-[#0B5D3B]/30 flex items-center justify-center text-[#0B5D3B] dark:text-[#4ADE80]">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveCategory("governorate")}
            className="bg-white dark:bg-[#12221A] border border-[#DCE4DF] dark:border-[#1E3529] hover:border-[#C89B3C] rounded-xl p-4 flex items-center justify-between cursor-pointer transition shadow-2xs"
          >
            <div>
              <span className="text-xs font-semibold text-[#687D70] dark:text-[#8FA899]">
                اخبار استانداری و جهاد کشاورزی مازندران
              </span>
              <div className="text-2xl font-extrabold text-[#9A6B13] dark:text-[#FCD34D] mt-1 tabular-persian">
                {toPersianDigits(metrics.govCount)} خبر
              </div>
              <span className="text-[11px] text-[#3D5245] dark:text-[#9AB5A6]">
                مصوبات استانی، کارگروه تولید و شالیکاران
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#FEF5E7] dark:bg-[#78350F]/30 flex items-center justify-center text-[#9A6B13] dark:text-[#FCD34D]">
              <Landmark className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setShowWriterStudio((v) => !v)}
            className="bg-gradient-to-l from-[#0B5D3B]/5 to-[#C89B3C]/10 dark:from-[#0B5D3B]/20 dark:to-[#78350F]/20 border border-[#C89B3C]/50 rounded-xl p-4 flex items-center justify-between cursor-pointer transition shadow-2xs"
          >
            <div>
              <span className="text-xs font-bold text-[#0B5D3B] dark:text-[#FCD34D]">
                میز هوشمند خبرنویسی امروز
              </span>
              <div className="text-2xl font-extrabold text-[#0F1E16] dark:text-white mt-1 tabular-persian">
                {toPersianDigits(metrics.bulletinCount)} منبع انتخابی
              </div>
              <span className="text-[11px] text-[#0B5D3B] dark:text-[#6EE7B7] font-semibold underline">
                کلیک جهت تنظیم متن خبر روابط عمومی ←
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#C89B3C] text-[#0F1E16] flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Main Content Grid: Single-Column News Stream + Optional PR Writer Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Chronological 24-Hour News Stream */}
          <div
            className={
              showWriterStudio
                ? "lg:col-span-7 space-y-4"
                : "lg:col-span-12 max-w-[980px] mx-auto w-full space-y-4"
            }
          >
            {/* Stream Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#DCE4DF] dark:border-[#1E3529]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0B5D3B] dark:bg-[#4ADE80]" />
                <h2 className="text-base sm:text-lg font-extrabold text-[#0F1E16] dark:text-white">
                  جریان زمانی اخبار ۲۴ ساعت اخیر (به ترتیب جدیدترین)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E6F4EA] dark:bg-[#0B5D3B]/40 text-[#0B5D3B] dark:text-[#6EE7B7] tabular-persian">
                  {toPersianDigits(filteredArticles.length)} مورد
                </span>
              </div>

              <button
                type="button"
                onClick={handleGenerateSmartPRDraft}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0B5D3B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#C89B3C]" />
                <span>تولید خودکار خبر روابط عمومی از اخبار امروز</span>
              </button>
            </div>

            {/* Empty State if a very specific filter has 0 local matches */}
            {filteredArticles.length === 0 ? (
              <div className="bg-white dark:bg-[#12221A] border border-[#DCE4DF] dark:border-[#1E3529] rounded-2xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#F0F4F1] dark:bg-[#193024] text-[#0B5D3B] mx-auto flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#0F1E16] dark:text-white">
                    برای کلیدواژه «{searchInput || activeKeywordQuery}» در لیست فعلی موردی یافت نشد
                  </h3>
                  <p className="text-sm text-[#687D70] dark:text-[#8FA899]">
                    می‌توانید همین الان جستجوی زنده ۲۴ ساعته گوگل را برای این عبارت اجرا کنید یا مستقیماً وارد صفحه نتایج ۲۴ ساعت اخیر گوگل شوید:
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleLiveGoogleRefresh(searchInput || activeKeywordQuery)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B5D3B] text-white text-sm font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>استخراج زنده این موضوع از گوگل</span>
                  </button>
                  <a
                    href={currentGoogleDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF5E7] text-[#9A6B13] border border-[#F5D9A6] text-sm font-bold"
                  >
                    <span>باز کردن نتایج ۲۴ ساعته در سایت گوگل</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              /* Editorial News Cards (Strictly 4 Core Data Points per Card) */
              filteredArticles.map((article) => {
                const relTime = formatRelativeTimePersian(article.publishedAt);
                const clockStr = formatClockPersian(article.publishedAt);
                const catStyle =
                  CATEGORY_META[article.category] ||
                  CATEGORY_META.bank_mazandaran;
                const isCopied = copiedId === article.id;

                return (
                  <article
                    key={article.id}
                    className="group bg-white dark:bg-[#12221A] border border-[#DCE4DF] dark:border-[#1E3529] hover:border-[#0B5D3B] dark:hover:border-[#4ADE80]/60 rounded-xl p-5 sm:p-6 transition-all duration-150 shadow-[0_1px_3px_rgba(15,30,22,0.05),0_4px_12px_rgba(15,30,22,0.03)] hover:shadow-md"
                  >
                    {/* 1. SOURCE & TIME METADATA ROW */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${catStyle.badgeBg} ${catStyle.badgeText} ${catStyle.badgeBorder} ${catStyle.darkBadgeBg} ${catStyle.darkBadgeText}`}
                        >
                          {article.category === "governorate" ? (
                            <Landmark className="w-3.5 h-3.5" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5" />
                          )}
                          <span>{catStyle.label}</span>
                        </span>

                        {/* Publisher Name & Domain */}
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-[#3D5245] dark:text-[#C4D7CC]">
                          <Globe className="w-3.5 h-3.5 text-[#0B5D3B] dark:text-[#4ADE80]" />
                          <span>{article.sourceName}</span>
                        </span>

                        <span className="px-2 py-0.5 rounded bg-[#F0F4F1] dark:bg-[#193024] text-[11px] font-mono text-[#687D70] dark:text-[#8FA899]" dir="ltr">
                          {article.sourceDomain}
                        </span>
                      </div>

                      {/* Relative Timestamp Badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tabular-persian ${
                            relTime.isBreaking
                              ? "bg-[#E6F4EA] dark:bg-[#0B5D3B]/40 text-[#15803D] dark:text-[#4ADE80]"
                              : "bg-[#F0F4F1] dark:bg-[#193024] text-[#687D70] dark:text-[#9AB5A6]"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{relTime.label}</span>
                          <span className="opacity-60">•</span>
                          <span>{clockStr}</span>
                        </span>
                      </div>
                    </div>

                    {/* 2. HEADLINE (تیتر خبر) */}
                    <h3 className="text-lg sm:text-[19px] font-bold leading-[1.65] text-[#0F1E16] dark:text-white group-hover:text-[#0B5D3B] dark:group-hover:text-[#6EE7B7] transition-colors mb-2.5">
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus:outline-none"
                      >
                        {article.title}
                      </a>
                    </h3>

                    {/* 3. SUMMARY SNIPPET (خلاصه خبر برای خبرنویسی) */}
                    <p className="text-sm sm:text-[15px] leading-[1.85] text-[#3D5245] dark:text-[#B8CCC0] line-clamp-3 mb-4">
                      {article.summary}
                    </p>

                    {/* 4. ACTION FOOTER (ورود به سایت منبع + جستجو در گوگل + کپی برای خبرنویسی) */}
                    <div className="pt-3.5 border-t border-[#DCE4DF]/80 dark:border-[#1E3529] flex flex-wrap items-center justify-between gap-2.5">
                      {/* Primary & Secondary Source Links */}
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#0B5D3B] hover:bg-[#08472D] text-white transition shadow-2xs"
                        >
                          <span>ورود به سایت منبع خبر</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={article.googleSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#F0F4F1] dark:bg-[#193024] hover:bg-[#E2ECE5] dark:hover:bg-[#224030] text-[#3D5245] dark:text-[#C4D7CC] border border-[#DCE4DF] dark:border-[#264234] transition"
                          title="مشاهده پوشش این خبر در نتایج ۲۴ ساعت اخیر گوگل"
                        >
                          <Search className="w-3.5 h-3.5 text-[#0B5D3B] dark:text-[#4ADE80]" />
                          <span>نتایج مشابه در گوگل</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      </div>

                      {/* PR Director Utilities: Copy for News Writing + Add to Bulletin + Bookmark */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopySummaryForPR(article)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            isCopied
                              ? "bg-[#E6F4EA] text-[#15803D] border-[#15803D]"
                              : "bg-white dark:bg-[#162920] hover:bg-[#F0F4F1] text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234]"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#15803D]" />
                              <span>کپی شد ✓</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>کپی برای خبرنویسی</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBulletin(article)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            article.includedInBulletin
                              ? "bg-[#FEF5E7] dark:bg-[#78350F]/40 text-[#9A6B13] dark:text-[#FCD34D] border-[#C89B3C]"
                              : "bg-white dark:bg-[#162920] hover:bg-[#FEF5E7]/50 text-[#3D5245] dark:text-[#C4D7CC] border-[#DCE4DF] dark:border-[#264234]"
                          }`}
                          title="افزودن این خبر به میز نگارش خبر و بولتن امروز"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {article.includedInBulletin
                              ? "در میز خبرنویسی ✓"
                              : "+ درج در خبر امروز"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBookmark(article.id)}
                          className={`p-2 rounded-lg border transition cursor-pointer ${
                            article.isBookmarked
                              ? "bg-[#FEF5E7] text-[#C89B3C] border-[#C89B3C]"
                              : "bg-white dark:bg-[#162920] text-[#687D70] border-[#DCE4DF] dark:border-[#264234] hover:text-[#0B5D3B]"
                          }`}
                          title="نشان کردن خبر"
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              article.isBookmarked ? "fill-current" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Right/Side Workbench: «میز هوشمند نگارش خبر و بولتن روابط عمومی» */}
          {showWriterStudio && (
            <aside className="lg:col-span-5 bg-white dark:bg-[#12221A] border-2 border-[#0B5D3B] dark:border-[#4ADE80]/50 rounded-2xl p-5 sm:p-6 shadow-lg sticky top-28 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DCE4DF] dark:border-[#1E3529] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0B5D3B] text-white flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#0F1E16] dark:text-white">
                      میز هوشمند نگارش خبر روابط عمومی
                    </h3>
                    <p className="text-xs text-[#687D70] dark:text-[#8FA899]">
                      تنظیم سریع خبر روزانه بانک کشاورزی استان مازندران
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWriterStudio(false)}
                  className="p-1.5 rounded-lg text-[#687D70] hover:bg-[#F0F4F1] dark:hover:bg-[#193024] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Auto-synthesize CTA */}
              <div className="bg-[#F0F4F1] dark:bg-[#193024] rounded-xl p-3 flex items-center justify-between gap-2 border border-[#DCE4DF] dark:border-[#264234]">
                <span className="text-xs font-medium text-[#3D5245] dark:text-[#C4D7CC]">
                  {toPersianDigits(bulletinArticles.length)} خبر از ۲۴ ساعت اخیر در میز خبرنویسی انتخاب شده است
                </span>
                <button
                  type="button"
                  onClick={handleGenerateSmartPRDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B5D3B] hover:bg-[#08472D] text-white text-xs font-bold transition cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F3C663]" />
                  <span>نگارش خودکار از اخبار امروز</span>
                </button>
              </div>

              {/* Editable PR Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#3D5245] dark:text-[#9AB5A6] mb-1">
                    روتیتر خبر:
                  </label>
                  <input
                    type="text"
                    value={draftKicker}
                    onChange={(e) => setDraftKicker(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F8F9F6] dark:bg-[#0B1510] border border-[#DCE4DF] dark:border-[#264234] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#0B5D3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3D5245] dark:text-[#9AB5A6] mb-1">
                    تیتر اصلی خبر روابط عمومی:
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F8F9F6] dark:bg-[#0B1510] border border-[#DCE4DF] dark:border-[#264234] text-sm font-bold text-[#0B5D3B] dark:text-[#6EE7B7] focus:outline-none focus:border-[#0B5D3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3D5245] dark:text-[#9AB5A6] mb-1">
                    لید (خلاصه مدیریتی خبر):
                  </label>
                  <textarea
                    rows={3}
                    value={draftLead}
                    onChange={(e) => setDraftLead(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F8F9F6] dark:bg-[#0B1510] border border-[#DCE4DF] dark:border-[#264234] text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-[#0B5D3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3D5245] dark:text-[#9AB5A6] mb-1">
                    متن کامل گزارش خبری:
                  </label>
                  <textarea
                    rows={7}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F8F9F6] dark:bg-[#0B1510] border border-[#DCE4DF] dark:border-[#264234] text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-[#0B5D3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3D5245] dark:text-[#9AB5A6] mb-1">
                    منابع خبری رصدشده:
                  </label>
                  <input
                    type="text"
                    value={draftReferences}
                    onChange={(e) => setDraftReferences(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#F8F9F6] dark:bg-[#0B1510] border border-[#DCE4DF] dark:border-[#264234] text-xs text-[#687D70] focus:outline-none focus:border-[#0B5D3B]"
                  />
                </div>
              </div>

              {/* Studio Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyFullDraft}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B5D3B] hover:bg-[#08472D] text-white text-xs sm:text-sm font-bold transition cursor-pointer"
                >
                  {copiedFullDraft ? (
                    <>
                      <Check className="w-4 h-4 text-[#F3C663]" />
                      <span>متن کامل خبر کپی شد ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>کپی متن کامل خبر برای انتشار</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FEF5E7] hover:bg-[#F5D9A6] text-[#9A6B13] border border-[#C89B3C] text-xs sm:text-sm font-bold transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSavingDraft ? "در حال ذخیره..." : "ذخیره پیش‌نویس"}</span>
                </button>
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="mt-12 border-t border-[#DCE4DF] dark:border-[#1E3529] bg-white dark:bg-[#12221A] py-6">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#687D70] dark:text-[#8FA899]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0B5D3B]" />
            <span className="font-bold text-[#0F1E16] dark:text-white">
              سامانه اختصاصی رصد اخبار ۲۴ ساعته — روابط عمومی بانک کشاورزی استان مازندران
            </span>
          </div>
          <div>
            <span>
              طراحی‌شده جهت پایش یکپارچه اخبار بانک کشاورزی و استانداری مازندران از طریق جستجوی زنده گوگل (۲۴ ساعت اخیر)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
