/** Library for interactive with DNS */

import * as filesystem from "filesystem";
import * as component from "component";
import * as event from "event";
import * as network from "network";
import * as uuid from "uuid";

const DNS_ADDRESS_FILE = "/etc/dns.address";
const DNS_PORT = 53;
const DNS_AD_PORT = 54;
const DNS_AD_RESPONSE_PORT = 55;

/** Return the set address for DNS, or throw an error if not set */
export function getServerAddress(): string {
    if(!filesystem.exists(DNS_ADDRESS_FILE)) {
        throw "Address of DNS server not set. Please run `dns set-server NETWORK_ADDRESS`.";
    }
    const [file] = io.open(DNS_ADDRESS_FILE, "r");
    if(file == null) {
        throw "Failed to read " + DNS_ADDRESS_FILE;
    }
    const file_length = filesystem.size(DNS_ADDRESS_FILE);
    const file_data = file.read(file_length);
    if(file_data == null || file_data === "") {
        throw "Failed to read " + DNS_ADDRESS_FILE;
    }
    file.close();
    const stripped = string.gsub(file_data, "[%s\n]+", "");
    return stripped[0];
}

/** Set the DNS server address */
export function setServerAddress(address: string): void {
    const [file] = io.open(DNS_ADDRESS_FILE, "w");
    if(file == null) {
        throw "Failed to write to " + DNS_ADDRESS_FILE;
    }
    file.write(address);
    file.close();
}

/**
 * Search for DNS servers for `timeout` seconds, and return the list
 * 
 * WARNING: This method is not "thread safe". It will open and close port 55
 */
export function searchServers(timeout: number = 5): string[] {
    component.modem.open(DNS_AD_RESPONSE_PORT)
    const servers_found: { [key: string]: boolean } = {};
    const handleDnsAd: event.EventHandler<OC.EventMap["modem_message"]> = (
        name: string,
        receiverAddress: string,
        senderAddress: string,
        port: number,
        distance: number,
        ...payload: OC.Components.ModemData[]
    ) => {
        if(port == DNS_AD_RESPONSE_PORT && payload.length > 0 && payload[0] == "dns-ad") {
            servers_found[senderAddress] = true;
        }
    };
    event.listen("modem_message", handleDnsAd);
    component.modem.broadcast(DNS_AD_PORT, "dns-search");
    os.sleep(timeout);
    component.modem.close(DNS_AD_RESPONSE_PORT);
    event.ignore("modem_message", handleDnsAd);
    const server_list: string[] = []
    for(const [k, v] of pairs(servers_found)) {
        server_list.push(k as string);
    }
    return server_list;
}

type Channel = number;
type Address = string;
type Port = number;
type TcpOpenArgs = ["connection", Channel, Address, Port];
type TcpCloseArgs = ["close", Channel, Address, Port];
type TcpMessageArgs = ["message", Channel, string, Address, Port];
type TcpEventArgs = TcpOpenArgs | TcpCloseArgs | TcpMessageArgs;

export function register(name: string, timeout: number = 5) {
    const server_address = getServerAddress();
    const channel = network.tcp.open(server_address, DNS_PORT);

    const request_id = uuid.next();
    let open = true;
    let status: string | null = null;

    const handleResponse: event.EventHandler<TcpEventArgs> = (name: string, ...args) => {
        const [event_type, on_channel] = args;
        if(on_channel === channel) {
            if(event_type === "close") {
                open = false;
                event.push(request_id);
            }
            else if(event_type === "message") {
                const message = args[2];
                status = message;
                event.push(request_id);
            }
        }
    };

    event.listen("tcp", handleResponse);
    network.tcp.send(channel, "register " + name);
    event.pull(timeout, request_id);
    event.ignore("tcp", handleResponse);
    if(open) {
        network.tcp.close(channel);
    }

    if(status === "granted") {
        return true;
    }
    throw status || "timeout";
}

export function unregister(name: string, timeout: number = 5) {
    const server_address = getServerAddress();
    const channel = network.tcp.open(server_address, DNS_PORT);

    const request_id = uuid.next();
    let open = true;
    let status: string | null = null;

    const handleResponse: event.EventHandler<TcpEventArgs> = (name: string, ...args) => {
        const [event_type, on_channel] = args;
        if(on_channel === channel) {
            if(event_type === "close") {
                open = false;
                event.push(request_id);
            }
            else if(event_type === "message") {
                const message = args[2];
                status = message;
                event.push(request_id);
            }
        }
    };

    event.listen("tcp", handleResponse);
    network.tcp.send(channel, "unregister " + name);
    event.pull(timeout, request_id);
    event.ignore("tcp", handleResponse);
    if(open) {
        network.tcp.close(channel);
    }

    if(status === "ok") {
        return true;
    }
    throw status || "timeout";
}

export function resolve(name: string, timeout: number = 5) {
    const server_address = getServerAddress();
    const channel = network.tcp.open(server_address, DNS_PORT);

    const request_id = uuid.next();
    let open = true;
    let status: string | null = null;

    const handleResponse: event.EventHandler<TcpEventArgs> = (name: string, ...args) => {
        const [event_type, on_channel] = args;
        if(on_channel === channel) {
            if(event_type === "close") {
                open = false;
                event.push(request_id);
            }
            else if(event_type === "message") {
                const message = args[2];
                status = message;
                event.push(request_id);
            }
        }
    };

    event.listen("tcp", handleResponse);
    network.tcp.send(channel, "resolve " + name);
    event.pull(timeout, request_id);
    event.ignore("tcp", handleResponse);
    if(open) {
        network.tcp.close(channel);
    }

    if(status != null && string.gmatch(status, "^address ")) {
        const [address] = string.gsub(status as string, "^address ", "");
        return address;
    }
    throw status || "timeout";
}
