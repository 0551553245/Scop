import { createContext, useContext, useState } from 'react'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('scop-lang') || 'en')
  const isAr = lang === 'ar'
  const isRTL = isAr

  function toggleLang() {
    const next = lang === 'en' ? 'ar' : 'en'
    setLang(next)
    localStorage.setItem('scop-lang', next)
    document.body.dir = next === 'ar' ? 'rtl' : 'ltr'
  }

  return (
    <LanguageContext.Provider value={{ lang, isAr, isRTL, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
