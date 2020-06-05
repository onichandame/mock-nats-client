import { generate } from "randomstring"
import {
  NatsConnectionOptions,
  Subscription,
  Msg,
  MsgCallback,
  Sub,
  Client,
  FlushCallback,
  SubscriptionOptions
} from "ts-nats"

const createInbox = () => generate({ length: 20, charset: "alphanumeric" })

export class MockNats extends Client {
  private _connected: boolean
  private _closed: boolean
  private _subs: Sub[]
  private _protoHand: Client["protocolHandler"]
  createInbox: typeof createInbox
  constructor() {
    super()
    this._connected = false
    this._closed = false
    this._subs = []
    this.createInbox = createInbox
    this._protoHand = {}
  }
  private get connected() {
    return this._connected
  }
  private set connected(c: boolean) {
    this._connected = c
  }
  private get subs() {
    return this._subs
  }
  private set subs(s: Sub[]) {
    this._subs = s
  }
  private get protoHand() {
    return this._protoHand
  }
  private set protoHand(p: Client["protocolHandler"]) {
    this._protoHand = p
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
  public async connect(
    _?: NatsConnectionOptions | string | number
  ): Promise<Client> {
    if (this.isClosed()) throw new Error("closed client cannot be reused")
    return new Promise(resolve => {
      this.connected = true
      setTimeout(() => resolve(this), 10)
    })
  }
  public close() {
    this.subs = []
    this.connected = false
    this._closed = true
    setTimeout(() => this.emit("disconnect"), 10)
  }
  public async flush(cb?: FlushCallback): Promise<void> {
    if (cb) cb()
  }
  public async publish(
    subject: string,
    data?: any,
    reply?: string
  ): Promise<void> {
    this.subs.forEach(sub => {
      if (sub.max == sub.received) {
        this.subs.splice(this.subs.indexOf(sub), 1)
        return
      }
      if (this.matchSubject(subject, sub.subject))
        sub.callback(null, {
          subject: subject,
          sid: sub.sid,
          data: data,
          size: data ? Buffer.from(data).byteLength : 0,
          reply: reply
        })
      sub.received++
    })
  }
  public async subscribe(
    subject: string,
    cb: MsgCallback,
    opts?: SubscriptionOptions
  ) {
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
    return this.close()
  }
  public async request(
    subject: string,
    timeout = 1000,
    data?: any
  ): Promise<Msg> {
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
      setTimeout(() => reject(new Error("timeout request")), timeout)
    })
  }
  public isClosed(): boolean {
    return this._closed
  }
  public numSubscriptions(): number {
    return this.subs.length
  }
}
