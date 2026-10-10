import './balance.css'
import { savingsHistory, formatYen, currencyUnit } from '../ledgerLogic.js'
import { t } from '../text.js'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function Savings({ data }) {
  const { accounts, entries } = data
  const unit = currencyUnit(data.settings.currency)
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  const histories = savingsHistory(accounts, entries)

  return (
    <div className="report">
      <h2>{t('savings.title')}</h2>
      {histories.length === 0 && <p className="note">{t('savings.noAccounts')}</p>}
      {histories.map((h) => (
        <section key={h.account.id}>
          <h3>{h.account.name}{t('common.colon')}<Num n={h.balance} />{unit}</h3>
          {h.rows.length === 0 ? <p className="note">{t('savings.noRecords')}</p> : (
            <table>
              <thead>
                <tr><th>{t('common.date')}</th><th>{t('common.otherAccount')}</th><th>{t('common.memo')}</th><th>{t('common.amount')}</th><th>{t('savings.cumulative')}</th></tr>
              </thead>
              <tbody>
                {h.rows.map(({ entry, delta, total }) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{name(entry.debitId === h.account.id ? entry.creditId : entry.debitId)}</td>
                    <td>{entry.memo}</td>
                    <td className={delta < 0 ? 'neg' : ''}>{delta > 0 ? '+' : ''}{formatYen(delta)}{unit}</td>
                    <td><Num n={total} />{unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      <p className="note">{t('savings.note')}</p>
    </div>
  )
}
