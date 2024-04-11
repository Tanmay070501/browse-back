import { NetworkCaptureOptions } from "../plugin/custom-network";

type XHRRequestBody = string | Document | Blob | ArrayBufferView | ArrayBuffer | FormData | URLSearchParams | ReadableStream<Uint8Array> | null | undefined;

interface XHRLog {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: XHRRequestBody;
  responseBody: any;
  status?: number;
  statusText?: string;
  xhrLogCounter: string;
  performance?: PerformanceResourceTiming;
  payloadsCaptured: boolean;
  startTime?: number;
  endTime?: number;
}

type PerformanceResourceTimingList = Array<PerformanceResourceTiming>;

const olderOpen = XMLHttpRequest.prototype.open
const olderSend = XMLHttpRequest.prototype.send

export function recordXhr(cb:(...args: unknown[]) => any, opts?: NetworkCaptureOptions) {
  // Init options if not specified
  const options = opts || {
    captureNetworkPayload: false,
  };

  // Store a reference to the native method
  const oldOpen = XMLHttpRequest.prototype.open;

  let xhrLogCounter = 1;

  // Overwrite the native method
  XMLHttpRequest.prototype.open = function(...args: any[]) {
    const startTime = performance.now(); // Capture start time

    const method = args[0];
    const url = args[1];
    // const async = args[2] !== false;
    // const username = args[3] || null;
    // const password = args[4] || null;

    const that: XMLHttpRequest = this;

    const xhrLog: XHRLog = {
      method,
      url,
      requestHeaders: {},
      requestBody: null,
      responseHeaders: {},
      responseBody: null,
      xhrLogCounter: `xhrLog${xhrLogCounter}`,
      payloadsCaptured: options.captureNetworkPayload || false,
      startTime: startTime, // Include start time in XHR log
      endTime: undefined, // End time will be set later
    };

    xhrLogCounter++;

    // Capture headers set
    const oldSetRequestHeader = that.setRequestHeader;
    that.setRequestHeader = function(name: string, value: string) {
      xhrLog.requestHeaders[name] = value;

      oldSetRequestHeader.call(this, name, value);
    };

    // Capture what is sent up
    const oldSend = that.send;
    that.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      if (typeof body !== 'undefined' && options.captureNetworkPayload) {
        xhrLog.requestBody = body;
      }

      // performance.clearResourceTimings();
      // Set a mark before we trigger the XHR so we can find the performance data easier
      window.performance.mark(xhrLog.xhrLogCounter);
      oldSend.call(this, body);
    }

    // Assign an event listener
    that.addEventListener('load', function(/*event*/) {
      if (options.captureNetworkPayload) {
        xhrLog.responseBody = btoa(that.response)
      }
    }, false);

    that.addEventListener('loadend', function(/*event*/) {
      const endTime = performance.now()
      xhrLog.endTime = endTime
      // Get the raw header string
      const rawHeaders: string = that.getAllResponseHeaders();

      // Convert the header string into an array
      // of individual headers
      const headers: Array<string> = rawHeaders.trim().split(/[\r\n]+/);

      // Create a map of header names to values
      headers.forEach((line) => {
        const parts = line.split(': ');
        const header = parts.shift();
        const value = parts.join(': ');
        if (typeof header === 'string') {
          xhrLog.responseHeaders[header] = value;
        }
      });

      xhrLog.status = that.status;
      xhrLog.statusText = that.statusText;


      // It seems that getEntries() really returns Array<PerformanceResourceTiming>, but it is
      // defined as returning PerformanceEntryList, which does not expose the 'initiatorType'
      // property. Cast to PerformanceResourceTimingList so typescript knows about 'initiatorType'
      const entries = window.performance.getEntries() as PerformanceResourceTimingList;
      let markIndex = -1;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.name === xhrLog.xhrLogCounter) {
          markIndex = i;
          break;
        }
      }
      if (markIndex >= 0) {
        for (let i = markIndex; i < entries.length; i++) {
          const entry = entries[i];
          if (
            entry.initiatorType === 'xmlhttprequest'
            && entry.name
            && entry.name.indexOf(xhrLog.url) >= 0
          ) {
            xhrLog.performance = entry;
            break;
          }
        }
      }

      performance.clearResourceTimings()

      window.performance.clearMarks(xhrLog.xhrLogCounter)

      // fire plugin event
      cb({request: xhrLog, initiatorType: 'xhr'})

      // Fire an event with this XHR capture
      // const xhrEvent = new CustomEvent('xhrLog', {
      //   detail: {
      //     xhrLog,
      //   },
      // });

      // document.dispatchEvent(xhrEvent);
    }, false);

    // Call the stored reference to the native method
    oldOpen.apply(this, args as any);
  };

  return function restoreXHR() {
    XMLHttpRequest.prototype.open = olderOpen;
    XMLHttpRequest.prototype.send = olderSend;
  }
};


