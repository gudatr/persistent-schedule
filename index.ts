import * as fs from "fs";
/*
export default class Schedule {
    private scheduledFunctions: Array<ScheduledFunction> = new Array<ScheduledFunction>();

    index = 0;

    static make(schedule: (schedule: Schedule) => void, tickMilliseconds: number = 5000) {
        setInterval(() => {
            Redis.lock(REDIS_LOCK + this.constructor.name, 0, 300, (releaseLock) => {
                try {
                    let scheduleObject = new Schedule();
                    schedule(scheduleObject);
                    scheduleObject.scheduledFunctions.forEach(fn => {
                        fn.process(scheduleObject);
                    });
                } catch (err: any) {
                    Logger.Log(10, "jobs", 'Error occured in scheduler', err);
                } finally {
                    releaseLock();
                }
            });
        }, tickMilliseconds);
    }

    run(fn: () => void) {
        let func = new ScheduledFunction(this.index++, fn);
        this.scheduledFunctions.push(func);
        return func;
    }
}

class ScheduledFunction {
    private days: Array<string> = ScheduledFunction.weekdaysMap;

    private interval: number | null = null;

    private times: Array<string> | null = null;

    private function: () => void;

    private index: number;

    constructor(index: number, fn: () => void) {
        this.index = index;
        this.function = fn;
    }

    private getSignature(): string {
        return this.index + "_" + this.times + "_" + this.interval + "_" + this.days;
    }

    private static readonly weekdaysMap = ["Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"];

    public process(schedule: Schedule) {
        let now = Date.now();
        let currentTime = new Date();
        if (this.days !== null) {
            //Skip in case the current day is not in the days array
            if (!this.days.includes(ScheduledFunction.weekdaysMap[
                currentTime.getDay()]))
                return;
        }

        //Check if time is within last minute, then check if redis key is set
        if (this.times !== null) {
            this.times.forEach(time => {
                let hourAndMinute = time.split(':');
                let dateCompare = new Date();
                dateCompare.setHours(Number.parseInt(hourAndMinute[0]), Number.parseInt(hourAndMinute[1]), 0, 0);
                let dateAsMillis = dateCompare.getTime();
                if (dateAsMillis < now && now - Times.OneMinute > dateAsMillis) {
                    this.compareTimeAndRun(dateAsMillis);
                }
            });
            //Intervals start at Time 0
        } else if (this.interval !== null) {
            let mod = now % this.interval;
            let lastInterval = now - mod;
            this.compareTimeAndRun(lastInterval);
        }
    }

    private compareTimeAndRun(time: number) {
        let signature = this.getSignature();
        Redis.lock(REDIS_LOCK + signature, 200, 200, (releaseLock) => {
            Redis.connection().get(signature, (err, reply) => {
                if (!err && (!reply || Number.parseInt(reply) < time)) {
                    //Expires every day in case something goes wrong.
                    //Unsure whether a general clean up would be better (TODO)
                    Redis.connection().set(signature, time.toString(), 'EX', 86400, (err, reply) => {
                        releaseLock();
                        this.function();
                    });
                } else {
                    releaseLock();
                }
            });
        });
    }

    public daily() {
        this.days = ScheduledFunction.weekdaysMap;
        return this;
    }

    public atTimesOfDay(times: Array<string>) {
        this.times = times;
        this.interval = null;
        return this;
    }

    public onDay(day: "Sunday" |
        "Monday" |
        "Tuesday" |
        "Wednesday" |
        "Thursday" |
        "Friday" |
        "Saturday") {
        this.days = [
            day
        ];
        return this;
    }

    public every(interval: number) {
        this.interval = interval;
        this.times = null;
        return this;
    }

    public onDays(days: Array<"Sunday" |
        "Monday" |
        "Tuesday" |
        "Wednesday" |
        "Thursday" |
        "Friday" |
        "Saturday">) {
        this.days = [];
        for (let i = 0; i < days.length; i++) {
            this.days.push(days[i]);
        }
        return this;
    }
}
*/
type StorageState = { [Key: string]: number | boolean | string | null | undefined };

export class Storage {

    private file: fs.promises.FileHandle | undefined;

    private state: StorageState = {};

    private requestPath: string;

    private hasChanged: boolean = false;

    private exclusiveFlag = fs.constants.S_IRUSR | fs.constants.S_IWUSR | fs.constants.O_CREAT;

    constructor(private path: string, tickInterval: number = 50) {
        this.requestPath = path + "_request";
        setInterval(() => { this.tick(); }, tickInterval);
    }

    public async Set(key: string, value: number | boolean | string | null | undefined) {
        await this.requestAccess();
        this.state[key] = value;
        this.hasChanged = true;
    }

    public async Get(key: string): Promise<number | boolean | string | null | undefined> {
        await this.requestAccess();
        return this.state[key];
    }

    public async Lock(key: string, ttl = 100) {

    }

    public async Unlock(key: string) {

    }

    private async writeState() {
        if (this.hasChanged && this.file) {
            await this.file.truncate();
            await this.file.write(this.stateToString(), 0, 'utf-8');
            this.hasChanged = false;
        }
    }

    private async readState() {
        await this.requestAccess();
        if (!this.file) return;
        let fileContents = (await this.file.read()).buffer;
        this.updateStateFromString(fileContents.toString());
    }

    private async requestAccess() {
        if (this.file) return;

        return new Promise(async (resolve, _reject) => {
            let requestFileHandle = await fs.promises.open(this.requestPath, 'w+', this.exclusiveFlag);
            this.file = await fs.promises.open(this.path, 'w+', this.exclusiveFlag);
            await requestFileHandle.close();
            await fs.promises.unlink(this.requestPath).catch((_err) => { });
            await this.readState();
            resolve(true);
        });
    }

    private async yieldAccess() {
        this.file?.close();
        this.file = undefined;
    }

    private async tick() {
        if (!this.file) return;

        await this.writeState();

        let requestFileExists = !!(await fs.promises.stat(this.requestPath).catch(_e => false));

        if (requestFileExists) await this.yieldAccess();
    }

    private stateToString(): string {
        let keys = Object.keys(this.state);
        let parts = new Array(keys.length * 2);
        let i = 0;
        for (let key in keys) {
            let value: any = this.state[key];
            let type = typeof value;
            switch (type) {
                case "boolean": value = value ? 't' : 'f'; break;
                case "string": value = '"' + value.replaceAll('\r\n\r', '\r\n'); break;
                case "object": value = 'n'; break;
                case "undefined": value = 'u'; break;
            }
            parts[i] = key;
            parts[i + 1] = value;
            i += 2;
        }
        return parts.join('\r\n\r');
    }

    private updateStateFromString(state: string) {
        let rows = state.split('\r\n\r');
        for (let i = 0; i < rows.length - 1; i += 2) {
            let value: any = rows[i + 1];
            switch (value[0]) {
                case 't': value = true; break;
                case 'f': value = false; break;
                case 'n': value = null; break;
                case 'u': value = undefined; break;
                case '"': value = value.substring(1); break;
                default: value = +value; break;
            }
            this.state[rows[i]] = value;
        }
    }
}