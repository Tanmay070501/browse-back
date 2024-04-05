import { EventWithTime } from "../@types/options";
import { NETWORK_PLUGIN_NAME, NetworkData, NetworkRequest } from "../plugin/console/record";
import _ from "lodash"

const partitionArray = <T extends Object>(
    arr: T[], 
    predicate: (element: T) => boolean
): [T[], T[]] => {
    let trueArray: T[] = [];
    let falseArray: T[] = [];
    
    for (const element of arr) {
        if (predicate(element)) {
            trueArray.push(element);
        } else {
            falseArray.push(element);
        }
    }
    
    return [trueArray, falseArray];
}

function transformData(
    originalData: EventWithTime[],
    startTimestamp: number,
    transformation: (item: EventWithTime, request: NetworkRequest, newTimestamp: number) => any
): Array<any> {
    return originalData.flatMap(item =>
        item.data.payload.requests.map((request: NetworkRequest) => {
            const startTime = request.startTime;
            const newTimestamp = startTimestamp + startTime;
            return transformation(item, request, newTimestamp);
        })
    );
}

export const alignDomAndNetworkEvents = (elements: EventWithTime[]): EventWithTime[] => {
    let [networkEv, domEv] = partitionArray(elements, e => {
        return e.type === 6 && e.data.plugin === NETWORK_PLUGIN_NAME
    })

    console.log(domEv, networkEv)
    let transformedData = transformData(
        networkEv,
        domEv[0].timestamp,
        (item, request, newTimestamp) => ({
            type: item.type,
            data: { request , plugin: item.data.plugin},
            timestamp: newTimestamp
        })
    );
    transformedData = _.uniqWith(transformedData, _.isEqual)
    const mergedArray = [...transformedData, ...domEv]
    const sortedArray = mergedArray.sort((a, b) => a.timestamp - b.timestamp);
    return sortedArray
}
