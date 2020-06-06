# Mock NATS Client

A mocked NATS client for unit test. All messaging actions are carried out in memory only.

Has the same function signature and typing with the original ts-nats library.

# Author

[onichandame](https://onichandame.com)

# Usage

Installation

```bash
yarn add @onichandame/mock-nats-client
```

Connection

```typescript
import { connect } from '@onichandame/mock-nats-client'

const nc = await connect()
```

Subscribe:

```typescript
nc.subscribe('subject', (e, msg) => console.log(msg.data))
```

Publish:

```typescript
nc.publish('subscribe', {})
```

Any feature request or bug report is welcome.
