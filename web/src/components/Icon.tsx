export type IconName =
  | 'home'
  | 'grid'
  | 'receipt'
  | 'people'
  | 'plus'
  | 'arrow'
  | 'check'
  | 'check-circle'
  | 'clock'
  | 'refresh'
  | 'close'
  | 'search'
  | 'info'
  | 'link'
  | 'wallet'
  | 'split'
  | 'chevron'

// A single 24px outline grid keeps navigation, actions, and status tags consistent.
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',
  people:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  'check-circle': 'm8 12 3 3 5-6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.09 7A7 7 0 0 1 18 5l2 7M4 12l2 7a7 7 0 0 0 11.91-2',
  close: 'm6 6 12 12M6 18 18 6',
  search: 'm21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M20 12h-4v5h4M17 14.5h.01',
  split: 'M12 21v-8M12 13 5 6M12 13l7-7M3 10V4h6M15 4h6v6',
  chevron: 'm9 5 7 7-7 7',
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export function Brand() {
  return (
    <span className="brand">
      <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="9" fill="var(--brand-fill)" />
        <path
          d="M11 12h6M11 20h6M11 28h6M25 12h4M25 20h4M25 28h4M21 9v22"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span>Splito</span>
    </span>
  )
}

export function Avatar({
  name,
  index = 0,
  small = false,
}: {
  name: string
  index?: number
  small?: boolean
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0])
    .join('')
    .toUpperCase()
  return (
    <span className={`avatar avatar-${index % 4}${small ? ' small' : ''}`} aria-hidden="true">
      {initials}
    </span>
  )
}
