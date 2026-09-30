import VillageCurrencyIcon, { VILLAGE_ORDER, villageKoreanName } from './VillageCurrencyIcon'
import styles from './villageWallet.module.css'

export default function VillageWalletBar({ balances = {} }) {
  return (
    <section className={styles.walletBar} aria-label="여섯 마을 지갑">
      {VILLAGE_ORDER.map((village) => (
        <div className={styles.wallet} key={village} title={villageKoreanName(village)}>
          <VillageCurrencyIcon village={village} className={styles.icon} />
          <span className={styles.name}>{villageKoreanName(village)}</span>
          <strong className={styles.balance}>{Number(balances[village] || 0).toLocaleString('ko-KR')}</strong>
        </div>
      ))}
    </section>
  )
}
