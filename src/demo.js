import VNC from './VNC'

const vnc = new VNC(null)
const host = '192.168.100.103'
const port = 5901
const password = 'dogsbank'

vnc.connect({ host, port, password })
