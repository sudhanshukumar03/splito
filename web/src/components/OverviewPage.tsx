import { Link } from '@tanstack/react-router'
import { useHomeWorkspace } from '../lib/home-context'
import { money } from '../lib/money'
import { HomeDataState, HomePageHeader } from './HomePageHeader'

export function OverviewPage() {
  const { data, homeId, ledger } = useHomeWorkspace()
  const openBills = data && ledger ? data.bills.length - ledger.settledBills : 0
  return (
    <div className="overview-page">
      <HomePageHeader title="Overview">
        {data && data.home.members.length === 0 && (
          <Link className="button primary" to="/homes/$homeId/housemates" params={{ homeId }}>
            Add housemates
          </Link>
        )}
      </HomePageHeader>
      {!data || !ledger ? (
        <HomeDataState />
      ) : (
        <section className="overview-summary" aria-label="Household summary">
          <span className="metric-label">Total outstanding</span>
          <strong
            className={`balance-amount${ledger.outstandingCents > 0n ? ' has-outstanding' : ''}`}
          >
            {money(ledger.outstandingCents)}
          </strong>
          <p className="balance-context">
            {openBills} {openBills === 1 ? 'bill with' : 'bills with'} unpaid shares
          </p>
          <dl className="overview-metrics">
            <div>
              <dt>Total expenses</dt>
              <dd>{money(ledger.totalCents)}</dd>
            </div>
            <div>
              <dt>Open bills</dt>
              <dd>{openBills}</dd>
            </div>
            <div>
              <dt>Housemates</dt>
              <dd>{data.home.members.length}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}
