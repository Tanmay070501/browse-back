import {getRecordConsolePlugin, mirror, record} from  "rrweb"
import {  MouseInteractions, eventWithTime, listenerHandler } from '@rrweb/types';
import { BrowseBackOptions } from "../@types/options";
import { getRecordNetworkPlugin } from "../plugin/record";

// export class SessionRecorder {
//     private events: any[] = [[]];
//     private errorListener: (event: ErrorEvent) => void;
//     private stopRecording: listenerHandler | undefined
//     constructor() {
//         console.log("Yoo")
//         this.errorListener = this.handleError.bind(this);
//         window.addEventListener('error', this.errorListener);
//         const stopFn = record({
//             emit: (event, isCheckout) => {
//                 // this.events.push(event);
//                 if (isCheckout) {
//                     this.events.push([]);
//                 }
//                 const lastEvents = this.events[this.events.length - 1];
//                 lastEvents.push(event);
//             },
//             plugins: [
//                 // getRecordConsolePlugin({
//                 //   level: ['info', 'log', 'warn', 'error'],
//                 //   lengthThreshold: 10000,
//                 //   stringifyOptions: {
//                 //     stringLengthLimit: 1000,
//                 //     numOfKeysLimit: 100,
//                 //     depthOfLimit: 1,
//                 //   },
//                 //   logger: window.console,
//                 // }),
//                 // getRecordConsolePlugin()

//               ],
//               checkoutEveryNms: 1 * 60 * 1000, // checkout every 1 minutes
//         })
//         this.stopRecording  = stopFn?.bind(this)
        
//         setInterval(() => {
//             record.addCustomEvent("ignore-me", {})
//         }, 1000)

//     }

//     record(event: any) {
//         this.events.push(event);
//     }

//     private takeSnapshot() {
//         record.addCustomEvent('bro', {
//             "kekw": 2
//         })
//         const len = this.events.length;
//         console.log(this.events)
//         const events = this.events[len - 2].concat(this.events[len - 1]);
//         console.log(events)
//     }

//     private handleError(event: ErrorEvent) {
//         console.log(event)
//         this.takeSnapshot()
//     }
// }

const recordLastNMinutes = (lastNMinutes = 2) => {
    const events: Array<Array<eventWithTime>> = [[]]
    record({
        emit: (event, isCheckout) => {
            if (isCheckout) {
                events.push([]);
            }
            const lastEvents = events[events.length - 1];
            lastEvents.push(event);
        },
        checkoutEveryNms: (lastNMinutes / 2) * 60 * 1000
    })

    setInterval(() => {
        record.addCustomEvent('ignore', {})
    }, 1000 * 5)

    // if (window && rec){
    //     window.addEventListener('error',() => {

    //     })
    // }
}
type CustomEventType = eventWithTime[][]

export class BrowseBack {
    private static events: CustomEventType = [[]]
    static init ( options: BrowseBackOptions = {recordErrorOnly: true, lastNMinutes: 2}): void {
        const {lastNMinutes, recordErrorOnly} = options
        
        
        document && document.addEventListener('DOMContentLoaded', () => {
            document.addEventListener('click', e => {
                console.log(e)
                console.log(e.target)
            })
            
            record({
                emit: (event, isCheckout) => {
                    if(this.events.length >= 3){
                        this.events.splice(0, 1)
                    }
                    if (isCheckout) {
                        this.events.push([]);
                    }
                    const lastEvents = this.events[this.events.length - 1];
                    lastEvents.push(event);
                },
                checkoutEveryNms: (lastNMinutes / 2) * 60 * 1000,
                plugins: [getRecordNetworkPlugin({
                    initiatorTypes: ['fetch', 'xmlhttprequest'],
                    recordHeaders: true,
                    recordBody: true,
                })],
                hooks:{
                    // mouseInteraction: 
                }
            })
            if(window && recordErrorOnly){
                window.addEventListener('error', async (e) => {
                    console.log(e)
                    const len = this.events.length;
                    // console.log(this.events)
                    const events = len === 1 ? this.events[0] : this.events[len - 2].concat(this.events[len - 1]);
                    this.sendSnapshotToBackend(events)
                })
            }
        })
    }


    private static sendSnapshotToBackend (data: any) {
        console.log(data)
    }
}

BrowseBack.init()