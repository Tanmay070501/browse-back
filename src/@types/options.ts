import { eventWithTime } from "@rrweb/types";
import { NetworkData, NetworkRequest } from "../plugin/console/record";

export interface BrowseBackOptions {
    apiKey: string;
    recordErrorOnly: boolean;
    lastNMinutes: number;
    socketUrl: string;
    username?: string;
    user_identifier?: string;
}

export type EventWithTime  = eventWithTime & {
    data: {
        tag: string,
        payload: any,
        plugin?: string
    }
}