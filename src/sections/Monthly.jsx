import { useState } from 'react'
import './balance.css'
import '../print.css'
import { monthReport, balanceSheet, balanceSheetColumns, profitLossRows, previousMonth, issuedLabel, formatYen, formatMoney, currencyUnit } from '../ledgerLogic.js'
import { today } from '../today.js'
import { t } from '../text.js'

const cls = (n) => (n < 0 ? 'neg' : '')

// 月の集計の行（科目名と金額。通貨の文字つき）
const Line = ({ name, amount, currency }) => (
  <tr>
    <td>{name}</td>
    <td className={cls(amount)}>{formatMoney(amount, currency)}</td>
  </tr>
)

// 通常の表示：見出しを押すと開く（初期は閉じる）。印刷用表示：すべて開いた表示（開閉の三角を出さない）
function Section({ printView, title, extra, children }) {
  if (printView) return <section className="print-section"><h2>{title}</h2>{extra}{children}</section>
  return <details><summary><h2>{title}</h2>{extra}</summary>{children}</details>
}

// P/L：報告書の形（収益の部、費用の部、当期収支、残高調整）。並びは profitLossRows のまま。金額は数字だけ（単位は見出しの横）
function ProfitLossTable({ report }) {
  return (
    <table className="statement">
      <tbody>
        {profitLossRows(report).map((r, i) => (
          <tr key={i} className={r.kind}>
            <td>{r.name}</td>
            <td className={cls(r.amount)}>{r.amount !== null && formatYen(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// B/S：勘定式（左に資産の部、右に負債の部と純資産の部）。下に、資産合計と負債・純資産合計。並びは balanceSheetColumns のまま
function BalanceSheetTable({ sheet }) {
  const { left, right, leftTotal, rightTotal } = balanceSheetColumns(sheet)
  const rows = Math.max(left.length, right.length) // 左右の長さをそろえるために、空のセルを足すだけ
  const amount = (c) => (c && c.amount !== null ? formatYen(c.amount) : '')
  return (
    <table className="statement bs">
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <td className={`name ${left[i]?.kind ?? ''}`}>{left[i]?.name}</td>
            <td className={`${left[i]?.kind ?? ''} ${cls(left[i]?.amount)}`}>{amount(left[i])}</td>
            <td className={`text name right ${right[i]?.kind ?? ''}`}>{right[i]?.name}</td>
            <td className={`${right[i]?.kind ?? ''} ${cls(right[i]?.amount)}`}>{amount(right[i])}</td>
          </tr>
        ))}
        <tr className="total">
          <td>{leftTotal.name}</td>
          <td className={cls(leftTotal.amount)}>{formatYen(leftTotal.amount)}</td>
          <td className="text right">{rightTotal.name}</td>
          <td className={cls(rightTotal.amount)}>{formatYen(rightTotal.amount)}</td>
        </tr>
      </tbody>
    </table>
  )
}

export default function Monthly({ data }) {
  const { accounts, entries } = data
  const currency = data.settings.currency
  const [month, setMonth] = useState(() => previousMonth(today())) // 初期表示は前月
  const [printView, setPrintView] = useState(false)
  const report = month ? monthReport(accounts, entries, month) : null
  const sheet = month ? balanceSheet(accounts, entries, month) : null
  const adj = report?.adjustment

  return (
    <div className={`report${printView ? ' print-view' : ''}`}>
      {printView ? <h2 className="print-title">{t('monthly.printTitle')}{month && t('monthly.inMonth', { month })}</h2> : <h2>{t('monthly.title')}</h2>}
      {printView && <p className="issued">{issuedLabel(today())}</p>}
      <div className="month-bar no-print">
        <input type="month" aria-label={t('common.month')} value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" onClick={() => setMonth(today().slice(0, 7))}>{t('common.thisMonth')}</button>
        <button type="button" onClick={() => setMonth(previousMonth(today()))}>{t('common.lastMonth')}</button>
        {!printView && <button type="button" onClick={() => setPrintView(true)}>{t('monthly.printView')}</button>}
      </div>
      {printView && (
        <div className="month-bar no-print">
          <button type="button" onClick={() => window.print()}>{t('monthly.print')}</button>
          <button type="button" onClick={() => setPrintView(false)}>{t('monthly.back')}</button>
          <span className="note">{t('monthly.printNote')}</span>
        </div>
      )}
      {!month ? <p className="note">{t('common.chooseMonth')}</p> : (
        <>
          <Section
            printView={printView}
            title={t('monthly.summaryTitle', { month })}
            extra={<span className={`value ${cls(report.result)}`}>{t('monthly.result')} {formatMoney(report.result, currency)}</span>}
          >
            <table>
              <tbody>
                <Line name={t('monthly.revenueTotal')} amount={report.revenueTotal} currency={currency} />
                <Line name={t('monthly.expenseTotal')} amount={report.expenseTotal} currency={currency} />
                {(adj.gain !== 0 || adj.loss !== 0) && <Line name={t('monthly.adjustmentLine')} amount={adj.net} currency={currency} />}
              </tbody>
            </table>
            <p className="note">{t('monthly.noteSummary')}</p>
          </Section>

          <Section printView={printView} title={t('monthly.plTitle', { month })}>
            <p className="note">{t('monthly.unit', { unit: currencyUnit(currency) })}</p>
            <ProfitLossTable report={report} />
          </Section>

          <Section
            printView={printView}
            title={t('monthly.bsTitle', { month })}
            extra={!sheet.balanced && <span className="value error">{t('monthly.bsUnbalancedBadge')}</span>}
          >
            <p className="note">{t('monthly.unit', { unit: currencyUnit(currency) })}</p>
            <BalanceSheetTable sheet={sheet} />
            {sheet.balanced
              ? <p className="note">{t('monthly.bsBalanced')}</p>
              : <p className="error">{t('monthly.bsUnbalanced')}</p>}
            <p className="note">{t('monthly.bsNote')}</p>
          </Section>
        </>
      )}
    </div>
  )
}
