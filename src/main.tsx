import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GlobalLayout from './layout/globallayout.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalLayout>
      <App />
    </GlobalLayout>
  </StrictMode>,
)
