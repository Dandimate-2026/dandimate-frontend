import { useEffect, useState } from 'react'
import { getPlans } from '../api/plans'
import { USE_MOCK } from '../api/mock'
import { mergePlanCatalog, PLANS, type Plan } from '../lib/plans'

/** 서버 플랜 목록. 받기 전이나 실패하면 기본값. mock 모드에서는 유료 플랜도 고를 수 있게 둔다 */
export function usePlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(() => (USE_MOCK ? PLANS.map((p) => ({ ...p, available: true })) : PLANS))

  useEffect(() => {
    if (USE_MOCK) return
    getPlans()
      .then((items) => {
        if (items) setPlans(mergePlanCatalog(items))
      })
      .catch(() => {
        // 플랜 목록을 못 받으면 기본값으로 보여준다
      })
  }, [])

  return plans
}
