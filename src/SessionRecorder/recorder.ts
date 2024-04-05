import {record} from  "rrweb"
import {  IncrementalSource, MouseInteractions, ReplayerEvents, eventWithTime, listenerHandler } from '@rrweb/types';
import { BrowseBackOptions, EventWithTime } from "../@types/options";
import { getRecordNetworkPlugin } from "../plugin/console/record";
import io, { Socket } from 'socket.io-client';
import { RecordEvents, SocketEventType } from "../constants/constant";
import { v4 as uuidv4 } from 'uuid';
import { alignDomAndNetworkEvents } from "../utils/utils";


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

  
IncrementalSource

export class BrowseBack {
    private static events: CustomEventType = [[]]
    private static socket: Socket;
    private static sessionId: string | null = null;
    static username: string = 'Unknown';
    static user_identifier: string = 'N/A';
    private static recordErrorOnly: Boolean = true;
    private static getMetadata = () => {
        return {
            username: this.username,
            user_identifier:this.user_identifier
        }
    }
    static init ( options: BrowseBackOptions): void {
        let isCheckout = false;
        let started = false;
        const {lastNMinutes = 4, apiKey, socketUrl, user_identifier, username} = options ?? {}

        if("recordErrorOnly" in options){
            this.recordErrorOnly = options.recordErrorOnly
        }

        if(!apiKey) throw new Error("BrowseBack: API Key Missing")
        if(!socketUrl) throw new Error("Socket url missing")

        if(username){
            this.username = username
        }

        if(user_identifier){
            this.user_identifier = user_identifier
        }
        
        record({
            emit: (event: EventWithTime, _isCheckout) => {
                started = true
                if(BrowseBack.events.length >= 4 && this.recordErrorOnly){
                    BrowseBack.events.splice(0, 1)
                }
                if (isCheckout && this.recordErrorOnly) {
                    BrowseBack.events.push([]);
                    isCheckout = false
                    record.takeFullSnapshot()
                }

                // if(event?.data?.tag === RecordEvents.ignore){
                //     return;
                // }

                if(event.type === 6){
                    console.log(event)
                }

                const lastEvents = BrowseBack.events[BrowseBack.events.length - 1];
                lastEvents.push(event);
            },
            plugins: [
                getRecordNetworkPlugin({
                    recordHeaders: true,
                    recordBody: true,
                    recordInitialRequests: true
                }),
                // getRecordSequentialIdPlugin()
            ],
            maskAllInputs: true
        })

        document.addEventListener('click',(e) => {
            console.log(e.relatedTarget, e.currentTarget, e.target)
        })

        if(window && this.recordErrorOnly){

            setInterval(() => {
                if(!started) return;
                isCheckout = true
                record.addCustomEvent(RecordEvents.ignore, {})
            }, (lastNMinutes / 2) * 60 * 1000)

            window.addEventListener('error', debounce((e) => {
                if(!started) return;

                const len = BrowseBack.events.length;
                if(len < 1){
                    return;
                }

                let events = [] as EventWithTime[];
                if(len === 1){
                    events = BrowseBack.events[0]
                }
                if(len === 2){
                    events = [...(BrowseBack.events[len - 2]), ...(BrowseBack.events[len - 1])]
                }
                if(len > 2){
                    events = [...(BrowseBack.events[len - 3]),...(BrowseBack.events[len - 2]), ...(BrowseBack.events[len - 1])]
                }
                // atleast two event is required to send it to backend
                if(events.length < 2) return;
                this.sendSnapshotToBackend({events: events, error: e?.message ?? 'Unknown error'},SocketEventType.error_snapshot)
            }, 500))
            return;
        }

        const headers = {
            "browse-back-key": apiKey,
        }

        this.socket = io(socketUrl, {
          transportOptions: {
            polling: {
              extraHeaders: headers,
            },
          },
        });

        if(!this.recordErrorOnly){
            this.socket.emit("create_session")
            this.socket.once('set_session_id', (data) => {
                console.log(data)
                this.sessionId = data
                try{
                    localStorage.setItem("browse_back", this.sessionId as string)
                }catch(err){
                    // ignore
                }
            })
        }

        setInterval(() => {
            if(!BrowseBack.sessionId) return;
            this.sendSnapshotToBackend({events: BrowseBack.events[0], error: "N/A"}, SocketEventType.session)
            BrowseBack.events[0] = []
        }, 15000)

    }


    private static sendSnapshotToBackend (data: {events: EventWithTime[], error?: string }, topic: SocketEventType) {

        this.socket.emit(topic, JSON.stringify({
            events: data.events,
            metadata: {...this.getMetadata(), error: data?.error},
            sessionId: this.sessionId
        }))
    }

}
