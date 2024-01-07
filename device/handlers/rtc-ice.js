const GsmProxyEventHandler = require("./../gsm-proxy-event-handler");

class HandlerRtcOffer extends GsmProxyEventHandler {
    constructor(gsmProxy) {
        super("rtc-ice-candidate", gsmProxy);
    }

    async handle(data, tag) {
        this.gsmProxy.rtcAddIceCandidate(data);
    }
}

module.exports = HandlerRtcOffer;
