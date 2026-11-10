import type { PlanCatalogItem } from '../lib/plans'
import { request } from './client'

/** 방 만들기 전 서버의 플랜 목록·가격·한도를 조회한다. */
export function getPlans(): Promise<PlanCatalogItem[] | null> {
  return request<PlanCatalogItem[]>('/plans')
}
