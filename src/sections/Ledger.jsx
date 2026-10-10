import { useState } from 'react'
import './ledger.css'
import {
  TYPES, TYPE_LABELS, ROLES, ROLE_LABELS, newAccount, changeType, validateAccountName,
  isProtected, canDeleteAccount, canChangeType, canChangeRole, hasBudget, removeAccountFromSettings,
} from '../ledgerLogic.js'
import { t } from '../text.js'
import { useConfirm } from './ConfirmDialog.jsx'

function RoleSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  )
}

function TypeSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
    </select>
  )
}

function AccountRow({ account, accounts, entries, subscriptions, budgets, onChange, onDelete }) {
  const [name, setName] = useState(account.name)
  const [error, setError] = useState('')
  const confirm = useConfirm()
  const locked = isProtected(account)
  const deletable = canDeleteAccount(account, entries, subscriptions, budgets)
  const typeEditable = canChangeType(account, entries, subscriptions, budgets)
  const roleEditable = canChangeRole(account, budgets) // 予算がある科目は、role も変えられない
  const touch = (patch) => onChange({ ...account, ...patch, updatedAt: new Date().toISOString() })

  const saveName = () => {
    const r = validateAccountName(name, accounts, account.id)
    if (r.error) return setError(r.error)
    setError('')
    if (r.name !== account.name) touch({ name: r.name })
    setName(r.name)
  }

  const remove = async () => {
    if (await confirm({ message: t('ledger.deleteConfirm', { name: account.name }) })) onDelete()
  }

  return (
    <li className={account.active ? '' : 'inactive'}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={saveName}>{t('common.rename')}</button>{' '}
      <TypeSelect value={account.type} disabled={!typeEditable} onChange={(type) => onChange(changeType(account, type, 'other'))} />
      {account.type === 'asset' && <RoleSelect value={account.role} disabled={!roleEditable} onChange={(role) => touch({ role })} />}
      {account.type === 'liability' && (
        <span className="note"> {ROLE_LABELS[account.role]}{account.role === 'card' && t('ledger.cardDays', { closing: account.closingDay, pay: account.payDay })}</span>
      )}{' '}
      <button onClick={() => touch({ active: !account.active })} disabled={locked}>
        {account.active ? t('common.disable') : t('common.enable')}
      </button>
      <button onClick={remove} disabled={!deletable}>{t('common.delete')}</button>
      {!account.active && <span className="note"> {t('common.inactive')}</span>}
      {locked && <div className="note">{t('ledger.noteLocked')}</div>}
      {!locked && !deletable && <div className="note">{t('ledger.noteInUse')}</div>}
      {!locked && account.role === 'card' && <div className="note">{t('ledger.noteCard')}</div>}
      {!locked && hasBudget(account, budgets) &&<div className="note">{t('ledger.noteBudget')}</div>}
      {error && <div className="error">{error}</div>}
    </li>
  )
}

function AddForm({ accounts, onAdd }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [role, setRole] = useState('cash')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const r = validateAccountName(name, accounts)
    if (r.error) return setError(r.error)
    setError('')
    onAdd(newAccount(r.name, type, type === 'asset' ? role : undefined)) // 負債は role が other になる（クレカは、クレカの画面から追加する）
    setName('')
  }

  return (
    <form onSubmit={submit}>
      <TypeSelect value={type} onChange={setType} />
      {type === 'asset' && <RoleSelect value={role} onChange={setRole} />}
      <input placeholder={t('ledger.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
      <button>{t('common.add')}</button>
      {error && <span className="error">{error}</span>}
    </form>
  )
}

export default function Ledger({ data, update }) {
  const { accounts, entries, subscriptions, budgets } = data
  const setAccounts = (next) => update({ ...data, accounts: next })
  // 科目を削除したときは、お気に入りからも外す（1回の update で。2回に分けると、古い data で上書きされる）
  const deleteAccount = (id) => update({ ...data, accounts: accounts.filter((x) => x.id !== id), settings: removeAccountFromSettings(data.settings, id) })

  return (
    <div className="ledger">
      <h2>{t('ledger.title')}</h2>
      <AddForm accounts={accounts} onAdd={(a) => setAccounts([...accounts, a])} />
      {TYPES.map((type) => (
        <section key={type}>
          <h3>{TYPE_LABELS[type]}</h3>
          <ul>
            {accounts.filter((a) => a.type === type).map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                accounts={accounts}
                entries={entries}
                subscriptions={subscriptions}
                budgets={budgets}
                onChange={(next) => setAccounts(accounts.map((x) => (x.id === a.id ? next : x)))}
                onDelete={() => deleteAccount(a.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
