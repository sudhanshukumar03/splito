export type RecentHome = { id: string; name: string }
const homesKey = 'splito-homes'
export function recentHomes(): RecentHome[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(homesKey) ?? '[]')
    if (!Array.isArray(saved)) return []
    const seen = new Set<string>()
    return saved
      .filter(
        (item): item is RecentHome =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          item.id.trim().length > 0 &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
      .slice(0, 8)
  } catch {
    return []
  }
}
export function rememberHome(home: RecentHome): void {
  try {
    localStorage.setItem(
      homesKey,
      JSON.stringify([home, ...recentHomes().filter((item) => item.id !== home.id)].slice(0, 8)),
    )
  } catch {
    /* The home URL still works without browser storage. */
  }
}
