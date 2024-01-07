// Debug Params
const alwaysPerformOnboarding = false;
const alwaysPerformModemSelection = false;
const logLevel = "silly"; //"silly";

// Variables
const identifier = "com.gsm-proxy";
const name = "GsmProxy";
const onboardingUrl = "https://gsm-proxy-onboarding.glitch.me/api/onboard";
const pingInterval = 30;
const modemSettings = {
    baudRate: 115200,
    incomingCallIndication: true,
    incomingSMSIndication: true,
    customInitCommand: " ",
};
const priorityOfModemAutomaticConnection = ["ttyS0", "ttyAMA0"];
//const priorityOfModemAutomaticConnection = ["ttyAMA0", "ttyS0"];

// Libraries
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const Preferences = require("preferences");
const winston = require("winston");
const axios = require("axios");

const WebSocket = require("ws");
const serialportgsm = require("serialport-gsm");
const ussd = require("./lib/serialport-gsm-ussd.js");

class GsmProxy {
    ws = null;

    constructor() {
        this.isRunning = true;
        this.ws = null;
        this.arrayOfPastTries = [];
        this.config = new Preferences(identifier);
        this.logger = this.#createLogger();
        this.logger.debug(`${name} Created`);
        this.handlers = this.#loadHandlers();
        this.gsmModem = this.#createModem();
    }

    // This is one of the main functions it is triggered, when modem has some event
    async onModemEvent(type, data) {
        this.#wsSend({ type: `m-${type}`, data: data });
    }

    // This is one of the main functions it is triggered, when user or cloud send some event to device
    async onCloudEvent(type, data) {
        if (!this.handlers[type]) {
            this.logger.error(`Handler missed for type '${type}'`);
            return;
        }
        this.handlers[type].handle(data);
    }

    #loadHandlers() {
        var result = {};
        try {
            const files = fs.readdirSync(path.join(__dirname, "handlers"));
            files.forEach((file) => {
                const classOfHanler = require(path.join(
                    __dirname,
                    "handlers",
                    file
                ));
                var coh = new classOfHanler(this);
                result[coh.name] = coh;
            });
        } catch (error) {
            this.logger.error(error);
        }
        this.logger.silly(JSON.stringify(Object.keys(result)));
        return result;
    }

    #createModem() {
        const self = this;
        var gsmModem = serialportgsm.Modem();
        ussd(gsmModem);

        gsmModem.on("open", () => {
            gsmModem.on("error", (data) => {
                self.logger.debug(`Modem - Error : ` + JSON.stringify(data));
            });

            gsmModem.on("close", (data) => {
                if (!this.isRunning) {
                    self.logger.debug(`Modem - Disconnected`);
                } else {
                    self.logger.debug(
                        `Modem - Disconnected : ` + JSON.stringify(data)
                    );
                    self.gsmModem = self.#createModem();
                    self.#connectModem();
                }
            });

            gsmModem.on("onNewIncomingCall", (result) => {
                self.onModemEvent("call", result.data);
            });

            gsmModem.on("onNewMessageIndicator", (result) => {
                self.onModemEvent("sms", result.data);
            });

            gsmModem.on("onNewIncomingUSSD", (result) => {
                self.onModemEvent("ussd", result.data);
            });
        });

        return gsmModem;
    }

    #createLogger() {
        const logFormat = winston.format.printf(function (info) {
            let date = new Date().toISOString();
            return `${date}-${info.level}: ${JSON.stringify(info.message, null, 4)}`;
        });
        return winston.createLogger({
            level: logLevel,
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        logFormat
                    ),
                }),
            ],
        });
    }

    pingDelay = 0;
    async #createPingLoop() {
        while (this.isRunning) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (this.pingDelay < 0) continue;
            this.pingDelay++;
            if (this.pingDelay >= pingInterval * 2) {
                this.pingDelay = 0;
                // TODO: need to test that packets are going
                this.ws.ping();
                this.logger.silly("Ping");
            }
        }
    }

    destruct() {
        this.isRunning = false;
        try {
            this.gsmModem.close(() => {
                this.ws.close();
            });
        } catch (e) {
            debugLog(e);
            this.ws.close();
        }
        //close everything here
    }

    #wsSend(obj, callback) {
        this.logger.debug(obj);
        try {
            this.ws.send(JSON.stringify(obj), callback);
        } catch (error) {
            this.logger.error(error);
        }
    }

    #wsReceive(obj) {
        try {
            if (!obj.type || !obj.data) {
                this.logger.silly(obj);
                return;
            }
            this.logger.debug(obj);
            this.onCloudEvent(obj.type, obj.data, obj.tag);
        } catch (error) {
            this.logger.error(error);
        }
        return;
        try {
            switch (message.type) {
                case "webRTCOffer":
                    handleOffer(message.offer);
                    break;
                case "ICECandidate":
                    handleCandidate(message.candidate);
                    break;
                case "cmd":
                    handleCommandExecution(message);
                    break;
                case "sms":
                    handleSMSExecution(message);
                    break;
                case "ussd":
                    handleUSSDExecution(message);
                    break;
                case "ping":
                    // Ignore and skip;
                    break;
                default:
                    debugLog("Unknown message type: " + message.type);
                    break;
            }
        } catch (e) {
            debugLog("ERROR: " + e + " when executing message.");
        }
    }

    #connectModem(callback) {
        const modemPath = this.#getModemPath();
        if (!modemPath) {
            this.logger.error(`No available modem found`);
            if (callback)
                callback(false);
            return;
        }
        const self = this;
        const objPart1 = self.config.device;
        const objPart2 = {
            logger: {
                debug: (text) => {
                    self.logger.silly(text);
                },
            },
        };
        const settings = Object.assign(modemSettings, objPart1, objPart2);
        self.logger.debug(`Modem connecting to '${modemPath}'...`);
        self.gsmModem.open(modemPath, settings, (error, result) => {
            if (error) {
                self.logger.debug(error);
                self.arrayOfPastTries.push(modemPath);
                self.#connectModem(callback);
            } else {
                self.gsmModem.executeCommand("AT", (result, err) => {
                    if ((err && Object.keys(err).length > 0)||(!result || result.status != 'success')) {
                        self.logger.debug(error);
                        self.arrayOfPastTries.push(modemPath);
                        self.#connectModem(callback);
                    } else {
                        self.arrayOfPastTries = [];
                        self.config.modemPath = modemPath;
                        self.config.save();
                        self.logger.debug(`Modem connected`);
                        self.logger.debug(`Modem initializing...`);
                        self.gsmModem.initializeModem(() => {
                            self.logger.debug(`Modem - Initialized`);
                        });
                        if (callback)
                            callback(true);
                    }
                });
            }
        });
    }

    #getModemPath() {
        if (!alwaysPerformModemSelection && (this.arrayOfPastTries.length == 0) && this.config.modemPath) {
            this.logger.silly('Read modem path from config: '+this.config.modemPath);
            return this.config.modemPath;
        }
        this.logger.silly('Guessing modem path...');
        const bestModem = this.#findBestDeviceForModem();
        if (!bestModem) return null;
        return "/dev/" + bestModem;
    }

    async setModemPath(modem) {
        const newModemPath = "/dev/" + modem;
        if (this.config.modemPath == newModemPath) return;
        this.config.modemPath = newModemPath;
        this.destruct();
    }

    async #configureModem() {
        const self = this;
        return new Promise((resolve, reject) => {
            self.#connectModem(() => resolve(true));
        });
    }

    async #configureWebSocket() {
        const self = this;
        return new Promise((resolve, reject) => {
            const url = self.config.wsServer;
            if (self.ws || !url) return;

            self.ws = new WebSocket(url);
            self.pingDelay = 0;

            const token = self.#getToken();

            self.ws.addEventListener("open", () => {
                self.logger.debug("Exchange Server - Connected");
                self.logger.debug("Exchange Server - Sending token...");
                self.#wsSend(
                    {
                        type: "token",
                        token: token,
                    },
                    () => {
                        self.logger.debug("Exchange Server - Token Sent");
                        resolve(true);
                    }
                );
            });

            self.ws.addEventListener("close", (code, reason) => {
                if (!self.isRunning) {
                    self.logger.debug("Exchange Server - Disconnected");
                    self.#webSocketDisposed();
                } else {
                    self.logger.debug(
                        "Exchange Server - Disconnected with code: " +
                            JSON.stringify(code) +
                            " - and reason - " +
                            JSON.stringify(reason)
                    );
                    self.ws = null;
                    self.pingDelay = -1;
                    self.#configureWebSocket();
                }
            });

            self.ws.addEventListener("ping", async (data) => {
                self.logger.debug(data);
            });

            self.ws.addEventListener("pong", async (data) => {
                self.logger.debug(data);
            });

            self.ws.addEventListener("message", async (event) => {
                var message = null;
                try {
                    message = JSON.parse(event.data);
                } catch (e) {
                    self.logger.error(
                        "ERROR: " +
                            e +
                            " when parsing message (" +
                            JSON.stringify(event) +
                            ")"
                    );
                    return;
                }
                self.#wsReceive(message);
            });
        });
    }

    #webSocketDisposed() {
        this.logger.debug("Bye!");
        process.exit(0);
    }

    #retrieveSysId() {
        if (!this.config.id) {
            this.logger.silly(`Retrieving system code from the sys params`);
            try {
                var stdout = execSync(
                    "grep Serial /proc/cpuinfo | awk '{ print $3 }' | tail -c 7"
                );
                this.config.id = stdout.toString().split("\n")[0];
            } catch (error) {
                this.logger.error(error);
            }
        }
        this.logger.debug(`System code is '${this.config.id}'`);
    }

    #findBestDeviceForModem() {
        var pastTries = {};
        this.arrayOfPastTries.forEach((pt) => {
            pastTries[pt.substring(5)] = true;
        });
        var modemsAvailable = [];
        this.modemsList.forEach((m) => {
            if (!pastTries[m]) {
                modemsAvailable.push(m);
            }
        });
        for (let i = 0; i < priorityOfModemAutomaticConnection.length; i++) {
            const pm = priorityOfModemAutomaticConnection[i];
            for (let k = 0; k < modemsAvailable.length; k++) {
                const m = modemsAvailable[k];
                if (pm == m) {
                    return m;
                }
            }
        }
        if (modemsAvailable.length > 0) return modemsAvailable[0];
        return null;
    }

    #retrieveModems() {
        this.modemsList = [];
        this.logger.silly(`Retrieving modems from the sys params`);
        try {
            var stdout = execSync("find /dev/ -group dialout");
            stdout
                .toString()
                .split("\n")
                .forEach((m) => {
                    if (m.length == 0) return;
                    this.modemsList.push(m.substring(5));
                });
        } catch (error) {
            this.logger.error(error);
        }
        this.logger.debug(`Modems available:`);
        this.logger.debug(this.modemsList);
    }

    async #retrieveTryDevicePrimaryConfig() {
        if (!alwaysPerformOnboarding && this.config.server && this.config.token)
            return;
        this.logger.debug(
            `Trying to request primary configuration with code ${this.config.id} from ${onboardingUrl}`
        );
        try {
            const response = await axios.post(onboardingUrl, {
                code: this.getId(),
            });
            if (response.status == 200) {
                this.config.server = response.data.server;
                this.config.token = response.data.token;
            } else {
                this.logger.info(
                    `Data of primary configuration with code ${this.config.id} not found`
                );
            }
        } catch (error) {
            this.logger.error("Error making POST request:", error);
        }
    }

    async #retrieveDeviceConfig() {
        if (!this.config.server || !this.config.token) {
            return;
        }
        const url = this.config.server + "/api/get-config";
        this.logger.debug(`Requesting device configuration ${url}`);
        try {
            const response = await axios.post(url, {
                token: this.config.token,
            });
            if (response.status == 200) {
                this.config.wsServer = response.data.wsServer;
                this.config.device = response.data.device;
            } else {
                this.logger.info(`Data of device configuration not found`);
            }
        } catch (error) {
            this.logger.error("Error making POST request:", error);
        }
    }

    log() {
        return this.logger;
    }

    async init() {
        this.#retrieveSysId();
        this.#retrieveModems();
        await this.#retrieveTryDevicePrimaryConfig();
        await this.#retrieveDeviceConfig();
        await this.#configureWebSocket();
        this.#createPingLoop();
        await this.#configureModem();
        this.logger.debug(`${name} Initialized`);
    }

    getModem() {
        return this.gsmModem;
    }

    getId() {
        if (!this.config.id) return "000000";
        return this.config.id;
    }

    #getToken() {
        if (!this.config.token) return "";
        return this.config.token;
    }
}

module.exports = GsmProxy;
