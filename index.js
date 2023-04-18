"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
const fs = __importStar(require("fs"));
class Storage {
    constructor(path, tickInterval = 50) {
        this.path = path;
        this.state = {};
        this.hasChanged = false;
        this.exclusiveFlag = fs.constants.S_IRUSR | fs.constants.S_IWUSR | fs.constants.O_CREAT;
        this.requestPath = path + "_request";
        setInterval(() => { this.tick(); }, tickInterval);
    }
    Set(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.requestAccess();
            this.state[key] = value;
            this.hasChanged = true;
        });
    }
    Get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.requestAccess();
            return this.state[key];
        });
    }
    Lock(key, ttl = 100) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    Unlock(key) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    writeState() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasChanged && this.file) {
                yield this.file.truncate();
                yield this.file.write(this.stateToString(), 0, 'utf-8');
                this.hasChanged = false;
            }
        });
    }
    readState() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.requestAccess();
            if (!this.file)
                return;
            let fileContents = (yield this.file.read()).buffer;
            this.updateStateFromString(fileContents.toString());
        });
    }
    requestAccess() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.file)
                return;
            return new Promise((resolve, _reject) => __awaiter(this, void 0, void 0, function* () {
                let requestFileHandle = yield fs.promises.open(this.requestPath, 'w+', this.exclusiveFlag);
                this.file = yield fs.promises.open(this.path, 'w+', this.exclusiveFlag);
                yield requestFileHandle.close();
                yield fs.promises.unlink(this.requestPath).catch((_err) => { });
                yield this.readState();
                resolve(true);
            }));
        });
    }
    yieldAccess() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            (_a = this.file) === null || _a === void 0 ? void 0 : _a.close();
            this.file = undefined;
        });
    }
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.file)
                return;
            yield this.writeState();
            let requestFileExists = !!(yield fs.promises.stat(this.requestPath).catch(_e => false));
            if (requestFileExists)
                yield this.yieldAccess();
        });
    }
    stateToString() {
        let keys = Object.keys(this.state);
        let parts = new Array(keys.length * 2);
        let i = 0;
        for (let key in keys) {
            let value = this.state[key];
            let type = typeof value;
            switch (type) {
                case "boolean":
                    value = value ? 't' : 'f';
                    break;
                case "string":
                    value = '"' + value.replaceAll('\r\n\r', '\r\n');
                    break;
                case "object":
                    value = 'n';
                    break;
                case "undefined":
                    value = 'u';
                    break;
            }
            parts[i] = key;
            parts[i + 1] = value;
            i += 2;
        }
        return parts.join('\r\n\r');
    }
    updateStateFromString(state) {
        let rows = state.split('\r\n\r');
        for (let i = 0; i < rows.length - 1; i += 2) {
            let value = rows[i + 1];
            switch (value[0]) {
                case 't':
                    value = true;
                    break;
                case 'f':
                    value = false;
                    break;
                case 'n':
                    value = null;
                    break;
                case 'u':
                    value = undefined;
                    break;
                case '"':
                    value = value.substring(1);
                    break;
                default:
                    value = +value;
                    break;
            }
            this.state[rows[i]] = value;
        }
    }
}
exports.Storage = Storage;
