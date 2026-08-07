/**
 * M6-7 · 三语支持（中文 / 缅文 / 英文）
 * 纯表现层模块：不触碰 lib/game-config.ts 中的任何业务文案与数学定义。
 * 缅文翻译为 M6 初版，留待母语审校（见风险分析）。
 */

export type Locale = "zh" | "my" | "en";

export const LOCALES: readonly Locale[] = ["zh", "my", "en"];

export const LOCALE_LABEL: Record<Locale, string> = {
  zh: "中文",
  my: "မြန်မာ",
  en: "EN",
};

const dict = {
  brandKicker: {
    zh: "INDEPENDENT WEB BUILD · MILESTONE 6",
    my: "INDEPENDENT WEB BUILD · MILESTONE 6",
    en: "INDEPENDENT WEB BUILD · MILESTONE 6",
  },
  brandNote: {
    zh: "ASIAN BUFFALO 玩法开发版 / 原创程序美术",
    my: "ASIAN BUFFALO ကစားနည်း dev version / မူရင်း procedural အနုပညာ",
    en: "ASIAN BUFFALO gameplay dev build / original procedural art",
  },
  demoWallet: { zh: "演示钱包", my: "နမူနာ wallet", en: "Demo wallet" },
  realMoneyOff: { zh: "真钱通道：关闭", my: "အစစ်အမှန်ငွေ - ပိတ်ထားသည်", en: "Real money: OFF" },
  rules: { zh: "规则", my: "စည်းမျဉ်းများ", en: "Rules" },
  fixedLines: { zh: "固定线", my: "ပ fixed လိုင်း", en: "Lines" },
  freeGames: { zh: "免费局", my: "အခမဲ့ပွဲ", en: "Free games" },
  lineBet: { zh: "线注", my: "လိုင်းလောင်းကြေး", en: "Line bet" },
  totalBet: { zh: "总注", my: "စုစုပေါင်းလောင်းကြေး", en: "Total bet" },
  baseGame: { zh: "BASE GAME", my: "BASE GAME", en: "BASE GAME" },
  freeGameLeft: { zh: "FREE GAME · {n} LEFT", my: "FREE GAME · {n} ခုကျန်", en: "FREE GAME · {n} LEFT" },
  room: { zh: "房间", my: "အခန်း", en: "Room" },
  roomSuffix: { zh: "{n} 房", my: "အခန်း {n}", en: "Room {n}" },
  level: { zh: "等级", my: "အဆင့်", en: "Level" },
  multiplier: { zh: "倍率", my: "အဆ", en: "Multiplier" },
  maxBet: { zh: "最大投注", my: "အများဆုံးလောင်း", en: "MAX BET" },
  spinIdle: { zh: "开始", my: "စတင်ရန်", en: "START" },
  spinBusy: { zh: "旋转中", my: "လည်ပတ်နေ", en: "SPINNING" },
  spinFree: { zh: "免费旋转", my: "အခမဲ့လည်ပတ်", en: "FREE SPIN" },
  winLabel: { zh: "赢分", my: "အနိုင်", en: "Win" },
  roundLabel: { zh: "局号", my: "ပွဲနံပါတ်", en: "Round" },
  msgVerified: {
    zh: "原游戏规则已核对；当前为非真钱数学原型",
    my: "မူရင်းစည်းမျဉ်း စစ်ဆေးပြီး; ငွေစစ်မဟုတ်သော သင်္ချာနမူနာ",
    en: "Original rules verified; non-real-money math prototype",
  },
  msgNoBalance: {
    zh: "演示余额不足；真钱模式尚未开放",
    my: "နမူနာလက်ကျန်ငွေ မလုံလောက်ပါ; ငွေစစ်မုဒ် မဖွင့်ရသေးပါ",
    en: "Insufficient demo balance; real-money mode not open",
  },
  msgSpinningFree: { zh: "免费游戏旋转中…", my: "အခမဲ့ဂိမ်း လည်ပတ်နေသည်…", en: "Free game spinning…" },
  msgSpinning: { zh: "正在生成演示局结果…", my: "နမူနာရလဒ် ထုတ်နေသည်…", en: "Generating demo round…" },
  msgWin: {
    zh: "本局赢得 {amount} MMK{mult}",
    my: "ဒီပွဲ အနိုင်ရ {amount} MMK{mult}",
    en: "Won {amount} MMK{mult}",
  },
  msgFreeMult: { zh: "，免费局 ×{n}", my: ", အခမဲ့ပွဲ ×{n}", en: ", free ×{n}" },
  msgFreeTrigger: {
    zh: "触发 {n} 次免费游戏",
    my: "အခမဲ့ဂိမ်း {n} ခု ရရှိ",
    en: "Triggered {n} free games",
  },
  msgNoWin: { zh: "本局未中奖", my: "ဒီပွဲ မနိုင်ပါ", en: "No win this round" },
  footerSource: {
    zh: "规则来源：目标游戏客户端帮助页与运行代码",
    my: "စည်းမျဉ်းရင်းမြစ် - မူရင်းဂိမ်း အကူညီစာမျက်နှာနှင့် runtime code",
    en: "Rule source: target game client help page and runtime code",
  },
  footerMath: { zh: "数学状态：{status}", my: "သင်္ချာအခြေအနေ: {status}", en: "Math status: {status}" },
  footerNoMoney: {
    zh: "本版本不存款、不提款、不兑换",
    my: "ဤ version တွင် ငွေသွင်း/ငွေထုတ်/လဲလှယ် မပါဝင်ပါ",
    en: "No deposits, withdrawals or exchange in this build",
  },
  rtpPending: { zh: "待校准", my: "စောင့်ဆိုင်းဆဲ", en: "Pending" },
  rulesTitle: { zh: "玩法与赔付表", my: "ကစားနည်းနှင့် ဆုကြေးဇယား", en: "Rules & Paytable" },
  rulesVerified: { zh: "已核验规则", my: "စစ်ဆေးပြီးစည်းမျဉ်းများ", en: "Verified rules" },
  basicRules: { zh: "基础规则", my: "အခြေခံစည်းမျဉ်းများ", en: "Basic rules" },
  basicRulesP1: {
    zh: "5轴×4行、50条固定赔付线。普通符号从最左轴起连续命中；水牛2个起赔，其余普通符号3个起赔。",
    my: "Reel 5 × Row 4၊ ပ fixed လိုင်း 50။ သန်သင်္ကေတများ ဘယ်ဘက်မှ ဆက်တိုက်ပေါ်လျှင် ဆ; ကြွား 2 လုံးမှ၊ ကျန် 3 လုံးမှ ဆပေးသည်။",
    en: "5 reels × 4 rows, 50 fixed lines. Regular symbols pay left-to-right; Buffalo pays from 2, others from 3.",
  },
  basicRulesP2: {
    zh: "WILD代替SCATTER以外的普通符号，并且只会出现在第2、3、4轴。",
    my: "WILD သည် SCATTER မဟုတ်သော သင်္ကေတများကို အစားထိုးပြီး reel 2, 3, 4 တွင်သာ ပေါ်သည်။",
    en: "WILD substitutes all regular symbols except SCATTER and appears on reels 2, 3, 4 only.",
  },
  freeGameRules: { zh: "免费游戏", my: "အခမဲ့ဂိမ်း", en: "Free games" },
  times: { zh: "次", my: "ခု", en: "games" },
  freeRetrigger: {
    zh: "免费游戏中，2/3/4/5个SCATTER分别追加 {list} 次。免费局WILD带×2或×3倍数。",
    my: "အခမဲ့ဂိမ်းအတွင်း SCATTER 2/3/4/5 လုံးအလိုက် {list} ခု ထပ်ရသည်။ အခမဲ့ပွဲတွင် WILD ၌ ×2 သို့မဟုတ် ×3 အဆပါသည်။",
    en: "In free games, 2/3/4/5 SCATTERs retrigger {list} games. WILDs carry ×2 or ×3.",
  },
  scatterPays: { zh: "SCATTER赔付", my: "SCATTER ဆုကြေး", en: "SCATTER pays" },
  scatterPaysP: {
    zh: "3/4/5个SCATTER分别支付总投注的 {list}。",
    my: "SCATTER 3/4/5 လုံးအလိုက် စုစုပေါင်းလောင်းကြေး၏ {list} ဆပေးသည်။",
    en: "3/4/5 SCATTERs pay {list} of total bet.",
  },
  colSymbol: { zh: "符号", my: "သင်္ကေတ", en: "Symbol" },
  col2: { zh: "2个", my: "2 လုံး", en: "2" },
  col3: { zh: "3个", my: "3 လုံး", en: "3" },
  col4: { zh: "4个", my: "4 လုံး", en: "4" },
  col5: { zh: "5个", my: "5 လုံး", en: "5" },
  paytableNote: {
    zh: "普通符号数值 × 单线投注；客户端未公开RTP与卷轴权重。",
    my: "သာမန်တန်ဖိုး × လိုင်းလောင်းကြေး; RTP နှင့် reel အလေးချိန်ကို client ၌ မဖော်ပြပါ။",
    en: "Regular values × line bet; RTP and reel weights are not client-published.",
  },
  closeRules: { zh: "关闭规则", my: "ပိတ်ရန်", en: "Close rules" },
  auto: { zh: "AUTO", my: "AUTO", en: "AUTO" },
  mute: { zh: "静音", my: "အသံပိတ်", en: "Mute" },
  unmute: { zh: "取消静音", my: "အသံဖွင့်", en: "Unmute" },
  quality: { zh: "画质", my: "အရည်အသွေး", en: "Quality" },
  qualityAuto: { zh: "自动", my: "အလိုအလျောက်", en: "Auto" },
  qualityHigh: { zh: "高", my: "မြင့်", en: "High" },
  qualityMedium: { zh: "中", my: "အလတ်", en: "Med" },
  qualityLow: { zh: "低", my: "နိမ့်", en: "Low" },
  sceneLoading: { zh: "草原场景加载中…", my: "Savanna မြင်ကွင်း တင်နေသည်…", en: "Loading savanna…" },
  bigWin: { zh: "BIG WIN 大奖", my: "BIG WIN", en: "BIG WIN" },
  megaWin: { zh: "MEGA WIN 巨奖", my: "MEGA WIN", en: "MEGA WIN" },
  ultraWin: { zh: "ULTRA WIN 超级大奖", my: "ULTRA WIN", en: "ULTRA WIN" },
  jackpot: { zh: "JACKPOT 头奖", my: "JACKPOT", en: "JACKPOT" },
  tapToContinue: { zh: "点击继续", my: "ဆက်လက်ရန် နှိပ်ပါ", en: "Tap to continue" },
  language: { zh: "语言", my: "ဘာသာစကား", en: "Language" },
} as const;

export type I18nKey = keyof typeof dict;

export function translate(locale: Locale, key: I18nKey, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  let text: string = entry[locale] ?? entry.en;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** 符号名三语映射（表现层展示用；lib 中的 SYMBOLS.label 保持不变） */
export const SYMBOL_NAME: Record<string, Record<Locale, string>> = {
  buffalo: { zh: "水牛", my: "ကြွား", en: "Buffalo" },
  lion: { zh: "狮子", my: "ခြင်္သေ့", en: "Lion" },
  elephant: { zh: "大象", my: "ဆင်", en: "Elephant" },
  zebra: { zh: "斑马", my: "မြင်းကျား", en: "Zebra" },
  antelope: { zh: "羚羊", my: "Antelope", en: "Antelope" },
  a: { zh: "A", my: "A", en: "A" },
  k: { zh: "K", my: "K", en: "K" },
  q: { zh: "Q", my: "Q", en: "Q" },
  j: { zh: "J", my: "J", en: "J" },
  ten: { zh: "10", my: "10", en: "10" },
  nine: { zh: "9", my: "9", en: "9" },
  wild: { zh: "WILD", my: "WILD", en: "WILD" },
  scatter: { zh: "SCATTER", my: "SCATTER", en: "SCATTER" },
};

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_STORAGE_KEY = "ab-m6-locale";

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "zh" || stored === "my" || stored === "en" ? stored : DEFAULT_LOCALE;
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
