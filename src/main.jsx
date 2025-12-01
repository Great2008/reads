import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // <--- Imports your App.jsx component
import './index.css' // <--- Imports your global CSS (Tailwind)

// This line renders the App component into the <div> with id="root" in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
