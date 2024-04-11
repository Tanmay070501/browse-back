import { NetworkCaptureOptions } from "../plugin/custom-network";

type FetchRequestBody = Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string | null;

interface FetchLog {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: FetchRequestBody;
  responseHeaders: Record<string, string>;
  responseBody: any;
  status?: number;
  statusText?: string;
  fetchLogCounter: string;
  performance?: PerformanceResourceTiming;
  payloadsCaptured: boolean;
  startTime?: number;
  endTime?: number;
  error?: undefined
}

type PerformanceResourceTimingList = Array<PerformanceResourceTiming>;

// const localEntry: Array<any> = []

export function recordFetch(cb:(...args: unknown[]) => any, opts?: NetworkCaptureOptions) {
    
  // Init options if not specified
  const options = opts || {
    captureNetworkPayload: false,
  };

  // Store a reference to the native method
  const oldFetch = window.fetch;

  let fetchLogCounter = 1;

  // Overwrite the native method
  window.fetch = async function(...args: any[]): Promise<Response> {
    const startTime = performance.now(); // Capture start time
    const [input, init] = args;

    const url = typeof input === 'string' ? input : input.url;
    const method = (init && init.method) ? init.method : 'GET';

    const fetchLog: FetchLog = {
      method,
      url,
      requestHeaders: {},
      requestBody: null,
      responseHeaders: {},
      responseBody: null,
      fetchLogCounter: `fetchLog${fetchLogCounter}`,
      payloadsCaptured: options.captureNetworkPayload || false,
      startTime: startTime, // Include start time in fetch log
      endTime: undefined, // End time will be set later
    };

    fetchLogCounter++;

    let cloneResponse: Response;

    try {
      // Capture headers set
      const oldHeaders = (init && init.headers) ? init.headers : new Headers();
      const headers = new Headers(oldHeaders);

      fetchLog.requestHeaders = oldHeaders as any;

      // Capture what is sent up
      const oldBody = (init && init.body) ? init.body : null;

      if (typeof oldBody !== 'undefined' && options.captureNetworkPayload) {
        fetchLog.requestBody = oldBody;
      }

      // Set a mark before we trigger the fetch so we can find the performance data easier
      window.performance.mark(fetchLog.fetchLogCounter);

      const response = await oldFetch(input, init);

      const endTime = performance.now(); // Capture end time

      cloneResponse = response.clone()

      fetchLog.endTime = endTime; // Include end time in fetch log

      return response;
    } catch (error) {
      const endTime = performance.now();
      fetchLog.endTime = endTime;
      // Re-throw the error to preserve the original error message
      fetchLog.error = (error as any)?.message;
      cloneResponse = new Response(null, {
          status: 599,
          statusText: fetchLog.error,
      });
      throw error;
    } finally{
      setTimeout(async () => {
          if(cloneResponse === undefined){
            return
          }
          if (options.captureNetworkPayload) {
            const body = await cloneResponse.text()
            fetchLog.responseBody = btoa(body);
          }
    
          // Capture response headers
          cloneResponse.headers.forEach((value, name) => {
            fetchLog.responseHeaders[name] = value;
          });
    
          fetchLog.status = cloneResponse.status;
          fetchLog.statusText = cloneResponse.statusText;
    
          // It seems that getEntries() really returns Array<PerformanceResourceTiming>, but it is
          // defined as returning PerformanceEntryList, which does not expose the 'initiatorType'
          // property. Cast to PerformanceResourceTimingList so typescript knows about 'initiatorType'
          const entries = window.performance.getEntries() as PerformanceResourceTimingList;
          let markIndex = -1;
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.name === fetchLog.fetchLogCounter) {
              markIndex = i;
              break;
            }
          }
          if (markIndex >= 0) {
            for (let i = markIndex; i < entries.length; i++) {
              const entry = entries[i];
              if (
                entry.initiatorType === 'fetch'
                && entry.name
                && entry.name.indexOf(fetchLog.url) >= 0
              ) {
                fetchLog.performance = entry
                fetchLog.startTime = entry.startTime;
                fetchLog.endTime = entry.responseEnd
                break;
              }
            }
          }

          performance.clearResourceTimings()
          window.performance.clearMarks(fetchLog.fetchLogCounter);

          // this fill fire plugin event with fetchLog Data
          cb({request: fetchLog, initiatorType: 'fetch'})
    
          // Fire an event with this fetch capture
          // const fetchEvent = new CustomEvent('fetchLog', {
          //   detail: {
          //     fetchLog,
          //   },
          // });
    
        //   document.dispatchEvent(fetchEvent);
      })
    }
  };

  return function restoreFetch(){
      window.fetch = oldFetch;
  }
}


