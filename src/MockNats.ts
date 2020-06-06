import { generate } from "randomstring"
import {
  Payload,
  NatsError,
  ErrorCode,
  NatsConnectionOptions,
  Subscription,
  Msg,
  MsgCallback,
  Sub,
  Client,
  FlushCallback,
  SubscriptionOptions
} from "ts-nats"

type Pub = {
  subject: string
  data?: any
  reply?: string
}

type Queue = {
  pubs: Pub[]
  promise: Promise<never>
}

const serialize = (raw: any): string => {
  if (Buffer.isBuffer(raw)) return raw.toString()
  else if (raw instanceof Object) return JSON.stringify(raw)
  else return raw.toString()
}

const createInbox = () => generate({ length: 20, charset: "alphanumeric" })

const ConnectionError = new NatsError(
  "mock client connection status improper",
  ErrorCode["CONN_ERR"]
)

export class MockNats extends Client {
  private connected: boolean
  private closed: boolean
  private subs: Sub[]
  private queue: Queue
  private protoHand: Client["protocolHandler"]
  private payload: Payload
  createInbox: typeof createInbox
  constructor() {
    super()
    this.connected = false
    this.closed = false
    this.subs = []
    this.createInbox = createInbox
    this.protoHand = {}
    this.queue = { pubs: [], promise: new Promise(r => r()) }
    this.payload = Payload.STRING
  }
  private matchSubject(pub: string, sub: string) {
    const subs = sub.split(".")
    return new RegExp(
      subs
        .map(sub => {
          switch (sub) {
            case "*":
              return "[a-zA-Z0-9]*"
            case ">":
              return "[a-zA-Z0-9.]*"
            default:
              return sub
          }
        })
        .join("\\.")
    ).test(pub)
  }
  private ensureConnected() {
    if (!this.connected) throw ConnectionError
  }
  public connect(
    opts?: NatsConnectionOptions | string | number
  ): Promise<Client> {
    if (opts && typeof opts !== "string" && typeof opts !== "number") {
      if (opts.payload) this.payload = opts.payload
    }
    if (this.isClosed()) throw new Error("closed client cannot be reused")
    return new Promise(resolve => {
      this.connected = true
      setTimeout(() => resolve(this), 10)
    })
  }
  public close() {
    this.subs = []
    this.connected = false
    this.closed = true
    setTimeout(() => this.emit("disconnect"), 10)
  }
  public async flush(cb?: FlushCallback): Promise<void> {
    this.ensureConnected()
    return (this.queue.promise = this.queue.promise.then(() => {
      return new Promise((resolve, reject) => {
        try {
          for (let pub of this.queue.pubs) {
            if (pub.data) {
              switch (this.payload) {
                case Payload.BINARY: {
                  pub.data = Buffer.from(serialize(pub.data))
                  break
                }
                case Payload.STRING: {
                  pub.data = serialize(pub.data)
                  break
                }
                case Payload.JSON: {
                  pub.data = JSON.parse(serialize(pub.data))
                  break
                }
                default: {
                  throw new Error("payload type not valid")
                }
              }
            }
            for (let sub of this.subs) {
              if (this.matchSubject(pub.subject, sub.subject)) {
                sub.callback(null, {
                  sid: sub.sid,
                  size: pub.data
                    ? Buffer.from(serialize(pub.data)).byteLength
                    : 0,
                  ...pub
                })
                if (sub.max)
                  if (sub.max === ++sub.received)
                    this.subs.splice(this.subs.indexOf(sub), 1)
              }
            }
            this.queue.pubs.splice(this.queue.pubs.indexOf(pub), 1)
          }
          resolve()
          if (cb) cb()
        } catch (e) {
          reject(e)
          if (cb) cb(e)
        }
      })
    }))
  }
  public publish(subject: string, data?: any, reply?: string): void {
    this.ensureConnected()
    this.queue.pubs.push({ subject, data, reply })
    this.flush()
  }
  public async subscribe(
    subject: string,
    cb: MsgCallback,
    opts?: SubscriptionOptions
  ) {
    this.ensureConnected()
    let sub: Sub = {
      sid: Math.random(),
      subject,
      received: 0,
      callback: cb,
      ...opts
    }
    this.subs.push(sub)
    return new Subscription(sub, this.protoHand)
  }
  public async drain(): Promise<any> {
    await this.flush()
    return this.close()
  }
  public request(subject: string, timeout = 1000, data?: any): Promise<Msg> {
    this.ensureConnected()
    return new Promise((resolve, reject) => {
      const reply = createInbox()
      this.subscribe(
        reply,
        (e, msg) => {
          if (e) reject(e)
          else resolve(msg)
        },
        { max: 1 }
      )
      this.publish(subject, data, reply)
      setTimeout(() => reject(new Error("request timeout")), timeout)
    })
  }
  public isClosed(): boolean {
    return this.closed
  }
  public numSubscriptions(): number {
    return this.subs.length
  }
}
