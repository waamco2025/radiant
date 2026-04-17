import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import V3App from './V3App.jsx'

createRoot(document.getElementById('v3-root')).render(
  <StrictMode>
    <V3App />
  </StrictMode>,
)
