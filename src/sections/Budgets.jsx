import { useState } from 'react'
import './balance.css'
import './budgets.css'
import {
  BUDGET_RULES, budgetAccountOptions, effectiveBudget, monthReport, goalActualMap, budgetStatus,
  addBudget, changeBudgetAmount, removeBudget, budgetHistory, hasBudget, isPastBudgetMonth, previousMonth, formatMoney,
} from '../ledgerLogic.js'
import { today } from '../today.js'
import { t } from '../text.js'
import { useConfirm } from './ConfirmDialog.jsx'

const Yen = ({ n, currency }) => <>{formatMoney(n, currency)}</>
const Rate = ({ n }) => <>{n}%</>

// 上限の表（費用）：予算、実績、残り、達成率、判定（超過の行は赤）。最後に合計の行（判定なし）
function LimitTable({ limits, currency }) {
  if (limits.rows.length === 0) return <p className="note">{t('budgets.noLimits')}</p>
  const { total } = limits
  return (
    <table className="budget-table">
      <thead>
        <tr><th>{t('common.account')}</th><th>{t('budgets.budget')}</th><th>{t('budgets.actual')}</th><th>{t('budgets.remaining')}</th><th>{t('budgets.rate')}</th><th>{t('budgets.judgement')}</th></tr>
      </thead>
      <tbody>
        {limits.rows.map((r) => (
          <tr key={r.account.id} className={r.over ? 'over' : ''}>
            <td>{r.account.name}{!r.account.active && <span className="note"> {t('common.inactive')}</span>}</td>
            <td><Yen n={r.budget} currency={currency} /></td>
            <td><Yen n={r.actual} currency={currency} /></td>
            <td><Yen n={r.remaining} currency={currency} /></td>
            <td><Rate n={r.rate} /></td>
            <td>{r.over ? t('budgets.over') : ''}</td>
          </tr>
        ))}
        <tr className="total">
          <td>{t('common.total')}</td><td><Yen n={total.budget} currency={currency} /></td><td><Yen n={total.actual} currency={currency} /></td><td><Yen n={total.remaining} currency={currency} /></td><td><Rate n={total.rate} /></td><td />
        </tr>
      </tbody>
    </table>
  )
}

// 目標の表（取り分け）：目標、実績、不足、達成率、判定（達成・未達。目標を超えても赤くしない）。最後に合計の行（判定なし）
function GoalTable({ goals, currency }) {
  if (goals.rows.length === 0) return <p className="note">{t('budgets.noGoals')}</p>
  const { total } = goals
  return (
    <table className="budget-table">
      <thead>
        <tr><th>{t('common.account')}</th><th>{t('budgets.goal')}</th><th>{t('budgets.actual')}</th><th>{t('budgets.shortfall')}</th><th>{t('budgets.rate')}</th><th>{t('budgets.judgement')}</th></tr>
      </thead>
      <tbody>
        {goals.rows.map((r) => (
          <tr key={r.account.id}>
            <td>{r.account.name}{!r.account.active && <span className="note"> {t('common.inactive')}</span>}</td>
            <td><Yen n={r.budget} currency={currency} /></td>
            <td><Yen n={r.actual} currency={currency} /></td>
            <td><Yen n={r.shortfall} currency={currency} /></td>
            <td><Rate n={r.rate} /></td>
            <td>{r.status === 'achieved' ? t('budgets.achieved') : t('budgets.notAchieved')}</td>
          </tr>
        ))}
        <tr className="total">
          <td>{t('common.total')}</td><td><Yen n={total.budget} currency={currency} /></td><td><Yen n={total.actual} currency={currency} /></td><td><Yen n={total.shortfall} currency={currency} /></td><td><Rate n={total.rate} /></td><td />
        </tr>
      </tbody>
    </table>
  )
}

// 履歴の1件：金額だけ変更でき、削除できる（適用開始月は変えられない）。今月より前の適用開始月は、確認画面を出す
function HistoryRow({ budget, data, update }) {
  const [amountText, setAmountText] = useState(String(budget.amount))
  const [error, setError] = useState('')
  const past = isPastBudgetMonth(budget.startMonth, today())
  const confirm = useConfirm()

  const change = async () => {
    const r = changeBudgetAmount(data.budgets, budget.id, amountText) // 先に検証する
    if (r.error) return setError(r.error)
    setError('')
    if (past && !(await confirm({ message: t('budgets.pastMessage') }))) return
    update({ ...data, budgets: r.budgets })
  }

  const remove = async () => {
    if (!(await confirm({ message: past ? t('budgets.deleteConfirmPast', { message: t('budgets.pastMessage') }) : t('budgets.deleteConfirm') }))) return
    update({ ...data, budgets: removeBudget(data.budgets, budget.id) })
  }

  return (
    <li>
      <span className="start">{t('budgets.fromMonth', { month: budget.startMonth })}</span>
      <span className="amount"><Yen n={budget.amount} currency={data.settings.currency} /></span>
      <input inputMode="numeric" aria-label={t('common.amount')} value={amountText} onChange={(e) => setAmountText(e.target.value)} />
      <button type="button" onClick={change}>{t('budgets.changeAmount')}</button>
      <button type="button" onClick={remove}>{t('common.delete')}</button>
      {error && <span className="error">{error}</span>}
    </li>
  )
}

export default function Budgets({ data, update }) {
  const { accounts, entries, budgets } = data
  const currency = data.settings.currency
  const [month, setMonth] = useState(() => today().slice(0, 7)) // 初期表示は今月
  const status = month ? budgetStatus(budgets, accounts, monthReport(accounts, entries, month), goalActualMap(entries, accounts, budgets, month), month) : null

  const [kind, setKind] = useState('limit')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [startMonth, setStartMonth] = useState(() => today().slice(0, 7))
  const [error, setError] = useState('')

  const confirm = useConfirm()

  const add = async (e) => {
    e.preventDefault()
    const r = addBudget(budgets, accounts, { kind, accountId, amountText: amount, startMonth }) // 先に検証する
    if (r.error) return setError(r.error) // 入力途中の内容は消さない
    setError('')
    if (isPastBudgetMonth(startMonth, today()) && !(await confirm({ message: t('budgets.pastMessage') }))) return
    update({ ...data, budgets: r.budgets })
    setAmount('')
  }

  const budgeted = accounts.filter((a) => hasBudget(a, budgets))

  return (
    <div className="report budgets">
      <h2>{t('budgets.title')}</h2>
      <div className="month-bar">
        <input type="month" aria-label={t('common.month')} value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" onClick={() => setMonth(today().slice(0, 7))}>{t('common.thisMonth')}</button>
        <button type="button" onClick={() => setMonth(previousMonth(today()))}>{t('common.lastMonth')}</button>
      </div>
      {!month ? <p className="note">{t('common.chooseMonth')}</p> : (
        <>
          <h3>{t('budgets.limitTitle')}</h3>
          <LimitTable limits={status.limits} currency={currency} />
          {status.unset.length > 0 && (
            <>
              <h3>{t('budgets.unsetTitle')}</h3>
              <table className="budget-table">
                <thead>
                  <tr><th>{t('common.account')}</th><th>{t('budgets.actual')}</th></tr>
                </thead>
                <tbody>
                  {status.unset.map((r) => <tr key={r.account.id}><td>{r.account.name}</td><td><Yen n={r.actual} currency={currency} /></td></tr>)}
                </tbody>
              </table>
            </>
          )}
          <h3>{t('budgets.goalTitle')}</h3>
          <GoalTable goals={status.goals} currency={currency} />
        </>
      )}

      <h3>{t('budgets.addTitle')}</h3>
      <form onSubmit={add}>
        <select aria-label={t('budgets.kind')} value={kind} onChange={(e) => { setKind(e.target.value); setAccountId('') }}>
          {Object.entries(BUDGET_RULES).map(([k, rule]) => <option key={k} value={k}>{rule.label}</option>)}
        </select>
        <select aria-label={t('common.account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">{t('common.chooseAccount')}</option>
          {budgetAccountOptions(accounts, kind).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input inputMode="numeric" placeholder={t('common.amount')} aria-label={t('common.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label>{t('budgets.startMonth')}{' '}<input type="month" aria-label={t('budgets.startMonth')} value={startMonth} onChange={(e) => setStartMonth(e.target.value)} /></label>
        <button>{t('common.add')}</button>
        {error && <span className="error">{error}</span>}
      </form>
      <p className="note">{t('budgets.note')}</p>

      <h3>{t('budgets.historyTitle')}</h3>
      {budgeted.length === 0 ? <p className="note">{t('budgets.empty')}</p> : budgeted.map((account) => {
        const history = budgetHistory(budgets, account.id)
        const now = effectiveBudget(budgets, account.id, today().slice(0, 7))
        return (
          <details key={account.id} className={account.active ? '' : 'inactive'}>
            <summary>
              {account.name}{t('budgets.kindWrap', { kind: BUDGET_RULES[history[0].kind]?.label })}
              {!account.active && <span className="note"> {t('common.inactive')}</span>}
              <span className="note"> {now ? t('budgets.thisMonthNow', { amount: formatMoney(now.amount, currency) }) : t('budgets.noBudgetThisMonth')}</span>
            </summary>
            <ul>
              {history.map((b) => <HistoryRow key={`${b.id}:${b.amount}`} budget={b} data={data} update={update} />)}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
