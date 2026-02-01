# @baseportal/chat-widget

Embeddable chat widget for Baseportal. Lightweight (~60KB gzipped) with Preact, Ably realtime, and multi-language support.

## Installation

### Script tag (IIFE)

```html
<script src="https://your-domain.com/baseportal-chat.iife.js"></script>
<script>
  const chat = new BaseportalChat({
    channelToken: 'your-channel-token',
  })
</script>
```

### NPM / PNPM

```bash
pnpm add @baseportal/chat-widget
```

```typescript
import { BaseportalChat } from '@baseportal/chat-widget'

const chat = new BaseportalChat({
  channelToken: 'your-channel-token',
})
```

## Configuration

```typescript
const chat = new BaseportalChat({
  // Required
  channelToken: 'your-channel-token',

  // Optional
  apiUrl: 'https://api.baseportal.io',   // Custom API URL
  position: 'bottom-right',               // 'bottom-right' | 'bottom-left'
  locale: 'pt',                           // 'pt' | 'en' | 'es'
  hideOnLoad: false,                       // Start hidden (no bubble)
  theme: {
    primaryColor: '#6366f1',               // Custom primary color
  },
  container: document.getElementById('chat'), // Mount inside a specific element
  visitor: {                               // Pre-identify the visitor
    name: 'John Doe',
    email: 'john@example.com',
    hash: 'hmac-sha256-hash',             // Required if identity verification is enabled
    metadata: { plan: 'pro' },
  },
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channelToken` | `string` | — | **(Required)** Channel token from Baseportal dashboard |
| `apiUrl` | `string` | `https://api.baseportal.io` | API base URL |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Widget position on the page |
| `locale` | `'pt' \| 'en' \| 'es'` | `'pt'` | UI language |
| `hideOnLoad` | `boolean` | `false` | If `true`, widget starts hidden (no bubble) |
| `theme` | `{ primaryColor?: string }` | — | Custom theme overrides |
| `container` | `HTMLElement` | — | Mount inside a specific DOM element instead of `document.body` |
| `visitor` | `VisitorData` | — | Pre-identify the visitor (see Identity Verification) |

## API Methods

### Visibility

```typescript
chat.open()       // Open the chat window
chat.close()      // Close the chat window
chat.toggle()     // Toggle open/close
chat.show()       // Show the widget (bubble + window)
chat.hide()       // Hide the widget entirely
chat.isOpen()     // Returns true if chat window is open
```

### Visitor Identity

```typescript
// Identify a visitor (enables conversation history)
chat.identify({
  email: 'john@example.com',
  name: 'John Doe',
  hash: 'hmac-sha256-hash',   // Required if identity verification is enabled
  metadata: { plan: 'pro' },
})

// Update visitor data
chat.updateVisitor({
  name: 'Jane Doe',
  metadata: { plan: 'enterprise' },
})

// Clear visitor data and reset
chat.clearVisitor()
```

### Actions

```typescript
// Send a message programmatically
chat.sendMessage('Hello!')

// Open a specific conversation
chat.setConversationId('conversation-uuid')

// Start a new conversation
chat.newConversation()
```

### Configuration (Runtime)

```typescript
chat.setTheme({ primaryColor: '#10b981' })
chat.setPosition('bottom-left')
chat.setLocale('en')
```

### Lifecycle

```typescript
chat.destroy()   // Unmount widget and clean up all listeners
```

## Events

```typescript
chat.on('ready', () => {
  console.log('Widget initialized')
})

chat.on('open', () => {
  console.log('Chat window opened')
})

chat.on('close', () => {
  console.log('Chat window closed')
})

chat.on('message:sent', (message) => {
  console.log('Message sent:', message)
})

chat.on('message:received', (message) => {
  console.log('Message received:', message)
})

chat.on('conversation:started', (conversation) => {
  console.log('New conversation:', conversation)
})

chat.on('conversation:closed', (conversation) => {
  console.log('Conversation closed:', conversation)
})

chat.on('identified', (visitor) => {
  console.log('Visitor identified:', visitor)
})

// Remove listener
const handler = (msg) => console.log(msg)
chat.on('message:received', handler)
chat.off('message:received', handler)
```

### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | — | Widget initialized and mounted |
| `open` | — | Chat window opened |
| `close` | — | Chat window closed |
| `show` | — | Widget made visible |
| `hide` | — | Widget hidden |
| `message:sent` | `Message` | Visitor sent a message |
| `message:received` | `Message` | Agent/bot message received |
| `conversation:started` | `Conversation` | New conversation created |
| `conversation:closed` | `Conversation` | Conversation closed by agent |
| `identified` | `VisitorData` | Visitor identified via `identify()` |

## Identity Verification

For authenticated users, identity verification ensures visitors can only access their own conversation history. It uses HMAC-SHA256 with a secret key configured in the Baseportal dashboard.

### Server-side hash generation

```javascript
// Node.js
const crypto = require('crypto')
const hash = crypto
  .createHmac('sha256', 'your-identity-verification-secret')
  .update(userEmail)
  .digest('hex')
```

```python
# Python
import hmac, hashlib
hash = hmac.new(
    b'your-identity-verification-secret',
    user_email.encode(),
    hashlib.sha256
).hexdigest()
```

```php
// PHP
$hash = hash_hmac('sha256', $userEmail, 'your-identity-verification-secret');
```

```ruby
# Ruby
hash = OpenSSL::HMAC.hexdigest('SHA256', 'your-identity-verification-secret', user_email)
```

### Client-side usage

```typescript
const chat = new BaseportalChat({
  channelToken: 'your-channel-token',
  visitor: {
    email: 'john@example.com',
    name: 'John Doe',
    hash: 'server-generated-hmac-hash',
  },
})
```

When identity verification is enabled on the channel:
- `visitor.email` and `visitor.hash` are required
- The visitor can view their conversation history
- Conversations are linked to the visitor's email across sessions

## File Uploads

The widget supports file uploads directly in the chat. Visitors can attach files by clicking the paperclip icon in the composer.

**Supported file types:** Images, videos (MP4), audio, PDF, Word, Excel, and text files.

**Limits:**
- Max file size: 25 MB
- Max files per conversation: 20
- Rate limit: 10 uploads per minute

**Media rendering:**
- **Images** — displayed inline with click-to-expand lightbox
- **Videos** — native HTML5 video player
- **Other files** — download card with file name and icon

## Container Mode

Mount the widget inside a specific element instead of showing the floating bubble:

```html
<div id="chat-container" style="width: 400px; height: 600px;"></div>

<script>
  const chat = new BaseportalChat({
    channelToken: 'your-channel-token',
    container: document.getElementById('chat-container'),
  })
</script>
```

In container mode:
- No floating bubble is rendered
- The chat window fills the container element
- `show()` / `hide()` / `open()` / `close()` still work

## Channel Configuration

Features are configured per channel in the Baseportal dashboard:

| Feature | Description |
|---------|-------------|
| `requireName` | Require visitor name before starting a conversation |
| `requireEmail` | Require visitor email before starting a conversation |
| `allowViewHistory` | Allow authenticated visitors to see past conversations |
| `allowReopenConversation` | Allow visitors to reopen closed conversations |
| `privacyPolicyUrl` | Display a link to your privacy policy |
| Identity Verification | Enable HMAC verification for visitor identity |

## Development

```bash
cd packages/chat-widget

# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev
```

### Build outputs

| File | Format | Usage |
|------|--------|-------|
| `dist/index.iife.js` | IIFE | Script tag (global `BaseportalChat`) |
| `dist/index.esm.js` | ESM | `import` in bundlers |
| `dist/index.cjs.js` | CJS | `require()` in Node.js |
| `dist/index.d.ts` | TypeScript | Type definitions |

### Deploy to client

After building, copy the IIFE bundle to the client's public directory:

```bash
cp dist/index.iife.js ../../baseportal-client/public/baseportal-chat.iife.js
```

## TypeScript

All types are exported:

```typescript
import type {
  BaseportalChatConfig,
  ChannelInfo,
  Conversation,
  Message,
  VisitorData,
} from '@baseportal/chat-widget'
```
