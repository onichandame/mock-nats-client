import { generate } from "randomstring"
import { Payload } from "ts-nats"

import { MockNats } from "./MockNats"

const subject = generate({ length: 10, charset: "alphanumeric" })
const message = generate({ length: 10, charset: "alphanumeric" })

describe("mock nats", () => {
  test("is class", () => expect(MockNats.constructor).toBeTruthy())
  test("can publish", async () => {
    const nc = await new MockNats().connect()
    expect(nc.publish(subject)).toBeUndefined()
  })
  test("can subscribe", async () => {
    const nc = await new MockNats().connect()
    return nc.subscribe(subject, () => {})
  })
  test("can receive msg", async () => {
    expect.assertions(1)
    const nc = await new MockNats().connect()
    nc.subscribe(subject, (_, msg) => expect(msg.data).toEqual(message))
    nc.publish(subject, message)
  })
  test("can request for reply", async () => {
    const nc = await new MockNats().connect()
    nc.subscribe(
      subject,
      (_, msg) => msg.reply && nc.publish(msg.reply, message)
    )
    return nc.request(subject)
  })
  test("can flush", async () => {
    const nc = await new MockNats().connect()
    let m = ""
    nc.subscribe(subject, (_, msg) => (m = msg.data))
    nc.publish(subject, message)
    expect(m).not.toEqual(message)
    await nc.flush()
    expect(m).toEqual(message)
  })
  test("can close", () => {
    const nc = new MockNats()
    expect(nc.isClosed()).toBeFalsy()
    nc.close()
    expect(nc.isClosed()).toBeTruthy()
  })
  test("can subscribe to certain counts", async () => {
    expect.assertions(1)
    let count = 0
    const nc = await new MockNats().connect()
    nc.subscribe(subject, () => count++, { max: 2 })
    nc.publish(subject)
    nc.publish(subject)
    nc.publish(subject)
    await nc.flush()
    expect(count).toEqual(2)
  })
  test("can get correct number of subscriptions", async () => {
    const nc = await new MockNats().connect()
    await nc.subscribe(subject, () => {})
    await nc.subscribe(subject, () => {})
    await nc.subscribe(subject, () => {})
    expect(nc.numSubscriptions()).toEqual(3)
  })
  test("cannot conduct actions if not connected", async () => {
    const nc = new MockNats()
    expect(() => nc.publish(subject)).toThrow()
    await expect(nc.subscribe(subject, () => {})).rejects.toBeDefined()
  })
  test("can parse payload", async () => {
    expect.assertions(3)
    const message = {}
    let nc = await new MockNats().connect({ payload: Payload.STRING })
    nc.subscribe(subject, (_, msg) => expect(typeof msg.data).toEqual("string"))
    nc.publish(subject, message)
    nc = await new MockNats().connect({ payload: Payload.JSON })
    nc.subscribe(subject, (_, msg) =>
      expect(
        msg.data instanceof Object && !Buffer.isBuffer(msg.data)
      ).toBeTruthy()
    )
    nc.publish(subject, message)
    nc = await new MockNats().connect({ payload: Payload.BINARY })
    nc.subscribe(subject, (_, msg) =>
      expect(Buffer.isBuffer(msg.data)).toBeTruthy()
    )
    nc.publish(subject, message)
  })
})
