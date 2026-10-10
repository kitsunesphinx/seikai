import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyDocumentLanguage } from './text.js'

applyDocumentLanguage() // 覚えてある言語に、html の lang とタブの題を合わせる（描く前に）
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
