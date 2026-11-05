import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type Bill, errorMessage, type HomeDetails, type PaidShare } from './api'
import { forgetPayment, paymentKey } from './payment-attempts'
import { rememberHome } from './storage'

export function useHome(homeId: string) {
  const [data, setData] = useState<{ home: HomeDetails; bills: Bill[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const version = useRef(0)
  const mounted = useRef(false)
  const readController = useRef<AbortController | null>(null)
  const payments = useRef(new Map<string, AbortController>())
  const confirmed = useRef(new Map<string, PaidShare>())

  const refresh = useCallback(async () => {
    const current = ++version.current
    readController.current?.abort()
    const controller = new AbortController()
    readController.current = controller
    setLoading(true)
    setError('')
    try {
      let [home, result] = await Promise.all([
        api.home(homeId, controller.signal),
        api.bills(homeId, controller.signal),
      ])
      // Members can be added between these independent reads. Resolve names once more.
      const known = new Set(home.members.map((item) => item.id))
      if (result.bills.some((bill) => bill.shares.some((share) => !known.has(share.memberId))))
        home = await api.home(homeId, controller.signal)
      if (
        home.id !== homeId ||
        home.members.some((item) => item.homeId !== homeId) ||
        result.bills.some(
          (bill) =>
            bill.homeId !== homeId ||
            bill.shares.some((share) => !home.members.some((item) => item.id === share.memberId)),
        )
      )
        throw new ApiError('The household data is inconsistent. Please refresh to try again.')
      if (!mounted.current || current !== version.current) return false
      // Payments are monotonic. A GET started earlier must not undo a confirmed POST.
      const merged = result.bills.map((bill) => ({
        ...bill,
        shares: bill.shares.map((share) => confirmed.current.get(share.id) ?? share),
      }))
      for (const bill of merged)
        for (const share of bill.shares)
          if (share.paidAt !== null) forgetPayment(homeId, bill.id, share.id)
      rememberHome(home)
      setData({ home, bills: merged })
      setPaymentErrors({})
      return true
    } catch (failure) {
      if (mounted.current && current === version.current) setError(errorMessage(failure))
      return false
    } finally {
      if (mounted.current && current === version.current) setLoading(false)
    }
  }, [homeId])

  useEffect(() => {
    mounted.current = true
    void refresh()
    const activePayments = payments.current
    return () => {
      mounted.current = false
      version.current++
      readController.current?.abort()
      for (const controller of activePayments.values()) controller.abort()
    }
  }, [refresh])

  async function pay(bill: Bill, shareId: string) {
    if (payments.current.has(shareId) || confirmed.current.has(shareId)) return
    const controller = new AbortController()
    payments.current.set(shareId, controller)
    setPending(new Set(payments.current.keys()))
    setPaymentErrors((previous) => ({ ...previous, [shareId]: '' }))
    setNotice('')
    try {
      const saved = await api.pay(
        bill.id,
        shareId,
        paymentKey(homeId, bill.id, shareId),
        controller.signal,
      )
      const original = bill.shares.find((share) => share.id === shareId)
      if (
        !original ||
        saved.id !== shareId ||
        saved.memberId !== original.memberId ||
        saved.amountCents !== original.amountCents
      )
        throw new ApiError(
          'The payment response did not match this share. Refresh to check its status.',
        )
      if (!mounted.current) return
      confirmed.current.set(shareId, saved)
      forgetPayment(homeId, bill.id, shareId)
      setData(
        (previous) =>
          previous && {
            ...previous,
            bills: previous.bills.map((item) =>
              item.id === bill.id
                ? {
                    ...item,
                    shares: item.shares.map((share) => (share.id === shareId ? saved : share)),
                  }
                : item,
            ),
          },
      )
      setNotice('Payment recorded.')
    } catch (failure) {
      if (mounted.current)
        setPaymentErrors((previous) => ({
          ...previous,
          [shareId]:
            failure instanceof ApiError && failure.status === 409
              ? 'This share was paid in another attempt. Refresh to confirm its status.'
              : `${errorMessage(failure)} Retry safely with the same payment attempt.`,
        }))
    } finally {
      payments.current.delete(shareId)
      if (mounted.current) setPending(new Set(payments.current.keys()))
    }
  }
  return { data, loading, error, pending, paymentErrors, notice, refresh, pay }
}
