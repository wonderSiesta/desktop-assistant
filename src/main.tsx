import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const params = new URLSearchParams(window.location.search)
const isPopup = params.get('view') === 'popup'
const petView = params.get('view')
if (petView?.startsWith('pet')) document.documentElement.dataset.surface=petView

async function render() {
  if (petView?.startsWith('pet')) {
    const { Pet, PetPanel, PetBubble } = await import('./components/Pet')
    ReactDOM.createRoot(document.getElementById('root')!).render(petView==='pet-panel'?<PetPanel/>:petView==='pet-bubble'?<PetBubble/>:<Pet/>)
  } else if (isPopup) {
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
