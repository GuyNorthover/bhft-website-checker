import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface TierContextType {
  tier: number
  setTier: (tier: number, token: string) => void
  clearTier: () => void
  isTestMode: boolean
  verifying: boolean
}

const TierContext = createContext<TierContextType>({
  tier: 1, setTier: () => {}, clearTier: () => {}, isTestMode: false, verifying: false
})

export function TierProvider({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState(1)
  const [isTestMode, setIsTestMode] = useState(false)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('hc_tier_token')
    const savedTier = localStorage.getItem('hc_tier')
    if (savedToken && savedTier) {
      // Quick local check — full verify happens async
      setTierState(Number(savedTier))
      setIsTestMode(savedToken.startsWith('test_'))
      // Verify with backend
      fetch(`/api/checkout/verify?token=${savedToken}`)
        .then(r => r.json())
        .then(data => {
          if (data.valid) {
            setTierState(data.tier)
            setIsTestMode(data.testMode)
          } else {
            localStorage.removeItem('hc_tier_token')
            localStorage.removeItem('hc_tier')
            setTierState(1)
          }
        })
        .catch(() => {}) // Keep local state if network fails
        .finally(() => setVerifying(false))
    } else {
      setVerifying(false)
    }
  }, [])

  function setTier(newTier: number, token: string) {
    setTierState(newTier)
    setIsTestMode(token.startsWith('test_'))
    localStorage.setItem('hc_tier', String(newTier))
    localStorage.setItem('hc_tier_token', token)
  }

  function clearTier() {
    setTierState(1)
    localStorage.removeItem('hc_tier')
    localStorage.removeItem('hc_tier_token')
  }

  return (
    <TierContext.Provider value={{ tier, setTier, clearTier, isTestMode, verifying }}>
      {children}
    </TierContext.Provider>
  )
}

export function useTier() { return useContext(TierContext) }
