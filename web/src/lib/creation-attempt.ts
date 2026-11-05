// A confirmed creation and its following read are separate outcomes. Retrying the
// read must never repeat a POST that has already returned a successful response.
export class CreationAttempt {
  committed = false
  private pending = false

  async run(create: () => Promise<unknown>, refresh: () => Promise<boolean>): Promise<boolean> {
    if (this.pending) return false
    this.pending = true
    try {
      if (!this.committed) {
        await create()
        this.committed = true
      }
      return await refresh()
    } finally {
      this.pending = false
    }
  }
}
