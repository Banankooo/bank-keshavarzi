const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatJalaliDatePersian(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatter.format(date);
  } catch {
    return toPersianDigits("پنجشنبه ۲ مهر ۱۴۰۵");
  }
}

export function formatClockPersian(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const formatter = new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `ساعت ${toPersianDigits(formatter.format(date))}`;
  } catch {
    return "ساعت ۱۲:۰۰";
  }
}

export function formatRelativeTimePersian(dateInput: string | Date): {
  label: string;
  hoursAgo: number;
  isBreaking: boolean;
  isWithin24h: boolean;
} {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMinutes < 5) {
    return {
      label: "لحظاتی پیش",
      hoursAgo: 0,
      isBreaking: true,
      isWithin24h: true,
    };
  }

  if (diffMinutes < 60) {
    return {
      label: `${toPersianDigits(diffMinutes)} دقیقه پیش`,
      hoursAgo: diffHours,
      isBreaking: true,
      isWithin24h: true,
    };
  }

  const roundedHours = Math.floor(diffHours);
  if (roundedHours < 24) {
    return {
      label: `${toPersianDigits(roundedHours)} ساعت پیش`,
      hoursAgo: diffHours,
      isBreaking: roundedHours <= 6,
      isWithin24h: true,
    };
  }

  const days = Math.floor(roundedHours / 24);
  if (days === 1) {
    return {
      label: "دیروز (۲۴ ساعت اخیر)",
      hoursAgo: diffHours,
      isBreaking: false,
      isWithin24h: diffHours <= 30,
    };
  }

  return {
    label: `${toPersianDigits(days)} روز پیش`,
    hoursAgo: diffHours,
    isBreaking: false,
    isWithin24h: false,
  };
}

export function buildGoogle24hSearchUrl(query: string, mode: "web" | "news" = "web"): string {
  const cleanQuery = query.trim() || "بانک کشاورزی مازندران OR استانداری مازندران";
  const encoded = encodeURIComponent(cleanQuery);
  if (mode === "news") {
    return `https://www.google.com/search?q=${encoded}&tbs=qdr:d&tbm=nws&hl=fa`;
  }
  return `https://www.google.com/search?q=${encoded}&tbs=qdr:d&hl=fa`;
}

export function extractDomainFromUrl(url: string, fallbackSource?: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "");
    if (host.includes("google.com") || host.includes("bing.com")) {
      // Check if url param exists inside query string
      const nestedUrl = parsed.searchParams.get("url");
      if (nestedUrl) {
        const nestedParsed = new URL(nestedUrl);
        return nestedParsed.hostname.replace(/^www\./i, "");
      }
      if (fallbackSource && fallbackSource.includes(".")) {
        return fallbackSource.replace(/^www\./i, "").trim();
      }
    }
    return host;
  } catch {
    return fallbackSource || "news.google.com";
  }
}

export function unwrapRedirectUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const nestedUrl = parsed.searchParams.get("url");
    if (nestedUrl && (nestedUrl.startsWith("http://") || nestedUrl.startsWith("https://"))) {
      return nestedUrl;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}
