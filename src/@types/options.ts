import { eventWithTime } from "@rrweb/types";
import { recordOptions } from "rrweb/typings/types";

export interface BrowseBackOptions {
    apiKey: string;
    recordErrorOnly: boolean;
    lastNMinutes?: number;
    socketUrl: string;
    username?: string;
    user_identifier?: string;
    recordNetwork?: boolean;
    recordConsole?: boolean;
    record?: boolean;
    sendMail?: boolean;
}

export type EventWithTime  = eventWithTime & {
    data: {
        tag: string,
        payload: any,
        plugin?: string
    }
}

type RRWebRecordOpts = recordOptions<EventWithTime>

export const validConfigOptions =  [
    "recordCanvas", 
    "recordCrossOriginIframes",
    "maskInputOptions",
    "maskAllInputs",
]
export interface recordConfig {
    recordCanvas?: RRWebRecordOpts["recordCanvas"],
    recordCrossOriginIframes?: RRWebRecordOpts["recordCrossOriginIframes"]
    maskInputOptions?: RRWebRecordOpts["maskInputOptions"],
    maskAllInputs?:RRWebRecordOpts["maskAllInputs"]
}
