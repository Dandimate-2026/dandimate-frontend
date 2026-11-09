import { useCallback } from 'react'
import { resolvePath, useLocation, useNavigate, type NavigateFunction, type NavigateOptions, type To } from 'react-router'

type RouteState = Record<string, unknown> & { returnTargets?: Record<string, number> }
const routeState = (value: unknown): RouteState => value && typeof value === 'object' && !Array.isArray(value) ? value as RouteState : {}

/** 상위 화면으로 돌아갈 때 새 기록을 쌓지 않고 실제 이전 화면으로 되돌아간다. */
export function useAppNavigate(): NavigateFunction {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((to: To | number, options?: NavigateOptions) => {
    if (typeof to === 'number') return navigate(to)
    const destination = resolvePath(to, location.pathname)
    const parent = destination.pathname !== location.pathname && (destination.pathname === '/' || location.pathname.startsWith(`${destination.pathname}/`))
    const currentIndex: unknown = window.history.state?.idx
    const currentState = routeState(location.state)
    const previous = currentState.returnTargets ?? {}
    if (parent && !options?.replace && !destination.search && !destination.hash) {
      const targetIndex = previous[destination.pathname]
      if (typeof currentIndex === 'number' && Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < currentIndex) return navigate(targetIndex - currentIndex)
      return navigate(to, { ...options, replace: true })
    }
    const returnTargets = { ...previous }
    if (typeof currentIndex === 'number' && Number.isInteger(currentIndex)) returnTargets[location.pathname] = currentIndex
    return navigate(to, { ...options, state: { ...(currentState.reviewerDemo ? { reviewerDemo: currentState.reviewerDemo } : {}), ...routeState(options?.state), returnTargets } })
  }, [navigate, location.pathname, location.state]) as NavigateFunction
}
