/* @flow */
import DES from 'des-vnc'
import { Buffer } from 'buffer'
import PseudoEventEmitter from './PseudoEventEmitter'
const { log, error } = console

// TODO: REUDX, REDUX, REDUX
type State = {
  protocolVersionReceived: boolean,
  securityTypeSend: boolean,
  challengeResponseSend: boolean,
  clientInitSend: boolean,
  frameBufferUpdateRequestSend: boolean,
  frameBufferUpdateStart: boolean,
  processingRectangles: boolean,

  protocolVersion: string,
  protocolMajorVersion: string,
  protocolMinorVersion: string,
  numberOfSecurityTypes: number,
  securityTypes: Array<number>,
  securityType: number
}

const defaultState = {
  protocolVersionReceived: false,
  securityTypeSend: false,
  challengeResponseSend: false,
  clientInitSend: false,
  frameBufferUpdateRequestSend: false,
  frameBufferUpdateStart: false,
  processingRectangles: false,

  protocolVersion: 'RFB 003.008\n',
  protocolMajorVersion: '',
  protocolMinorVersion: '',
  numberOfSecurityTypes: 0,
  securityTypes: [],
  securityType: 0
}

type ServerPixelFormat = {
  bitsPerPixel: number,
  depth: number,
  bigEndianFlag: number,
  trueColourFlag: number,
  redMax: number,
  greenMax: number,
  blueMax: number,
  redShift: number,
  greenShift: number,
  blueShift: number
}

type FrameBuffer = {
  frameBufferWidth: number,
  frameBufferHeight: number,
  numberOfRectangles: number,
  raw: Buffer
}

export type Client = {
  frameBuffer: FrameBuffer,
  serverPixelFormat: ServerPixelFormat,
  nameLength: number,
  nameString: string
}

const defaultClient = {
  frameBuffer: {
    frameBufferWidth: 0,
    frameBufferHeight: 0,
    numberOfRectangles: 0,
    raw: Buffer.alloc(0)
  },
  serverPixelFormat: {
    bitsPerPixel: 0,
    depth: 0,
    bigEndianFlag: 0,
    trueColourFlag: 0,
    redMax: 0,
    greenMax: 0,
    blueMax: 0,
    redShift: 0,
    greenShift: 0,
    blueShift: 0
  },
  nameLength: 0,
  nameString: ''
}

export default class RFB extends PseudoEventEmitter {
  client: Client = defaultClient
  cypher: DES
  state: State = defaultState
  url: string
  ws: WebSocket
  PROTOCOL_VERSION_RECEIVED: string = 'PROTOCOL_VERSION_RECEIVED'
  SECURITY_TYPE_SEND: string = 'SECURITY_TYPE_SEND'
  CHALLENGE_RESPONSE_SEND: string = 'CHALLENGE_RESPONSE_SEND'
  CLIENT_INIT_SEND: string = 'CLIENT_INIT_SEND'
  FRAME_BUFFER_UPDATE_REQUEST_SEND: string = 'FRAME_BUFFER_UPDATE_REQUEST_SEND'
  FRAME_BUFFER_UPDATE_START: string = 'FRAME_BUFFER_UPDATE_START'
  PROCESSING_RECTANGLES: string = 'PROCESSING_RECTANGLES'
  FRAME_BUFFER_UPDATE_END: string = 'FRAME_BUFFER_UPDATE_END'

  constructor({ socket, password }: { socket: WebSocket, password: string }) {
    super()
    this.ws = socket
    this.cypher = new DES(password.split('').map(c => c.charCodeAt(0)))
  }

  onopen(e: any) {}

  onmessage(buffer: Buffer) {
    if (!this.state.protocolVersionReceived) {
      this.state.protocolVersionReceived = true
      this.protocolVersionReceive(buffer)
    } else if (!this.state.securityTypeSend) {
      this.state.securityTypeSend = true
      this.securityTypeSent(buffer)
    } else if (!this.state.challengeResponseSend) {
      this.state.challengeResponseSend = true
      this.challengeResponseSent(buffer)
    } else if (!this.state.clientInitSend) {
      this.state.clientInitSend = true
      this.clientInitSent(buffer)
    } else if (!this.state.frameBufferUpdateRequestSend) {
      this.state.frameBufferUpdateRequestSend = true
      this.frameBufferUpdateRequestSend(buffer)
    } else if (!this.state.frameBufferUpdateStart) {
      this.state.frameBufferUpdateStart = true
      this.state.processingRectangles = true
      this.frameBufferUpdateStart(buffer)
    } else if (this.state.processingRectangles) {
      this.processRectangles(buffer)
    }
  }

  protocolVersionReceive(buffer: Buffer) {
    this.state.protocolMajorVersion = buffer.slice(4, 7).toString('ascii')
    this.state.protocolMinorVersion = buffer.slice(8, 11).toString('ascii')

    this.ws.send(Buffer.from(this.state.protocolVersion, 'ascii'))
    this.emit(this.PROTOCOL_VERSION_RECEIVED, this.state)
  }

  securityTypeSent(buffer: Buffer) {
    this.state.numberOfSecurityTypes = buffer.readUInt8(0)
    this.state.securityTypes = Array.from(new Uint8Array(buffer.slice(1)))

    if (!this.state.securityTypes.includes(2)) {
      return this.disconnect()
    }

    this.state.securityType = 2
    this.ws.send(new Uint8Array([this.state.securityType]))
    this.emit(this.SECURITY_TYPE_SEND, this.state)
  }

  challengeResponseSent(buffer: Buffer) {
    const challenge = new Uint8Array(buffer)
    const response = this.cypher.encrypt(Array.from(challenge))
    this.ws.send(new Uint8Array(response))
    this.emit(this.CHALLENGE_RESPONSE_SEND, this.state)
  }

  clientInitSent(buffer: Buffer) {
    const result = buffer.readInt32BE(0)
    if (result !== 0) {
      const reasonLength = buffer.readInt32BE(4)
      log(buffer.slice(8, reasonLength + 8).toString('ascii'))
      return this.disconnect()
    }

    const sharedFlg = 0 // 0: exclusive access, 1: shared access
    this.ws.send(new Uint8Array([sharedFlg]))
    this.emit(this.CLIENT_INIT_SEND, this.state)
  }

  frameBufferUpdateRequestSend(buffer: Buffer) {
    this.client.frameBuffer.frameBufferWidth = buffer.readInt16BE(0)
    this.client.frameBuffer.frameBufferHeight = buffer.readInt16BE(2)
    const serverPixelFormatOffset = 4
    this.client.serverPixelFormat = {
      bitsPerPixel: buffer.readUInt8(0 + serverPixelFormatOffset),
      depth: buffer.readUInt8(1 + serverPixelFormatOffset),
      bigEndianFlag: buffer.readUInt8(2 + serverPixelFormatOffset),
      trueColourFlag: buffer.readUInt8(3 + serverPixelFormatOffset),
      redMax: buffer.readInt16BE(4 + serverPixelFormatOffset),
      greenMax: buffer.readInt16BE(6 + serverPixelFormatOffset),
      blueMax: buffer.readInt16BE(8 + serverPixelFormatOffset),
      redShift: buffer.readUInt8(10 + serverPixelFormatOffset),
      greenShift: buffer.readUInt8(11 + serverPixelFormatOffset),
      blueShift: buffer.readUInt8(12 + serverPixelFormatOffset)
    }

    this.client.nameLength = buffer.readInt32BE(20)
    this.client.nameString = buffer
      .slice(24, this.client.nameLength + 24)
      .toString('utf8')

    this.setEncodingsRequest()
    this.frameBufferUpdateRequest({
      xPosition: 0,
      yPosition: 0,
      width: this.client.frameBuffer.frameBufferWidth,
      height: this.client.frameBuffer.frameBufferHeight
    })
    this.emit(this.FRAME_BUFFER_UPDATE_REQUEST_SEND, this.client)
  }

  setEncodingsRequest() {
    const encodings = [0]
    const messageType = 2
    const numberOfEncodings = encodings.length
    const buffer = Buffer.alloc(4 + 4 * numberOfEncodings)
    buffer.writeUInt8(messageType, 0)
    buffer.writeUInt16BE(numberOfEncodings, 2)
    for (let i = 0; i < numberOfEncodings; i++) {
      buffer.writeUInt32BE(encodings[i], 4 + 4 * i)
    }

    this.ws.send(buffer)
  }

  frameBufferUpdateRequest({
    incremental = 0,
    xPosition,
    yPosition,
    width,
    height
  }: {
    incremental?: number,
    xPosition: number,
    yPosition: number,
    width: number,
    height: number
  }) {
    const messageType = 3

    const buffer = Buffer.alloc(10)
    buffer.writeUInt8(messageType, 0)
    buffer.writeUInt8(incremental, 1)
    buffer.writeUInt16BE(xPosition, 2)
    buffer.writeUInt16BE(yPosition, 4)
    buffer.writeUInt16BE(width, 6)
    buffer.writeUInt16BE(height, 8)

    this.ws.send(buffer)
  }

  frameBufferUpdateStart(buffer: Buffer) {
    const messageType = buffer.readUInt8(0)

    if (messageType !== 0) {
      log(`This is not frame buffer update, message-type is: ${messageType}`)
      return
    }

    this.client.frameBuffer.numberOfRectangles = buffer.readInt16BE(2)
    this.client.frameBuffer.raw = buffer
    this.emit(this.FRAME_BUFFER_UPDATE_START, this.client)
  }

  processRectangles(buffer: Buffer) {
    this.client.frameBuffer.raw = Buffer.concat([
      this.client.frameBuffer.raw,
      buffer
    ])

    // Check processing status
    let completed = true
    let offset = 4
    for (
      let rectangle = 0;
      rectangle < this.client.frameBuffer.numberOfRectangles;
      rectangle++
    ) {
      const encodingType = this.client.frameBuffer.raw.readInt32BE(offset + 8)

      if (encodingType !== 0) {
        log(`I can only process encode type raw: ${encodingType}`)
        log(this.client.frameBuffer.raw)
        return
      }

      const width = this.client.frameBuffer.raw.readInt16BE(offset + 4)
      const height = this.client.frameBuffer.raw.readInt16BE(offset + 6)

      const bytesOfPixels =
        width * height * (this.client.serverPixelFormat.bitsPerPixel / 8)
      const receivedBytesLength = this.client.frameBuffer.raw.slice(
        offset + 12,
        offset + 12 + bytesOfPixels
      ).length
      // log(
      //   `Progress ${rectangle + 1}/${numberOfRectangles}:`,
      //   `${Math.floor(100 * receivedBytesLength / bytesOfPixels)} %`
      // )

      completed = completed && receivedBytesLength === bytesOfPixels
      offset += 12 + bytesOfPixels
    }

    if (completed) {
      this.state.processingRectangles = false
      this.emit(this.FRAME_BUFFER_UPDATE_END, this.client)

      setTimeout(() => {
        if (this.state.processingRectangles) {
          return
        }
        this.emit(this.FRAME_BUFFER_UPDATE_START, this.client)
        this.state.processingRectangles = true

        this.client.frameBuffer.raw = Buffer.alloc(0)
        this.client.frameBuffer.numberOfRectangles =
          defaultClient.frameBuffer.numberOfRectangles

        this.frameBufferUpdateRequest({
          increment: 1,
          xPosition: 0,
          yPosition: 0,
          width: this.client.frameBuffer.frameBufferWidth,
          height: this.client.frameBuffer.frameBufferHeight
        })
      }, 1000)
    } else {
      this.emit(this.PROCESSING_RECTANGLES, this.client)
    }
  }

  onclose(e: any) {
    log(e)
  }

  onerror(e: any) {
    error(e)
  }

  disconnect() {
    log('disconnect')
    this.ws.close()
  }
}
