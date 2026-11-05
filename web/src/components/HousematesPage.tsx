import { useHomeWorkspace } from '../lib/home-context'
import { money } from '../lib/money'
import { HomeDataState, HomePageHeader } from './HomePageHeader'
import { Avatar, Icon } from './Icon'
import { PageState } from './PageState'

export function HousematesPage() {
  const { data, ledger, openDialog, loading } = useHomeWorkspace()
  return (
    <div className="housemates-page">
      <HomePageHeader title="Housemates">
        <button
          type="button"
          className="button primary"
          disabled={!data || loading}
          onClick={() => openDialog('member')}
        >
          <Icon name="plus" size={18} />
          Add housemate
        </button>
      </HomePageHeader>
      {!data || !ledger ? (
        <HomeDataState />
      ) : ledger.members.length ? (
        <div className="member-directory">
          <table className="member-table" aria-label="Household members">
            <thead>
              <tr>
                <th scope="col" className="member-column">
                  Member
                </th>
                <th scope="col" className="balance-column">
                  Outstanding balance
                </th>
                <th scope="col" className="desktop-column">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {ledger.members.map(
                ({ member, outstandingCents, totalShares, unpaidShares }, index) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-cell">
                        <Avatar name={member.name} index={index} />
                        <div>
                          <strong>{member.name}</strong>
                          <small>
                            {totalShares === 0
                              ? 'No bill shares yet'
                              : unpaidShares === 0
                                ? 'All shares paid'
                                : unpaidShares +
                                  ' unpaid ' +
                                  (unpaidShares === 1 ? 'share' : 'shares')}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="amount-cell">
                      <strong>{money(outstandingCents)}</strong>
                    </td>
                    <td className="desktop-column">
                      <span
                        className={
                          'status-pill' +
                          (totalShares === 0 ? ' neutral' : unpaidShares === 0 ? ' settled' : '')
                        }
                      >
                        <Icon
                          name={
                            totalShares > 0 && unpaidShares === 0
                              ? 'check-circle'
                              : totalShares === 0
                                ? 'people'
                                : 'clock'
                          }
                          size={14}
                        />
                        {totalShares === 0
                          ? 'No shares'
                          : unpaidShares === 0
                            ? 'Settled'
                            : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState
          title="No housemates yet"
          description="Add household members before creating your first shared bill."
          action="Add your first housemate"
          onAction={() => openDialog('member')}
        />
      )}
    </div>
  )
}
