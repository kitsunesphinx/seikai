import { useState } from 'react'
import './balance.css'
import { TYPE_LABELS, accountBalances, freeAmount, budgetFreeAmount, typeTotals, formatYen, currencyUnit } from '../ledgerLogic.js'
import { BALANCE_VIEWS, BALANCE_VIEW_LABELS, loadBalanceView } from '../storage.js'
import { today } from '../today.js'
import { t } from '../text.js'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function Balance({ data }) {
  const { accounts, entries } = data
  const unit = currencyUnit(data.settings.currency)
  const free = freeAmount(accounts, entries)
  // 自由に使える額の表示：最初は設定（ブラウザごとに覚えた「残高の表示」）。ボタンで切り替えた状態は覚えない（画面を移ると、設定の値に戻る）
  const [view, setView] = useState(loadBalanceView)
  const budgeted = budgetFreeAmount(accounts, entries, data.budgets, today().slice(0, 7)) // 今月の予算を反映した額（仕様 5.13）
  const { rows, balanced } = accountBalances(accounts, entries)

  return (
    <div className="report">
      <h2>{t('balance.freeTitle')}</h2>
      <div className="view-toggle" role="group" aria-label={t('balance.viewLabel')}>
        {BALANCE_VIEWS.map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{t(BALANCE_VIEW_LABELS[v])}</button>
        ))}
      </div>
      {view === 'actual' ? (
        <p className="free">
          <Num n={free.total} />{unit}
          {free.items.length > 0 && (
            <span className="note">
              {t('balance.freeOpen')}
              {free.items.map((item, i) => (
                <span key={item.id}>{i > 0 && t('common.separator')}{item.name} <Num n={item.balance} /></span>
              ))}
              {t('balance.freeClose')}
            </span>
          )}
        </p>
      ) : (
        // 予算反映：自由に使える額 − 今月の上限の残り − 今月の目標の不足。内訳は、実際の額と、引いた額（科目ごと。0の科目は出さない）。引く額が0のときも、形はそろえる
        <p className="free">
          <Num n={budgeted.total} />{unit}
          <span className="note">
            {t('balance.freeOpen')}
            {t('balance.freeTitle')} <Num n={budgeted.free} />{t('common.separator')}{t('balance.budgetReserved')} <Num n={budgeted.reserved === 0 ? 0 : -budgeted.reserved} />
            {budgeted.items.length > 0 && t('common.colon')}
            {budgeted.items.map((item, i) => (
              <span key={item.id}>{i > 0 && t('common.separator')}{item.name} <Num n={item.amount} /></span>
            ))}
            {t('balance.freeClose')}
          </span>
        </p>
      )}
      {!balanced && <p className="error">{t('balance.unbalanced')}</p>}
      <h2>{t('balance.title')}</h2>
      {['asset', 'liability'].map((type) => {
        const total = typeTotals(rows, type)
        return (
        <section key={type}>
          <h3>{TYPE_LABELS[type]}</h3>
          <table>
            <thead>
              <tr><th>{t('common.account')}</th><th>{t('balance.debitTotal')}</th><th>{t('balance.creditTotal')}</th><th>{t('common.balance')}</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.account.type === type && (r.account.active || r.used)).map((r) => (
                <tr key={r.account.id} className={r.account.active ? '' : 'inactive'}>
                  <td>{r.account.name}{!r.account.active && <span className="note"> {t('common.inactive')}</span>}</td>
                  <td>{formatYen(r.debit)}</td>
                  <td>{formatYen(r.credit)}</td>
                  <td className={r.balance < 0 ? 'neg' : ''}>{formatYen(r.balance)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>{t('common.total')}</td>
                <td>{formatYen(total.debit)}</td>
                <td>{formatYen(total.credit)}</td>
                <td className={total.balance < 0 ? 'neg' : ''}>{formatYen(total.balance)}</td>
              </tr>
            </tbody>
          </table>
        </section>
        )
      })}
      <p className="note">{t('balance.note')}</p>
    </div>
  )
}
