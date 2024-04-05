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
    private static recentErr: string = "N/A"

    static updateUser(username?: string, user_identifier?: string) {
        if(user_identifier){
            this.user_identifier = user_identifier
        }
        if(username){
            this.username = username
        }
    }
    
    static init ( options: BrowseBackOptions): void {
        try{
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

                    const lastEvents = BrowseBack.events[BrowseBack.events.length - 1];
                    lastEvents.push(event);
                },
                plugins: [
                    getRecordNetworkPlugin({
                        recordHeaders: true,
                        recordBody: true,
                        recordInitialRequests: true
                    }),
                ],
                maskAllInputs: true
            })

            // initiate connection to backend
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

            // Record Error only

            if(window && this.recordErrorOnly){

                setInterval(() => {
                    if(!started) return;
                    isCheckout = true
                    record.addCustomEvent(RecordEvents.ignore, {})
                }, (lastNMinutes / 2) * 60 * 1000)

                window.addEventListener('error', debounce((err) => {
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
                    this.sendSnapshotToBackend({events: events, error: err?.message ?? 'Unknown error'},SocketEventType.error_snapshot)
                }, 500))

                return;
            }

            if(!this.recordErrorOnly){
                this.socket.emit("create_session")
                this.socket.once('set_session_id', (data) => {
                    this.sessionId = data
                    try{
                        localStorage.setItem("browse_back", this.sessionId as string)
                    }catch(err){
                        // ignore
                    }
                })
            }

            window.addEventListener("error", (err) => {
                if(err?.message){
                    this.recentErr = err.message
                }
            })

            setInterval(() => {
                if(!BrowseBack.sessionId) return;
                this.sendSnapshotToBackend({events: BrowseBack.events[0]}, SocketEventType.session)
                BrowseBack.events[0] = []
            }, 5000)
        }catch(_err){
            // ignore
        }
    }


    private static sendSnapshotToBackend (data: {events: EventWithTime[], error?: string }, topic: SocketEventType) {
        if(!this.socket) return;
        let metadata = this.getMetadata()
        if(!metadata?.error){
            metadata.error = data?.error as string 
        }
        this.socket.emit(topic, JSON.stringify({
            events: data.events,
            metadata: metadata,
            sessionId: this.sessionId
        }))
    }

    private static getMetadata = () => {
        return {
            username: this.username,
            user_identifier:this.user_identifier,
            error: this.recentErr
        }
    }

}
