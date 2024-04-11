import { RecordPlugin } from "@rrweb/types";
import { recordFetch } from "../../network-event/fetch";
import { recordXhr } from "../../network-event/capture-xhr";

export const CUSTOM_NETWORK_PLUGIN_NAME = "tannu/network@1"

export interface NetworkCaptureOptions {
    captureNetworkPayload: boolean;
}  



export const getRecordNetworkPlugin: (
    options?: NetworkCaptureOptions,
  ) => RecordPlugin = (options) => ({
    name: CUSTOM_NETWORK_PLUGIN_NAME,
    observer: (cb, _win, options) => {
        if(!window) return () => {}

        window.addEventListener('hashchange', function(event) {
            // Update the stored URL when the popstate event occurs
            console.log(window.location.href)
        }, false);

        if(!("performance" in window)){
            return () => {}
        }

        if("navigation" in window){
            (window.navigation as any).addEventListener("navigate", (event: any) => {
                cb(
                    {
                        request: {
                            url: window.location.href
                        },
                        initiatorType: 'navigation'
                    }
                )
            })
        }

        window.performance.addEventListener("resourcetimingbufferfull", () => {
            window.performance.clearResourceTimings()
        })

        const restoreFetch = recordFetch(cb, options as NetworkCaptureOptions)
        const restoreXHR = recordXhr(cb, options as NetworkCaptureOptions)

        return () => {
            restoreFetch();
            restoreXHR()
        }
    },
    options: options,
});