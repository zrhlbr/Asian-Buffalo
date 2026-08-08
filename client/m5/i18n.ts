/**
 * i18n — trilingual (zh-CN / en / my-MM).
 * Language switch is presentation-only; never touches Session/Spin/Round/Balance.
 */

export type Lang = "zh-CN" | "en" | "my-MM";
export const LANGS: Lang[] = ["zh-CN", "en", "my-MM"];

const dict: Record<Lang, Record<string, string>> = {
  "zh-CN": {
    gameTitle: "牛魔王",
    loading: "正在进入火焰山…",
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
    superWin: "至尊巨赢",
    epicWin: "史诗巨赢",
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
    linesNote: "5×4、50 线玩法。赔付表数值为线注倍数；Big/Mega/Ultra/Super/Epic/Jackpot 仅为展示动画。",
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
    qualityUltra: "旗舰",
    qualityHigh: "高",
    qualityMedium: "中",
    qualityLow: "低",
    fxEffects: "特效",
    fxOn: "开",
    fxOff: "关",
    animalAnim: "动物动画",
    animalFull: "完整",
    animalSimple: "简化",
    fpsTarget: "帧率",
    fpsAuto: "自动",
    fps30: "30",
    fps60: "60",
    settings: "设置",
    back: "返回",
    tapToContinue: "点击继续",
    spinning: "旋转中",
    goodLuckSpin: "祝好运",
    /** Near-miss teaser — never claims a win when payout is 0. Prefer FX-only. */
    closeCall: "就差一点",
    profile: "个人中心",
    profilePlayerId: "玩家ID",
    profilePhone: "手机",
    profilePhoneNone: "未绑定",
    profileCurrency: "币种",
    profileStatus: "状态",
    profileRegistered: "注册时间",
    profileLastLogin: "最近登录",
    profileNickname: "昵称",
    profileSave: "保存",
    profileBindPhone: "绑定",
    profileChooseAvatar: "选择头像",
    profileSaved: "已保存",
    profilePhonePending: "已提交（短信验证待业务规则）",
    vip: "VIP",
    vipCenter: "VIP 中心",
    vipChests: "奖励宝箱",
    vipUnlocked: "已解锁",
    vipLocked: "未解锁",
    vipConditionsPending: "升级条件由后台配置（业务规则待定）",
    chestClaim: "领取",
    chestClaimed: "已领取",
    chestLocked: "锁定",
    wallet: "钱包",
    walletAvailable: "可用",
    walletFrozen: "冻结",
    walletStatus: "状态",
    walletNoMoves: "暂无近期流水",
    walletPending: "充值/提现请在大厅或牛魔王中心操作；金额与渠道见 BUSINESS_RULES_PENDING。",
    help: "帮助",
    helpIntro: "牛魔王正式规则与客服入口。旋转结算以服务器为准。",
    helpPending: "工单系统 Phase 8 — 规则详见赔付表与公告。",
    overlayWaitSpin: "旋转结算中，请稍后再打开",
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
    gameTitle: "BULL DEMON KING",
    loading: "Entering Flame Mountain…",
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
    superWin: "SUPER WIN",
    epicWin: "EPIC WIN",
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
      "5×4, 50-line game. Paytable values are line-bet multipliers. Big/Mega/Ultra/Super/Epic/Jackpot are UI only.",
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
    qualityUltra: "Ultra",
    qualityHigh: "High",
    qualityMedium: "Med",
    qualityLow: "Low",
    fxEffects: "Effects",
    fxOn: "On",
    fxOff: "Off",
    animalAnim: "Animal anim",
    animalFull: "Full",
    animalSimple: "Simple",
    fpsTarget: "FPS",
    fpsAuto: "Auto",
    fps30: "30",
    fps60: "60",
    settings: "Settings",
    back: "Back",
    tapToContinue: "Tap to continue",
    spinning: "Spinning",
    goodLuckSpin: "Good luck",
    /** Near-miss teaser — never claims a win when payout is 0. Prefer FX-only. */
    closeCall: "So close",
    profile: "Profile",
    profilePlayerId: "Player ID",
    profilePhone: "Phone",
    profilePhoneNone: "Not bound",
    profileCurrency: "Currency",
    profileStatus: "Status",
    profileRegistered: "Registered",
    profileLastLogin: "Last login",
    profileNickname: "Nickname",
    profileSave: "Save",
    profileBindPhone: "Bind",
    profileChooseAvatar: "Choose avatar",
    profileSaved: "Saved",
    profilePhonePending: "Submitted (SMS OTP pending business rules)",
    vip: "VIP",
    vipCenter: "VIP Center",
    vipChests: "Reward chests",
    vipUnlocked: "Unlocked",
    vipLocked: "Locked",
    vipConditionsPending: "Upgrade conditions are admin-configured (pending rules)",
    chestClaim: "Claim",
    chestClaimed: "Claimed",
    chestLocked: "Locked",
    wallet: "Wallet",
    walletAvailable: "Available",
    walletFrozen: "Frozen",
    walletStatus: "Status",
    walletNoMoves: "No recent moves",
    walletPending: "Use lobby/hub for deposit & withdraw. Amounts/channels: BUSINESS_RULES_PENDING.",
    help: "Help",
    helpIntro: "Bull Demon King formal rules and support. Settlement is server-authoritative.",
    helpPending: "Tickets are Phase 8 — see paytable and announcements for rules.",
    overlayWaitSpin: "Please wait until the spin settles",
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
    gameTitle: "နွားနတ်ဆိုးဘုရင်",
    loading: "မီးတောင်သို့ ဝင်ရောက်နေသည်…",
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
    superWin: "စူပါအနိုင်",
    epicWin: "ဧပစ်အနိုင်",
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
      "5×4၊ လိုင်း ၅၀။ Big/Mega/Ultra/Super/Epic/Jackpot သည် UI သရုပ်ပြသာ ဖြစ်သည်။",
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
    qualityUltra: "အမြင့်ဆုံး",
    qualityHigh: "မြင့်",
    qualityMedium: "အလတ်",
    qualityLow: "နိမ့်",
    fxEffects: "အထူးပြုလုပ်ချက်",
    fxOn: "ဖွင့်",
    fxOff: "ပိတ်",
    animalAnim: "တိရစ္ဆာန် အန်နီမေးရှင်း",
    animalFull: "ပြည့်စုံ",
    animalSimple: "ရိုးရှင်း",
    fpsTarget: "FPS",
    fpsAuto: "အလိုအလျောက်",
    fps30: "30",
    fps60: "60",
    settings: "ဆက်တင်",
    back: "ပြန်သွားရန်",
    tapToContinue: "ဆက်လက်ရန် နှိပ်ပါ",
    spinning: "လှည့်နေသည်",
    goodLuckSpin: "ကံကောင်းပါစေ",
    /** Near-miss teaser — never claims a win when payout is 0. Prefer FX-only. */
    closeCall: "နီးစပ်သွားပြီ",
    profile: "ပရိုဖိုင်",
    profilePlayerId: "ကစားသမား ID",
    profilePhone: "ဖုန်း",
    profilePhoneNone: "မချိတ်ရသေး",
    profileCurrency: "ငွေကြေး",
    profileStatus: "အခြေအနေ",
    profileRegistered: "မှတ်ပုံတင်ချိန်",
    profileLastLogin: "နောက်ဆုံးဝင်ရောက်",
    profileNickname: "အမည်ဝှက်",
    profileSave: "သိမ်းမည်",
    profileBindPhone: "ချိတ်မည်",
    profileChooseAvatar: "ပုံရွေးပါ",
    profileSaved: "သိမ်းပြီး",
    profilePhonePending: "တင်ပြီး (SMS စည်းမျဉ်း စောင့်ဆိုင်း)",
    vip: "VIP",
    vipCenter: "VIP စင်တာ",
    vipChests: "ဆုသေတ္တာများ",
    vipUnlocked: "ဖွင့်ပြီး",
    vipLocked: "မဖွင့်ရသေး",
    vipConditionsPending: "အဆင့်တက် စည်းမျဉ်းကို အက်ဒမင် သတ်မှတ် (စောင့်ဆိုင်း)",
    chestClaim: "ယူမည်",
    chestClaimed: "ယူပြီး",
    chestLocked: "သော့ခတ်",
    wallet: "ပိုက်ဆံအိတ်",
    walletAvailable: "ရနိုင်",
    walletFrozen: "ထိန်းသိမ်း",
    walletStatus: "အခြေအနေ",
    walletNoMoves: "မကြာသေးမီ လှုပ်ရှားမှု မရှိ",
    walletPending: "ငွေသွင်း/ထုတ် — lobby/hub မှ လုပ်ပါ။ BUSINESS_RULES_PENDING ကြည့်ပါ။",
    help: "အကူအညီ",
    helpIntro: "Bull Demon King တရားဝင် စည်းမျဉ်းနှင့် အကူအညီ။ ဆုချီးမြှင့်မှုကို ဆာဗာက ဆုံးဖြတ်သည်။",
    helpPending: "လက်မှတ် Phase 8 — စည်းမျဉ်းအတွက် paytable/ကြေညာချက် ကြည့်ပါ။",
    overlayWaitSpin: "လှည့်ခြင်း ပြီးသည်အထိ စောင့်ပါ",
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
