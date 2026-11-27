function bootstrap(source, nonce, guard, loopMessage) {
    const send = (level, text) => parent.postMessage({ nonce, level, text: text.slice(0, 4000) }, '*');
    let count = 0;
    let remaining = 80;
    setInterval(() => { remaining = 80; }, 1000);
    Object.defineProperty(window, guard, { value() {
            if (!count)
                setTimeout(() => { count = 0; }, 0);
            if (++count > 100000)
                throw new Error(loopMessage);
        } });
    function describe(value, depth = 0, seen = new WeakSet()) {
        if (value instanceof Error)
            return (value.stack ?? value.message).slice(0, 2000);
        if (value instanceof Element)
            return '<' + value.tagName.toLowerCase() + (value.id ? '#' + value.id : '') + '>';
        if (typeof value !== 'object' || value === null)
            return String(value).slice(0, 1000);
        if (Array.isArray(value)) {
            if (seen.has(value)) return '[Circular]';
            if (depth >= 3) return '[…]';
            seen.add(value);
            return '[' + value.slice(0, 12).map(item => describe(item, depth + 1, seen)).join(', ') + (value.length > 12 ? ', …]' : ']');
        }
        if (seen.has(value))
            return '[↻]';
        if (depth >= 3)
            return '…';
        seen.add(value);
        const parts = [];
        for (const key in value) {
            if (!Object.hasOwn(value, key))
                continue;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            parts.push(key + ': ' + (descriptor && 'value' in descriptor ? describe(descriptor.value, depth + 1, seen) : '[getter]'));
            if (parts.length >= 12)
                break;
        }
        return ('{' + parts.join(', ') + '}').slice(0, 2000);
    }
    for (const level of ['log', 'info', 'warn', 'error', 'clear']) {
        console[level] = (...args) => {
            if (remaining <= 0)
                return;
            remaining--;
            try {
                send(level, args.slice(0, 12).map(value => describe(value)).join(' '));
            }
            catch {
                send(level, '…');
            }
        };
    }
    window.addEventListener('error', event => console.error(event.error ?? event.message));
    window.addEventListener('unhandledrejection', event => console.error(event.reason));
    Object.defineProperty(window, guard + '_result', { value(value) {
        if (value && typeof value.then === 'function') {
            Promise.resolve(value).then(result => console.log(result), reason => console.error(reason));
        } else if (value !== undefined) console.log(value);
    } });
    window.addEventListener('message', event => {
        if (event.source !== parent || event.data?.nonce !== nonce || typeof event.data.command !== 'string')
            return;
        const command = document.createElement('script');
        command.nonce = nonce;
        command.textContent = event.data.command;
        document.body.append(command);
        command.remove();
    });
    const style = document.createElement('style');
    style.textContent = source.css;
    document.head.append(style);
    document.body.innerHTML = source.html;
    const script = document.createElement('script');
    script.nonce = nonce;
    script.textContent = source.js;
    document.body.append(script);
    send('ready', '');
}
