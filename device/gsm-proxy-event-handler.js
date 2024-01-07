class GsmProxyEventHandler {
    constructor(name, gsmProxy) {
        this.gsmProxy = gsmProxy;
        this.name = name;
    }

    async handle(data, tag) {
        throw new Error("Abstract method 'handle' must be implemented in subclass");
    }

    log() {
        return this.gsmProxy.log();
    }
}

module.exports = GsmProxyEventHandler;