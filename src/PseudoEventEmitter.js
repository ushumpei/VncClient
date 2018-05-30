/* @flow */

export default class PseudoEventEmitter {
  callbacks: { [string]: Array<Function> } = {}

  emit(event: string, param: any) {
    if (!this.callbacks[event]) this.callbacks[event] = []
    this.callbacks[event].forEach(f => f.call(this, param))
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) this.callbacks[event] = []
    this.callbacks[event].push(callback)
    return this
  }
}
