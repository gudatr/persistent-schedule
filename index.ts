import Storage from "smol-storage";

const weekdaysMap = ["Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"];

export default class Schedule {
    private scheduledFunctions: Array<ScheduledFunction> = new Array<ScheduledFunction>();

    public static storage = new Storage('./schedule');

    index = 0;

    static make(schedule: (schedule: Schedule) => void, tickMilliseconds: number = 5000) {
        setInterval(async () => {
            let lock = await this.storage.lock('lock:schedule', 5000);
            try {
                let scheduleObject = new Schedule();
                schedule(scheduleObject);
                scheduleObject.scheduledFunctions.forEach(fn => {
                    fn.process();
                });
            } catch (err: any) {
                console.log('Error occured while running the schedule', err);
            } finally {
                this.storage.unlock('lock:schedule', lock);
            }
        }, tickMilliseconds);
    }

    run(fn: () => void) {
        let func = new ScheduledFunction(this.index++, fn);
        this.scheduledFunctions.push(func);
        return func;
    }
}

class ScheduledFunction {
    private days: Array<string> = weekdaysMap;

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

    public process() {
        let now = Date.now();
        let time = new Date();

        if (this.days && !this.days.includes(weekdaysMap[time.getDay()])) return;

        if (!this.times && this.interval) {
            let mod = now % this.interval;
            let lastInterval = now - mod;
            return this.compareTimeAndRun(lastInterval);
        }

        this.times?.forEach(time => {
            let hourAndMinute = time.split(':');

            let dateCompare = new Date();

            dateCompare.setHours(Number.parseInt(hourAndMinute[0]), Number.parseInt(hourAndMinute[1]), 0, 0);

            let dateAsMillis = dateCompare.getTime();

            if (dateAsMillis < now && now - 60000 > dateAsMillis) {
                this.compareTimeAndRun(dateAsMillis);
            }
        });
    }

    private async compareTimeAndRun(time: number) {
        let signature = this.getSignature();
        let lockKey = 'lock:' + signature;
        let lock = await Schedule.storage.lock(lockKey);
        try {
            let lastRun = await Schedule.storage.get(signature);

            if (lastRun && +lastRun < time) {
                await Schedule.storage.set(signature, time);
                this.function();
            }
        } finally {
            Schedule.storage.unlock(lockKey, lock);
        }
    }

    public daily() {
        this.days = weekdaysMap;
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