import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const params = new URLSearchParams(window.location.search)
const isPopup = params.get('view') === 'popup'

async function render() {
  if (isPopup) {
    const { Popup } = await import('./components/Popup')
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <Popup />
      </React.StrictMode>,
    )
  } else {
    const { App } = await import('./App')
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  }
}

render()
