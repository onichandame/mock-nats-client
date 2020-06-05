import { MockNats } from "./MockNats"

export const connect = (opts: Parameters<MockNats["connect"]>[0]) => {
  return new MockNats().connect(opts)
}
