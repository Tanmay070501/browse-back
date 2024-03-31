import { eventWithTime } from "@rrweb/types";

export interface BrowseBackOptions {
    apiKey: string;
    recordErrorOnly: boolean;
    lastNMinutes: number;
    socketUrl: string;
}

export type EventWithTime  = eventWithTime & {
    data: {
        tag: string
    }
}