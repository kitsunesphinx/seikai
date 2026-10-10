// データの読み書きはこのファイルだけで行う。保存先を変えるときはここだけ直す。
import { t, getLanguage } from './text.js'
import { makeInitialAccounts, addKeys, addCardRoles, addPresets, applySubscriptions, emptySettings, sanitizeSettings, defaultCurrency, isCurrency, budgetKindAllows, isBudgetMonth, TYPES, ROLES, LIABILITY_ROLES, PRESETS, KINDS, SPECIAL_KEYS, isDate } from './ledgerLogic.js'

const KEY = 'orenoyome'
export const SCHEMA_VERSION = 8

// 初めての起動と全体の初期化：初期科目はその時点の言語の名前で作り、通貨は言語に合わせる（韓国語ならウォン、それ以外は円）
export const emptyData = (language = getLanguage()) => ({ schemaVersion: SCHEMA_VERSION, skills: [], accounts: makeInitialAccounts(undefined, language), entries: [], subscriptions: [], settings: { ...emptySettings(), currency: defaultCurrency(language) }, budgets: [] })

// 保存されている版が古ければそのまま返す（移行は migrate を呼んだときだけ）
export function loadData() {
  const raw = localStorage.getItem(KEY)
  if (raw === null) return emptyData()
  return JSON.parse(raw)
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export const needsMigration = (data) => data.schemaVersion < SCHEMA_VERSION

// v1（スキルのみ）・v2・v3・v4・v5・v6・v7 → v8。スキルはそのまま引き継ぐ。成功: { data, warnings } / 失敗: { error }（渡したデータは変えない）
// v1：初期科目（language の名前）・仕訳なし。v2：key を付ける（欠けたら error）。v3：そのまま。v4：定期支払いもそのまま。v5：設定（お気に入り）もそのまま。v6：予算もそのまま。
// 負債に role を付ける（v7。key が credit-card → card・締め日31・引き落とし日27、ほか → other）。
// 科目に preset を付ける（v8。名前と区分が、ja・ko どちらかの初期名と同じ科目。key を持つ科目・同じ preset の2つ目には付けない）。settings.currency を足す（v8。language が韓国語ならウォン、それ以外は円）。
// subscriptions（v4 より前は空）、settings（v5 より前は空の初期値）、budgets（v6 より前は空）を足す。
// v7 以前のデータに preset があれば error（v8 の項目なので）。組み立てた結果は、返す前に v8 の検証（key・preset 込み）にかける。保存は、呼ぶ側が成功のときだけ行う。
// warnings：v5・v6・v7 の設定で、その項目だけ無視したときの警告の文（なければ空）
export function migrate(data, language = getLanguage()) {
  let accounts = []
  let entries = []
  let subscriptions = []
  if (data.schemaVersion === 1) {
    accounts = makeInitialAccounts(undefined, language)
  } else {
    if (data.schemaVersion === 2) {
      const r = addKeys(Array.isArray(data.accounts) ? data.accounts : [])
      if (r.error) return r
      accounts = r.accounts
    } else {
      accounts = data.accounts
    }
    entries = data.entries
    if (data.schemaVersion >= 4) subscriptions = data.subscriptions
  }
  if (Array.isArray(accounts)) accounts = addCardRoles(accounts)
  const budgets = data.schemaVersion >= 6 ? data.budgets : []
  const error = checkLedger(accounts, entries, { requireKeys: true, v7: true, v8: data.schemaVersion === 1 }) ?? checkSubscriptions(subscriptions, accounts) ?? checkBudgets(budgets, accounts)
  if (error) return { error }
  accounts = addPresets(accounts)
  const presetError = checkLedger(accounts, entries, { requireKeys: true, v7: true, v8: true }) // 付けた結果の検証
  if (presetError) return { error: presetError }
  let settings = emptySettings()
  let warnings = []
  if (data.schemaVersion >= 5) {
    const r = sanitizeSettings(data.settings, accounts)
    if (r.error) return { error: r.error }
    settings = r.settings
    warnings = r.warnings
  }
  return { data: { schemaVersion: SCHEMA_VERSION, skills: data.skills, accounts, entries, subscriptions, settings: { ...settings, currency: defaultCurrency(language) }, budgets }, warnings }
}

// 定期支払いの自動記入（v4 以降のデータに対して）。今日と now は呼ぶ側から渡す。記入しないときは、同じ data を返す
export function autoRecord(data, today, now) {
  const r = applySubscriptions(data.subscriptions, data.entries, today, now)
  if (r.added === 0) return { data, added: 0 }
  return { data: { ...data, subscriptions: r.subscriptions, entries: r.entries }, added: r.added }
}

// ---- 残高の表示（作業18、仕様 5.13）：残高の画面で、自由に使える額を最初にどちらで出すか。ブラウザごとに覚える（言語と同じ形）。
// 保存データ（orenoyome）・書き出し・セーブファイルには入れない。schemaVersion は変えない。storage は getItem / setItem を持つ物（ブラウザの localStorage、テストでは偽物）
export const BALANCE_VIEW_KEY = 'orenoyome-balance-view'
export const BALANCE_VIEWS = ['actual', 'budget'] // 実際の額、予算を反映した額

// 覚えた値が正しければそれ。なければ・不正な値・読めないとき（storage がない、例外）は 'actual'。例外にしない
export function readBalanceView(storage) {
  try {
    const stored = storage.getItem(BALANCE_VIEW_KEY)
    if (BALANCE_VIEWS.includes(stored)) return stored
  } catch { /* 読めなければ 'actual' */ }
  return 'actual'
}

// 正しい値だけ覚える。書けなくても例外にしない（覚えられなくても、今の画面は変わる）
export function saveBalanceView(storage, view) {
  if (!BALANCE_VIEWS.includes(view)) return
  try {
    storage.setItem(BALANCE_VIEW_KEY, view)
  } catch { /* 覚えられなくてもよい */ }
}

// 画面から使う入口：ブラウザの localStorage を使う。localStorage の取り出しで例外が出ても（使えない設定など）、読むときは 'actual'、書くときは何もしない
const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
export const loadBalanceView = () => readBalanceView(browserStorage())
export const rememberBalanceView = (view) => saveBalanceView(browserStorage(), view)
export const BALANCE_VIEW_LABELS = { actual: 'balance.viewActual', budget: 'balance.viewBudget' } // ボタン・選択肢の文言（辞書のキー）

// 書き出し：schemaVersion を一番上に、書き出し日時を付ける。残りのデータ（skills, accounts, entries, subscriptions, settings, budgets）はそのまま入れる
export function exportJson() {
  const { schemaVersion, ...rest } = loadData()
  return JSON.stringify({ schemaVersion, exportedAt: new Date().toISOString(), ...rest }, null, 2)
}

const isStr = (v) => typeof v === 'string'
const isInt = (v) => Number.isInteger(v)
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function validSkill(s) {
  return (
    isObj(s) && isStr(s.id) && isStr(s.name) && isInt(s.level) && s.level >= 0 && s.level <= 500 &&
    isStr(s.createdAt) && isStr(s.updatedAt) &&
    isObj(s.descriptions) &&
    Object.entries(s.descriptions).every(([k, v]) => /^\d+$/.test(k) && Number(k) <= 50 && isStr(v)) &&
    Array.isArray(s.levelHistory) &&
    s.levelHistory.every((h) => isObj(h) && isStr(h.changedAt) && isInt(h.from) && isInt(h.to))
  )
}

const validDay = (d) => isInt(d) && d >= 1 && d <= 31

// 資産は ROLES のどれか。負債は v7 から card・other のどちらか（v6 以前は role なし）。ほかは role なし
function validRole(a, v7) {
  if (a.type === 'asset') return ROLES.includes(a.role)
  if (a.type === 'liability' && v7) return LIABILITY_ROLES.includes(a.role)
  return a.role === undefined
}

// 締め日・引き落とし日：v7 の card の科目だけが持つ（1〜31の整数）。それ以外が持っていたらエラー
function validCardDays(a, v7) {
  if (v7 && a.role === 'card') return validDay(a.closingDay) && validDay(a.payDay)
  return a.closingDay === undefined && a.payDay === undefined
}

// preset：v8 から。表（PRESETS）にあるもの。key を持つ科目は持たない。v7 以前は持たない
function validPreset(a, v8) {
  if (a.preset === undefined) return true
  return v8 && PRESETS.includes(a.preset) && a.key === undefined
}

function validAccount(a, v7, v8) {
  return (
    isObj(a) && isStr(a.id) && isStr(a.name) && a.name.trim() !== '' &&
    TYPES.includes(a.type) &&
    (a.key === undefined || SPECIAL_KEYS.includes(a.key)) &&
    validRole(a, v7) && validCardDays(a, v7) &&
    (!v7 || a.key !== 'credit-card' || a.role === 'card') && validPreset(a, v8) &&
    typeof a.active === 'boolean' && isStr(a.createdAt) && isStr(a.updatedAt)
  )
}

const unique = (list) => new Set(list).size === list.length

function validEntry(e, accountIds) {
  return (
    isObj(e) && isStr(e.id) && isDate(e.date) &&
    accountIds.has(e.debitId) && accountIds.has(e.creditId) && e.debitId !== e.creditId &&
    isInt(e.amount) && e.amount >= 1 && isStr(e.memo) && KINDS.includes(e.kind) &&
    isStr(e.createdAt) && isStr(e.updatedAt)
  )
}

// accounts / entries の検証。エラー文を返す（問題なければ null）。requireKeys: 4つの特別科目の key が揃っていること（v3）。v7: 負債の role・締め日・引き落とし日の検証（v7）。v8: preset の検証（v8。同じ preset の重複もエラー）
function checkLedger(accounts, entries, { requireKeys = false, v7 = false, v8 = false } = {}) {
  if (!Array.isArray(accounts) || !accounts.every((a) => validAccount(a, v7, v8))) return t('import.accountsShape')
  if (!unique(accounts.map((a) => a.id))) return t('import.accountIdDup')
  if (!unique(accounts.map((a) => a.name.trim()))) return t('import.accountNameDup')
  if (!unique(accounts.filter((a) => a.preset !== undefined).map((a) => a.preset))) return t('import.accountPresetDup')
  const keys = accounts.filter((a) => a.key !== undefined).map((a) => a.key)
  if (!unique(keys)) return t('import.accountKeyDup')
  if (requireKeys && !SPECIAL_KEYS.every((k) => keys.includes(k))) return t('import.specialMissing')
  if (!Array.isArray(entries)) return t('import.entriesShape')
  const ids = new Set(accounts.map((a) => a.id))
  if (!entries.every((e) => validEntry(e, ids))) return t('import.entriesInvalid')
  if (!unique(entries.map((e) => e.id))) return t('import.entryIdDup')
  return null
}

function validSubscription(s, accountIds) {
  return (
    isObj(s) && isStr(s.id) && isStr(s.name) && s.name.trim() !== '' && isStr(s.memo) &&
    isInt(s.amount) && s.amount >= 1 && isInt(s.day) && s.day >= 1 && s.day <= 31 &&
    accountIds.has(s.debitId) && accountIds.has(s.creditId) && s.debitId !== s.creditId &&
    typeof s.active === 'boolean' && isStr(s.lastMonth) && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.lastMonth) &&
    isStr(s.createdAt) && isStr(s.updatedAt)
  )
}

// subscriptions の検証。エラー文を返す（問題なければ null）。accounts は検証済みの科目の配列
function checkSubscriptions(subscriptions, accounts) {
  if (!Array.isArray(subscriptions)) return t('import.subsShape')
  const ids = new Set(accounts.map((a) => a.id))
  if (!subscriptions.every((s) => validSubscription(s, ids))) return t('import.subsInvalid')
  if (!unique(subscriptions.map((s) => s.id))) return t('import.subIdDup')
  return null
}

function validBudget(b, accountsById) {
  const account = isObj(b) ? accountsById.get(b.accountId) : undefined
  return (
    isObj(b) && isStr(b.id) && account !== undefined && budgetKindAllows(b.kind, account) &&
    isInt(b.amount) && b.amount >= 1 && isBudgetMonth(b.startMonth) && isStr(b.createdAt) && isStr(b.updatedAt)
  )
}

// budgets の検証。エラー文を返す（問題なければ null）。accounts は検証済みの科目の配列
// 種類と科目の組み合わせ（上限＝調整損以外の費用、目標＝取り分け）・金額・適用開始月・同じ科目と適用開始月の重複は、すべてエラー
function checkBudgets(budgets, accounts) {
  if (!Array.isArray(budgets)) return t('import.budgetsShape')
  const byId = new Map(accounts.map((a) => [a.id, a]))
  if (!budgets.every((b) => validBudget(b, byId))) return t('import.budgetsInvalid')
  if (!unique(budgets.map((b) => b.id))) return t('import.budgetIdDup')
  if (!unique(budgets.map((b) => `${b.accountId} ${b.startMonth}`))) return t('import.budgetPairDup')
  return null
}

// 読み込みファイルの検証のみ。現在のデータには触れない。成功: { data, warnings } / 失敗: { error }
// warnings：設定（お気に入り）で、その項目だけ無視したときの警告の文（なければ空）
export function parseImport(text, language = getLanguage()) {
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return { error: t('import.jsonBroken') }
  }
  if (!isObj(json) || !isInt(json.schemaVersion)) return { error: t('import.notOurFile') }
  if (json.schemaVersion > SCHEMA_VERSION) return { error: t('import.newerVersion') }
  if (json.schemaVersion < 1 || !Array.isArray(json.skills) || !json.skills.every(validSkill))
    return { error: t('import.dataShape') }
  if (json.schemaVersion === 1) return migrate(json, language)
  const error = checkLedger(json.accounts, json.entries, { requireKeys: json.schemaVersion >= 3, v7: json.schemaVersion >= 7, v8: json.schemaVersion >= 8 })
  if (error) return { error }
  if (json.schemaVersion >= 4) {
    const subError = checkSubscriptions(json.subscriptions, json.accounts)
    if (subError) return { error: subError }
  }
  if (json.schemaVersion < 8) return migrate(json, language) // v2〜v7 → v8（migrate が v8 の検証をする。v5〜v7 の設定の警告も返る）
  const r = sanitizeSettings(json.settings, json.accounts)
  if (r.error) return { error: r.error }
  if (!isCurrency(json.settings.currency)) return { error: t('import.currencyInvalid') }
  const budgetError = checkBudgets(json.budgets, json.accounts)
  if (budgetError) return { error: budgetError }
  return {
    data: { schemaVersion: 8, skills: json.skills, accounts: json.accounts, entries: json.entries, subscriptions: json.subscriptions, settings: { ...r.settings, currency: json.settings.currency }, budgets: json.budgets },
    warnings: r.warnings,
  }
}
