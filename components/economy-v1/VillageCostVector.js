import VillageCurrencyIcon, { VILLAGE_ORDER, villageKoreanName } from './VillageCurrencyIcon'
import styles from './villageWallet.module.css'

export function villageShortages(cost = {}, balances = {}) {
  return VILLAGE_ORDER.flatMap((village) => {
    const shortage = Math.max(0, Number(cost[village] || 0) - Number(balances[village] || 0))
    return shortage > 0 ? [{ village, shortage }] : []
  })
}

export default function VillageCostVector({ cost = {}, balances, showExpected = false }) {
  const entries = VILLAGE_ORDER.filter((village) => Number(cost[village] || 0) > 0)
  return (
    <div className={styles.costVector} aria-label="마을별 가격">
      {entries.map((village) => {
        const amount = Number(cost[village])
        const balance = balances == null ? null : Number(balances[village] || 0)
        const shortage = balance == null ? 0 : Math.max(0, amount - balance)
        const expected = balance == null ? null : balance - amount
        return (
          <span
            className={`${styles.cost} ${shortage > 0 ? styles.short : ''}`}
            key={village}
            title={`${villageKoreanName(village)} ${amount}${shortage > 0 ? `, ${shortage} 부족` : ''}`}
          >
            <VillageCurrencyIcon village={village} className={styles.costIcon} />
            <span>{amount}</span>
            {shortage > 0 && <em>{shortage} 부족</em>}
            {showExpected && shortage === 0 && <small>→ {expected.toLocaleString('ko-KR')}</small>}
          </span>
        )
      })}
    </div>
  )
}
