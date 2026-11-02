import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import './memories.css'
import MemoryPreview from './MemoryPreview'

createRoot(document.getElementById('root')!).render(<StrictMode><MemoryPreview /></StrictMode>)
