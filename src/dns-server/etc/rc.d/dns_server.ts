
import * as network from "network";
import * as event from "event";
import * as component from "component";
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

type Channel = number;
type Address = string;
type Port = number;
type TcpOpenArgs = ["connection", Channel, Address, Port];
type TcpCloseArgs = ["close", Channel, Address, Port];
type TcpMessageArgs = ["message", Channel, string, Address, Port];
type TcpEventArgs = TcpOpenArgs | TcpCloseArgs | TcpMessageArgs;

let names: { [key: string]: string | undefined } = {};

const dns = {
    timeouts: {} as { [key: Channel]: number | null },

    handleConnection(this: void, channel: Channel, address: Address, port: Port) {
        dns.timeouts[channel] = event.timer(5, () => network.tcp.close(channel));
    },
    handleClose(this: void, channel: Channel, address: Address, port: Port) {
        if(dns.timeouts[channel] != null) {
            event.cancel(dns.timeouts[channel]);
            dns.timeouts[channel] = null;
        }
    },
    handleMessage(this: void, channel: Channel, message: string, address: Address, port: Port) {
        const request: string[] = [];
        for(const [part] of string.gmatch(message, "[^%s]+")) {
            request.push(part);
        }

        const command = request[0];

        if(command === "register") {
            const name = request[1];
            if(name == null) {
                network.tcp.send(channel, "invalid");
            }
            else if(names[name] != null) {
                network.tcp.send(channel, "taken");
            }
            else{
                names[name] = address;
                network.tcp.send(channel, "granted");
            }
        }
        else if(command === "unregister") {
            const name = request[1];
            if(name && names[name] === address) {
                names[name] = undefined;
                network.tcp.send(channel, "ok");
            }
            else {
                network.tcp.send(channel, "unknown");
            }
        }
        else if(command == "resolve") {
            const name = request[1];
            if(name == null) {
                network.tcp.send(channel, "invalid");
            }
            else if(names[name] != null) {
                network.tcp.send(channel, "address " + names[name]);
            }
            else {
                network.tcp.send(channel, "unknown");
            }
        }
        else {
            network.tcp.send(channel, "invalid");
        }

        network.tcp.close(channel);
    },
    handle(this: void, name: string, ...args: [...TcpEventArgs]) {
        const [method, channel] = args;
        if(method === "connection") {
            dns.handleConnection(channel, args[2], args[3]);
        }
        else if(method === "close") {
            dns.handleClose(channel, args[2], args[3]);
        }
        else if(method === "message") {
            dns.handleMessage(channel, args[2], args[3], args[4]);
        }
    },
    start() {
        event.listen<TcpEventArgs>("tcp", this.handle);
        network.tcp.listen(DNS_PORT);
    },
    stop() {
        network.tcp.unlisten(DNS_PORT);
        event.ignore("tcp", this.handle);
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

