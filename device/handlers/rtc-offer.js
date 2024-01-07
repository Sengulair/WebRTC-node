const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerRtcIce extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("rtc-offer", gsmProxy);
    }

    async handle(data, tag) {
        this.gsmProxy.rtcStart(data);
    }
}

module.exports = HandlerRtcIce;
