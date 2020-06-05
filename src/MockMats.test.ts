import { MockNats } from "./MockNats"
import { generate } from "randomstring"

const subject = generate({ length: 10, charset: "alphanumeric" })
const message = generate({ length: 10, charset: "alphanumeric" })

describe("mock nats", () => {
  test("is class", () => expect(MockNats.constructor).toBeTruthy())
  test("can publish", async () => {
    const nc = await new MockNats().connect()
    return expect(nc.publish(subject)).resolves
  })
  test("can subscribe", async () => {
    const nc = await new MockNats().connect()
    return expect(nc.subscribe(subject, () => {})).resolves
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
    return expect(nc.request(subject)).resolves
  })
  test("can close", () => {
    const nc = new MockNats()
    expect(nc.isClosed()).toBeFalsy()
    nc.close()
    expect(nc.isClosed()).toBeTruthy()
  })
  test("can subscribe to certain counts", async () => {
    await new Promise(async r => {
      expect.assertions(1)
      let count = 0
      const nc = await new MockNats().connect()
      nc.subscribe(subject, () => count++, { max: 2 })
      nc.publish(subject)
      nc.publish(subject)
      nc.publish(subject)
      setTimeout(() => {
        expect(count).toEqual(2)
        r()
      }, 2000)
    })
  })
  test("can get correct number of subscriptions", async () => {
    const nc = await new MockNats().connect()
    await nc.subscribe(subject, () => {})
    await nc.subscribe(subject, () => {})
    await nc.subscribe(subject, () => {})
    expect(nc.numSubscriptions()).toEqual(3)
  })
})
