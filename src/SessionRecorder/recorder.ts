import { record , getRecordConsolePlugin } from  "rrweb"
import {  IncrementalSource, RecordPlugin } from '@rrweb/types';
import { BrowseBackOptions, EventWithTime, recordConfig, validConfigOptions } from "../@types/options";
import io, { Socket } from 'socket.io-client';
import { RecordEvents, SocketEventType } from "../constants/constant";
import { getRecordNetworkPlugin } from "../plugin/netwok/record";


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

    static init ( browseBackOptions: BrowseBackOptions, config?: recordConfig): void {
        try{
            if(config){
                for (let key in config) {
                    if (!(key in validConfigOptions)) {
                        console.error(`Invalid option: ${key}`);
                        return;
                    }
                }
            }
            let isCheckout = false;
            let started = false;
            const plugins: RecordPlugin[] = []

            if("recordErrorOnly" in browseBackOptions){
                this.recordErrorOnly = browseBackOptions.recordErrorOnly
            }
            const options = {
                lastNMinutes: 8,
                recordConsole: true,
                recordNetwork: true,
                ...browseBackOptions,
            }

            if(!options.apiKey) throw new Error("BrowseBack: API Key Missing")
            if(!options.socketUrl) throw new Error("Socket url missing")

            if(options.username){
                this.username = options.username
            }

            if(options.user_identifier){
                this.user_identifier = options.user_identifier
            }
            
            if(options.recordConsole){
                plugins.push(getRecordConsolePlugin())
            }

            if(options.recordNetwork){
                plugins.push(getRecordNetworkPlugin({
                    recordHeaders: true,
                    recordBody: true,
                    recordInitialRequests: true
                }))
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
                plugins: plugins,
                ...config,
            })

            // initiate connection to backend
            const headers = {
                "browse-back-key": options.apiKey,
            }

            this.socket = io(options.socketUrl, {
                transportOptions: {
                    polling: {
                    extraHeaders: headers,
                    },
                },
                
            });

            this.socket.on('disconnect', (e, d) => {
                console.log("disconnect ", e, d)
                this.sessionId = null;
            })

            // Record Error only

            if(window && this.recordErrorOnly){
                // fake event for inactivity
                setInterval(() => {
                    if(!started) return;
                    isCheckout = true
                    record.addCustomEvent(RecordEvents.ignore, {})
                }, (options.lastNMinutes / 2) * 60 * 1000)

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

            
            this.socket.emit("create_session")

            this.socket.once('set_session_id', (data) => {
                this.sessionId = data
                try{
                    localStorage.setItem("browse_back", this.sessionId as string)
                }catch(err){
                    // ignore
                }
            })

            window.addEventListener("error", (err) => {
                if(err?.message){
                    this.recentErr = err.message
                }
            })

            setInterval(() => {
                if(!this.sessionId) return;
                this.sendSnapshotToBackend({events: BrowseBack.events[0]}, SocketEventType.session)
                BrowseBack.events[0] = []
            }, 5000)
        }catch(_err){
            // ignore
            console.error(_err)
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
            user_identifier: this.user_identifier,
            error: this.recentErr
        }
    }

}
