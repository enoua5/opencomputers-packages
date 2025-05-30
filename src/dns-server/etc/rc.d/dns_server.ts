
import * as network from "network";
import * as event from "event";
import * as component from "component";
import * as lttp from "lttp";
import { serialize, unserialize } from "serialization";

const DNS_PORT = 53;
const DNS_AD_PORT = 54;
const DNS_AD_RESPONSE_PORT = 55;

const ad = {
    handle(this: void, name: string, receiverAddress: string, senderAddress: string, port: number, distance: number, ...payload: unknown[]) {
        if(port === DNS_AD_PORT && payload.length > 0 && payload[0] == "dns-search") {
            component.modem.send(senderAddress, DNS_AD_RESPONSE_PORT, "dns-ad");
        }
    },
    start() {
        event.listen("modem_message", this.handle);
        component.modem.open(DNS_AD_PORT);
    },
    stop() {
        component.modem.close(DNS_AD_PORT);
        event.ignore("modem_message", this.handle);
    },
}

let names: { [key: string]: string | undefined } = {};

const dns: {
    handleRequest: LttpRequestCallback;
    start: () => void;
    stop: () => void;
} = {
    handleRequest(
        this: void,
        channel: Channel,
        address: Address,
        port: Port,
        method: Method,
        path: Path,
        headers: Headers,
        body: Body,
        respond: LttpResponseHandler
    ) {
        const resource = string.sub(path, 2);

        if(resource == "") {
            respond(422);
            return;
        }

        if(method === "POST") {
            if(names[resource] != null) {
                respond(409);
                return;
            }
            else{
                names[resource] = address;
                respond(200);
                return;
            }
        }
        else if(method === "DELETE") {
            if(names[resource] == null) {
                respond(404);
                return;
            }
            else if(names[resource] === address) {
                names[resource] = undefined;
                respond(200);
                return;
            }
            else {
                respond(403);
                return;
            }
        }
        else if(method === "GET") {
            if(names[resource] != null) {
                respond(200, {}, names[resource]);
                return;
            }
            else {
                respond(404);
                return;
            }
        }
        else {
            respond(405);
            return;
        }
    },
    start() {
        lttp.listen(DNS_PORT, dns.handleRequest);
    },
    stop() {
        lttp.unlisten(DNS_PORT);
    },
}

function save() {
    const [file] = io.open("/etc/dns-names", "w");
    if(file != null) {
        file.write(serialize(names));
        file.close();
    }
}

function load() {
    const [file] = io.open("/etc/dns-names", "r");
    if(file != null) {
        const data = file.read();
        if(data != null) {
            const value = unserialize(data);
            if(typeof value == "object" && value != null) {
                names = value;
            }
        }
    }
}

let save_loop: number | undefined = undefined;

start = () => {
    ad.start();
    dns.start();
    load();
    save_loop = event.timer(5, save, Infinity);
}

stop = () => {
    ad.stop();
    dns.stop();
    if(save_loop != null) {
        event.cancel(save_loop);
    }
}

