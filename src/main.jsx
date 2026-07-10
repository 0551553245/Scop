import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/theme.css'

const savedLang = localStorage.getItem('scop-lang') || 'en'
document.body.dir = savedLang === 'ar' ? 'rtl' : 'ltr'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
