/**
 * i18n — trilingual (zh-CN / en / my-MM).
 * Language switch is presentation-only; never touches Session/Spin/Round/Balance.
 */

export type Lang = "zh-CN" | "en" | "my-MM";
export const LANGS: Lang[] = ["zh-CN", "en", "my-MM"];

const dict: Record<Lang, Record<string, string>> = {
  "zh-CN": {
    gameTitle: "亚洲水牛",
    loading: "正在进入草原…",
    balance: "余额",
    bet: "投注",
    win: "赢得",
    spin: "旋转",
    stop: "停止",
    auto: "自动",
    autoOn: "自动中",
    turbo: "快速",
    freeSpins: "免费旋转",
    freeSpinsLeft: "剩余免费旋转",
    freeSpinsWon: "赢得免费旋转",
    bigWin: "大赢",
    megaWin: "巨赢",
    ultraWin: "超级巨赢",
    jackpot: "超级头奖",
    congratulations: "恭喜！",
    goodLuck: "祝好运！",
    paytable: "赔付表",
    sound: "音效",
    language: "语言",
    lines: "50 线",
    scatterNote:
      "SCATTER：3/4/5 个触发 8/15/20 次免费旋转；免费旋转中 2 个及以上再触发额外次数。结算由服务器权威判定。",
    wildNote: "WILD：可替代除 SCATTER 外所有符号。线奖与免费游戏由正式数学版本结算。",
    linesNote: "5×4、50 线玩法。赔付表数值为线注倍数；Big/Mega/Ultra/Jackpot 仅为展示动画。",
    insufficient: "余额不足",
    errorGeneric: "服务暂时不可用，请稍后重试",
    retry: "重试",
    recovery: "正在恢复上一局…",
    session: "会话",
    sessionExpired: "会话已过期，请刷新页面",
    mathMismatch: "数学版本不匹配，请刷新页面",
    networkError: "网络错误，请检查连接后重试",
    totalWin: "总赢分",
    mute: "静音",
    unmute: "取消静音",
    volume: "音量",
    quality: "画质",
    qualityAuto: "自动",
    qualityHigh: "高",
    qualityMedium: "中",
    qualityLow: "低",
    settings: "设置",
    tapToContinue: "点击继续",
    spinning: "旋转中",
    goodLuckSpin: "祝好运",
    sym_buffalo: "水牛",
    sym_lion: "狮子",
    sym_elephant: "大象",
    sym_zebra: "斑马",
    sym_antelope: "羚羊",
    sym_a: "A",
    sym_k: "K",
    sym_q: "Q",
    sym_j: "J",
    sym_ten: "10",
    sym_nine: "9",
    sym_wild: "WILD",
    sym_scatter: "SCATTER",
  },
  en: {
    gameTitle: "Asian Buffalo",
    loading: "Entering the savanna…",
    balance: "Balance",
    bet: "Bet",
    win: "Win",
    spin: "SPIN",
    stop: "STOP",
    auto: "AUTO",
    autoOn: "AUTO ON",
    turbo: "TURBO",
    freeSpins: "Free Spins",
    freeSpinsLeft: "Free spins left",
    freeSpinsWon: "Free spins won",
    bigWin: "BIG WIN",
    megaWin: "MEGA WIN",
    ultraWin: "ULTRA WIN",
    jackpot: "JACKPOT",
    congratulations: "Congratulations!",
    goodLuck: "Good luck!",
    paytable: "Paytable",
    sound: "Sound",
    language: "Language",
    lines: "50 Lines",
    scatterNote:
      "SCATTER: 3/4/5 award 8/15/20 free spins; 2+ during free spins retrigger. Settlement is server-authoritative.",
    wildNote: "WILD substitutes for all symbols except SCATTER. Line pays use the frozen math version.",
    linesNote:
      "5×4, 50-line game. Paytable values are line-bet multipliers. Big/Mega/Ultra/Jackpot are UI only.",
    insufficient: "Insufficient balance",
    errorGeneric: "Service temporarily unavailable",
    retry: "Retry",
    recovery: "Recovering last round…",
    session: "Session",
    sessionExpired: "Session expired — please refresh",
    mathMismatch: "Math version mismatch — please refresh",
    networkError: "Network error — check connection and retry",
    totalWin: "Total win",
    mute: "Mute",
    unmute: "Unmute",
    volume: "Volume",
    quality: "Quality",
    qualityAuto: "Auto",
    qualityHigh: "High",
    qualityMedium: "Med",
    qualityLow: "Low",
    settings: "Settings",
    tapToContinue: "Tap to continue",
    spinning: "Spinning",
    goodLuckSpin: "Good luck",
    sym_buffalo: "Buffalo",
    sym_lion: "Lion",
    sym_elephant: "Elephant",
    sym_zebra: "Zebra",
    sym_antelope: "Antelope",
    sym_a: "A",
    sym_k: "K",
    sym_q: "Q",
    sym_j: "J",
    sym_ten: "10",
    sym_nine: "9",
    sym_wild: "WILD",
    sym_scatter: "SCATTER",
  },
  "my-MM": {
    gameTitle: "အာရှကြွေး",
    loading: "မြက်ခင်းပြင်သို့ ဝင်ရောက်နေသည်…",
    balance: "လက်ကျန်ငွေ",
    bet: "လောင်းကြေး",
    win: "အနိုင်ရ",
    spin: "လှည့်ပါ",
    stop: "ရပ်ပါ",
    auto: "အလိုအလျောက်",
    autoOn: "အလိုအလျောက်ဖွင့်ထား",
    turbo: "အမြန်",
    freeSpins: "အခမဲ့လှည့်ခြင်း",
    freeSpinsLeft: "ကျန်ရှိသောအခမဲ့လှည့်ခြင်း",
    freeSpinsWon: "အခမဲ့လှည့်ခြင်းရရှိ",
    bigWin: "အနိုင်ကြီး",
    megaWin: "မဂ်ဂါအနိုင်",
    ultraWin: "အထွတ်အထိပ်အနိုင်",
    jackpot: "ဂျက်ပေါက်ဆု",
    congratulations: "ဂုဏ်ယူပါတယ်!",
    goodLuck: "ကံကောင်းပါစေ!",
    paytable: "ဆုကြေးငွေဇယား",
    sound: "အသံ",
    language: "ဘာသာစကား",
    lines: "လိုင်း ၅၀",
    scatterNote:
      "SCATTER: 3/4/5 သည် အခမဲ့လှည့်ခြင်း 8/15/20 ပေးသည်။ ဆုံးဖြတ်ချက်ကို ဆာဗာကသာ လုပ်သည်။",
    wildNote: "WILD သည် SCATTER မဟုတ်သော သင်္ကေတများကို အစားထိုးနိုင်သည်။",
    linesNote:
      "5×4၊ လိုင်း ၅၀။ Big/Mega/Ultra/Jackpot သည် UI သရုပ်ပြသာ ဖြစ်သည်။",
    insufficient: "လက်ကျန်ငွေ မလုံလောက်ပါ",
    errorGeneric: "ဝန်ဆောင်မှု ယာယီမရနိုင်ပါ",
    retry: "ပြန်ကြိုးစားရန်",
    recovery: "နောက်ဆုံးပွဲ ပြန်လည်ရယူနေသည်…",
    session: "ဆက်ရှင်",
    sessionExpired: "ဆက်ရှင် သက်တမ်းကုန်ပါပြီ — ပြန်လည်ဖွင့်ပါ",
    mathMismatch: "သင်္ချာဗားရှင်း မကိုက်ညီပါ — ပြန်လည်ဖွင့်ပါ",
    networkError: "ကွန်ရက်အမှား — ချိတ်ဆက်မှု စစ်ဆေးပြီး ပြန်ကြိုးစားပါ",
    totalWin: "စုစုပေါင်းအနိုင်",
    mute: "အသံပိတ်",
    unmute: "အသံဖွင့်",
    volume: "အသံအတိုးအကျယ်",
    quality: "အရည်အသွေး",
    qualityAuto: "အလိုအလျောက်",
    qualityHigh: "မြင့်",
    qualityMedium: "အလတ်",
    qualityLow: "နိမ့်",
    settings: "ဆက်တင်",
    tapToContinue: "ဆက်လက်ရန် နှိပ်ပါ",
    spinning: "လှည့်နေသည်",
    goodLuckSpin: "ကံကောင်းပါစေ",
    sym_buffalo: "ကြွေး",
    sym_lion: "ခြင်္သေ့",
    sym_elephant: "ဆင်",
    sym_zebra: "မြင်းကျား",
    sym_antelope: "သမင်",
    sym_a: "A",
    sym_k: "K",
    sym_q: "Q",
    sym_j: "J",
    sym_ten: "10",
    sym_nine: "9",
    sym_wild: "WILD",
    sym_scatter: "SCATTER",
  },
};

const STORAGE_KEY = "ab-lang";

let current: Lang = load();

function load(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return "zh-CN";
}

export function getLang(): Lang {
  return current;
}

export function t(key: string): string {
  const v = dict[current][key];
  if (v === undefined) {
    console.warn(`[i18n] missing key "${key}" for ${current}`);
    return dict.en[key] ?? key;
  }
  return v;
}

export function setLang(lang: Lang): void {
  if (!LANGS.includes(lang)) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
  applyDom();
  for (const fn of listeners) fn(lang);
}

const listeners: Array<(lang: Lang) => void> = [];
export function onLangChange(fn: (lang: Lang) => void): void {
  listeners.push(fn);
}

export function applyDom(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
  });
  document.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === current);
  });
}

export function validateDicts(): string[] {
  const base = Object.keys(dict["zh-CN"]);
  const problems: string[] = [];
  for (const lang of LANGS) {
    for (const key of base) {
      if (!(key in dict[lang])) problems.push(`${lang}: missing "${key}"`);
      else if (!dict[lang][key]!.trim()) problems.push(`${lang}: empty "${key}"`);
    }
    for (const key of Object.keys(dict[lang])) {
      if (!base.includes(key)) problems.push(`${lang}: extra "${key}"`);
    }
  }
  return problems;
}
