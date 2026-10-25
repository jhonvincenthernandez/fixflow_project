import { useIonRouter } from '@ionic/vue'

/**
 * Navigation through Ionic's router so page transitions and the hardware back button work.
 * Links are real <a href> elements (see AppLink); this is only the click handler behind them.
 */
export function useNavigate() {
  const ionRouter = useIonRouter()
  return {
    push: (path: string): void => ionRouter.push(path),
    replace: (path: string): void => ionRouter.replace(path),
    back: (fallbackPath: string): void => {
      if (ionRouter.canGoBack()) ionRouter.back()
      else ionRouter.replace(fallbackPath)
    },
  }
}
