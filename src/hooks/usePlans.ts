import { useEffect, useState } from 'react'
import { getPlans } from '../api/plans'
import { mergePlanCatalog, PLANS, type Plan } from '../lib/plans'

/** 서버 플랜 목록. 받기 전이나 실패하면 기본값을 사용한다. */
export function usePlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(PLANS)

  useEffect(() => {
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
