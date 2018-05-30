/* @flow */
import WebSocket from 'ws'
import * as BlobPolyfill from 'blob-polyfill'
import { Buffer } from 'buffer'
import RFB, { type Client } from './RFB'

const { log } = console

export default class VNC {
  canvas: ?HTMLElement
  rfb: RFB

  constructor(canvas: ?HTMLElement) {
    this.canvas = canvas
  }

  connect({
    host,
    port,
    password
  }: {
    host: string,
    port: number,
    password: string
  }) {
    const url = `ws://${host}:${port}`
    log('VNC:', `Connect to ${url}`)

    const socket = new WebSocket(url)
    socket.onclose = e => this.rfb.onclose(e)
    socket.onerror = e => this.rfb.onerror(e)
    socket.onmessage = e => {
      if (!(e.data instanceof Blob)) return this.rfb.onmessage(e.data) // eslint-disable-line no-undef

      const fr = new FileReader() // eslint-disable-line no-undef
      fr.onload = () => {
        this.rfb.onmessage(Buffer.from(fr.result))
      }
      fr.readAsArrayBuffer(e.data)
    }
    socket.onopen = e => this.rfb.onopen(e)

    this.rfb = new RFB({ socket, password })
    this.rfb.on(this.rfb.PROTOCOL_VERSION_RECEIVED, state => {
      log(
        'VNC:',
        `Protocol version: ${state.protocolMajorVersion}:${
          state.protocolMinorVersion
        }`
      )
    })
    this.rfb.on(this.rfb.SECURITY_TYPE_SEND, state => {
      log('VNC:', `Number of security types: ${state.numberOfSecurityTypes}`)
      log('VNC:', `Security types: ${state.securityTypes.toString()}`)
      log('VNC:', `Security type: ${state.securityType}`)
    })
    this.rfb.on(this.rfb.CHALLENGE_RESPONSE_SEND, state => {
      log('VNC:', 'Challenge response send')
    })
    this.rfb.on(this.rfb.CLIENT_INIT_SEND, state => {
      log('VNC:', 'Client init send')
    })
    this.rfb.on(this.rfb.FRAME_BUFFER_UPDATE_REQUEST_SEND, client => {
      log('VNC:', 'Frame buffer update request send')

      const { frameBufferWidth, frameBufferHeight } = client.frameBuffer
      this.canvas.width = frameBufferWidth
      this.canvas.height = frameBufferHeight
      const context = this.canvas.getContext('2d')
      context.clearRect(0, 0, frameBufferWidth, frameBufferHeight)
      context.fillStyle = 'white'
      context.fillRect(0, 0, frameBufferWidth, frameBufferHeight)
    })
    this.rfb.on(this.rfb.FRAME_BUFFER_UPDATE_START, client => {
      log('VNC:', 'Frame buffer update start')
    })
    this.rfb.on(this.rfb.PROCESSING_RECTANGLES, client => {})
    this.rfb.on(this.rfb.FRAME_BUFFER_UPDATE_END, client => {
      log('VNC:', 'Frame buffer update end')
      this.update(client)
    })
  }

  update(client: Client) {
    const { frameBufferWidth, frameBufferHeight, raw } = client.frameBuffer
    this.canvas.width = frameBufferWidth
    this.canvas.height = frameBufferHeight
    const context = this.canvas.getContext('2d')
    context.clearRect(0, 0, frameBufferWidth, frameBufferHeight)

    const canvasData = context.createImageData(
      frameBufferWidth,
      frameBufferHeight
    )

    for (let x = 0; x < raw.length - 20; x += 4) {
      canvasData.data[x + 0] = raw.readUInt8(16 + x + 3)
      canvasData.data[x + 1] = raw.readUInt8(16 + x + 0)
      canvasData.data[x + 2] = raw.readUInt8(16 + x + 1)
      canvasData.data[x + 3] = raw.readUInt8(16 + x + 2)
    }

    context.putImageData(canvasData, 0, 0)
  }
}
