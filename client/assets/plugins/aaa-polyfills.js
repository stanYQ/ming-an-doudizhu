// Buffer polyfill for colyseus.js in Cocos Creator browser/WeChat environment.
// Must load before colyseus.js — filename starts with 'aaa' to win alphabetical order.
(function () {
    if (typeof globalThis.Buffer !== 'undefined') return;

    function B(arg) {
        if (typeof arg === 'number') return new Uint8Array(arg);
        if (arg instanceof Uint8Array) return arg;
        if (arg instanceof ArrayBuffer) return new Uint8Array(arg);
        if (Array.isArray(arg)) return new Uint8Array(arg);
        return new Uint8Array(0);
    }

    B.from = function (data, encoding) {
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) return new Uint8Array(data);
        if (Array.isArray(data)) return new Uint8Array(data);
        if (typeof data === 'string') {
            if (encoding === 'base64') {
                var bin = atob(data), bytes = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return bytes;
            }
            if (encoding === 'hex') {
                var h = data, out = new Uint8Array(h.length / 2);
                for (var j = 0; j < out.length; j++) out[j] = parseInt(h.substr(j * 2, 2), 16);
                return out;
            }
            return new TextEncoder().encode(data); // utf8 default
        }
        return new Uint8Array(0);
    };

    B.alloc = function (size, fill) {
        var b = new Uint8Array(size);
        if (fill !== undefined) b.fill(typeof fill === 'string' ? fill.charCodeAt(0) : fill);
        return b;
    };

    B.allocUnsafe = function (size) { return new Uint8Array(size); };
    B.allocUnsafeSlow = B.allocUnsafe;

    B.isBuffer = function (obj) { return obj instanceof Uint8Array; };

    B.concat = function (list, totalLength) {
        var total = totalLength != null ? totalLength : list.reduce(function (n, b) { return n + b.length; }, 0);
        var result = new Uint8Array(total), offset = 0;
        for (var i = 0; i < list.length; i++) { result.set(list[i], offset); offset += list[i].length; }
        return result;
    };

    B.byteLength = function (str, encoding) {
        if (encoding === 'base64') return Math.floor(str.length * 3 / 4);
        return new TextEncoder().encode(str).length;
    };

    globalThis.Buffer = B;
})();

// process polyfill — colyseus.js checks process.env.NODE_ENV and process.browser
(function () {
    if (typeof globalThis.process !== 'undefined') return;
    globalThis.process = {
        env: { NODE_ENV: 'production' },
        browser: true,
        version: '',
        versions: {},
        platform: 'browser',
        nextTick: function (fn) { Promise.resolve().then(fn); },
    };
})();
