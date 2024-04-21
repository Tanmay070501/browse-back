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
    private static username: string = 'Unknown';
    private static user_identifier: string = 'N/A';
    private static recordErrorOnly: Boolean = false;
    private static recentErr: string = ""
    static stop: () => void;
    private static recordStopFn?:  () => void;
    private static record?: boolean = true;
    private static clearIntervalList: number[] = [];

    static updateUser(username?: string, user_identifier?: string) {
        if(user_identifier){
            BrowseBack.user_identifier = user_identifier
        }
        if(username){
            BrowseBack.username = username
        }
    }

    static init ( browseBackOptions: BrowseBackOptions, config: recordConfig = {}): void {
        try{
            if(config){
                for (let key in config) {
                    if (!(validConfigOptions.includes(key))) {
                        console.error(`Invalid option: ${key}`);
                        return;
                    }
                }
            }
            let isCheckout = false;
            let started = false;
            const plugins: RecordPlugin[] = []

            if("recordErrorOnly" in browseBackOptions){
                BrowseBack.recordErrorOnly = browseBackOptions.recordErrorOnly
            }

            if("record" in browseBackOptions){
                BrowseBack.record = browseBackOptions.record;
            }

            const options = {
                lastNMinutes: 6,
                recordConsole: false,
                recordNetwork: false,
                sendMail: false,
                ...browseBackOptions,
            }

            if(!BrowseBack.record){
                console.log("Not recording");
                return;
            }

            if(!options.apiKey) throw new Error("BrowseBack: API Key Missing")
            if(!options.socketUrl) throw new Error("Socket url missing")

            if(options.username){
                BrowseBack.username = options.username
            }

            if(options.user_identifier){
                BrowseBack.user_identifier = options.user_identifier
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
            
            
            BrowseBack.recordStopFn = record({
                emit: (event: EventWithTime, _isCheckout) => {
                    started = true
                    if(BrowseBack.events.length >= 4 && BrowseBack.recordErrorOnly){
                        BrowseBack.events.splice(0, 1)
                    }
                    if (isCheckout && BrowseBack.recordErrorOnly) {
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

            BrowseBack.stop = () => {
                BrowseBack.socket.disconnect()
                BrowseBack.sessionId = null;
                BrowseBack.events = [[]]
                BrowseBack.clearIntervalList.forEach(item => {
                    clearInterval(item);
                })
                BrowseBack.clearIntervalList = []
                if(BrowseBack.recordStopFn){
                    BrowseBack.recordStopFn();
                }
            }

            // initiate connection to backend
            const headers = {
                "browse-back-key": options.apiKey,
                "browse-back-record-error": BrowseBack.recordErrorOnly,
                "browse-back-send-mail": options.sendMail
            }

            BrowseBack.socket = io(options.socketUrl, {
                transportOptions: {
                    polling: {
                    extraHeaders: headers,
                    },
                },
            });

            BrowseBack.socket.on('disconnect', (reason, desc) => {
                console.log("disconnect ", reason, desc)
                BrowseBack.sessionId = null;
            })

            // Record Error only

            if(window && BrowseBack.recordErrorOnly){
                // fake event for inactivity
                const interval1 = setInterval(() => {
                    if(!started) return;
                    isCheckout = true
                    record.addCustomEvent(RecordEvents.ignore, {})
                }, (options.lastNMinutes / 2) * 60 * 1000)

                BrowseBack.clearIntervalList.push(interval1)

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
                    if(!BrowseBack.sessionId) return;
                    BrowseBack.sendSnapshotToBackend({events: events, error: err?.message ?? 'Unknown error'},SocketEventType.error_snapshot)
                }, 500))

                return;
            }

            BrowseBack.socket.on('start', () => {

                BrowseBack.socket.emit("create_session")

                BrowseBack.socket.once('set_session_id', (data) => {
                    BrowseBack.sessionId = data

                    try{
                        localStorage.setItem("browse_back", BrowseBack.sessionId as string)
                    }catch(err){
                        // ignore
                    }
                })

                window.addEventListener("error", (err) => {
                    if(err?.message){
                        BrowseBack.recentErr = err.message
                    }
                })

                const interval2 = setInterval(() => {

                    if(!BrowseBack.sessionId) return;

                    BrowseBack.sendSnapshotToBackend({events: BrowseBack.events[0]}, SocketEventType.session)
                    BrowseBack.events[0] = []
                }, 5000)
                BrowseBack.clearIntervalList.push(interval2);
            })
        }catch(_err){
            // ignore
            console.error(_err)
        }
    }


    private static sendSnapshotToBackend (data: {events: EventWithTime[], error?: string }, topic: SocketEventType) {
        if(!BrowseBack.socket) return;
        let metadata = BrowseBack.getMetadata()
        if(!metadata?.error){
            metadata.error = data?.error as string 
        }
        BrowseBack.socket.emit(topic, JSON.stringify({
            events: data.events,
            metadata: metadata,
            sessionId: BrowseBack.sessionId
        }))
    }

    private static getMetadata = () => {
        return {
            username: BrowseBack.username,
            user_identifier: BrowseBack.user_identifier,
            error: BrowseBack.recentErr
        }
    }

}
