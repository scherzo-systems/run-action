"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/events-universal/default.js
var require_default = __commonJS({
  "node_modules/events-universal/default.js"(exports2, module2) {
    module2.exports = require("events");
  }
});

// node_modules/fast-fifo/fixed-size.js
var require_fixed_size = __commonJS({
  "node_modules/fast-fifo/fixed-size.js"(exports2, module2) {
    module2.exports = class FixedFIFO {
      constructor(hwm) {
        if (!(hwm > 0) || (hwm - 1 & hwm) !== 0) throw new Error("Max size for a FixedFIFO should be a power of two");
        this.buffer = new Array(hwm);
        this.mask = hwm - 1;
        this.top = 0;
        this.btm = 0;
        this.next = null;
      }
      clear() {
        this.top = this.btm = 0;
        this.next = null;
        this.buffer.fill(void 0);
      }
      push(data) {
        if (this.buffer[this.top] !== void 0) return false;
        this.buffer[this.top] = data;
        this.top = this.top + 1 & this.mask;
        return true;
      }
      shift() {
        const last = this.buffer[this.btm];
        if (last === void 0) return void 0;
        this.buffer[this.btm] = void 0;
        this.btm = this.btm + 1 & this.mask;
        return last;
      }
      peek() {
        return this.buffer[this.btm];
      }
      isEmpty() {
        return this.buffer[this.btm] === void 0;
      }
    };
  }
});

// node_modules/fast-fifo/index.js
var require_fast_fifo = __commonJS({
  "node_modules/fast-fifo/index.js"(exports2, module2) {
    var FixedFIFO = require_fixed_size();
    module2.exports = class FastFIFO {
      constructor(hwm) {
        this.hwm = hwm || 16;
        this.head = new FixedFIFO(this.hwm);
        this.tail = this.head;
        this.length = 0;
      }
      clear() {
        this.head = this.tail;
        this.head.clear();
        this.length = 0;
      }
      push(val) {
        this.length++;
        if (!this.head.push(val)) {
          const prev = this.head;
          this.head = prev.next = new FixedFIFO(2 * this.head.buffer.length);
          this.head.push(val);
        }
      }
      shift() {
        if (this.length !== 0) this.length--;
        const val = this.tail.shift();
        if (val === void 0 && this.tail.next) {
          const next = this.tail.next;
          this.tail.next = null;
          this.tail = next;
          return this.tail.shift();
        }
        return val;
      }
      peek() {
        const val = this.tail.peek();
        if (val === void 0 && this.tail.next) return this.tail.next.peek();
        return val;
      }
      isEmpty() {
        return this.length === 0;
      }
    };
  }
});

// node_modules/b4a/index.js
var require_b4a = __commonJS({
  "node_modules/b4a/index.js"(exports2, module2) {
    function isBuffer(value) {
      return Buffer.isBuffer(value) || value instanceof Uint8Array;
    }
    function isEncoding(encoding) {
      return Buffer.isEncoding(encoding);
    }
    function alloc(size, fill2, encoding) {
      return Buffer.alloc(size, fill2, encoding);
    }
    function allocUnsafe(size) {
      return Buffer.allocUnsafe(size);
    }
    function allocUnsafeSlow(size) {
      return Buffer.allocUnsafeSlow(size);
    }
    function byteLength(string, encoding) {
      return Buffer.byteLength(string, encoding);
    }
    function compare(a, b) {
      return Buffer.compare(a, b);
    }
    function concat(buffers, totalLength) {
      return Buffer.concat(buffers, totalLength);
    }
    function copy(source, target, targetStart, start, end) {
      return toBuffer(source).copy(target, targetStart, start, end);
    }
    function equals(a, b) {
      return toBuffer(a).equals(b);
    }
    function fill(buffer, value, offset, end, encoding) {
      return toBuffer(buffer).fill(value, offset, end, encoding);
    }
    function from(value, encodingOrOffset, length) {
      return Buffer.from(value, encodingOrOffset, length);
    }
    function includes(buffer, value, byteOffset, encoding) {
      return toBuffer(buffer).includes(value, byteOffset, encoding);
    }
    function indexOf(buffer, value, byfeOffset, encoding) {
      return toBuffer(buffer).indexOf(value, byfeOffset, encoding);
    }
    function lastIndexOf(buffer, value, byteOffset, encoding) {
      return toBuffer(buffer).lastIndexOf(value, byteOffset, encoding);
    }
    function swap16(buffer) {
      return toBuffer(buffer).swap16();
    }
    function swap32(buffer) {
      return toBuffer(buffer).swap32();
    }
    function swap64(buffer) {
      return toBuffer(buffer).swap64();
    }
    function toBuffer(buffer) {
      if (Buffer.isBuffer(buffer)) return buffer;
      return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    function toString(buffer, encoding, start, end) {
      return toBuffer(buffer).toString(encoding, start, end);
    }
    function write(buffer, string, offset, length, encoding) {
      return toBuffer(buffer).write(string, offset, length, encoding);
    }
    function readDoubleBE(buffer, offset) {
      return toBuffer(buffer).readDoubleBE(offset);
    }
    function readDoubleLE(buffer, offset) {
      return toBuffer(buffer).readDoubleLE(offset);
    }
    function readFloatBE(buffer, offset) {
      return toBuffer(buffer).readFloatBE(offset);
    }
    function readFloatLE(buffer, offset) {
      return toBuffer(buffer).readFloatLE(offset);
    }
    function readInt32BE(buffer, offset) {
      return toBuffer(buffer).readInt32BE(offset);
    }
    function readInt32LE(buffer, offset) {
      return toBuffer(buffer).readInt32LE(offset);
    }
    function readUInt32BE(buffer, offset) {
      return toBuffer(buffer).readUInt32BE(offset);
    }
    function readUInt32LE(buffer, offset) {
      return toBuffer(buffer).readUInt32LE(offset);
    }
    function writeDoubleBE(buffer, value, offset) {
      return toBuffer(buffer).writeDoubleBE(value, offset);
    }
    function writeDoubleLE(buffer, value, offset) {
      return toBuffer(buffer).writeDoubleLE(value, offset);
    }
    function writeFloatBE(buffer, value, offset) {
      return toBuffer(buffer).writeFloatBE(value, offset);
    }
    function writeFloatLE(buffer, value, offset) {
      return toBuffer(buffer).writeFloatLE(value, offset);
    }
    function writeInt32BE(buffer, value, offset) {
      return toBuffer(buffer).writeInt32BE(value, offset);
    }
    function writeInt32LE(buffer, value, offset) {
      return toBuffer(buffer).writeInt32LE(value, offset);
    }
    function writeUInt32BE(buffer, value, offset) {
      return toBuffer(buffer).writeUInt32BE(value, offset);
    }
    function writeUInt32LE(buffer, value, offset) {
      return toBuffer(buffer).writeUInt32LE(value, offset);
    }
    module2.exports = {
      isBuffer,
      isEncoding,
      alloc,
      allocUnsafe,
      allocUnsafeSlow,
      byteLength,
      compare,
      concat,
      copy,
      equals,
      fill,
      from,
      includes,
      indexOf,
      lastIndexOf,
      swap16,
      swap32,
      swap64,
      toBuffer,
      toString,
      write,
      readDoubleBE,
      readDoubleLE,
      readFloatBE,
      readFloatLE,
      readInt32BE,
      readInt32LE,
      readUInt32BE,
      readUInt32LE,
      writeDoubleBE,
      writeDoubleLE,
      writeFloatBE,
      writeFloatLE,
      writeInt32BE,
      writeInt32LE,
      writeUInt32BE,
      writeUInt32LE
    };
  }
});

// node_modules/text-decoder/lib/pass-through-decoder.js
var require_pass_through_decoder = __commonJS({
  "node_modules/text-decoder/lib/pass-through-decoder.js"(exports2, module2) {
    var b4a = require_b4a();
    module2.exports = class PassThroughDecoder {
      constructor(encoding) {
        this.encoding = encoding;
      }
      get remaining() {
        return 0;
      }
      decode(data) {
        return b4a.toString(data, this.encoding);
      }
      flush() {
        return "";
      }
    };
  }
});

// node_modules/text-decoder/lib/utf8-decoder.js
var require_utf8_decoder = __commonJS({
  "node_modules/text-decoder/lib/utf8-decoder.js"(exports2, module2) {
    var b4a = require_b4a();
    module2.exports = class UTF8Decoder {
      constructor() {
        this._reset();
      }
      get remaining() {
        return this.bytesSeen;
      }
      decode(data) {
        if (data.byteLength === 0) return "";
        if (this.bytesNeeded === 0 && trailingIncomplete(data, 0) === 0) {
          this.bytesSeen = trailingBytesSeen(data);
          return b4a.toString(data, "utf8");
        }
        let result = "";
        let start = 0;
        if (this.bytesNeeded > 0) {
          while (start < data.byteLength) {
            const byte = data[start];
            if (byte < this.lowerBoundary || byte > this.upperBoundary) {
              result += "�";
              this._reset();
              break;
            }
            this.lowerBoundary = 128;
            this.upperBoundary = 191;
            this.codePoint = this.codePoint << 6 | byte & 63;
            this.bytesSeen++;
            start++;
            if (this.bytesSeen === this.bytesNeeded) {
              result += String.fromCodePoint(this.codePoint);
              this._reset();
              break;
            }
          }
          if (this.bytesNeeded > 0) return result;
        }
        const trailing = trailingIncomplete(data, start);
        const end = data.byteLength - trailing;
        if (end > start) result += b4a.toString(data, "utf8", start, end);
        for (let i = end; i < data.byteLength; i++) {
          const byte = data[i];
          if (this.bytesNeeded === 0) {
            if (byte <= 127) {
              this.bytesSeen = 0;
              result += String.fromCharCode(byte);
            } else if (byte >= 194 && byte <= 223) {
              this.bytesNeeded = 2;
              this.bytesSeen = 1;
              this.codePoint = byte & 31;
            } else if (byte >= 224 && byte <= 239) {
              if (byte === 224) this.lowerBoundary = 160;
              else if (byte === 237) this.upperBoundary = 159;
              this.bytesNeeded = 3;
              this.bytesSeen = 1;
              this.codePoint = byte & 15;
            } else if (byte >= 240 && byte <= 244) {
              if (byte === 240) this.lowerBoundary = 144;
              else if (byte === 244) this.upperBoundary = 143;
              this.bytesNeeded = 4;
              this.bytesSeen = 1;
              this.codePoint = byte & 7;
            } else {
              this.bytesSeen = 1;
              result += "�";
            }
            continue;
          }
          if (byte < this.lowerBoundary || byte > this.upperBoundary) {
            result += "�";
            i--;
            this._reset();
            continue;
          }
          this.lowerBoundary = 128;
          this.upperBoundary = 191;
          this.codePoint = this.codePoint << 6 | byte & 63;
          this.bytesSeen++;
          if (this.bytesSeen === this.bytesNeeded) {
            result += String.fromCodePoint(this.codePoint);
            this._reset();
          }
        }
        return result;
      }
      flush() {
        const result = this.bytesNeeded > 0 ? "�" : "";
        this._reset();
        return result;
      }
      _reset() {
        this.codePoint = 0;
        this.bytesNeeded = 0;
        this.bytesSeen = 0;
        this.lowerBoundary = 128;
        this.upperBoundary = 191;
      }
    };
    function trailingIncomplete(data, start) {
      const len = data.byteLength;
      if (len <= start) return 0;
      const limit = Math.max(start, len - 4);
      let i = len - 1;
      while (i > limit && (data[i] & 192) === 128) i--;
      if (i < start) return 0;
      const byte = data[i];
      let needed;
      if (byte <= 127) return 0;
      if (byte >= 194 && byte <= 223) needed = 2;
      else if (byte >= 224 && byte <= 239) needed = 3;
      else if (byte >= 240 && byte <= 244) needed = 4;
      else return 0;
      const available = len - i;
      return available < needed ? available : 0;
    }
    function trailingBytesSeen(data) {
      const len = data.byteLength;
      if (len === 0) return 0;
      const last = data[len - 1];
      if (last <= 127) return 0;
      if ((last & 192) !== 128) return 1;
      const limit = Math.max(0, len - 4);
      let i = len - 2;
      while (i >= limit && (data[i] & 192) === 128) i--;
      if (i < 0) return 1;
      const first = data[i];
      let needed;
      if (first >= 194 && first <= 223) needed = 2;
      else if (first >= 224 && first <= 239) needed = 3;
      else if (first >= 240 && first <= 244) needed = 4;
      else return 1;
      if (len - i !== needed) return 1;
      if (needed >= 3) {
        const second = data[i + 1];
        if (first === 224 && second < 160) return 1;
        if (first === 237 && second > 159) return 1;
        if (first === 240 && second < 144) return 1;
        if (first === 244 && second > 143) return 1;
      }
      return 0;
    }
  }
});

// node_modules/text-decoder/index.js
var require_text_decoder = __commonJS({
  "node_modules/text-decoder/index.js"(exports2, module2) {
    var PassThroughDecoder = require_pass_through_decoder();
    var UTF8Decoder = require_utf8_decoder();
    module2.exports = class TextDecoder {
      constructor(encoding = "utf8") {
        this.encoding = normalizeEncoding(encoding);
        switch (this.encoding) {
          case "utf8":
            this.decoder = new UTF8Decoder();
            break;
          case "utf16le":
          case "base64":
            throw new Error("Unsupported encoding: " + this.encoding);
          default:
            this.decoder = new PassThroughDecoder(this.encoding);
        }
      }
      get remaining() {
        return this.decoder.remaining;
      }
      push(data) {
        if (typeof data === "string") return data;
        return this.decoder.decode(data);
      }
      // For Node.js compatibility
      write(data) {
        return this.push(data);
      }
      end(data) {
        let result = "";
        if (data) result = this.push(data);
        result += this.decoder.flush();
        return result;
      }
    };
    function normalizeEncoding(encoding) {
      encoding = encoding.toLowerCase();
      switch (encoding) {
        case "utf8":
        case "utf-8":
          return "utf8";
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return "utf16le";
        case "latin1":
        case "binary":
          return "latin1";
        case "base64":
        case "ascii":
        case "hex":
          return encoding;
        default:
          throw new Error("Unknown encoding: " + encoding);
      }
    }
  }
});

// node_modules/streamx/lib/errors.js
var require_errors = __commonJS({
  "node_modules/streamx/lib/errors.js"(exports2, module2) {
    module2.exports = class StreamError extends Error {
      constructor(msg, code, fn = StreamError) {
        super(msg);
        this.code = code;
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, fn);
        }
      }
      static isStreamDestroyed(err) {
        return err && err.code === "STREAM_DESTROYED";
      }
      static isPrematureClose(err) {
        return err && err.code === "PREMATURE_CLOSE";
      }
      static isAborted(err) {
        return err && err.code === "ABORTED";
      }
      static isBadArgument(err) {
        return err && err.code === "BAD_ARGUMENT";
      }
      get name() {
        return "StreamError";
      }
      static STREAM_DESTROYED() {
        return new StreamError("Stream was destroyed", "STREAM_DESTROYED", StreamError.STREAM_DESTROYED);
      }
      static PREMATURE_CLOSE(msg = "Premature close") {
        return new StreamError(msg, "PREMATURE_CLOSE", StreamError.PREMATURE_CLOSE);
      }
      static ABORTED() {
        return new StreamError("Stream aborted", "ABORTED", StreamError.ABORTED);
      }
      static BAD_ARGUMENT(msg = "Bad argument") {
        return new StreamError(msg, "BAD_ARGUMENT", StreamError.BAD_ARGUMENT);
      }
    };
  }
});

// node_modules/streamx/index.js
var require_streamx = __commonJS({
  "node_modules/streamx/index.js"(exports2, module2) {
    var { EventEmitter } = require_default();
    var FIFO = require_fast_fifo();
    var TextDecoder2 = require_text_decoder();
    var StreamError = require_errors();
    var qmt = typeof queueMicrotask === "undefined" ? (fn) => global.process.nextTick(fn) : queueMicrotask;
    var MAX = (1 << 29) - 1;
    var OPENING = 1;
    var PREDESTROYING = 2;
    var DESTROYING = 4;
    var DESTROYED = 8;
    var NOT_OPENING = MAX ^ OPENING;
    var NOT_PREDESTROYING = MAX ^ PREDESTROYING;
    var READ_ACTIVE = 1 << 4;
    var READ_UPDATING = 2 << 4;
    var READ_PRIMARY = 4 << 4;
    var READ_QUEUED = 8 << 4;
    var READ_RESUMED = 16 << 4;
    var READ_PIPE_DRAINED = 32 << 4;
    var READ_ENDING = 64 << 4;
    var READ_EMIT_DATA = 128 << 4;
    var READ_EMIT_READABLE = 256 << 4;
    var READ_EMITTED_READABLE = 512 << 4;
    var READ_DONE = 1024 << 4;
    var READ_NEXT_TICK = 2048 << 4;
    var READ_NEEDS_PUSH = 4096 << 4;
    var READ_READ_AHEAD = 8192 << 4;
    var READ_FLOWING = READ_RESUMED | READ_PIPE_DRAINED;
    var READ_ACTIVE_AND_NEEDS_PUSH = READ_ACTIVE | READ_NEEDS_PUSH;
    var READ_PRIMARY_AND_ACTIVE = READ_PRIMARY | READ_ACTIVE;
    var READ_EMIT_READABLE_AND_QUEUED = READ_EMIT_READABLE | READ_QUEUED;
    var READ_RESUMED_READ_AHEAD = READ_RESUMED | READ_READ_AHEAD;
    var READ_NOT_ACTIVE = MAX ^ READ_ACTIVE;
    var READ_NON_PRIMARY = MAX ^ READ_PRIMARY;
    var READ_NON_PRIMARY_AND_PUSHED = MAX ^ (READ_PRIMARY | READ_NEEDS_PUSH);
    var READ_PUSHED = MAX ^ READ_NEEDS_PUSH;
    var READ_PAUSED = MAX ^ READ_RESUMED;
    var READ_NOT_QUEUED = MAX ^ (READ_QUEUED | READ_EMITTED_READABLE);
    var READ_NOT_ENDING = MAX ^ READ_ENDING;
    var READ_PIPE_NOT_DRAINED = MAX ^ READ_FLOWING;
    var READ_NOT_NEXT_TICK = MAX ^ READ_NEXT_TICK;
    var READ_NOT_UPDATING = MAX ^ READ_UPDATING;
    var READ_NO_READ_AHEAD = MAX ^ READ_READ_AHEAD;
    var READ_PAUSED_NO_READ_AHEAD = MAX ^ READ_RESUMED_READ_AHEAD;
    var WRITE_ACTIVE = 1 << 18;
    var WRITE_UPDATING = 2 << 18;
    var WRITE_PRIMARY = 4 << 18;
    var WRITE_QUEUED = 8 << 18;
    var WRITE_UNDRAINED = 16 << 18;
    var WRITE_DONE = 32 << 18;
    var WRITE_EMIT_DRAIN = 64 << 18;
    var WRITE_NEXT_TICK = 128 << 18;
    var WRITE_WRITING = 256 << 18;
    var WRITE_FINISHING = 512 << 18;
    var WRITE_CORKED = 1024 << 18;
    var WRITE_NOT_ACTIVE = MAX ^ (WRITE_ACTIVE | WRITE_WRITING);
    var WRITE_NON_PRIMARY = MAX ^ WRITE_PRIMARY;
    var WRITE_NOT_FINISHING = MAX ^ (WRITE_ACTIVE | WRITE_FINISHING);
    var WRITE_DRAINED = MAX ^ WRITE_UNDRAINED;
    var WRITE_NOT_QUEUED = MAX ^ WRITE_QUEUED;
    var WRITE_NOT_NEXT_TICK = MAX ^ WRITE_NEXT_TICK;
    var WRITE_NOT_UPDATING = MAX ^ WRITE_UPDATING;
    var WRITE_NOT_CORKED = MAX ^ WRITE_CORKED;
    var ACTIVE = READ_ACTIVE | WRITE_ACTIVE;
    var NOT_ACTIVE = MAX ^ ACTIVE;
    var DONE = READ_DONE | WRITE_DONE;
    var DESTROY_STATUS = DESTROYING | DESTROYED | PREDESTROYING;
    var OPEN_STATUS = DESTROY_STATUS | OPENING;
    var AUTO_DESTROY = DESTROY_STATUS | DONE;
    var NON_PRIMARY = WRITE_NON_PRIMARY & READ_NON_PRIMARY;
    var ACTIVE_OR_TICKING = WRITE_NEXT_TICK | READ_NEXT_TICK;
    var TICKING = ACTIVE_OR_TICKING & NOT_ACTIVE;
    var IS_OPENING = OPEN_STATUS | TICKING;
    var READ_PRIMARY_STATUS = OPEN_STATUS | READ_ENDING | READ_DONE;
    var READ_STATUS = OPEN_STATUS | READ_DONE | READ_QUEUED;
    var READ_ENDING_STATUS = OPEN_STATUS | READ_ENDING | READ_QUEUED;
    var READ_READABLE_STATUS = OPEN_STATUS | READ_EMIT_READABLE | READ_QUEUED | READ_EMITTED_READABLE;
    var SHOULD_NOT_READ = OPEN_STATUS | READ_ACTIVE | READ_ENDING | READ_DONE | READ_NEEDS_PUSH | READ_READ_AHEAD;
    var READ_BACKPRESSURE_STATUS = DESTROY_STATUS | READ_ENDING | READ_DONE;
    var READ_UPDATE_SYNC_STATUS = READ_UPDATING | OPEN_STATUS | READ_NEXT_TICK | READ_PRIMARY;
    var READ_NEXT_TICK_OR_OPENING = READ_NEXT_TICK | OPENING;
    var WRITE_PRIMARY_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_DONE;
    var WRITE_QUEUED_AND_UNDRAINED = WRITE_QUEUED | WRITE_UNDRAINED;
    var WRITE_QUEUED_AND_ACTIVE = WRITE_QUEUED | WRITE_ACTIVE;
    var WRITE_DRAIN_STATUS = WRITE_QUEUED | WRITE_UNDRAINED | OPEN_STATUS | WRITE_ACTIVE;
    var WRITE_STATUS = OPEN_STATUS | WRITE_ACTIVE | WRITE_QUEUED | WRITE_CORKED;
    var WRITE_PRIMARY_AND_ACTIVE = WRITE_PRIMARY | WRITE_ACTIVE;
    var WRITE_ACTIVE_AND_WRITING = WRITE_ACTIVE | WRITE_WRITING;
    var WRITE_FINISHING_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_QUEUED_AND_ACTIVE | WRITE_DONE;
    var WRITE_BACKPRESSURE_STATUS = WRITE_UNDRAINED | DESTROY_STATUS | WRITE_FINISHING | WRITE_DONE;
    var WRITE_UPDATE_SYNC_STATUS = WRITE_UPDATING | OPEN_STATUS | WRITE_NEXT_TICK | WRITE_PRIMARY;
    var WRITE_DROP_DATA = WRITE_FINISHING | WRITE_DONE | DESTROY_STATUS;
    var asyncIterator = Symbol.asyncIterator || Symbol("asyncIterator");
    var WritableState = class {
      constructor(stream, { highWaterMark = 16384, map = null, mapWritable, byteLength, byteLengthWritable } = {}) {
        this.stream = stream;
        this.queue = new FIFO();
        this.highWaterMark = highWaterMark;
        this.buffered = 0;
        this.error = null;
        this.pipeline = null;
        this.drains = null;
        this.byteLength = byteLengthWritable || byteLength || defaultByteLength;
        this.map = mapWritable || map;
        this.afterWrite = afterWrite.bind(this);
        this.afterUpdateNextTick = updateWriteNT.bind(this);
      }
      get ending() {
        return (this.stream._duplexState & WRITE_FINISHING) !== 0;
      }
      get ended() {
        return (this.stream._duplexState & WRITE_DONE) !== 0;
      }
      push(data) {
        if ((this.stream._duplexState & WRITE_DROP_DATA) !== 0) return false;
        if (this.map !== null) data = this.map(data);
        this.buffered += this.byteLength(data);
        this.queue.push(data);
        if (this.buffered < this.highWaterMark) {
          this.stream._duplexState |= WRITE_QUEUED;
          return true;
        }
        this.stream._duplexState |= WRITE_QUEUED_AND_UNDRAINED;
        return false;
      }
      shift() {
        const data = this.queue.shift();
        this.buffered -= this.byteLength(data);
        if (this.buffered === 0) this.stream._duplexState &= WRITE_NOT_QUEUED;
        return data;
      }
      end(data) {
        if (typeof data === "function") {
          this.stream.once("finish", data);
        } else if (data !== void 0 && data !== null) {
          this.push(data);
        }
        this.stream._duplexState = (this.stream._duplexState | WRITE_FINISHING) & WRITE_NON_PRIMARY;
      }
      autoBatch(data, cb) {
        const buffer = [];
        const stream = this.stream;
        buffer.push(data);
        while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED_AND_ACTIVE) {
          buffer.push(stream._writableState.shift());
        }
        if ((stream._duplexState & OPEN_STATUS) !== 0) return cb(null);
        stream._writev(buffer, cb);
      }
      update() {
        const stream = this.stream;
        stream._duplexState |= WRITE_UPDATING;
        do {
          while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED) {
            const data = this.shift();
            stream._duplexState |= WRITE_ACTIVE_AND_WRITING;
            stream._write(data, this.afterWrite);
          }
          if ((stream._duplexState & WRITE_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
        } while (this.continueUpdate() === true);
        stream._duplexState &= WRITE_NOT_UPDATING;
      }
      updateNonPrimary() {
        const stream = this.stream;
        if ((stream._duplexState & WRITE_FINISHING_STATUS) === WRITE_FINISHING) {
          stream._duplexState = stream._duplexState | WRITE_ACTIVE;
          stream._final(afterFinal.bind(this));
          return;
        }
        if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
          if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
            stream._duplexState |= ACTIVE;
            stream._destroy(afterDestroy.bind(this));
          }
          return;
        }
        if ((stream._duplexState & IS_OPENING) === OPENING) {
          stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
          stream._open(afterOpen.bind(this));
        }
      }
      continueUpdate() {
        if ((this.stream._duplexState & WRITE_NEXT_TICK) === 0) return false;
        this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
        return true;
      }
      updateCallback() {
        if ((this.stream._duplexState & WRITE_UPDATE_SYNC_STATUS) === WRITE_PRIMARY) {
          this.update();
        } else {
          this.updateNextTick();
        }
      }
      updateNextTick() {
        if ((this.stream._duplexState & WRITE_NEXT_TICK) !== 0) return;
        this.stream._duplexState |= WRITE_NEXT_TICK;
        if ((this.stream._duplexState & WRITE_UPDATING) === 0) qmt(this.afterUpdateNextTick);
      }
    };
    var ReadableState = class {
      constructor(stream, { highWaterMark = 16384, map = null, mapReadable, byteLength, byteLengthReadable } = {}) {
        this.stream = stream;
        this.queue = new FIFO();
        this.highWaterMark = highWaterMark === 0 ? 1 : highWaterMark;
        this.buffered = 0;
        this.readAhead = highWaterMark > 0;
        this.error = null;
        this.pipeline = null;
        this.byteLength = byteLengthReadable || byteLength || defaultByteLength;
        this.map = mapReadable || map;
        this.pipeTo = null;
        this.afterRead = afterRead.bind(this);
        this.afterUpdateNextTick = updateReadNT.bind(this);
      }
      get ending() {
        return (this.stream._duplexState & READ_ENDING) !== 0;
      }
      get ended() {
        return (this.stream._duplexState & READ_DONE) !== 0;
      }
      pipe(pipeTo, cb) {
        if (this.pipeTo !== null) throw StreamError.BAD_ARGUMENT("Can only pipe to one destination");
        if (typeof cb !== "function") cb = null;
        this.stream._duplexState |= READ_PIPE_DRAINED;
        this.pipeTo = pipeTo;
        this.pipeline = new Pipeline(this.stream, pipeTo, cb);
        if (cb) this.stream.on("error", noop);
        if (isStreamx(pipeTo)) {
          pipeTo._writableState.pipeline = this.pipeline;
          if (cb) pipeTo.on("error", noop);
          pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
        } else {
          const onerror = this.pipeline.done.bind(this.pipeline, pipeTo);
          const onclose = this.pipeline.done.bind(this.pipeline, pipeTo, null);
          pipeTo.on("error", onerror);
          pipeTo.on("close", onclose);
          pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
        }
        pipeTo.on("drain", afterDrain.bind(this));
        this.stream.emit("piping", pipeTo);
        pipeTo.emit("pipe", this.stream);
      }
      push(data) {
        const stream = this.stream;
        if (data === null) {
          this.highWaterMark = 0;
          stream._duplexState = (stream._duplexState | READ_ENDING) & READ_NON_PRIMARY_AND_PUSHED;
          return false;
        }
        if (this.map !== null) {
          data = this.map(data);
          if (data === null) {
            stream._duplexState &= READ_PUSHED;
            return this.buffered < this.highWaterMark;
          }
        }
        this.buffered += this.byteLength(data);
        this.queue.push(data);
        stream._duplexState = (stream._duplexState | READ_QUEUED) & READ_PUSHED;
        return this.buffered < this.highWaterMark;
      }
      shift() {
        const data = this.queue.shift();
        this.buffered -= this.byteLength(data);
        if (this.buffered === 0) {
          this.stream._duplexState &= READ_NOT_QUEUED;
        }
        return data;
      }
      unshift(data) {
        const pending = [this.map !== null ? this.map(data) : data];
        while (this.buffered > 0) pending.push(this.shift());
        for (let i = 0; i < pending.length - 1; i++) {
          const data2 = pending[i];
          this.buffered += this.byteLength(data2);
          this.queue.push(data2);
        }
        this.push(pending[pending.length - 1]);
      }
      read() {
        const stream = this.stream;
        if ((stream._duplexState & READ_STATUS) === READ_QUEUED) {
          const data = this.shift();
          if (this.pipeTo !== null && this.pipeTo.write(data) === false) {
            stream._duplexState &= READ_PIPE_NOT_DRAINED;
          }
          if ((stream._duplexState & READ_EMIT_DATA) !== 0) {
            stream.emit("data", data);
          }
          return data;
        }
        if (this.readAhead === false) {
          stream._duplexState |= READ_READ_AHEAD;
          this.updateNextTick();
        }
        return null;
      }
      drain() {
        const stream = this.stream;
        while ((stream._duplexState & READ_STATUS) === READ_QUEUED && (stream._duplexState & READ_FLOWING) !== 0) {
          const data = this.shift();
          if (this.pipeTo !== null && this.pipeTo.write(data) === false) {
            stream._duplexState &= READ_PIPE_NOT_DRAINED;
          }
          if ((stream._duplexState & READ_EMIT_DATA) !== 0) {
            stream.emit("data", data);
          }
        }
      }
      update() {
        const stream = this.stream;
        stream._duplexState |= READ_UPDATING;
        do {
          this.drain();
          while (this.buffered < this.highWaterMark && (stream._duplexState & SHOULD_NOT_READ) === READ_READ_AHEAD) {
            stream._duplexState |= READ_ACTIVE_AND_NEEDS_PUSH;
            stream._read(this.afterRead);
            this.drain();
          }
          if ((stream._duplexState & READ_READABLE_STATUS) === READ_EMIT_READABLE_AND_QUEUED) {
            stream._duplexState |= READ_EMITTED_READABLE;
            stream.emit("readable");
          }
          if ((stream._duplexState & READ_PRIMARY_AND_ACTIVE) === 0) {
            this.updateNonPrimary();
          }
        } while (this.continueUpdate() === true);
        stream._duplexState &= READ_NOT_UPDATING;
      }
      updateNonPrimary() {
        const stream = this.stream;
        if ((stream._duplexState & READ_ENDING_STATUS) === READ_ENDING) {
          stream._duplexState = (stream._duplexState | READ_DONE) & READ_NOT_ENDING;
          stream.emit("end");
          if ((stream._duplexState & AUTO_DESTROY) === DONE) {
            stream._duplexState |= DESTROYING;
          }
          if (this.pipeTo !== null) {
            this.pipeTo.end();
          }
        }
        if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
          if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
            stream._duplexState |= ACTIVE;
            stream._destroy(afterDestroy.bind(this));
          }
          return;
        }
        if ((stream._duplexState & IS_OPENING) === OPENING) {
          stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
          stream._open(afterOpen.bind(this));
        }
      }
      continueUpdate() {
        if ((this.stream._duplexState & READ_NEXT_TICK) === 0) return false;
        this.stream._duplexState &= READ_NOT_NEXT_TICK;
        return true;
      }
      updateCallback() {
        if ((this.stream._duplexState & READ_UPDATE_SYNC_STATUS) === READ_PRIMARY) {
          this.update();
        } else {
          this.updateNextTick();
        }
      }
      updateNextTickIfOpen() {
        if ((this.stream._duplexState & READ_NEXT_TICK_OR_OPENING) !== 0) return;
        this.stream._duplexState |= READ_NEXT_TICK;
        if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
      }
      updateNextTick() {
        if ((this.stream._duplexState & READ_NEXT_TICK) !== 0) return;
        this.stream._duplexState |= READ_NEXT_TICK;
        if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
      }
    };
    var TransformState = class {
      constructor(stream) {
        this.data = null;
        this.afterTransform = afterTransform.bind(stream);
        this.afterFinal = null;
      }
    };
    var Pipeline = class {
      constructor(src, dst, cb) {
        this.from = src;
        this.to = dst;
        this.afterPipe = cb;
        this.error = null;
        this.pipeToFinished = false;
      }
      finished() {
        this.pipeToFinished = true;
      }
      done(stream, err) {
        if (err) this.error = err;
        if (stream === this.to) {
          this.to = null;
          if (this.from !== null) {
            if ((this.from._duplexState & READ_DONE) === 0 || !this.pipeToFinished) {
              this.from.destroy(this.error || StreamError.PREMATURE_CLOSE("Writable stream closed"));
            }
            return;
          }
        }
        if (stream === this.from) {
          this.from = null;
          if (this.to !== null) {
            if ((stream._duplexState & READ_DONE) === 0) {
              this.to.destroy(this.error || StreamError.PREMATURE_CLOSE("Readable stream closed"));
            }
            return;
          }
        }
        if (this.afterPipe !== null) this.afterPipe(this.error);
        this.to = this.from = this.afterPipe = null;
      }
    };
    function afterDrain() {
      this.stream._duplexState |= READ_PIPE_DRAINED;
      this.updateCallback();
    }
    function afterFinal(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      if ((stream._duplexState & DESTROY_STATUS) === 0) {
        stream._duplexState |= WRITE_DONE;
        stream.emit("finish");
      }
      if ((stream._duplexState & AUTO_DESTROY) === DONE) {
        stream._duplexState |= DESTROYING;
      }
      stream._duplexState &= WRITE_NOT_FINISHING;
      if ((stream._duplexState & WRITE_UPDATING) === 0) {
        this.update();
      } else {
        this.updateNextTick();
      }
    }
    function afterDestroy(err) {
      const stream = this.stream;
      if (!err && !StreamError.isStreamDestroyed(this.error)) err = this.error;
      if (err) stream.emit("error", err);
      stream._duplexState |= DESTROYED;
      stream.emit("close");
      const rs = stream._readableState;
      const ws = stream._writableState;
      if (rs !== null && rs.pipeline !== null) {
        rs.pipeline.done(stream, err);
      }
      if (ws !== null) {
        while (ws.drains !== null && ws.drains.length > 0) {
          ws.drains.shift().resolve(false);
        }
        if (ws.pipeline !== null) {
          ws.pipeline.done(stream, err);
        }
      }
    }
    function afterWrite(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      stream._duplexState &= WRITE_NOT_ACTIVE;
      if (this.drains !== null) tickDrains(this.drains);
      if ((stream._duplexState & WRITE_DRAIN_STATUS) === WRITE_UNDRAINED) {
        stream._duplexState &= WRITE_DRAINED;
        if ((stream._duplexState & WRITE_EMIT_DRAIN) === WRITE_EMIT_DRAIN) {
          stream.emit("drain");
        }
      }
      this.updateCallback();
    }
    function afterRead(err) {
      if (err) this.stream.destroy(err);
      this.stream._duplexState &= READ_NOT_ACTIVE;
      if (this.readAhead === false && (this.stream._duplexState & READ_RESUMED) === 0) {
        this.stream._duplexState &= READ_NO_READ_AHEAD;
      }
      this.updateCallback();
    }
    function updateReadNT() {
      if ((this.stream._duplexState & READ_UPDATING) === 0) {
        this.stream._duplexState &= READ_NOT_NEXT_TICK;
        this.update();
      }
    }
    function updateWriteNT() {
      if ((this.stream._duplexState & WRITE_UPDATING) === 0) {
        this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
        this.update();
      }
    }
    function tickDrains(drains) {
      for (let i = 0; i < drains.length; i++) {
        if (--drains[i].writes === 0) {
          drains.shift().resolve(true);
          i--;
        }
      }
    }
    function afterOpen(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      if ((stream._duplexState & DESTROYING) === 0) {
        if ((stream._duplexState & READ_PRIMARY_STATUS) === 0) {
          stream._duplexState |= READ_PRIMARY;
        }
        if ((stream._duplexState & WRITE_PRIMARY_STATUS) === 0) {
          stream._duplexState |= WRITE_PRIMARY;
        }
        stream.emit("open");
      }
      stream._duplexState &= NOT_ACTIVE;
      if (stream._writableState !== null) {
        stream._writableState.updateCallback();
      }
      if (stream._readableState !== null) {
        stream._readableState.updateCallback();
      }
    }
    function afterTransform(err, data) {
      if (data !== void 0 && data !== null) this.push(data);
      this._writableState.afterWrite(err);
    }
    function newListener(name) {
      if (this._readableState !== null) {
        if (name === "data") {
          this._duplexState |= READ_EMIT_DATA | READ_RESUMED_READ_AHEAD;
          this._readableState.updateNextTick();
        }
        if (name === "readable") {
          this._duplexState |= READ_EMIT_READABLE;
          this._readableState.updateNextTick();
        }
      }
      if (this._writableState !== null) {
        if (name === "drain") {
          this._duplexState |= WRITE_EMIT_DRAIN;
          this._writableState.updateNextTick();
        }
      }
    }
    var Stream = class extends EventEmitter {
      constructor(opts) {
        super();
        this._duplexState = 0;
        this._readableState = null;
        this._writableState = null;
        if (opts) {
          if (opts.open) this._open = opts.open;
          if (opts.destroy) this._destroy = opts.destroy;
          if (opts.predestroy) this._predestroy = opts.predestroy;
          if (opts.signal) opts.signal.addEventListener("abort", abort.bind(this));
        }
        this.on("newListener", newListener);
      }
      _open(cb) {
        cb(null);
      }
      _destroy(cb) {
        cb(null);
      }
      _predestroy() {
      }
      get readable() {
        return this._readableState !== null ? true : void 0;
      }
      get writable() {
        return this._writableState !== null ? true : void 0;
      }
      get destroyed() {
        return (this._duplexState & DESTROYED) !== 0;
      }
      get destroying() {
        return (this._duplexState & DESTROY_STATUS) !== 0;
      }
      destroy(err) {
        if ((this._duplexState & DESTROY_STATUS) === 0) {
          if (!err) err = StreamError.STREAM_DESTROYED();
          this._duplexState = (this._duplexState | DESTROYING) & NON_PRIMARY;
          if (this._readableState !== null) {
            this._readableState.highWaterMark = 0;
            this._readableState.error = err;
          }
          if (this._writableState !== null) {
            this._writableState.highWaterMark = 0;
            this._writableState.error = err;
          }
          this._duplexState |= PREDESTROYING;
          this._predestroy();
          this._duplexState &= NOT_PREDESTROYING;
          if (this._readableState !== null) {
            this._readableState.updateNextTick();
          }
          if (this._writableState !== null) {
            this._writableState.updateNextTick();
          }
        }
      }
    };
    var Readable = class _Readable extends Stream {
      constructor(opts) {
        super(opts);
        this._duplexState |= OPENING | WRITE_DONE | READ_READ_AHEAD;
        this._readableState = new ReadableState(this, opts);
        if (opts) {
          if (this._readableState.readAhead === false) this._duplexState &= READ_NO_READ_AHEAD;
          if (opts.read) this._read = opts.read;
          if (opts.eagerOpen) this._readableState.updateNextTick();
          if (opts.encoding) this.setEncoding(opts.encoding);
        }
      }
      static deferred(fn, opts) {
        const out = new PassThrough(opts);
        fn().then((src) => {
          if (src === null) return out.end();
          if (out.destroying) return;
          pipeline2(src, out, noop);
        }).catch((err) => out.destroy(err));
        return out;
      }
      setEncoding(encoding) {
        const dec = new TextDecoder2(encoding);
        const map = this._readableState.map || echo;
        this._readableState.map = mapOrSkip;
        return this;
        function mapOrSkip(data) {
          const next = dec.push(data);
          return next === "" && (data.byteLength !== 0 || dec.remaining > 0) ? null : map(next);
        }
      }
      _read(cb) {
        cb(null);
      }
      pipe(dest, cb) {
        this._readableState.updateNextTick();
        this._readableState.pipe(dest, cb);
        return dest;
      }
      read() {
        this._readableState.updateNextTick();
        return this._readableState.read();
      }
      push(data) {
        this._readableState.updateNextTickIfOpen();
        return this._readableState.push(data);
      }
      unshift(data) {
        this._readableState.updateNextTickIfOpen();
        return this._readableState.unshift(data);
      }
      resume() {
        this._duplexState |= READ_RESUMED_READ_AHEAD;
        this._readableState.updateNextTick();
        return this;
      }
      pause() {
        this._duplexState &= this._readableState.readAhead === false ? READ_PAUSED_NO_READ_AHEAD : READ_PAUSED;
        return this;
      }
      static _fromAsyncIterator(ite, opts) {
        let destroy;
        const rs = new _Readable({
          ...opts,
          read(cb) {
            ite.next().then(push).then(cb.bind(null, null)).catch(cb);
          },
          predestroy() {
            destroy = ite.return();
          },
          destroy(cb) {
            if (!destroy) return cb(null);
            destroy.then(cb.bind(null, null)).catch(cb);
          }
        });
        return rs;
        function push(data) {
          if (data.done) rs.push(null);
          else rs.push(data.value);
        }
      }
      static from(data, opts) {
        if (isReadStreamx(data)) return data;
        if (data[asyncIterator]) return this._fromAsyncIterator(data[asyncIterator](), opts);
        if (!Array.isArray(data)) data = data === void 0 ? [] : [data];
        let i = 0;
        return new _Readable({
          ...opts,
          read(cb) {
            this.push(i === data.length ? null : data[i++]);
            cb(null);
          }
        });
      }
      static isBackpressured(rs) {
        return (rs._duplexState & READ_BACKPRESSURE_STATUS) !== 0 || rs._readableState.buffered >= rs._readableState.highWaterMark;
      }
      static isPaused(rs) {
        return (rs._duplexState & READ_RESUMED) === 0;
      }
      [asyncIterator]() {
        const stream = this;
        let error = null;
        let promiseResolve = null;
        let promiseReject = null;
        this.on("error", (err) => {
          error = err;
        });
        this.on("readable", onreadable);
        this.on("close", onclose);
        return {
          [asyncIterator]() {
            return this;
          },
          next() {
            return new Promise(function(resolve, reject) {
              promiseResolve = resolve;
              promiseReject = reject;
              const data = stream.read();
              if (data !== null) ondata(data);
              else if ((stream._duplexState & DESTROYED) !== 0) ondata(null);
            });
          },
          return() {
            return destroy(null);
          },
          throw(err) {
            return destroy(err);
          }
        };
        function onreadable() {
          if (promiseResolve !== null) ondata(stream.read());
        }
        function onclose() {
          if (promiseResolve !== null) ondata(null);
        }
        function ondata(data) {
          if (promiseReject === null) return;
          if (error) {
            promiseReject(error);
          } else if (data === null && (stream._duplexState & READ_DONE) === 0) {
            promiseReject(StreamError.STREAM_DESTROYED());
          } else {
            promiseResolve({ value: data, done: data === null });
          }
          promiseReject = promiseResolve = null;
        }
        function destroy(err) {
          stream.destroy(err);
          return new Promise((resolve, reject) => {
            if (stream._duplexState & DESTROYED) return resolve({ value: void 0, done: true });
            stream.once("close", function() {
              if (err) reject(err);
              else resolve({ value: void 0, done: true });
            });
          });
        }
      }
    };
    var Writable = class extends Stream {
      constructor(opts) {
        super(opts);
        this._duplexState |= OPENING | READ_DONE;
        this._writableState = new WritableState(this, opts);
        if (opts) {
          if (opts.writev) this._writev = opts.writev;
          if (opts.write) this._write = opts.write;
          if (opts.final) this._final = opts.final;
          if (opts.eagerOpen) this._writableState.updateNextTick();
        }
      }
      cork() {
        this._duplexState |= WRITE_CORKED;
      }
      uncork() {
        this._duplexState &= WRITE_NOT_CORKED;
        this._writableState.updateNextTick();
      }
      _writev(batch, cb) {
        cb(null);
      }
      _write(data, cb) {
        this._writableState.autoBatch(data, cb);
      }
      _final(cb) {
        cb(null);
      }
      static isBackpressured(ws) {
        return (ws._duplexState & WRITE_BACKPRESSURE_STATUS) !== 0;
      }
      static drained(ws) {
        if (ws.destroyed) return Promise.resolve(false);
        const state = ws._writableState;
        const pending = isWritev(ws) ? Math.min(1, state.queue.length) : state.queue.length;
        const writes = pending + (ws._duplexState & WRITE_WRITING ? 1 : 0);
        if (writes === 0) return Promise.resolve(true);
        if (state.drains === null) state.drains = [];
        return new Promise((resolve) => {
          state.drains.push({ writes, resolve });
        });
      }
      write(data) {
        this._writableState.updateNextTick();
        return this._writableState.push(data);
      }
      end(data) {
        this._writableState.updateNextTick();
        this._writableState.end(data);
        return this;
      }
    };
    var Duplex = class extends Readable {
      // and Writable
      constructor(opts) {
        super(opts);
        this._duplexState = OPENING | this._duplexState & READ_READ_AHEAD;
        this._writableState = new WritableState(this, opts);
        if (opts) {
          if (opts.writev) this._writev = opts.writev;
          if (opts.write) this._write = opts.write;
          if (opts.final) this._final = opts.final;
        }
      }
      cork() {
        this._duplexState |= WRITE_CORKED;
      }
      uncork() {
        this._duplexState &= WRITE_NOT_CORKED;
        this._writableState.updateNextTick();
      }
      _writev(batch, cb) {
        cb(null);
      }
      _write(data, cb) {
        this._writableState.autoBatch(data, cb);
      }
      _final(cb) {
        cb(null);
      }
      write(data) {
        this._writableState.updateNextTick();
        return this._writableState.push(data);
      }
      end(data) {
        this._writableState.updateNextTick();
        this._writableState.end(data);
        return this;
      }
    };
    var Transform = class extends Duplex {
      constructor(opts) {
        super(opts);
        this._transformState = new TransformState(this);
        if (opts) {
          if (opts.transform) this._transform = opts.transform;
          if (opts.flush) this._flush = opts.flush;
        }
      }
      _write(data, cb) {
        if (this._readableState.buffered >= this._readableState.highWaterMark) {
          this._transformState.data = data;
        } else {
          this._transform(data, this._transformState.afterTransform);
        }
      }
      _read(cb) {
        if (this._transformState.data !== null) {
          const data = this._transformState.data;
          this._transformState.data = null;
          cb(null);
          this._transform(data, this._transformState.afterTransform);
        } else {
          cb(null);
        }
      }
      destroy(err) {
        super.destroy(err);
        if (this._transformState.data !== null) {
          this._transformState.data = null;
          this._transformState.afterTransform();
        }
      }
      _transform(data, cb) {
        cb(null, data);
      }
      _flush(cb) {
        cb(null);
      }
      _final(cb) {
        this._transformState.afterFinal = cb;
        this._flush(transformAfterFlush.bind(this));
      }
    };
    var PassThrough = class extends Transform {
    };
    function transformAfterFlush(err, data) {
      const cb = this._transformState.afterFinal;
      if (err) return cb(err);
      if (data !== null && data !== void 0) this.push(data);
      this.push(null);
      cb(null);
    }
    function pipelinePromise(...streams) {
      return new Promise((resolve, reject) => {
        return pipeline2(...streams, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    function pipeline2(stream, ...streams) {
      const all = Array.isArray(stream) ? [...stream, ...streams] : [stream, ...streams];
      const done = all.length && typeof all[all.length - 1] === "function" ? all.pop() : null;
      if (all.length < 2) throw StreamError.BAD_ARGUMENT("Pipeline requires at least 2 streams");
      let src = all[0];
      let dest = null;
      let error = null;
      for (let i = 1; i < all.length; i++) {
        dest = all[i];
        if (isStreamx(src)) {
          src.pipe(dest, onerror);
        } else {
          errorHandle(src, true, i > 1, onerror);
          src.pipe(dest);
        }
        src = dest;
      }
      if (done) {
        let fin = false;
        const autoDestroy = isStreamx(dest) || !!(dest._writableState && dest._writableState.autoDestroy);
        dest.on("error", (err) => {
          if (error === null) error = err;
        });
        dest.on("finish", () => {
          fin = true;
          if (!autoDestroy) done(error);
        });
        if (autoDestroy) {
          dest.on("close", () => done(error || (fin ? null : StreamError.PREMATURE_CLOSE())));
        }
      }
      return dest;
      function errorHandle(s, rd, wr, onerror2) {
        s.on("error", onerror2);
        s.on("close", onclose);
        function onclose() {
          if (rd && s._readableState && !s._readableState.ended) {
            return onerror2(StreamError.PREMATURE_CLOSE());
          }
          if (wr && s._writableState && !s._writableState.ended) {
            return onerror2(StreamError.PREMATURE_CLOSE());
          }
        }
      }
      function onerror(err) {
        if (!err || error) return;
        error = err;
        for (const s of all) {
          s.destroy(err);
        }
      }
    }
    function echo(s) {
      return s;
    }
    function isStream(stream) {
      return !!stream._readableState || !!stream._writableState;
    }
    function isStreamx(stream) {
      return typeof stream._duplexState === "number" && isStream(stream);
    }
    function isEnding(stream) {
      return !!stream._readableState && stream._readableState.ending;
    }
    function isEnded(stream) {
      return !!stream._readableState && stream._readableState.ended;
    }
    function isFinishing(stream) {
      return !!stream._writableState && stream._writableState.ending;
    }
    function isFinished(stream) {
      return !!stream._writableState && stream._writableState.ended;
    }
    function getStreamError(stream, opts = {}) {
      const err = stream._readableState && stream._readableState.error || stream._writableState && stream._writableState.error;
      return !opts.all && StreamError.isStreamDestroyed(err) ? null : err;
    }
    function isReadStreamx(stream) {
      return isStreamx(stream) && stream.readable;
    }
    function isDisturbed(stream) {
      return (stream._duplexState & OPENING) !== OPENING || (stream._duplexState & DESTROYING) === DESTROYING || (stream._duplexState & ACTIVE_OR_TICKING) !== 0;
    }
    function isTypedArray(data) {
      return typeof data === "object" && data !== null && typeof data.byteLength === "number";
    }
    function defaultByteLength(data) {
      return isTypedArray(data) ? data.byteLength : 1024;
    }
    function noop() {
    }
    function abort() {
      this.destroy(StreamError.ABORTED());
    }
    function isWritev(s) {
      return s._writev !== Writable.prototype._writev && s._writev !== Duplex.prototype._writev;
    }
    module2.exports = {
      pipeline: pipeline2,
      pipelinePromise,
      isStream,
      isStreamx,
      isEnding,
      isEnded,
      isFinishing,
      isFinished,
      isDisturbed,
      getStreamError,
      Stream,
      Writable,
      Readable,
      Duplex,
      Transform,
      // Export PassThrough for compatibility with Node.js core's stream module
      PassThrough
    };
  }
});

// node_modules/tar-stream/headers.js
var require_headers = __commonJS({
  "node_modules/tar-stream/headers.js"(exports2) {
    var b4a = require_b4a();
    var ZEROS = "0000000000000000000";
    var SEVENS = "7777777777777777777";
    var ZERO_OFFSET = "0".charCodeAt(0);
    var USTAR_MAGIC = b4a.from([117, 115, 116, 97, 114, 0]);
    var USTAR_VER = b4a.from([ZERO_OFFSET, ZERO_OFFSET]);
    var GNU_MAGIC = b4a.from([117, 115, 116, 97, 114, 32]);
    var GNU_VER = b4a.from([32, 0]);
    var MASK = 4095;
    var MAGIC_OFFSET = 257;
    var VERSION_OFFSET = 263;
    exports2.decodeLongPath = function decodeLongPath(buf, encoding) {
      return decodeStr(buf, 0, buf.length, encoding);
    };
    exports2.encodePax = function encodePax(opts) {
      let result = "";
      if (opts.name) result += addLength(" path=" + opts.name + "\n");
      if (opts.linkname) result += addLength(" linkpath=" + opts.linkname + "\n");
      const pax = opts.pax;
      if (pax) {
        for (const key in pax) {
          result += addLength(" " + key + "=" + pax[key] + "\n");
        }
      }
      return b4a.from(result);
    };
    exports2.decodePax = function decodePax(buf) {
      const result = {};
      while (buf.length) {
        let i = 0;
        while (i < buf.length && buf[i] !== 32) i++;
        const len = parseInt(b4a.toString(buf.subarray(0, i)), 10);
        if (!len) return result;
        const b = b4a.toString(buf.subarray(i + 1, len - 1));
        const keyIndex = b.indexOf("=");
        if (keyIndex === -1) return result;
        result[b.slice(0, keyIndex)] = b.slice(keyIndex + 1);
        buf = buf.subarray(len);
      }
      return result;
    };
    exports2.encode = function encode(opts) {
      const buf = b4a.alloc(512);
      let name = opts.name;
      let prefix = "";
      if (opts.typeflag === 5 && name[name.length - 1] !== "/") name += "/";
      if (b4a.byteLength(name) !== name.length) return null;
      while (b4a.byteLength(name) > 100) {
        const i = name.indexOf("/");
        if (i === -1) return null;
        prefix += prefix ? "/" + name.slice(0, i) : name.slice(0, i);
        name = name.slice(i + 1);
      }
      if (b4a.byteLength(name) > 100 || b4a.byteLength(prefix) > 155) return null;
      if (opts.linkname && b4a.byteLength(opts.linkname) > 100) return null;
      b4a.write(buf, name);
      b4a.write(buf, encodeOct(opts.mode & MASK, 6), 100);
      b4a.write(buf, encodeOct(opts.uid, 6), 108);
      b4a.write(buf, encodeOct(opts.gid, 6), 116);
      encodeSize(opts.size, buf, 124);
      b4a.write(buf, encodeOct(opts.mtime.getTime() / 1e3 | 0, 11), 136);
      buf[156] = ZERO_OFFSET + toTypeflag(opts.type);
      if (opts.linkname) b4a.write(buf, opts.linkname, 157);
      b4a.copy(USTAR_MAGIC, buf, MAGIC_OFFSET);
      b4a.copy(USTAR_VER, buf, VERSION_OFFSET);
      if (opts.uname) b4a.write(buf, opts.uname, 265);
      if (opts.gname) b4a.write(buf, opts.gname, 297);
      b4a.write(buf, encodeOct(opts.devmajor || 0, 6), 329);
      b4a.write(buf, encodeOct(opts.devminor || 0, 6), 337);
      if (prefix) b4a.write(buf, prefix, 345);
      b4a.write(buf, encodeOct(cksum(buf), 6), 148);
      return buf;
    };
    exports2.decode = function decode(buf, filenameEncoding, allowUnknownFormat) {
      let typeflag = buf[156] === 0 ? 0 : buf[156] - ZERO_OFFSET;
      let name = decodeStr(buf, 0, 100, filenameEncoding);
      const mode = decodeOct(buf, 100, 8);
      const uid = decodeOct(buf, 108, 8);
      const gid = decodeOct(buf, 116, 8);
      const size = decodeOct(buf, 124, 12);
      const mtime = decodeOct(buf, 136, 12);
      const type = toType(typeflag);
      const linkname = buf[157] === 0 ? null : decodeStr(buf, 157, 100, filenameEncoding);
      const uname = decodeStr(buf, 265, 32);
      const gname = decodeStr(buf, 297, 32);
      const devmajor = decodeOct(buf, 329, 8);
      const devminor = decodeOct(buf, 337, 8);
      const c = cksum(buf);
      if (c === 8 * 32) return null;
      if (c !== decodeOct(buf, 148, 8)) throw new Error("Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?");
      if (isUSTAR(buf)) {
        if (buf[345]) name = decodeStr(buf, 345, 155, filenameEncoding) + "/" + name;
      } else if (isGNU(buf)) {
      } else {
        if (!allowUnknownFormat) {
          throw new Error("Invalid tar header: unknown format.");
        }
      }
      if (typeflag === 0 && name && name[name.length - 1] === "/") typeflag = 5;
      return {
        name,
        mode,
        uid,
        gid,
        size,
        mtime: new Date(1e3 * mtime),
        type,
        linkname,
        uname,
        gname,
        devmajor,
        devminor,
        pax: null
      };
    };
    function isUSTAR(buf) {
      return b4a.equals(USTAR_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6));
    }
    function isGNU(buf) {
      return b4a.equals(GNU_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6)) && b4a.equals(GNU_VER, buf.subarray(VERSION_OFFSET, VERSION_OFFSET + 2));
    }
    function clamp(index, len, defaultValue) {
      if (typeof index !== "number") return defaultValue;
      index = ~~index;
      if (index >= len) return len;
      if (index >= 0) return index;
      index += len;
      if (index >= 0) return index;
      return 0;
    }
    function toType(flag) {
      switch (flag) {
        case 0:
          return "file";
        case 1:
          return "link";
        case 2:
          return "symlink";
        case 3:
          return "character-device";
        case 4:
          return "block-device";
        case 5:
          return "directory";
        case 6:
          return "fifo";
        case 7:
          return "contiguous-file";
        case 72:
          return "pax-header";
        case 55:
          return "pax-global-header";
        case 27:
          return "gnu-long-link-path";
        case 28:
        case 30:
          return "gnu-long-path";
      }
      return null;
    }
    function toTypeflag(flag) {
      switch (flag) {
        case "file":
          return 0;
        case "link":
          return 1;
        case "symlink":
          return 2;
        case "character-device":
          return 3;
        case "block-device":
          return 4;
        case "directory":
          return 5;
        case "fifo":
          return 6;
        case "contiguous-file":
          return 7;
        case "pax-header":
          return 72;
      }
      return 0;
    }
    function indexOf(block, num, offset, end) {
      for (; offset < end; offset++) {
        if (block[offset] === num) return offset;
      }
      return end;
    }
    function cksum(block) {
      let sum = 8 * 32;
      for (let i = 0; i < 148; i++) sum += block[i];
      for (let j = 156; j < 512; j++) sum += block[j];
      return sum;
    }
    function encodeOct(val, n) {
      val = val.toString(8);
      if (val.length > n) return SEVENS.slice(0, n) + " ";
      return ZEROS.slice(0, n - val.length) + val + " ";
    }
    function encodeSizeBin(num, buf, off) {
      buf[off] = 128;
      for (let i = 11; i > 0; i--) {
        buf[off + i] = num & 255;
        num = Math.floor(num / 256);
      }
    }
    function encodeSize(num, buf, off) {
      if (num.toString(8).length > 11) {
        encodeSizeBin(num, buf, off);
      } else {
        b4a.write(buf, encodeOct(num, 11), off);
      }
    }
    function parse256(buf) {
      let positive;
      if (buf[0] === 128) positive = true;
      else if (buf[0] === 255) positive = false;
      else return null;
      const tuple = [];
      let i;
      for (i = buf.length - 1; i > 0; i--) {
        const byte = buf[i];
        if (positive) tuple.push(byte);
        else tuple.push(255 - byte);
      }
      let sum = 0;
      const l = tuple.length;
      for (i = 0; i < l; i++) {
        sum += tuple[i] * Math.pow(256, i);
      }
      return positive ? sum : -1 * sum;
    }
    function decodeOct(val, offset, length) {
      val = val.subarray(offset, offset + length);
      offset = 0;
      if (val[offset] & 128) {
        return parse256(val);
      } else {
        while (offset < val.length && val[offset] === 32) offset++;
        const end = clamp(indexOf(val, 32, offset, val.length), val.length, val.length);
        while (offset < end && val[offset] === 0) offset++;
        if (end === offset) return 0;
        return parseInt(b4a.toString(val.subarray(offset, end)), 8);
      }
    }
    function decodeStr(val, offset, length, encoding) {
      return b4a.toString(val.subarray(offset, indexOf(val, 0, offset, offset + length)), encoding);
    }
    function addLength(str) {
      const len = b4a.byteLength(str);
      let digits = Math.floor(Math.log(len) / Math.log(10)) + 1;
      if (len + digits >= Math.pow(10, digits)) digits++;
      return len + digits + str;
    }
  }
});

// node_modules/tar-stream/extract.js
var require_extract = __commonJS({
  "node_modules/tar-stream/extract.js"(exports2, module2) {
    var { Writable, Readable, getStreamError } = require_streamx();
    var FIFO = require_fast_fifo();
    var b4a = require_b4a();
    var headers = require_headers();
    var EMPTY = b4a.alloc(0);
    var BufferList = class {
      constructor() {
        this.buffered = 0;
        this.shifted = 0;
        this.queue = new FIFO();
        this._offset = 0;
      }
      push(buffer) {
        this.buffered += buffer.byteLength;
        this.queue.push(buffer);
      }
      shiftFirst(size) {
        return this._buffered === 0 ? null : this._next(size);
      }
      shift(size) {
        if (size > this.buffered) return null;
        if (size === 0) return EMPTY;
        let chunk = this._next(size);
        if (size === chunk.byteLength) return chunk;
        const chunks = [chunk];
        while ((size -= chunk.byteLength) > 0) {
          chunk = this._next(size);
          chunks.push(chunk);
        }
        return b4a.concat(chunks);
      }
      _next(size) {
        const buf = this.queue.peek();
        const rem = buf.byteLength - this._offset;
        if (size >= rem) {
          const sub = this._offset ? buf.subarray(this._offset, buf.byteLength) : buf;
          this.queue.shift();
          this._offset = 0;
          this.buffered -= rem;
          this.shifted += rem;
          return sub;
        }
        this.buffered -= size;
        this.shifted += size;
        return buf.subarray(this._offset, this._offset += size);
      }
    };
    var Source = class extends Readable {
      constructor(self, header, offset) {
        super();
        this.header = header;
        this.offset = offset;
        this._parent = self;
      }
      _read(cb) {
        if (this.header.size === 0) {
          this.push(null);
        }
        if (this._parent._stream === this) {
          this._parent._update();
        }
        cb(null);
      }
      _predestroy() {
        this._parent.destroy(getStreamError(this));
      }
      _detach() {
        if (this._parent._stream === this) {
          this._parent._stream = null;
          this._parent._missing = overflow(this.header.size);
          this._parent._update();
        }
      }
      _destroy(cb) {
        this._detach();
        cb(null);
      }
    };
    var Extract = class extends Writable {
      constructor(opts) {
        super(opts);
        if (!opts) opts = {};
        this._buffer = new BufferList();
        this._offset = 0;
        this._header = null;
        this._stream = null;
        this._missing = 0;
        this._longHeader = false;
        this._callback = noop;
        this._locked = false;
        this._finished = false;
        this._pax = null;
        this._paxGlobal = null;
        this._gnuLongPath = null;
        this._gnuLongLinkPath = null;
        this._filenameEncoding = opts.filenameEncoding || "utf-8";
        this._allowUnknownFormat = !!opts.allowUnknownFormat;
        this._unlockBound = this._unlock.bind(this);
      }
      _unlock(err) {
        this._locked = false;
        if (err) {
          this.destroy(err);
          this._continueWrite(err);
          return;
        }
        this._update();
      }
      _consumeHeader() {
        if (this._locked) return false;
        this._offset = this._buffer.shifted;
        try {
          this._header = headers.decode(this._buffer.shift(512), this._filenameEncoding, this._allowUnknownFormat);
        } catch (err) {
          this._continueWrite(err);
          return false;
        }
        if (!this._header) return true;
        switch (this._header.type) {
          case "gnu-long-path":
          case "gnu-long-link-path":
          case "pax-global-header":
          case "pax-header":
            this._longHeader = true;
            this._missing = this._header.size;
            return true;
        }
        this._locked = true;
        this._applyLongHeaders();
        if (this._header.size === 0 || this._header.type === "directory") {
          this.emit("entry", this._header, this._createStream(), this._unlockBound);
          return true;
        }
        this._stream = this._createStream();
        this._missing = this._header.size;
        this.emit("entry", this._header, this._stream, this._unlockBound);
        return true;
      }
      _applyLongHeaders() {
        if (this._gnuLongPath) {
          this._header.name = this._gnuLongPath;
          this._gnuLongPath = null;
        }
        if (this._gnuLongLinkPath) {
          this._header.linkname = this._gnuLongLinkPath;
          this._gnuLongLinkPath = null;
        }
        if (this._pax) {
          if (this._pax.path) this._header.name = this._pax.path;
          if (this._pax.linkpath) this._header.linkname = this._pax.linkpath;
          if (this._pax.size) this._header.size = parseInt(this._pax.size, 10);
          this._header.pax = this._pax;
          this._pax = null;
        }
      }
      _decodeLongHeader(buf) {
        switch (this._header.type) {
          case "gnu-long-path":
            this._gnuLongPath = headers.decodeLongPath(buf, this._filenameEncoding);
            break;
          case "gnu-long-link-path":
            this._gnuLongLinkPath = headers.decodeLongPath(buf, this._filenameEncoding);
            break;
          case "pax-global-header":
            this._paxGlobal = headers.decodePax(buf);
            break;
          case "pax-header":
            this._pax = this._paxGlobal === null ? headers.decodePax(buf) : Object.assign({}, this._paxGlobal, headers.decodePax(buf));
            break;
        }
      }
      _consumeLongHeader() {
        this._longHeader = false;
        this._missing = overflow(this._header.size);
        const buf = this._buffer.shift(this._header.size);
        try {
          this._decodeLongHeader(buf);
        } catch (err) {
          this._continueWrite(err);
          return false;
        }
        return true;
      }
      _consumeStream() {
        const buf = this._buffer.shiftFirst(this._missing);
        if (buf === null) return false;
        this._missing -= buf.byteLength;
        const drained = this._stream.push(buf);
        if (this._missing === 0) {
          this._stream.push(null);
          if (drained) this._stream._detach();
          return drained && this._locked === false;
        }
        return drained;
      }
      _createStream() {
        return new Source(this, this._header, this._offset);
      }
      _update() {
        while (this._buffer.buffered > 0 && !this.destroying) {
          if (this._missing > 0) {
            if (this._stream !== null) {
              if (this._consumeStream() === false) return;
              continue;
            }
            if (this._longHeader === true) {
              if (this._missing > this._buffer.buffered) break;
              if (this._consumeLongHeader() === false) return false;
              continue;
            }
            const ignore = this._buffer.shiftFirst(this._missing);
            if (ignore !== null) this._missing -= ignore.byteLength;
            continue;
          }
          if (this._buffer.buffered < 512) break;
          if (this._stream !== null || this._consumeHeader() === false) return;
        }
        this._continueWrite(null);
      }
      _continueWrite(err) {
        const cb = this._callback;
        this._callback = noop;
        cb(err);
      }
      _write(data, cb) {
        this._callback = cb;
        this._buffer.push(data);
        this._update();
      }
      _final(cb) {
        this._finished = this._missing === 0 && this._buffer.buffered === 0;
        cb(this._finished ? null : new Error("Unexpected end of data"));
      }
      _predestroy() {
        this._continueWrite(null);
      }
      _destroy(cb) {
        if (this._stream) this._stream.destroy(getStreamError(this));
        cb(null);
      }
      [Symbol.asyncIterator]() {
        let error = null;
        let promiseResolve = null;
        let promiseReject = null;
        let entryStream = null;
        let entryCallback = null;
        const extract2 = this;
        this.on("entry", onentry);
        this.on("error", (err) => {
          error = err;
        });
        this.on("close", onclose);
        return {
          [Symbol.asyncIterator]() {
            return this;
          },
          next() {
            return new Promise(onnext);
          },
          return() {
            return destroy(null);
          },
          throw(err) {
            return destroy(err);
          }
        };
        function consumeCallback(err) {
          if (!entryCallback) return;
          const cb = entryCallback;
          entryCallback = null;
          cb(err);
        }
        function onnext(resolve, reject) {
          if (error) {
            return reject(error);
          }
          if (entryStream) {
            resolve({ value: entryStream, done: false });
            entryStream = null;
            return;
          }
          promiseResolve = resolve;
          promiseReject = reject;
          consumeCallback(null);
          if (extract2._finished && promiseResolve) {
            promiseResolve({ value: void 0, done: true });
            promiseResolve = promiseReject = null;
          }
        }
        function onentry(header, stream, callback) {
          entryCallback = callback;
          stream.on("error", noop);
          if (promiseResolve) {
            promiseResolve({ value: stream, done: false });
            promiseResolve = promiseReject = null;
          } else {
            entryStream = stream;
          }
        }
        function onclose() {
          consumeCallback(error);
          if (!promiseResolve) return;
          if (error) promiseReject(error);
          else promiseResolve({ value: void 0, done: true });
          promiseResolve = promiseReject = null;
        }
        function destroy(err) {
          extract2.destroy(err);
          consumeCallback(err);
          return new Promise((resolve, reject) => {
            if (extract2.destroyed) return resolve({ value: void 0, done: true });
            extract2.once("close", function() {
              if (err) reject(err);
              else resolve({ value: void 0, done: true });
            });
          });
        }
      }
    };
    module2.exports = function extract2(opts) {
      return new Extract(opts);
    };
    function noop() {
    }
    function overflow(size) {
      size &= 511;
      return size && 512 - size;
    }
  }
});

// node_modules/tar-stream/constants.js
var require_constants = __commonJS({
  "node_modules/tar-stream/constants.js"(exports2, module2) {
    var constants = {
      // just for envs without fs
      S_IFMT: 61440,
      S_IFDIR: 16384,
      S_IFCHR: 8192,
      S_IFBLK: 24576,
      S_IFIFO: 4096,
      S_IFLNK: 40960
    };
    try {
      module2.exports = require("fs").constants || constants;
    } catch {
      module2.exports = constants;
    }
  }
});

// node_modules/tar-stream/pack.js
var require_pack = __commonJS({
  "node_modules/tar-stream/pack.js"(exports2, module2) {
    var { Readable, Writable, getStreamError } = require_streamx();
    var b4a = require_b4a();
    var constants = require_constants();
    var headers = require_headers();
    var DMODE = 493;
    var FMODE = 420;
    var END_OF_TAR = b4a.alloc(1024);
    var Sink = class extends Writable {
      constructor(pack, header, callback) {
        super({ mapWritable, eagerOpen: true });
        this.written = 0;
        this.header = header;
        this._callback = callback;
        this._linkname = null;
        this._isLinkname = header.type === "symlink" && !header.linkname;
        this._isVoid = header.type !== "file" && header.type !== "contiguous-file";
        this._finished = false;
        this._pack = pack;
        this._openCallback = null;
        if (this._pack._stream === null) this._pack._stream = this;
        else this._pack._pending.push(this);
      }
      _open(cb) {
        this._openCallback = cb;
        if (this._pack._stream === this) this._continueOpen();
      }
      _continuePack(err) {
        if (this._callback === null) return;
        const callback = this._callback;
        this._callback = null;
        callback(err);
      }
      _continueOpen() {
        if (this._pack._stream === null) this._pack._stream = this;
        const cb = this._openCallback;
        this._openCallback = null;
        if (cb === null) return;
        if (this._pack.destroying) return cb(new Error("pack stream destroyed"));
        if (this._pack._finalized) return cb(new Error("pack stream is already finalized"));
        this._pack._stream = this;
        if (!this._isLinkname) {
          this._pack._encode(this.header);
        }
        if (this._isVoid) {
          this._finish();
          this._continuePack(null);
        }
        cb(null);
      }
      _write(data, cb) {
        if (this._isLinkname) {
          this._linkname = this._linkname ? b4a.concat([this._linkname, data]) : data;
          return cb(null);
        }
        if (this._isVoid) {
          if (data.byteLength > 0) {
            return cb(new Error("No body allowed for this entry"));
          }
          return cb();
        }
        this.written += data.byteLength;
        if (this._pack.push(data)) return cb();
        this._pack._drain = cb;
      }
      _finish() {
        if (this._finished) return;
        this._finished = true;
        if (this._isLinkname) {
          this.header.linkname = this._linkname ? b4a.toString(this._linkname, "utf-8") : "";
          this._pack._encode(this.header);
        }
        overflow(this._pack, this.header.size);
        this._pack._done(this);
      }
      _final(cb) {
        if (this.written !== this.header.size) {
          return cb(new Error("Size mismatch"));
        }
        this._finish();
        cb(null);
      }
      _getError() {
        return getStreamError(this) || new Error("tar entry destroyed");
      }
      _predestroy() {
        this._pack.destroy(this._getError());
      }
      _destroy(cb) {
        this._pack._done(this);
        this._continuePack(this._finished ? null : this._getError());
        cb();
      }
    };
    var Pack = class extends Readable {
      constructor(opts) {
        super(opts);
        this._drain = noop;
        this._finalized = false;
        this._finalizing = false;
        this._pending = [];
        this._stream = null;
      }
      entry(header, buffer, callback) {
        if (this._finalized || this.destroying) throw new Error("already finalized or destroyed");
        if (typeof buffer === "function") {
          callback = buffer;
          buffer = null;
        }
        if (!callback) callback = noop;
        if (!header.size || header.type === "symlink") header.size = 0;
        if (!header.type) header.type = modeToType(header.mode);
        if (!header.mode) header.mode = header.type === "directory" ? DMODE : FMODE;
        if (!header.uid) header.uid = 0;
        if (!header.gid) header.gid = 0;
        if (!header.mtime) header.mtime = /* @__PURE__ */ new Date();
        if (typeof buffer === "string") buffer = b4a.from(buffer);
        const sink = new Sink(this, header, callback);
        if (b4a.isBuffer(buffer)) {
          header.size = buffer.byteLength;
          sink.write(buffer);
          sink.end();
          return sink;
        }
        if (sink._isVoid) {
          return sink;
        }
        return sink;
      }
      finalize() {
        if (this._stream || this._pending.length > 0) {
          this._finalizing = true;
          return;
        }
        if (this._finalized) return;
        this._finalized = true;
        this.push(END_OF_TAR);
        this.push(null);
      }
      _done(stream) {
        if (stream !== this._stream) return;
        this._stream = null;
        if (this._finalizing) this.finalize();
        if (this._pending.length) this._pending.shift()._continueOpen();
      }
      _encode(header) {
        if (!header.pax) {
          const buf = headers.encode(header);
          if (buf) {
            this.push(buf);
            return;
          }
        }
        this._encodePax(header);
      }
      _encodePax(header) {
        const paxHeader = headers.encodePax({
          name: header.name,
          linkname: header.linkname,
          pax: header.pax
        });
        const newHeader = {
          name: "PaxHeader",
          mode: header.mode,
          uid: header.uid,
          gid: header.gid,
          size: paxHeader.byteLength,
          mtime: header.mtime,
          type: "pax-header",
          linkname: header.linkname && "PaxHeader",
          uname: header.uname,
          gname: header.gname,
          devmajor: header.devmajor,
          devminor: header.devminor
        };
        this.push(headers.encode(newHeader));
        this.push(paxHeader);
        overflow(this, paxHeader.byteLength);
        newHeader.size = header.size;
        newHeader.type = header.type;
        this.push(headers.encode(newHeader));
      }
      _doDrain() {
        const drain = this._drain;
        this._drain = noop;
        drain();
      }
      _predestroy() {
        const err = getStreamError(this);
        if (this._stream) this._stream.destroy(err);
        while (this._pending.length) {
          const stream = this._pending.shift();
          stream.destroy(err);
          stream._continueOpen();
        }
        this._doDrain();
      }
      _read(cb) {
        this._doDrain();
        cb();
      }
    };
    module2.exports = function pack(opts) {
      return new Pack(opts);
    };
    function modeToType(mode) {
      switch (mode & constants.S_IFMT) {
        case constants.S_IFBLK:
          return "block-device";
        case constants.S_IFCHR:
          return "character-device";
        case constants.S_IFDIR:
          return "directory";
        case constants.S_IFIFO:
          return "fifo";
        case constants.S_IFLNK:
          return "symlink";
      }
      return "file";
    }
    function noop() {
    }
    function overflow(self, size) {
      size &= 511;
      if (size) self.push(END_OF_TAR.subarray(0, 512 - size));
    }
    function mapWritable(buf) {
      return b4a.isBuffer(buf) ? buf : b4a.from(buf);
    }
  }
});

// node_modules/tar-stream/index.js
var require_tar_stream = __commonJS({
  "node_modules/tar-stream/index.js"(exports2) {
    exports2.extract = require_extract();
    exports2.pack = require_pack();
  }
});

// node_modules/stream-json/utils/Utf8Stream.js
var require_Utf8Stream = __commonJS({
  "node_modules/stream-json/utils/Utf8Stream.js"(exports2, module2) {
    "use strict";
    var { Transform } = require("stream");
    var { StringDecoder } = require("string_decoder");
    var Utf8Stream = class extends Transform {
      constructor(options) {
        super(Object.assign({}, options, { writableObjectMode: false }));
        this._buffer = "";
      }
      _transform(chunk, encoding, callback) {
        if (typeof chunk == "string") {
          this._transform = this._transformString;
        } else {
          this._stringDecoder = new StringDecoder();
          this._transform = this._transformBuffer;
        }
        this._transform(chunk, encoding, callback);
      }
      _transformBuffer(chunk, _, callback) {
        this._buffer += this._stringDecoder.write(chunk);
        this._processBuffer(callback);
      }
      _transformString(chunk, _, callback) {
        this._buffer += chunk.toString();
        this._processBuffer(callback);
      }
      _processBuffer(callback) {
        if (this._buffer) {
          this.push(this._buffer, "utf8");
          this._buffer = "";
        }
        callback(null);
      }
      _flushInput() {
        if (this._stringDecoder) {
          this._buffer += this._stringDecoder.end();
        }
      }
      _flush(callback) {
        this._flushInput();
        this._processBuffer(callback);
      }
    };
    module2.exports = Utf8Stream;
  }
});

// node_modules/stream-json/Parser.js
var require_Parser = __commonJS({
  "node_modules/stream-json/Parser.js"(exports2, module2) {
    "use strict";
    var Utf8Stream = require_Utf8Stream();
    var patterns = {
      value1: /^(?:[\"\{\[\]\-\d]|true\b|false\b|null\b|\s{1,256})/,
      string: /^(?:[^\x00-\x1f\"\\]{1,256}|\\[bfnrt\"\\\/]|\\u[\da-fA-F]{4}|\")/,
      key1: /^(?:[\"\}]|\s{1,256})/,
      colon: /^(?:\:|\s{1,256})/,
      comma: /^(?:[\,\]\}]|\s{1,256})/,
      ws: /^\s{1,256}/,
      numberStart: /^\d/,
      numberDigit: /^\d{0,256}/,
      numberFraction: /^[\.eE]/,
      numberExponent: /^[eE]/,
      numberExpSign: /^[-+]/
    };
    var MAX_PATTERN_SIZE = 16;
    var noSticky = true;
    try {
      new RegExp(".", "y");
      noSticky = false;
    } catch (e) {
    }
    !noSticky && Object.keys(patterns).forEach((key) => {
      let src = patterns[key].source.slice(1);
      if (src.slice(0, 3) === "(?:" && src.slice(-1) === ")") {
        src = src.slice(3, -1);
      }
      patterns[key] = new RegExp(src, "y");
    });
    patterns.numberFracStart = patterns.numberExpStart = patterns.numberStart;
    patterns.numberFracDigit = patterns.numberExpDigit = patterns.numberDigit;
    var values = { true: true, false: false, null: null };
    var expected = { object: "objectStop", array: "arrayStop", "": "done" };
    var fromHex = (s) => String.fromCharCode(parseInt(s.slice(2), 16));
    var codes = { b: "\b", f: "\f", n: "\n", r: "\r", t: "	", '"': '"', "\\": "\\", "/": "/" };
    var Parser = class _Parser extends Utf8Stream {
      static make(options) {
        return new _Parser(options);
      }
      constructor(options) {
        super(Object.assign({}, options, { readableObjectMode: true }));
        this._packKeys = this._packStrings = this._packNumbers = this._streamKeys = this._streamStrings = this._streamNumbers = true;
        if (options) {
          "packValues" in options && (this._packKeys = this._packStrings = this._packNumbers = options.packValues);
          "packKeys" in options && (this._packKeys = options.packKeys);
          "packStrings" in options && (this._packStrings = options.packStrings);
          "packNumbers" in options && (this._packNumbers = options.packNumbers);
          "streamValues" in options && (this._streamKeys = this._streamStrings = this._streamNumbers = options.streamValues);
          "streamKeys" in options && (this._streamKeys = options.streamKeys);
          "streamStrings" in options && (this._streamStrings = options.streamStrings);
          "streamNumbers" in options && (this._streamNumbers = options.streamNumbers);
          this._jsonStreaming = options.jsonStreaming;
        }
        !this._packKeys && (this._streamKeys = true);
        !this._packStrings && (this._streamStrings = true);
        !this._packNumbers && (this._streamNumbers = true);
        this._done = false;
        this._expect = this._jsonStreaming ? "done" : "value";
        this._stack = [];
        this._parent = "";
        this._open_number = false;
        this._accumulator = "";
      }
      _flush(callback) {
        this._done = true;
        super._flush((error) => {
          if (error) return callback(error);
          if (this._open_number) {
            if (this._streamNumbers) {
              this.push({ name: "endNumber" });
            }
            this._open_number = false;
            if (this._packNumbers) {
              this.push({ name: "numberValue", value: this._accumulator });
              this._accumulator = "";
            }
          }
          callback(null);
        });
      }
      _processBuffer(callback) {
        let match, value, index = 0;
        main: for (; ; ) {
          switch (this._expect) {
            case "value1":
            case "value":
              patterns.value1.lastIndex = index;
              match = patterns.value1.exec(this._buffer);
              if (!match) {
                if (this._done || index + MAX_PATTERN_SIZE < this._buffer.length) {
                  if (index < this._buffer.length) return callback(new Error("Parser cannot parse input: expected a value"));
                  return callback(new Error("Parser has expected a value"));
                }
                break main;
              }
              value = match[0];
              switch (value) {
                case '"':
                  this._streamStrings && this.push({ name: "startString" });
                  this._expect = "string";
                  break;
                case "{":
                  this.push({ name: "startObject" });
                  this._stack.push(this._parent);
                  this._parent = "object";
                  this._expect = "key1";
                  break;
                case "[":
                  this.push({ name: "startArray" });
                  this._stack.push(this._parent);
                  this._parent = "array";
                  this._expect = "value1";
                  break;
                case "]":
                  if (this._expect !== "value1") return callback(new Error("Parser cannot parse input: unexpected token ']'"));
                  if (this._open_number) {
                    this._streamNumbers && this.push({ name: "endNumber" });
                    this._open_number = false;
                    if (this._packNumbers) {
                      this.push({ name: "numberValue", value: this._accumulator });
                      this._accumulator = "";
                    }
                  }
                  this.push({ name: "endArray" });
                  this._parent = this._stack.pop();
                  this._expect = expected[this._parent];
                  break;
                case "-":
                  this._open_number = true;
                  if (this._streamNumbers) {
                    this.push({ name: "startNumber" });
                    this.push({ name: "numberChunk", value: "-" });
                  }
                  this._packNumbers && (this._accumulator = "-");
                  this._expect = "numberStart";
                  break;
                case "0":
                  this._open_number = true;
                  if (this._streamNumbers) {
                    this.push({ name: "startNumber" });
                    this.push({ name: "numberChunk", value: "0" });
                  }
                  this._packNumbers && (this._accumulator = "0");
                  this._expect = "numberFraction";
                  break;
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                case "6":
                case "7":
                case "8":
                case "9":
                  this._open_number = true;
                  if (this._streamNumbers) {
                    this.push({ name: "startNumber" });
                    this.push({ name: "numberChunk", value });
                  }
                  this._packNumbers && (this._accumulator = value);
                  this._expect = "numberDigit";
                  break;
                case "true":
                case "false":
                case "null":
                  if (this._buffer.length - index === value.length && !this._done) break main;
                  this.push({ name: value + "Value", value: values[value] });
                  this._expect = expected[this._parent];
                  break;
              }
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "keyVal":
            case "string":
              patterns.string.lastIndex = index;
              match = patterns.string.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length && (this._done || this._buffer.length - index >= 6))
                  return callback(new Error("Parser cannot parse input: escaped characters"));
                if (this._done) return callback(new Error("Parser has expected a string value"));
                break main;
              }
              value = match[0];
              if (value === '"') {
                if (this._expect === "keyVal") {
                  this._streamKeys && this.push({ name: "endKey" });
                  if (this._packKeys) {
                    this.push({ name: "keyValue", value: this._accumulator });
                    this._accumulator = "";
                  }
                  this._expect = "colon";
                } else {
                  this._streamStrings && this.push({ name: "endString" });
                  if (this._packStrings) {
                    this.push({ name: "stringValue", value: this._accumulator });
                    this._accumulator = "";
                  }
                  this._expect = expected[this._parent];
                }
              } else if (value.length > 1 && value.charAt(0) === "\\") {
                const t = value.length == 2 ? codes[value.charAt(1)] : fromHex(value);
                if (this._expect === "keyVal" ? this._streamKeys : this._streamStrings) {
                  this.push({ name: "stringChunk", value: t });
                }
                if (this._expect === "keyVal" ? this._packKeys : this._packStrings) {
                  this._accumulator += t;
                }
              } else {
                if (this._expect === "keyVal" ? this._streamKeys : this._streamStrings) {
                  this.push({ name: "stringChunk", value });
                }
                if (this._expect === "keyVal" ? this._packKeys : this._packStrings) {
                  this._accumulator += value;
                }
              }
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "key1":
            case "key":
              patterns.key1.lastIndex = index;
              match = patterns.key1.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected an object key"));
                break main;
              }
              value = match[0];
              if (value === '"') {
                this._streamKeys && this.push({ name: "startKey" });
                this._expect = "keyVal";
              } else if (value === "}") {
                if (this._expect !== "key1") return callback(new Error("Parser cannot parse input: unexpected token '}'"));
                this.push({ name: "endObject" });
                this._parent = this._stack.pop();
                this._expect = expected[this._parent];
              }
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "colon":
              patterns.colon.lastIndex = index;
              match = patterns.colon.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected ':'"));
                break main;
              }
              value = match[0];
              value === ":" && (this._expect = "value");
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "arrayStop":
            case "objectStop":
              patterns.comma.lastIndex = index;
              match = patterns.comma.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected ','"));
                break main;
              }
              if (this._open_number) {
                this._streamNumbers && this.push({ name: "endNumber" });
                this._open_number = false;
                if (this._packNumbers) {
                  this.push({ name: "numberValue", value: this._accumulator });
                  this._accumulator = "";
                }
              }
              value = match[0];
              if (value === ",") {
                this._expect = this._expect === "arrayStop" ? "value" : "key";
              } else if (value === "}" || value === "]") {
                if (value === "}" ? this._expect === "arrayStop" : this._expect !== "arrayStop") {
                  return callback(new Error("Parser cannot parse input: expected '" + (this._expect === "arrayStop" ? "]" : "}") + "'"));
                }
                this.push({ name: value === "}" ? "endObject" : "endArray" });
                this._parent = this._stack.pop();
                this._expect = expected[this._parent];
              }
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            // number chunks
            case "numberStart":
              patterns.numberStart.lastIndex = index;
              match = patterns.numberStart.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected a starting digit"));
                break main;
              }
              value = match[0];
              this._streamNumbers && this.push({ name: "numberChunk", value });
              this._packNumbers && (this._accumulator += value);
              this._expect = value === "0" ? "numberFraction" : "numberDigit";
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "numberDigit":
              patterns.numberDigit.lastIndex = index;
              match = patterns.numberDigit.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected a digit"));
                break main;
              }
              value = match[0];
              if (value) {
                this._streamNumbers && this.push({ name: "numberChunk", value });
                this._packNumbers && (this._accumulator += value);
                if (noSticky) {
                  this._buffer = this._buffer.slice(value.length);
                } else {
                  index += value.length;
                }
              } else {
                if (index < this._buffer.length) {
                  this._expect = "numberFraction";
                  break;
                }
                if (this._done) {
                  this._expect = expected[this._parent];
                  break;
                }
                break main;
              }
              break;
            case "numberFraction":
              patterns.numberFraction.lastIndex = index;
              match = patterns.numberFraction.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) {
                  this._expect = expected[this._parent];
                  break;
                }
                break main;
              }
              value = match[0];
              this._streamNumbers && this.push({ name: "numberChunk", value });
              this._packNumbers && (this._accumulator += value);
              this._expect = value === "." ? "numberFracStart" : "numberExpSign";
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "numberFracStart":
              patterns.numberFracStart.lastIndex = index;
              match = patterns.numberFracStart.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected a fractional part of a number"));
                break main;
              }
              value = match[0];
              this._streamNumbers && this.push({ name: "numberChunk", value });
              this._packNumbers && (this._accumulator += value);
              this._expect = "numberFracDigit";
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "numberFracDigit":
              patterns.numberFracDigit.lastIndex = index;
              match = patterns.numberFracDigit.exec(this._buffer);
              value = match[0];
              if (value) {
                this._streamNumbers && this.push({ name: "numberChunk", value });
                this._packNumbers && (this._accumulator += value);
                if (noSticky) {
                  this._buffer = this._buffer.slice(value.length);
                } else {
                  index += value.length;
                }
              } else {
                if (index < this._buffer.length) {
                  this._expect = "numberExponent";
                  break;
                }
                if (this._done) {
                  this._expect = expected[this._parent];
                  break;
                }
                break main;
              }
              break;
            case "numberExponent":
              patterns.numberExponent.lastIndex = index;
              match = patterns.numberExponent.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length) {
                  this._expect = expected[this._parent];
                  break;
                }
                if (this._done) {
                  this._expect = "done";
                  break;
                }
                break main;
              }
              value = match[0];
              this._streamNumbers && this.push({ name: "numberChunk", value });
              this._packNumbers && (this._accumulator += value);
              this._expect = "numberExpSign";
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "numberExpSign":
              patterns.numberExpSign.lastIndex = index;
              match = patterns.numberExpSign.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length) {
                  this._expect = "numberExpStart";
                  break;
                }
                if (this._done) return callback(new Error("Parser has expected an exponent value of a number"));
                break main;
              }
              value = match[0];
              this._streamNumbers && this.push({ name: "numberChunk", value });
              this._packNumbers && (this._accumulator += value);
              this._expect = "numberExpStart";
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "numberExpStart":
              patterns.numberExpStart.lastIndex = index;
              match = patterns.numberExpStart.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length || this._done) return callback(new Error("Parser cannot parse input: expected an exponent part of a number"));
                break main;
              }
              value = match[0];
              this._streamNumbers && this.push({ name: "numberChunk", value });
              this._packNumbers && (this._accumulator += value);
              this._expect = "numberExpDigit";
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
            case "numberExpDigit":
              patterns.numberExpDigit.lastIndex = index;
              match = patterns.numberExpDigit.exec(this._buffer);
              value = match[0];
              if (value) {
                this._streamNumbers && this.push({ name: "numberChunk", value });
                this._packNumbers && (this._accumulator += value);
                if (noSticky) {
                  this._buffer = this._buffer.slice(value.length);
                } else {
                  index += value.length;
                }
              } else {
                if (index < this._buffer.length || this._done) {
                  this._expect = expected[this._parent];
                  break;
                }
                break main;
              }
              break;
            case "done":
              patterns.ws.lastIndex = index;
              match = patterns.ws.exec(this._buffer);
              if (!match) {
                if (index < this._buffer.length) {
                  if (this._jsonStreaming) {
                    this._expect = "value";
                    break;
                  }
                  return callback(new Error("Parser cannot parse input: unexpected characters"));
                }
                break main;
              }
              value = match[0];
              if (this._open_number) {
                this._streamNumbers && this.push({ name: "endNumber" });
                this._open_number = false;
                if (this._packNumbers) {
                  this.push({ name: "numberValue", value: this._accumulator });
                  this._accumulator = "";
                }
              }
              if (noSticky) {
                this._buffer = this._buffer.slice(value.length);
              } else {
                index += value.length;
              }
              break;
          }
        }
        !noSticky && (this._buffer = this._buffer.slice(index));
        callback(null);
      }
    };
    Parser.parser = Parser.make;
    Parser.make.Constructor = Parser;
    module2.exports = Parser;
  }
});

// node_modules/stream-json/utils/emit.js
var require_emit = __commonJS({
  "node_modules/stream-json/utils/emit.js"(exports2, module2) {
    "use strict";
    var emit = (stream) => stream.on("data", (item) => stream.emit(item.name, item.value));
    module2.exports = emit;
  }
});

// node_modules/stream-json/index.js
var require_stream_json = __commonJS({
  "node_modules/stream-json/index.js"(exports2, module2) {
    "use strict";
    var Parser = require_Parser();
    var emit = require_emit();
    var make = (options) => emit(new Parser(options));
    make.Parser = Parser;
    make.parser = Parser.parser;
    module2.exports = make;
  }
});

// src/bootstrap.ts
var import_node_crypto2 = require("node:crypto");
var import_node_fs = require("node:fs");
var import_promises2 = require("node:fs/promises");
var import_node_path2 = __toESM(require("node:path"), 1);
var import_promises3 = require("node:stream/promises");
var import_node_zlib = require("node:zlib");
var tar = __toESM(require_tar_stream(), 1);

// src/environment.ts
var import_node_path = __toESM(require("node:path"), 1);
var FILE_COMMAND_VARIABLES = /* @__PURE__ */ new Set([
  "GITHUB_OUTPUT",
  "GITHUB_ENV",
  "GITHUB_PATH",
  "GITHUB_STATE",
  "GITHUB_STEP_SUMMARY"
]);
function sanitizedChildEnvironment(source, cliDirectory) {
  const child = {};
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith("INPUT_") || name.startsWith("SCHERZO_RUN_ACTION_") || FILE_COMMAND_VARIABLES.has(name)) {
      continue;
    }
    child[name] = value;
  }
  const inheritedPath = source.PATH;
  child.PATH = inheritedPath ? `${cliDirectory}${import_node_path.default.delimiter}${inheritedPath}` : cliDirectory;
  return child;
}

// src/errors.ts
var AdapterError = class extends Error {
  code;
  constructor(code) {
    super(`Scherzo Run failed [${code}].`);
    this.name = "AdapterError";
    this.code = code;
  }
};
function asAdapterError(error) {
  return error instanceof AdapterError ? error : new AdapterError("result_projection_failed");
}

// src/github.ts
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var OUTPUT_NAMES = [
  "outcome",
  "run-directory",
  "artifact-set-path",
  "result-path",
  "export-state",
  "export-kind",
  "export-path",
  "export-value"
];
function emptyOutputs() {
  return Object.fromEntries(
    OUTPUT_NAMES.map((name) => [name, ""])
  );
}
async function appendVerifiedPath(githubPathFile, cliDirectory) {
  if (!githubPathFile || /[\r\n]/u.test(cliDirectory)) {
    throw new AdapterError("github_file_command_failed");
  }
  await (0, import_promises.appendFile)(githubPathFile, `${cliDirectory}
`, {
    encoding: "utf8"
  }).catch(() => {
    throw new AdapterError("github_file_command_failed");
  });
}
async function writeOutputs(githubOutputFile, outputs, random = import_node_crypto.randomBytes) {
  if (!githubOutputFile) {
    throw new AdapterError("github_file_command_failed");
  }
  let payload = "";
  for (const name of OUTPUT_NAMES) {
    const value = outputs[name];
    let delimiter;
    do {
      delimiter = `scherzo_${random(32).toString("hex")}`;
    } while (value.split(/\r?\n/u).includes(delimiter));
    payload += `${name}<<${delimiter}
${value}
${delimiter}
`;
  }
  await (0, import_promises.appendFile)(githubOutputFile, payload, { encoding: "utf8" }).catch(
    () => {
      throw new AdapterError("github_file_command_failed");
    }
  );
}
var WorkflowCommandGuard = class {
  #token;
  #stream;
  #active = false;
  #lineStart = true;
  #pending = Promise.resolve();
  constructor(stream, random = import_node_crypto.randomBytes) {
    this.#token = `scherzo_${random(32).toString("hex")}`;
    this.#stream = stream;
  }
  async #write(bytes) {
    const operation = this.#pending.then(
      () => new Promise((resolve, reject) => {
        const onError = () => {
          this.#stream.removeListener("error", onError);
          reject(new AdapterError("child_output_failed"));
        };
        this.#stream.once("error", onError);
        try {
          this.#stream.write(bytes, (error) => {
            this.#stream.removeListener("error", onError);
            if (error) {
              reject(new AdapterError("child_output_failed"));
            } else {
              resolve();
            }
          });
        } catch {
          onError();
        }
      })
    );
    this.#pending = operation.catch(() => void 0);
    await operation;
  }
  async start() {
    if (this.#active) return;
    this.#active = true;
    try {
      await this.#write(`::stop-commands::${this.#token}
`);
    } catch (error) {
      this.#active = false;
      throw error;
    }
  }
  async write(bytes) {
    if (!this.#active) {
      throw new AdapterError("child_output_failed");
    }
    await this.#write(bytes);
    if (bytes.length > 0) this.#lineStart = bytes.at(-1) === 10;
  }
  async stop() {
    if (!this.#active) return;
    try {
      const lineBreak = this.#lineStart ? "" : "\n";
      await this.#write(`${lineBreak}::${this.#token}::
`);
    } finally {
      this.#active = false;
      this.#lineStart = true;
    }
  }
};

// release-evidence.json
var release_evidence_default = {
  schemaVersion: 1,
  repository: "scherzo-systems/scherzo-cloud-cli",
  releaseUrl: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/tag/v0.32.0",
  tag: "v0.32.0",
  releaseId: 386748412,
  releaseCommit: "70cda5707c419de3912769f4adeba6805af7c2c6",
  sourceRevision: "8850664b080784c826a410e770092e452a6bd9b7",
  requiredSourceAncestor: "d3abe478b006861330b8998cb8ccfefe28cf7958",
  version: "0.32.0",
  buildIdentity: "8850664b080784c826a410e770092e452a6bd9b7",
  checksumAsset: {
    id: 556305548,
    name: "SHA256SUMS",
    size: 354,
    sha256: "5189a1e1624074d3be345770d9717ab7d605dea2446b49fbd76b7a2cbbef31c5",
    url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.32.0/SHA256SUMS"
  },
  archives: {
    "x86_64-unknown-linux-gnu": {
      id: 556305547,
      name: "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu.tar.gz",
      size: 11399162,
      sha256: "1b2d873aa50487cb9e283a56b9ed62e2b02e5082ab313b05983452df63001e12",
      url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.32.0/scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu.tar.gz",
      rootDirectory: "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu",
      inventory: [
        {
          path: "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu",
          type: "directory",
          mode: 493,
          size: 0
        },
        {
          path: "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu/LICENSE",
          type: "file",
          mode: 420,
          size: 11357
        },
        {
          path: "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu/README.md",
          type: "file",
          mode: 420,
          size: 73739
        },
        {
          path: "scherzo-cloud-0.32.0-x86_64-unknown-linux-gnu/scherzo-cloud",
          type: "file",
          mode: 493,
          size: 38267184
        }
      ]
    },
    "aarch64-unknown-linux-gnu": {
      id: 556305545,
      name: "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu.tar.gz",
      size: 11680652,
      sha256: "081ce9df233de3531768d8f2b29babf5ad0af09fde97d72e0e0b2e86c0c2f0d4",
      url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.32.0/scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu.tar.gz",
      rootDirectory: "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu",
      inventory: [
        {
          path: "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu",
          type: "directory",
          mode: 493,
          size: 0
        },
        {
          path: "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu/LICENSE",
          type: "file",
          mode: 420,
          size: 11357
        },
        {
          path: "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu/README.md",
          type: "file",
          mode: 420,
          size: 73739
        },
        {
          path: "scherzo-cloud-0.32.0-aarch64-unknown-linux-gnu/scherzo-cloud",
          type: "file",
          mode: 493,
          size: 36607e3
        }
      ]
    },
    "aarch64-apple-darwin": {
      id: 556305531,
      name: "scherzo-cloud-0.32.0-aarch64-apple-darwin.tar.gz",
      size: 10468837,
      sha256: "e11aad4bc5aabe1ba5c47dd6de55097eb6f4bad68a679be8ad1a77b53f322455",
      url: "https://github.com/scherzo-systems/scherzo-cloud-cli/releases/download/v0.32.0/scherzo-cloud-0.32.0-aarch64-apple-darwin.tar.gz",
      rootDirectory: "scherzo-cloud-0.32.0-aarch64-apple-darwin",
      inventory: [
        {
          path: "scherzo-cloud-0.32.0-aarch64-apple-darwin",
          type: "directory",
          mode: 493,
          size: 0
        },
        {
          path: "scherzo-cloud-0.32.0-aarch64-apple-darwin/LICENSE",
          type: "file",
          mode: 420,
          size: 11357
        },
        {
          path: "scherzo-cloud-0.32.0-aarch64-apple-darwin/README.md",
          type: "file",
          mode: 420,
          size: 73739
        },
        {
          path: "scherzo-cloud-0.32.0-aarch64-apple-darwin/scherzo-cloud",
          type: "file",
          mode: 493,
          size: 32490976
        }
      ]
    }
  }
};

// src/release.ts
var PINNED_RELEASE = release_evidence_default;
var PLATFORM_TARGETS = {
  "Linux/X64": "x86_64-unknown-linux-gnu",
  "Linux/ARM64": "aarch64-unknown-linux-gnu",
  "macOS/ARM64": "aarch64-apple-darwin"
};
function selectTarget(runnerOS, runnerArch) {
  return PLATFORM_TARGETS[`${runnerOS ?? ""}/${runnerArch ?? ""}`];
}

// src/subprocess.ts
var import_node_child_process = require("node:child_process");
async function captureCommand(executable, arguments_, environment, maximumBytes, failureCode) {
  const child = (0, import_node_child_process.spawn)(executable, [...arguments_], {
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collect = async (stream, retain) => {
    const chunks = [];
    let observed = 0;
    let overflow = false;
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(
        typeof value === "string" ? value : value
      );
      const remaining = maximumBytes - observed;
      const selected = chunk.subarray(0, Math.max(remaining, 0));
      if (retain && selected.length > 0) chunks.push(selected);
      observed += selected.length;
      if (selected.length < chunk.length) overflow = true;
    }
    return { bytes: Buffer.concat(chunks), overflow };
  };
  const stdoutPromise = collect(child.stdout, true);
  const stderrPromise = collect(child.stderr, false);
  const completion = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).catch(() => {
    throw new AdapterError(failureCode);
  });
  const [stdout, stderr] = await Promise.all([
    stdoutPromise,
    stderrPromise
  ]).catch(() => {
    throw new AdapterError(failureCode);
  });
  return {
    ...completion,
    stdout: stdout.bytes,
    stdoutOverflow: stdout.overflow,
    stderrOverflow: stderr.overflow
  };
}

// src/bootstrap.ts
var VERSION_OUTPUT_LIMIT = 65536;
var DEFAULT_BOOTSTRAP_DEPENDENCIES = {
  fetch: (url) => fetch(url, { redirect: "follow" }),
  runVersion: (executable, environment) => captureCommand(
    executable,
    ["version", "--json"],
    environment,
    VERSION_OUTPUT_LIMIT,
    "bootstrap_version_failed"
  ),
  appendPath: appendVerifiedPath
};
async function downloadVerified(destination, identity, fetchRelease) {
  const response = await fetchRelease(identity.url).catch(() => {
    throw new AdapterError("bootstrap_download_failed");
  });
  if (!response.ok || response.body === null) {
    throw new AdapterError("bootstrap_download_failed");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && (!/^[0-9]+$/u.test(contentLength) || Number(contentLength) !== identity.size)) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  const handle = await (0, import_promises2.open)(
    destination,
    import_node_fs.constants.O_CREAT | import_node_fs.constants.O_EXCL | import_node_fs.constants.O_WRONLY,
    384
  ).catch(() => {
    throw new AdapterError("bootstrap_download_failed");
  });
  const digest = (0, import_node_crypto2.createHash)("sha256");
  let bytes = 0;
  try {
    for await (const value of response.body) {
      const chunk = Buffer.from(value);
      bytes += chunk.length;
      if (bytes > identity.size) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      digest.update(chunk);
      await handle.write(chunk);
    }
    await handle.sync();
  } catch (error) {
    throw error instanceof AdapterError ? error : new AdapterError("bootstrap_download_failed");
  } finally {
    await handle.close().catch(() => void 0);
  }
  if (bytes !== identity.size || digest.digest("hex") !== identity.sha256) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
}
function verifyChecksumAsset(bytes, release) {
  if (bytes.includes(0) || !bytes.every((byte) => byte < 128)) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  const text = bytes.toString("ascii");
  if (!text.endsWith("\n")) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  const lines = text.slice(0, -1).split("\n");
  if (lines.length !== Object.keys(release.archives).length) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  const observed = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/u.exec(line);
    if (!match || observed.has(match[2])) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
    observed.set(match[2], match[1]);
  }
  for (const archive of Object.values(release.archives)) {
    if (observed.get(archive.name) !== archive.sha256) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
  }
}
function safeTarPath(name, directory) {
  const candidate = directory && name.endsWith("/") ? name.slice(0, -1) : name;
  const components = candidate.split("/");
  if (candidate === "" || candidate.startsWith("/") || candidate.includes("\\") || candidate.includes("\0") || components.some(
    (component) => component === "" || component === "." || component === ".."
  ) || import_node_path2.default.posix.normalize(candidate) !== candidate) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  return candidate;
}
async function extractArchive(archivePath, destination, archive) {
  const expected = new Map(
    archive.inventory.map((entry) => [entry.path, entry])
  );
  const seen = /* @__PURE__ */ new Set();
  const extract2 = tar.extract();
  extract2.on("entry", (header, stream, next) => {
    void (async () => {
      const isDirectory = header.type === "directory";
      const isFile = header.type === "file";
      if (!isDirectory && !isFile) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      const relative = safeTarPath(header.name, isDirectory);
      const entry = expected.get(relative);
      if (!entry || seen.has(relative) || entry.type !== (isDirectory ? "directory" : "file") || header.mode === void 0 || entry.mode !== (header.mode & 4095) || entry.size !== header.size) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      seen.add(relative);
      const outputPath = import_node_path2.default.join(destination, ...relative.split("/"));
      const confined = import_node_path2.default.relative(destination, outputPath);
      if (confined.startsWith("..") || import_node_path2.default.isAbsolute(confined)) {
        throw new AdapterError("bootstrap_integrity_failed");
      }
      if (isDirectory) {
        if (header.size !== 0) {
          throw new AdapterError("bootstrap_integrity_failed");
        }
        for await (const chunk of stream) {
          if (Buffer.byteLength(chunk) !== 0) {
            throw new AdapterError("bootstrap_integrity_failed");
          }
        }
        await (0, import_promises2.mkdir)(outputPath, { mode: 448 });
        await (0, import_promises2.chmod)(outputPath, entry.mode);
      } else {
        const parent = import_node_path2.default.dirname(outputPath);
        const parentStatus = await (0, import_promises2.lstat)(parent).catch(() => void 0);
        if (!parentStatus?.isDirectory() || parentStatus.isSymbolicLink()) {
          throw new AdapterError("bootstrap_integrity_failed");
        }
        const handle = await (0, import_promises2.open)(
          outputPath,
          import_node_fs.constants.O_CREAT | import_node_fs.constants.O_EXCL | import_node_fs.constants.O_WRONLY,
          384
        );
        let written = 0;
        try {
          for await (const value of stream) {
            const chunk = Buffer.from(value);
            written += chunk.length;
            if (written > entry.size) {
              throw new AdapterError("bootstrap_integrity_failed");
            }
            await handle.write(chunk);
          }
          await handle.sync();
        } finally {
          await handle.close().catch(() => void 0);
        }
        if (written !== entry.size) {
          throw new AdapterError("bootstrap_integrity_failed");
        }
        await (0, import_promises2.chmod)(outputPath, entry.mode);
      }
      next();
    })().catch((error) => extract2.destroy(asAdapterError(error)));
  });
  await (0, import_promises3.pipeline)((0, import_node_fs.createReadStream)(archivePath), (0, import_node_zlib.createGunzip)(), extract2).catch(
    () => {
      throw new AdapterError("bootstrap_integrity_failed");
    }
  );
  if (seen.size !== expected.size) {
    throw new AdapterError("bootstrap_integrity_failed");
  }
  for (const entry of archive.inventory) {
    const outputPath = import_node_path2.default.join(destination, ...entry.path.split("/"));
    const status = await (0, import_promises2.lstat)(outputPath).catch(() => void 0);
    if (!status || status.isSymbolicLink() || (entry.type === "file" ? !status.isFile() : !status.isDirectory()) || (status.mode & 4095) !== entry.mode || entry.type === "file" && status.size !== entry.size) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
  }
}
function exactObjectKeys(value, expected) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}
async function verifyVersion(executable, cliDirectory, release, sourceEnvironment, runVersion) {
  const environment = sanitizedChildEnvironment(
    sourceEnvironment,
    cliDirectory
  );
  const result = await runVersion(executable, environment);
  if (result.code !== 0 || result.signal !== null || result.stdoutOverflow || result.stderrOverflow) {
    throw new AdapterError("bootstrap_version_failed");
  }
  let version;
  try {
    version = JSON.parse(result.stdout.toString("utf8"));
  } catch {
    throw new AdapterError("bootstrap_version_failed");
  }
  const resolvedExecutable = await (0, import_promises2.realpath)(executable);
  if (typeof version !== "object" || version === null || !exactObjectKeys(version, [
    "schemaVersion",
    "command",
    "version",
    "executablePath",
    "buildIdentity"
  ])) {
    throw new AdapterError("bootstrap_version_failed");
  }
  const record2 = version;
  if (record2.schemaVersion !== 1 || record2.command !== "scherzo-cloud" || record2.version !== release.version || record2.executablePath !== resolvedExecutable || record2.buildIdentity !== release.buildIdentity || record2.buildIdentity === "unknown") {
    throw new AdapterError("bootstrap_version_failed");
  }
  return environment;
}
async function bootstrapCli(environment, dependencies = DEFAULT_BOOTSTRAP_DEPENDENCIES, release = PINNED_RELEASE) {
  const target = selectTarget(environment.RUNNER_OS, environment.RUNNER_ARCH);
  if (!target) {
    throw new AdapterError("bootstrap_platform_unsupported");
  }
  const runnerTemp = environment.RUNNER_TEMP;
  if (!runnerTemp || !import_node_path2.default.isAbsolute(runnerTemp)) {
    throw new AdapterError("bootstrap_platform_unsupported");
  }
  const canonicalRunnerTemp = await (0, import_promises2.realpath)(runnerTemp).catch(() => void 0);
  const temporaryStatus = canonicalRunnerTemp ? await (0, import_promises2.stat)(canonicalRunnerTemp).catch(() => void 0) : void 0;
  if (!canonicalRunnerTemp || !temporaryStatus?.isDirectory()) {
    throw new AdapterError("bootstrap_platform_unsupported");
  }
  const archive = release.archives[target];
  const allocation = await (0, import_promises2.mkdtemp)(
    import_node_path2.default.join(canonicalRunnerTemp, ".scherzo-run-cli-")
  ).catch(() => {
    throw new AdapterError("bootstrap_download_failed");
  });
  const checksumPath = import_node_path2.default.join(allocation, release.checksumAsset.name);
  const archivePath = import_node_path2.default.join(allocation, archive.name);
  try {
    await (0, import_promises2.chmod)(allocation, 448);
    await downloadVerified(
      checksumPath,
      release.checksumAsset,
      dependencies.fetch
    );
    verifyChecksumAsset(await (0, import_promises2.readFile)(checksumPath), release);
    await downloadVerified(archivePath, archive, dependencies.fetch);
    await extractArchive(archivePath, allocation, archive);
    await (0, import_promises2.rm)(checksumPath, { force: true });
    await (0, import_promises2.rm)(archivePath, { force: true });
    const cliDirectory = import_node_path2.default.join(allocation, archive.rootDirectory);
    const executable = import_node_path2.default.join(cliDirectory, "scherzo-cloud");
    const executableStatus = await (0, import_promises2.lstat)(executable).catch(() => void 0);
    if (!executableStatus?.isFile() || executableStatus.isSymbolicLink() || (executableStatus.mode & 4095) !== 493 || await (0, import_promises2.realpath)(executable) !== executable) {
      throw new AdapterError("bootstrap_integrity_failed");
    }
    const childEnvironment = await verifyVersion(
      executable,
      cliDirectory,
      release,
      environment,
      dependencies.runVersion
    );
    await dependencies.appendPath(environment.GITHUB_PATH, cliDirectory);
    return { executable, cliDirectory, environment: childEnvironment };
  } catch (error) {
    await (0, import_promises2.rm)(allocation, { recursive: true, force: true }).catch(
      () => void 0
    );
    throw asAdapterError(error);
  }
}

// src/execution.ts
var import_node_child_process2 = require("node:child_process");
var import_node_crypto3 = require("node:crypto");
var import_node_fs2 = require("node:fs");
var import_promises4 = require("node:fs/promises");
var import_node_path3 = __toESM(require("node:path"), 1);
var MAXIMUM_TERMINAL_JSON_BYTES = 2021e5;
var DEFAULT_EXECUTION_DEPENDENCIES = {
  spawn: (executable, arguments_, options) => (0, import_node_child_process2.spawn)(executable, [...arguments_], options),
  signals: process,
  presentationStream: process.stderr,
  randomBytes: import_node_crypto3.randomBytes,
  maximumTerminalBytes: MAXIMUM_TERMINAL_JSON_BYTES
};
async function allocateExecution(runnerTemp, prompt) {
  if (!runnerTemp || !import_node_path3.default.isAbsolute(runnerTemp)) {
    throw new AdapterError("input_invalid");
  }
  const canonicalRunnerTemp = await (0, import_promises4.realpath)(runnerTemp).catch(() => void 0);
  const temporaryStatus = canonicalRunnerTemp ? await (0, import_promises4.stat)(canonicalRunnerTemp).catch(() => void 0) : void 0;
  if (!canonicalRunnerTemp || !temporaryStatus?.isDirectory()) {
    throw new AdapterError("input_invalid");
  }
  const parent = await (0, import_promises4.mkdtemp)(
    import_node_path3.default.join(canonicalRunnerTemp, ".scherzo-run-")
  ).catch(() => {
    throw new AdapterError("allocation_failed");
  });
  const runDirectory = import_node_path3.default.join(parent, "run");
  const terminalPath = import_node_path3.default.join(parent, ".terminal.json");
  try {
    await (0, import_promises4.chmod)(parent, 448);
    const terminalHandle = await (0, import_promises4.open)(
      terminalPath,
      import_node_fs2.constants.O_CREAT | import_node_fs2.constants.O_EXCL | import_node_fs2.constants.O_WRONLY,
      384
    );
    try {
      await terminalHandle.sync();
    } finally {
      await terminalHandle.close();
    }
    await (0, import_promises4.chmod)(terminalPath, 384);
    if (prompt === void 0) {
      return { parent, runDirectory, terminalPath };
    }
    const promptPath = import_node_path3.default.join(parent, ".prompt");
    const promptHandle = await (0, import_promises4.open)(
      promptPath,
      import_node_fs2.constants.O_CREAT | import_node_fs2.constants.O_EXCL | import_node_fs2.constants.O_WRONLY,
      384
    );
    try {
      await promptHandle.writeFile(Buffer.from(prompt, "utf8"));
      await promptHandle.sync();
    } finally {
      await promptHandle.close();
    }
    await (0, import_promises4.chmod)(promptPath, 384);
    return { parent, runDirectory, terminalPath, promptPath };
  } catch (error) {
    await (0, import_promises4.rm)(parent, { recursive: true, force: true }).catch(() => void 0);
    throw error instanceof AdapterError ? error : new AdapterError("allocation_failed");
  }
}
function workflowArguments(inputs, allocation) {
  const arguments_ = [
    "workflow",
    "run",
    "--source-root",
    inputs.sourceRoot,
    "--execution-root",
    inputs.executionRoot,
    "--run-dir",
    allocation.runDirectory,
    "--max-parallel",
    inputs.maximumParallel,
    "--json"
  ];
  const promptPath = allocation.promptPath ?? inputs.promptFile;
  if (promptPath !== void 0) {
    arguments_.push("--prompt-file", promptPath);
  }
  for (const attachment of inputs.attachments) {
    arguments_.push("--attachment", attachment.mediaType, attachment.path);
  }
  arguments_.push(inputs.workflow);
  return arguments_;
}
async function spoolStdout(stdout, handle, maximumBytes) {
  let bytes = 0;
  let retained = 0;
  let overflow = false;
  let writeFailed = false;
  try {
    for await (const value of stdout) {
      const chunk = Buffer.from(value);
      bytes += chunk.length;
      const remaining = maximumBytes - retained;
      if (remaining > 0) {
        const selected = chunk.subarray(0, remaining);
        retained += selected.length;
        if (!writeFailed) {
          await handle.write(selected).catch(() => {
            writeFailed = true;
          });
        }
      }
      if (chunk.length > Math.max(remaining, 0)) overflow = true;
    }
    if (!writeFailed) {
      await handle.sync().catch(() => {
        writeFailed = true;
      });
    }
  } finally {
    await handle.close().catch(() => {
      writeFailed = true;
    });
  }
  if (writeFailed) throw new AdapterError("child_output_failed");
  return { bytes, overflow };
}
async function runWorkflow(executable, inputs, allocation, environment, dependencies = DEFAULT_EXECUTION_DEPENDENCIES) {
  const arguments_ = workflowArguments(inputs, allocation);
  if (await (0, import_promises4.lstat)(allocation.runDirectory).catch(() => void 0)) {
    throw new AdapterError("allocation_failed");
  }
  const spoolHandle = await (0, import_promises4.open)(
    allocation.terminalPath,
    import_node_fs2.constants.O_WRONLY | import_node_fs2.constants.O_TRUNC | import_node_fs2.constants.O_NOFOLLOW
  ).catch(() => {
    throw new AdapterError("child_output_failed");
  });
  const spoolStatus = await spoolHandle.stat().catch(() => void 0);
  if (!spoolStatus?.isFile() || (spoolStatus.mode & 4095) !== 384) {
    await spoolHandle.close().catch(() => void 0);
    throw new AdapterError("child_output_failed");
  }
  const guard = new WorkflowCommandGuard(
    dependencies.presentationStream,
    dependencies.randomBytes
  );
  try {
    await guard.start();
  } catch {
    await spoolHandle.close().catch(() => void 0);
    throw new AdapterError("child_output_failed");
  }
  let child;
  try {
    child = dependencies.spawn(executable, arguments_, {
      cwd: inputs.workspace,
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    await spoolHandle.close().catch(() => void 0);
    try {
      await guard.stop();
    } catch {
      throw new AdapterError("child_output_failed");
    }
    throw new AdapterError("child_launch_failed");
  }
  let active = true;
  let forwarded;
  const forward = (signal) => () => {
    if (!active || forwarded !== void 0) return;
    forwarded = signal;
    try {
      child.kill(signal);
    } catch {
    }
  };
  const onInterrupt = forward("SIGINT");
  const onTerminate = forward("SIGTERM");
  dependencies.signals.on("SIGINT", onInterrupt);
  dependencies.signals.on("SIGTERM", onTerminate);
  const stderrPromise = (async () => {
    for await (const value of child.stderr) {
      await guard.write(Buffer.from(value));
    }
  })();
  const stdoutPromise = spoolStdout(
    child.stdout,
    spoolHandle,
    dependencies.maximumTerminalBytes
  );
  try {
    let launchFailed = false;
    const completion = await new Promise((resolve) => {
      child.once("error", () => {
        launchFailed = true;
      });
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    active = false;
    const [spool] = await Promise.all([stdoutPromise, stderrPromise]).catch(
      () => {
        throw new AdapterError("child_output_failed");
      }
    );
    if (launchFailed) throw new AdapterError("child_launch_failed");
    return {
      ...completion,
      terminalPath: allocation.terminalPath,
      terminalBytes: spool.bytes,
      terminalOverflow: spool.overflow,
      ...forwarded === void 0 ? {} : { signalForwarded: forwarded }
    };
  } catch (error) {
    throw asAdapterError(error);
  } finally {
    active = false;
    dependencies.signals.off("SIGINT", onInterrupt);
    dependencies.signals.off("SIGTERM", onTerminate);
    try {
      await guard.stop();
    } catch {
      throw new AdapterError("child_output_failed");
    }
  }
}
async function cleanupExecution(allocation) {
  let failed = false;
  if (allocation.promptPath !== void 0) {
    await (0, import_promises4.rm)(allocation.promptPath, { force: true }).catch(() => {
      failed = true;
    });
  }
  await (0, import_promises4.rm)(allocation.terminalPath, { force: true }).catch(() => {
    failed = true;
  });
  const runStatus = await (0, import_promises4.lstat)(allocation.runDirectory).catch(() => void 0);
  if (!runStatus?.isDirectory() || runStatus.isSymbolicLink()) {
    await (0, import_promises4.rm)(allocation.parent, { recursive: true, force: true }).catch(() => {
      failed = true;
    });
    if (await (0, import_promises4.lstat)(allocation.parent).catch(() => void 0)) failed = true;
  } else {
    if (allocation.promptPath !== void 0 && await (0, import_promises4.lstat)(allocation.promptPath).catch(() => void 0) || await (0, import_promises4.lstat)(allocation.terminalPath).catch(() => void 0)) {
      failed = true;
    }
  }
  if (failed) throw new AdapterError("cleanup_failed");
}

// src/identity.ts
var import_promises5 = require("node:fs/promises");
var import_node_path4 = __toESM(require("node:path"), 1);
var MAXIMUM_STATUS_JSON_BYTES = 32 * 1024 * 1024;
var STATUS_KEYS = [
  "schemaVersion",
  "command",
  "outcome",
  "exitStatus",
  "runDirectory",
  "run",
  "state",
  "recovery",
  "retry"
];
var DEFAULT_RECOVERY_DEPENDENCIES = {
  readStatus: (executable, runDirectory, environment) => captureCommand(
    executable,
    ["workflow", "status", runDirectory, "--json"],
    environment,
    MAXIMUM_STATUS_JSON_BYTES,
    "result_identity_invalid"
  )
};
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}
async function retainedResult(allocation, outcome) {
  const artifactDirectory = import_node_path4.default.join(
    allocation.runDirectory,
    "attempts",
    "000001",
    "result"
  );
  const resultPath = import_node_path4.default.join(artifactDirectory, "result.json");
  const artifactStatus = await (0, import_promises5.lstat)(artifactDirectory).catch(() => void 0);
  const resultStatus = await (0, import_promises5.lstat)(resultPath).catch(() => void 0);
  if (!artifactStatus?.isDirectory() || artifactStatus.isSymbolicLink() || !resultStatus?.isFile() || resultStatus.isSymbolicLink()) {
    throw new AdapterError("result_identity_invalid");
  }
  return {
    runDirectory: allocation.runDirectory,
    artifactDirectory,
    resultPath,
    outcome,
    attemptNumber: 1
  };
}
async function recoverRunDirectory(allocation, envelope) {
  if (envelope?.runDirectory !== allocation.runDirectory) return void 0;
  const runStatus = await (0, import_promises5.lstat)(allocation.runDirectory).catch(() => void 0);
  return runStatus?.isDirectory() && !runStatus.isSymbolicLink() ? allocation.runDirectory : void 0;
}
async function recoverDurableRun(executable, allocation, environment, dependencies = DEFAULT_RECOVERY_DEPENDENCIES) {
  const runStatus = await (0, import_promises5.lstat)(allocation.runDirectory).catch(() => void 0);
  if (!runStatus?.isDirectory() || runStatus.isSymbolicLink()) return void 0;
  const status = await dependencies.readStatus(
    executable,
    allocation.runDirectory,
    environment
  );
  if (status.code !== 0 || status.signal !== null || status.stdoutOverflow || status.stderrOverflow) {
    throw new AdapterError("result_identity_invalid");
  }
  let parsed;
  try {
    parsed = JSON.parse(status.stdout.toString("utf8"));
  } catch {
    throw new AdapterError("result_identity_invalid");
  }
  const document = record(parsed);
  const run = record(document?.run);
  const state = record(document?.state);
  const attempts = state?.attempts;
  const attempt = Array.isArray(attempts) ? record(attempts[0]) : void 0;
  const result = record(attempt?.result);
  if (!document || !exactKeys(document, STATUS_KEYS) || document.schemaVersion !== 1 || document.command !== "scherzo-cloud workflow status" || document.outcome !== "status" || document.exitStatus !== 0 || document.runDirectory !== allocation.runDirectory || !run || run.schemaVersion !== 1 || typeof run.localRunId !== "string" || !state || state.schemaVersion !== 1 || state.localRunId !== run.localRunId || state.currentAttemptNumber !== 1 || !Array.isArray(attempts) || attempts.length !== 1 || !attempt || attempt.attemptNumber !== 1 || attempt.trigger !== "initial" || !result) {
    throw new AdapterError("result_identity_invalid");
  }
  if (result.status !== "published") {
    if (result.status !== "not_published" && result.status !== "publication_failed") {
      throw new AdapterError("result_identity_invalid");
    }
    return { runDirectory: allocation.runDirectory };
  }
  if (result.relativeDirectory !== "attempts/000001/result") {
    throw new AdapterError("result_identity_invalid");
  }
  const outcome = attempt.state === "succeeded" ? "succeeded" : attempt.state === "workflow_failed" ? "failed" : attempt.state === "cancelled" ? "cancelled" : void 0;
  if (!outcome) throw new AdapterError("result_identity_invalid");
  return {
    runDirectory: allocation.runDirectory,
    result: await retainedResult(allocation, outcome)
  };
}
async function committedIdentity(allocation, envelope) {
  if (envelope.outcome !== "succeeded" && envelope.outcome !== "failed" && envelope.outcome !== "cancelled") {
    return void 0;
  }
  if (envelope.runDirectory !== allocation.runDirectory || envelope.attemptNumber === void 0 || envelope.resultDirectory === void 0) {
    throw new AdapterError("result_identity_invalid");
  }
  const attemptDirectory = String(envelope.attemptNumber).padStart(6, "0");
  const expectedArtifactDirectory = import_node_path4.default.join(
    allocation.runDirectory,
    "attempts",
    attemptDirectory,
    "result"
  );
  if (envelope.resultDirectory !== expectedArtifactDirectory) {
    throw new AdapterError("result_identity_invalid");
  }
  const artifactStatus = await (0, import_promises5.lstat)(expectedArtifactDirectory).catch(
    () => void 0
  );
  const resultPath = import_node_path4.default.join(expectedArtifactDirectory, "result.json");
  const resultStatus = await (0, import_promises5.lstat)(resultPath).catch(() => void 0);
  if (!artifactStatus?.isDirectory() || artifactStatus.isSymbolicLink() || !resultStatus?.isFile() || resultStatus.isSymbolicLink()) {
    throw new AdapterError("result_identity_invalid");
  }
  return {
    runDirectory: allocation.runDirectory,
    artifactDirectory: expectedArtifactDirectory,
    resultPath,
    outcome: envelope.outcome,
    attemptNumber: envelope.attemptNumber
  };
}

// src/inputs.ts
var import_promises6 = require("node:fs/promises");
var import_node_path5 = __toESM(require("node:path"), 1);
function optionalInput(environment, name) {
  const value = environment[name];
  return value === void 0 || value === "" ? void 0 : value;
}
function resolveWorkspacePath(workspace, value) {
  return import_node_path5.default.resolve(workspace, value);
}
function parseAttachments(value, workspace) {
  if (value === void 0 || value === "") {
    return [];
  }
  let body = value;
  if (body.endsWith("\r\n")) {
    body = body.slice(0, -2);
  } else if (body.endsWith("\n")) {
    body = body.slice(0, -1);
  }
  const attachments = [];
  const lines = body.split("\n");
  for (const [index, originalLine] of lines.entries()) {
    let line = originalLine;
    if (line.endsWith("\r") && index < lines.length - 1) {
      line = line.slice(0, -1);
    }
    const delimiter = line.indexOf("=");
    if (line === "" || line.includes("\r") || delimiter <= 0 || delimiter === line.length - 1) {
      throw new AdapterError("input_invalid");
    }
    attachments.push({
      mediaType: line.slice(0, delimiter),
      path: resolveWorkspacePath(workspace, line.slice(delimiter + 1))
    });
  }
  return attachments;
}
async function readActionInputs(environment) {
  const workspaceValue = environment.GITHUB_WORKSPACE;
  if (!workspaceValue || !import_node_path5.default.isAbsolute(workspaceValue)) {
    throw new AdapterError("input_invalid");
  }
  const workspace = import_node_path5.default.resolve(workspaceValue);
  const workspaceStatus = await (0, import_promises6.stat)(workspace).catch(() => void 0);
  if (!workspaceStatus?.isDirectory()) {
    throw new AdapterError("input_invalid");
  }
  const workflowValue = optionalInput(environment, "INPUT_WORKFLOW");
  const prompt = optionalInput(environment, "INPUT_PROMPT");
  const promptFileValue = optionalInput(environment, "INPUT_PROMPT-FILE");
  if (!workflowValue || prompt !== void 0 && promptFileValue !== void 0) {
    throw new AdapterError("input_invalid");
  }
  const maximumParallel = optionalInput(environment, "INPUT_MAX-PARALLEL") ?? "1";
  if (!/^[0-9]+$/u.test(maximumParallel)) {
    throw new AdapterError("input_invalid");
  }
  const parallelValue = BigInt(maximumParallel);
  if (parallelValue < 1n || parallelValue > 256n) {
    throw new AdapterError("input_invalid");
  }
  const sourceRootValue = optionalInput(environment, "INPUT_SOURCE-ROOT");
  const executionRootValue = optionalInput(environment, "INPUT_EXECUTION-ROOT");
  const attachmentsValue = optionalInput(environment, "INPUT_ATTACHMENTS");
  const selectedExport = optionalInput(environment, "INPUT_EXPORT");
  return {
    workspace,
    workflow: resolveWorkspacePath(workspace, workflowValue),
    sourceRoot: sourceRootValue === void 0 ? workspace : resolveWorkspacePath(workspace, sourceRootValue),
    executionRoot: executionRootValue === void 0 ? workspace : resolveWorkspacePath(workspace, executionRootValue),
    ...prompt === void 0 ? {} : { prompt },
    ...promptFileValue === void 0 ? {} : { promptFile: resolveWorkspacePath(workspace, promptFileValue) },
    attachments: parseAttachments(attachmentsValue, workspace),
    maximumParallel,
    ...selectedExport === void 0 ? {} : { selectedExport }
  };
}

// src/result.ts
var import_node_crypto4 = require("node:crypto");
var import_node_fs3 = require("node:fs");
var import_promises7 = require("node:fs/promises");
var import_node_events = require("node:events");
var import_node_path6 = __toESM(require("node:path"), 1);
var import_stream_json = __toESM(require_stream_json(), 1);
var { parser } = import_stream_json.default;
var MAXIMUM_RESULT_BYTES = 202027692;
var MAXIMUM_VALIDATOR_OUTPUT_BYTES = 1048576;
var MAXIMUM_INLINE_EXPORT_BYTES = 65536;
function exactKeys2(value, expected) {
  const expectedKeys = [...expected].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expectedKeys.length && actual.every((key, index) => key === expectedKeys[index]);
}
var validateArtifactWithCli = async (executable, artifactDirectory, environment) => {
  const result = await captureCommand(
    executable,
    ["artifact", "validate", "--json", artifactDirectory],
    environment,
    MAXIMUM_VALIDATOR_OUTPUT_BYTES,
    "artifact_validation_failed"
  );
  if (result.code !== 0 || result.signal !== null || result.stdoutOverflow || result.stderrOverflow) {
    throw new AdapterError("artifact_validation_failed");
  }
  let document;
  try {
    document = JSON.parse(result.stdout.toString("utf8"));
  } catch {
    throw new AdapterError("artifact_validation_failed");
  }
  if (typeof document !== "object" || document === null || !exactKeys2(document, [
    "schemaVersion",
    "command",
    "outcome",
    "exitStatus",
    "artifactSetVersion",
    "artifactDirectory",
    "summary"
  ])) {
    throw new AdapterError("artifact_validation_failed");
  }
  const record2 = document;
  const summary = record2.summary;
  if (record2.schemaVersion !== 1 || record2.command !== "scherzo-cloud artifact validate" || record2.outcome !== "valid" || record2.exitStatus !== 0 || record2.artifactSetVersion !== 1 || record2.artifactDirectory !== await (0, import_promises7.realpath)(artifactDirectory) || typeof summary !== "object" || summary === null || !exactKeys2(summary, [
    "declaredExports",
    "availableExports",
    "unavailableExports",
    "referencedCarriers",
    "carrierBytes"
  ]) || !Object.values(summary).every(
    (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0
  )) {
    throw new AdapterError("artifact_validation_failed");
  }
};
async function fingerprintResult(file) {
  const handle = await (0, import_promises7.open)(
    file,
    import_node_fs3.constants.O_RDONLY | import_node_fs3.constants.O_NOFOLLOW
  ).catch(() => {
    throw new AdapterError("result_projection_failed");
  });
  const digest = (0, import_node_crypto4.createHash)("sha256");
  let size = 0;
  let before;
  let after;
  try {
    before = await handle.stat();
    if (!before.isFile()) throw new AdapterError("result_projection_failed");
    const stream = handle.createReadStream({ autoClose: false });
    for await (const value of stream) {
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > MAXIMUM_RESULT_BYTES) {
        throw new AdapterError("result_projection_failed");
      }
      digest.update(chunk);
    }
    after = await handle.stat();
  } finally {
    await handle.close().catch(() => void 0);
  }
  if (!before || !after || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || size !== after.size) {
    throw new AdapterError("result_projection_failed");
  }
  return {
    device: after.dev,
    inode: after.ino,
    size,
    sha256: digest.digest("hex")
  };
}
function primitiveValue(token) {
  if (token.name !== "numberValue") return token.value;
  if (typeof token.value !== "string") {
    throw new AdapterError("result_projection_failed");
  }
  if (!/^-?(?:0|[1-9][0-9]*)$/u.test(token.value)) {
    throw new AdapterError("result_projection_failed");
  }
  const value = Number(token.value);
  if (!Number.isSafeInteger(value)) {
    throw new AdapterError("result_projection_failed");
  }
  return value;
}
var PRIMITIVE_TOKENS = /* @__PURE__ */ new Set([
  "stringValue",
  "numberValue",
  "nullValue",
  "trueValue",
  "falseValue"
]);
function assignPrimitive(projection, selected, section, key, value) {
  if (section === "selected") {
    selected[key] = value;
  } else if (section === "digest") {
    const digest = selected.digest ?? {};
    digest[key] = value;
    selected.digest = digest;
  } else if (section === "carrier") {
    const carrier = selected.carrier ?? {};
    carrier[key] = value;
    selected.carrier = carrier;
  } else {
    const carrier = selected.carrier ?? {};
    const digest = carrier.digest ?? {};
    digest[key] = value;
    carrier.digest = digest;
    selected.carrier = carrier;
  }
  void projection;
}
async function parseResultAndFingerprint(file, selectedExport) {
  const handle = await (0, import_promises7.open)(
    file,
    import_node_fs3.constants.O_RDONLY | import_node_fs3.constants.O_NOFOLLOW
  ).catch(() => {
    throw new AdapterError("result_projection_failed");
  });
  const digest = (0, import_node_crypto4.createHash)("sha256");
  const jsonParser = parser();
  const projection = {};
  const selected = {};
  let selectedFound = false;
  let depth = 0;
  let rootKey;
  let exportKey;
  let selectedDepth;
  let section = "selected";
  let sectionDepth = 0;
  let selectedKey;
  const rootValues = /* @__PURE__ */ new Map();
  let exportsDepth;
  const consume = (async () => {
    for await (const raw of jsonParser) {
      const token = raw;
      if (token.name === "keyValue") {
        if (depth === 1 && typeof token.value === "string") {
          rootKey = token.value;
        } else if (exportsDepth === depth && typeof token.value === "string") {
          exportKey = token.value;
        } else if (selectedDepth !== void 0 && depth >= selectedDepth && typeof token.value === "string") {
          selectedKey = token.value;
        }
        continue;
      }
      if (token.name === "startObject" || token.name === "startArray") {
        const parentDepth = depth;
        depth += 1;
        if (parentDepth === 1 && rootKey === "exports" && token.name === "startObject") {
          exportsDepth = depth;
        } else if (exportsDepth === parentDepth && exportKey === selectedExport && token.name === "startObject") {
          selectedDepth = depth;
          selectedFound = true;
          section = "selected";
          sectionDepth = depth;
        } else if (selectedDepth !== void 0 && parentDepth >= selectedDepth) {
          if (section === "selected" && selectedKey === "digest") {
            section = "digest";
            sectionDepth = depth;
          } else if (section === "selected" && selectedKey === "carrier") {
            section = "carrier";
            sectionDepth = depth;
          } else if (section === "carrier" && selectedKey === "digest") {
            section = "carrierDigest";
            sectionDepth = depth;
          }
        }
        rootKey = void 0;
        exportKey = void 0;
        selectedKey = void 0;
        continue;
      }
      if (token.name === "endObject" || token.name === "endArray") {
        if (selectedDepth !== void 0 && depth === sectionDepth) {
          if (section === "carrierDigest") {
            section = "carrier";
            sectionDepth = selectedDepth + 1;
          } else {
            section = "selected";
            sectionDepth = selectedDepth;
          }
        }
        if (selectedDepth !== void 0 && depth === selectedDepth) {
          selectedDepth = void 0;
        }
        if (exportsDepth !== void 0 && depth === exportsDepth)
          exportsDepth = void 0;
        depth -= 1;
        continue;
      }
      if (PRIMITIVE_TOKENS.has(token.name)) {
        if (depth === 1 && rootKey) {
          rootValues.set(rootKey, primitiveValue(token));
          rootKey = void 0;
        } else if (selectedDepth !== void 0 && selectedKey) {
          assignPrimitive(
            projection,
            selected,
            section,
            selectedKey,
            primitiveValue(token)
          );
          selectedKey = void 0;
        }
      }
    }
  })();
  let size = 0;
  let before;
  let after;
  try {
    before = await handle.stat();
    if (!before.isFile()) throw new AdapterError("result_projection_failed");
    const stream = handle.createReadStream({ autoClose: false });
    for await (const value of stream) {
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > MAXIMUM_RESULT_BYTES) {
        throw new AdapterError("result_projection_failed");
      }
      digest.update(chunk);
      if (!jsonParser.write(chunk)) await (0, import_node_events.once)(jsonParser, "drain");
    }
    jsonParser.end();
    await consume;
    after = await handle.stat();
  } catch {
    jsonParser.destroy();
    throw new AdapterError("result_projection_failed");
  } finally {
    await handle.close().catch(() => void 0);
  }
  if (!before || !after || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || size !== after.size) {
    throw new AdapterError("result_projection_failed");
  }
  projection.schemaVersion = rootValues.get("schemaVersion");
  projection.attemptNumber = rootValues.get("attemptNumber");
  projection.outcome = rootValues.get("outcome");
  if (selectedExport !== void 0 && selectedFound) {
    projection.selected = selected;
  }
  return {
    projection,
    fingerprint: {
      device: after.dev,
      inode: after.ino,
      size,
      sha256: digest.digest("hex")
    }
  };
}
function sameFingerprint(first, second) {
  return first.device === second.device && first.inode === second.inode && first.size === second.size && first.sha256 === second.sha256;
}
async function readCarrier(artifactDirectory, metadata, retainInline) {
  if (typeof metadata.path !== "string" || typeof metadata.sizeBytes !== "number" || !Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes < 0 || metadata.digest?.algorithm !== "sha256" || typeof metadata.digest.value !== "string") {
    throw new AdapterError("result_projection_failed");
  }
  const carrierPath = import_node_path6.default.resolve(artifactDirectory, metadata.path);
  const relative = import_node_path6.default.relative(artifactDirectory, carrierPath);
  if (relative.startsWith("..") || import_node_path6.default.isAbsolute(relative)) {
    throw new AdapterError("result_projection_failed");
  }
  const parentStatus = await (0, import_promises7.lstat)(import_node_path6.default.dirname(carrierPath)).catch(
    () => void 0
  );
  const carrierStatus = await (0, import_promises7.lstat)(carrierPath).catch(() => void 0);
  if (!parentStatus?.isDirectory() || parentStatus.isSymbolicLink() || !carrierStatus?.isFile() || carrierStatus.isSymbolicLink()) {
    throw new AdapterError("result_projection_failed");
  }
  const handle = await (0, import_promises7.open)(
    carrierPath,
    import_node_fs3.constants.O_RDONLY | import_node_fs3.constants.O_NOFOLLOW
  ).catch(() => {
    throw new AdapterError("result_projection_failed");
  });
  const digest = (0, import_node_crypto4.createHash)("sha256");
  const chunks = [];
  let bytes = 0;
  let before;
  let after;
  try {
    before = await handle.stat();
    const stream = handle.createReadStream({ autoClose: false });
    for await (const value of stream) {
      const chunk = Buffer.from(value);
      bytes += chunk.length;
      if (bytes > metadata.sizeBytes)
        throw new AdapterError("result_projection_failed");
      digest.update(chunk);
      if (retainInline && metadata.sizeBytes <= MAXIMUM_INLINE_EXPORT_BYTES) {
        chunks.push(chunk);
      }
    }
    after = await handle.stat();
  } finally {
    await handle.close().catch(() => void 0);
  }
  if (!before?.isFile() || !after?.isFile() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes !== metadata.sizeBytes || digest.digest("hex") !== metadata.digest.value) {
    throw new AdapterError("result_projection_failed");
  }
  return {
    path: carrierPath,
    ...retainInline && metadata.sizeBytes <= MAXIMUM_INLINE_EXPORT_BYTES ? { inline: Buffer.concat(chunks) } : {}
  };
}
async function validateAndProject(executable, identity, selectedExport, environment, dependencies = {
  validateArtifact: validateArtifactWithCli
}) {
  const before = await fingerprintResult(identity.resultPath);
  await dependencies.validateArtifact(
    executable,
    identity.artifactDirectory,
    environment
  );
  await dependencies.afterValidation?.();
  const parsed = await parseResultAndFingerprint(
    identity.resultPath,
    selectedExport
  );
  if (!sameFingerprint(before, parsed.fingerprint) || parsed.projection.schemaVersion !== 1 || parsed.projection.attemptNumber !== identity.attemptNumber || !["succeeded", "failed", "cancelled"].includes(
    String(parsed.projection.outcome)
  ) || identity.outcome !== void 0 && parsed.projection.outcome !== identity.outcome) {
    throw new AdapterError("result_projection_failed");
  }
  const outcome = parsed.projection.outcome;
  if (selectedExport === void 0) return { outcome };
  const selected = parsed.projection.selected;
  if (!selected) throw new AdapterError("result_projection_failed");
  if (selected.state === "unavailable") {
    return { outcome, selected: { state: "unavailable" } };
  }
  if (selected.state !== "available" || !["file", "text", "json", "git_branch"].includes(String(selected.kind))) {
    throw new AdapterError("result_projection_failed");
  }
  const kind = selected.kind;
  if (kind === "git_branch" && selected.carrier === void 0) {
    return { outcome, selected: { state: "available", kind } };
  }
  const carrierMetadata = kind === "git_branch" ? selected.carrier ?? {} : {
    path: selected.path,
    sizeBytes: selected.sizeBytes,
    ...selected.digest === void 0 ? {} : { digest: selected.digest }
  };
  const carrier = await readCarrier(
    identity.artifactDirectory,
    carrierMetadata,
    kind === "text" || kind === "json"
  );
  if (kind === "file" || kind === "git_branch") {
    return {
      outcome,
      selected: { state: "available", kind, path: carrier.path }
    };
  }
  if (typeof carrierMetadata.sizeBytes !== "number") {
    throw new AdapterError("result_projection_failed");
  }
  if (carrierMetadata.sizeBytes > MAXIMUM_INLINE_EXPORT_BYTES) {
    return {
      outcome,
      selected: {
        state: "available",
        kind,
        path: carrier.path,
        failure: new AdapterError("result_projection_failed")
      }
    };
  }
  let value;
  try {
    value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      carrier.inline
    );
  } catch {
    throw new AdapterError("result_projection_failed");
  }
  return {
    outcome,
    selected: { state: "available", kind, path: carrier.path, value }
  };
}

// src/terminal.ts
var import_node_fs4 = require("node:fs");
var import_stream_json2 = __toESM(require_stream_json(), 1);
var { parser: parser2 } = import_stream_json2.default;
function primitiveValue2(token) {
  if (token.name !== "numberValue") return token.value;
  if (typeof token.value !== "string") {
    throw new AdapterError("terminal_result_invalid");
  }
  if (!/^-?(?:0|[1-9][0-9]*)$/u.test(token.value)) {
    throw new AdapterError("terminal_result_invalid");
  }
  const value = Number(token.value);
  if (!Number.isSafeInteger(value)) {
    throw new AdapterError("terminal_result_invalid");
  }
  return value;
}
var PRIMITIVE_TOKENS2 = /* @__PURE__ */ new Set([
  "stringValue",
  "numberValue",
  "nullValue",
  "trueValue",
  "falseValue"
]);
async function readTerminalEnvelope(file) {
  const stream = (0, import_node_fs4.createReadStream)(file).pipe(parser2());
  const values = /* @__PURE__ */ new Map();
  const rootKeys = /* @__PURE__ */ new Set();
  let depth = 0;
  let pendingRootKey;
  let rootStarted = false;
  let rootEnded = false;
  try {
    for await (const raw of stream) {
      const token = raw;
      if (token.name === "startObject" || token.name === "startArray") {
        depth += 1;
        if (!rootStarted) {
          if (token.name !== "startObject" || depth !== 1) {
            throw new AdapterError("terminal_result_invalid");
          }
          rootStarted = true;
        }
        pendingRootKey = void 0;
        continue;
      }
      if (token.name === "endObject" || token.name === "endArray") {
        if (depth === 1 && token.name === "endObject") rootEnded = true;
        depth -= 1;
        if (depth < 0) throw new AdapterError("terminal_result_invalid");
        continue;
      }
      if (token.name === "keyValue" && depth === 1) {
        if (typeof token.value !== "string" || rootKeys.has(token.value)) {
          throw new AdapterError("terminal_result_invalid");
        }
        pendingRootKey = token.value;
        rootKeys.add(token.value);
        continue;
      }
      if (depth === 1 && pendingRootKey && PRIMITIVE_TOKENS2.has(token.name)) {
        values.set(pendingRootKey, primitiveValue2(token));
        pendingRootKey = void 0;
      }
    }
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw new AdapterError("terminal_result_invalid");
  }
  if (!rootStarted || !rootEnded || depth !== 0) {
    throw new AdapterError("terminal_result_invalid");
  }
  const schemaVersion = values.get("schemaVersion");
  const command = values.get("command");
  const outcome = values.get("outcome");
  const exitStatus = values.get("exitStatus");
  if (schemaVersion !== 1 || command !== "scherzo-cloud workflow run" || !["succeeded", "failed", "cancelled", "interrupted", "rejected"].includes(
    String(outcome)
  ) || typeof exitStatus !== "number" || !Number.isSafeInteger(exitStatus)) {
    throw new AdapterError("terminal_result_invalid");
  }
  const optionalString = (name) => {
    const value = values.get(name);
    return typeof value === "string" ? value : void 0;
  };
  const optionalInteger = (name) => {
    const value = values.get(name);
    return typeof value === "number" && Number.isSafeInteger(value) ? value : void 0;
  };
  const runDirectory = optionalString("runDirectory");
  const attemptNumber = optionalInteger("attemptNumber");
  const resultDirectory = optionalString("resultDirectory");
  return {
    schemaVersion,
    command,
    outcome,
    exitStatus,
    ...runDirectory === void 0 ? {} : { runDirectory },
    ...attemptNumber === void 0 ? {} : { attemptNumber },
    ...resultDirectory === void 0 ? {} : { resultDirectory },
    rootKeys
  };
}
function sameKeys(actual, expected) {
  return actual.size === expected.length && expected.every((key) => actual.has(key));
}
function validateTerminalShape(envelope) {
  if (["succeeded", "failed", "cancelled"].includes(envelope.outcome)) {
    if (!sameKeys(envelope.rootKeys, [
      "schemaVersion",
      "command",
      "outcome",
      "exitStatus",
      "runDirectory",
      "attemptNumber",
      "resultDirectory",
      "result"
    ]) || !envelope.runDirectory || !envelope.resultDirectory || envelope.attemptNumber === void 0 || envelope.attemptNumber < 1) {
      throw new AdapterError("terminal_result_invalid");
    }
    return;
  }
  if (envelope.outcome === "interrupted") {
    if (!sameKeys(envelope.rootKeys, [
      "schemaVersion",
      "command",
      "outcome",
      "exitStatus",
      "runDirectory",
      "attemptNumber",
      "interruption"
    ]) || !envelope.runDirectory || envelope.attemptNumber === void 0 || envelope.attemptNumber < 1 || envelope.exitStatus !== 1) {
      throw new AdapterError("terminal_result_invalid");
    }
    return;
  }
  if (envelope.outcome === "rejected" && (!sameKeys(envelope.rootKeys, [
    "schemaVersion",
    "command",
    "outcome",
    "exitStatus",
    "phase",
    "workflow",
    "diagnostics"
  ]) || envelope.exitStatus !== 1)) {
    throw new AdapterError("terminal_result_invalid");
  }
}

// src/main.ts
var DEFAULT_ACTION_DEPENDENCIES = {
  bootstrap: bootstrapCli,
  readInputs: readActionInputs,
  allocate: allocateExecution,
  execute: runWorkflow,
  readTerminal: readTerminalEnvelope,
  recover: recoverDurableRun,
  project: (executable, identity, selectedExport, environment) => validateAndProject(executable, identity, selectedExport, environment),
  writeOutputs,
  cleanup: cleanupExecution
};
function applyProjection(outputs, projection) {
  outputs["export-state"] = projection.state;
  outputs["export-kind"] = projection.kind ?? "";
  outputs["export-path"] = projection.path ?? "";
  outputs["export-value"] = projection.value ?? "";
}
async function executeAction(environment, dependencies = DEFAULT_ACTION_DEPENDENCIES) {
  const outputs = emptyOutputs();
  let failure;
  let allocation;
  let terminal;
  let inputs;
  let bootstrap;
  let processResult;
  const fail = (error) => {
    failure ??= asAdapterError(error);
  };
  try {
    bootstrap = await dependencies.bootstrap(environment);
    inputs = await dependencies.readInputs(environment);
    allocation = await dependencies.allocate(
      environment.RUNNER_TEMP,
      inputs.prompt
    );
    try {
      processResult = await dependencies.execute(
        bootstrap.executable,
        inputs,
        allocation,
        bootstrap.environment
      );
    } catch (error) {
      fail(error);
    }
    if (processResult) {
      if (processResult.terminalOverflow) {
        fail(new AdapterError("terminal_result_invalid"));
      } else {
        try {
          const candidate = await dependencies.readTerminal(
            processResult.terminalPath
          );
          validateTerminalShape(candidate);
          terminal = candidate;
          if (processResult.code === null || processResult.signal !== null || terminal.exitStatus !== processResult.code) {
            fail(new AdapterError("terminal_result_invalid"));
          }
        } catch (error) {
          fail(error);
        }
      }
    }
    const runDirectory = await recoverRunDirectory(allocation, terminal);
    outputs["run-directory"] = runDirectory ?? "";
    let identity;
    if (terminal) {
      try {
        identity = await committedIdentity(allocation, terminal);
      } catch (error) {
        fail(error);
      }
    }
    if (!identity) {
      const recovered = await dependencies.recover(bootstrap.executable, allocation, bootstrap.environment).catch((error) => {
        fail(error);
        return void 0;
      });
      if (recovered) {
        outputs["run-directory"] = recovered.runDirectory;
        identity = recovered.result;
      }
    }
    if (identity) {
      outputs.outcome = identity.outcome ?? "";
      outputs["artifact-set-path"] = identity.artifactDirectory;
      outputs["result-path"] = identity.resultPath;
      try {
        const validated = await dependencies.project(
          bootstrap.executable,
          identity,
          inputs.selectedExport,
          bootstrap.environment
        );
        outputs.outcome = validated.outcome;
        if (validated.selected) {
          applyProjection(outputs, validated.selected);
          if (validated.selected.failure) fail(validated.selected.failure);
        }
      } catch (error) {
        fail(error);
      }
    }
    if (!processResult || processResult.code !== 0 || terminal?.outcome !== "succeeded") {
      fail(new AdapterError("workflow_failed"));
    }
  } catch (error) {
    fail(error);
    if (allocation) {
      outputs["run-directory"] = await recoverRunDirectory(allocation, terminal).catch(
        () => void 0
      ) ?? "";
    }
  } finally {
    if (allocation) {
      await dependencies.cleanup(allocation).catch(fail);
    }
  }
  await dependencies.writeOutputs(environment.GITHUB_OUTPUT, outputs).catch(fail);
  return {
    outputs,
    ...failure === void 0 ? {} : { failure }
  };
}
async function runMain() {
  const result = await executeAction(process.env);
  if (result.failure) {
    process.stderr.write(`${result.failure.message}
`);
    process.exitCode = 1;
  }
}

// src/index.ts
void runMain().catch(() => {
  process.stderr.write("Scherzo Run failed [result_projection_failed].\n");
  process.exitCode = 1;
});
