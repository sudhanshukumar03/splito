import type { ReactNode } from 'react'
import { useHomeWorkspace } from '../lib/home-context'
import { Icon } from './Icon'
import { PageState } from './PageState'

export function HomePageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <h1 id="page-title" tabIndex={-1}>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}
export function RefreshHome() {
  const { loading, refresh } = useHomeWorkspace()
  return (
    <button
      type="button"
      className="icon-button refresh-button"
      aria-label="Refresh household data"
      title="Refresh household data"
      disabled={loading}
      onClick={() => void refresh()}
    >
      {loading ? <span className="spinner" /> : <Icon name="refresh" size={18} />}
    </button>
  )
}
export function HomeDataState() {
  const { loading, refresh } = useHomeWorkspace()
  return (
    <PageState
      loading={loading}
      title={loading ? 'Loading household...' : 'Household unavailable'}
      description={
        loading
          ? 'Fetching the latest household records.'
          : 'Try loading again, or choose another home if this address is no longer available.'
      }
      action={loading ? undefined : 'Retry loading'}
      onAction={() => void refresh()}
    />
  )
}
