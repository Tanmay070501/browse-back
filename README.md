![BrowseBack Icon](logo.svg)

# BrowseBack

BrowseBack is a JavaScript library for recording and analyzing user interactions on web applications. It captures user events and errors, allowing you to analyze user behavior and diagnose issues.

## Features

- Record user interactions
- Capture errors and exceptions
- Customizable recording options
- Either Record errors or whore session based on your usecase

## Installation

You can install BrowseBack via npm:

```bash
npm install @tannu-dev/browse-back@latest
```

## Usage

```javascript
import { BrowseBack } from '@browseback/core';

// Initialize BrowseBack
BrowseBack.init({
  apiKey: 'YOUR_API_KEY',
  socketUrl: 'SOCKET_URL',
  recordConsole: true,
  recordNetwork: true,
  // Other options...
});
```

## Configuration

### browseBackOptions

| Option            | Description                                     |
|-------------------|-------------------------------------------------|
| `apiKey`          | Your BrowseBack API key.                        |
| `recordErrorOnly` | Whether to record errors only.                  |
| `lastNMinutes`    | Number of minutes to consider for inactivity.   |
| `socketUrl`       | URL for the WebSocket server.                   |
| `username`        | Username for identifying users.                 |
| `user_identifier` | Identifier for users.                           |
| `recordNetwork`   | Whether to record network events.               |
| `recordConsole`   | Whether to record console events.               |
| `record`          | Whether to enable recording.                    |
| `sendMail`        | Whether to send mail notifications.             |

### recordConfig (optional)

| Option                    | Description                                                      |
|---------------------------|------------------------------------------------------------------|
| `recordCanvas`            | Whether to record canvas interactions.                           |
| `recordCrossOriginIframes`| Whether to record cross-origin iframes interactions.             |
| `maskInputOptions`        | Options for masking input values.                                |
| `maskAllInputs`           | Whether to mask all input values.                                |


## LICENSE
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
