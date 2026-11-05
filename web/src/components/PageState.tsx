import { Icon } from './Icon'

export function PageState({
  title,
  description,
  action,
  onAction,
  loading = false,
}: {
  title: string
  description: string
  action?: string
  onAction?: () => void
  loading?: boolean
}) {
  return (
    <div className="page-state" role={loading ? 'status' : undefined}>
      <span className="state-icon">
        {loading ? <span className="spinner" /> : <Icon name="receipt" size={28} />}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button type="button" className="button primary" onClick={onAction}>
          {action}
          <Icon name="arrow" size={18} />
        </button>
      )}
    </div>
  )
}
