import { useEffect, useState } from 'react'
import { getPlans, PAYMENT_DEMO } from '../api/plans'
import { USE_MOCK } from '../api/mock'
import { mergePlanCatalog, PLANS, type Plan } from '../lib/plans'

/** 서버 플랜 목록. 받기 전이나 실패하면 기본값. mock 모드에서는 유료 플랜도 고를 수 있게 둔다 */
export function usePlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(() =>
    USE_MOCK || PAYMENT_DEMO ? PLANS.map((p) => ({ ...p, available: true })) : PLANS,
  )

  useEffect(() => {
    if (USE_MOCK) return
    getPlans()
      .then((items) => {
        // 결제 화면 시연 중에는 서버가 아직 못 만든다고 한 유료 플랜(roomCreationAvailable=false)도 고를 수 있게 둔다
        if (items) setPlans(mergePlanCatalog(items).map((p) => (PAYMENT_DEMO ? { ...p, available: true } : p)))
      })
      .catch(() => {
        // 플랜 목록을 못 받으면 기본값으로 보여준다
      })
  }, [])

  return plans
}
