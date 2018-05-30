// This file contains the boilerplate to execute your React app.
// If you want to modify your application's content, start in "index.js"

import { ReactInstance } from 'react-360/React360'
import { Surface } from 'react-360-web'
import VNC from './src/VNC'

function init(bundle, parent, options = {}) {
  const canvas = document.createElement('canvas')

  canvas.width = 1280
  canvas.height = 800
  const context = canvas.getContext('2d')
  context.fillStyle = 'white'
  context.fillRect(0, 0, 1280, 800)

  const vnc = new VNC(canvas)
  const host = '192.168.100.103'
  const port = 5901
  const password = 'dogsbank'
  vnc.connect({ host, port, password })

  const r360 = new ReactInstance(bundle, parent, {
    // Add custom options here
    fullScreen: true,
    ...options
  })

  r360.runtime.context.TextureManager.registerLocalTextureSource(
    'vnc_texture',
    vnc.canvas,
    { updateOnFrame: true }
  )

  // Render app content to the flat surface
  const surface = r360.getDefaultSurface()
  surface.setShape(Surface.SurfaceShape.Flat)
  r360.renderToSurface(
    r360.createRoot('VncClient', {
      /* initial props */
    }),
    surface
  )

  // Load the initial environment
  r360.compositor.setBackground(r360.getAssetURL('360_world.jpg'))
}

window.React360 = { init }
