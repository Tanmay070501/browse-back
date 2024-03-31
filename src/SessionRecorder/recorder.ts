import {getRecordConsolePlugin, mirror, record} from  "rrweb"
import {  MouseInteractions, eventWithTime, listenerHandler } from '@rrweb/types';
import { BrowseBackOptions, EventWithTime } from "../@types/options";
import { getRecordNetworkPlugin } from "../plugin/record";
import io, { Socket } from 'socket.io-client';
import { RecordEvents, SocketEventType } from "../constants/constant";

type CustomEventType = EventWithTime[][]


function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function(...args: Parameters<T>): void {
        
        // @ts-ignore
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}
  


export class BrowseBack {
    private static events: CustomEventType = [[]]
    private static socket: Socket;
    private static sessionId: string;
    static init ( options: BrowseBackOptions): void {
        const {lastNMinutes = 2, recordErrorOnly = true, apiKey, socketUrl} = options ?? {}
        if(!apiKey) throw new Error("BrowseBack: API Key Missing")
        if(!socketUrl) throw new Error("Socket url missing")

        console.log("lastNMinutes", lastNMinutes)
        console.log("errors only", recordErrorOnly)

        const stopFn = record({
            emit: (event: EventWithTime, isCheckout) => {
                if(this.events.length >= 3){
                    this.events.splice(0, 1)
                }
                if (isCheckout) {
                    this.events.push([]);
                }

                if(event.data?.tag && event?.data?.tag == RecordEvents.ignore){
                    return;
                }
                const lastEvents = this.events[this.events.length - 1];
                lastEvents.push(event);
            },
            checkoutEveryNms: (lastNMinutes / 2) * 60 * 1000,
            // plugins: [getRecordNetworkPlugin({
            //     initiatorTypes: ['fetch', 'xmlhttprequest'],
            //     recordHeaders: true,
            //     recordBody: true,
            // })],
        })

        setInterval(() => {
            if(!stopFn) return
            record.addCustomEvent(RecordEvents.ignore, {})
        }, 5000)


        if(window && recordErrorOnly){
            window.addEventListener('error', debounce(() => {
                console.log("debounce")
                if(!stopFn) return;
                record.addCustomEvent(RecordEvents.end, {})
                const len = BrowseBack.events.length;
                const events = len === 1 ? BrowseBack.events[0] : BrowseBack.events[len - 2].concat(BrowseBack.events[len - 1]);
                this.sendSnapshotToBackend(events,SocketEventType.error_snapshot)
            }, 500))

            const headers = {
                "browse-back-key": apiKey
            }
    
            this.socket = io(socketUrl, {
              transportOptions: {
                polling: {
                  extraHeaders: headers,
                },
              },
            });
            
            this.socket.on(SocketEventType.invalid, (data) => {
                throw new Error(data)
            })
    
            // this.socket.on(SocketEventType.error_snapshot, (data) => {
            //     this.sessionId = data
            //     console.log("update session id", this.sessionId)
            // })
        }

    }


    private static sendSnapshotToBackend (data: any, topic: SocketEventType) {
        //@ts-ignore
        // data.map(el => {
        //     console.log(el.type, new Date(el.timestamp))
        // })
        this.socket.emit(topic, JSON.stringify(data))
    }

}
