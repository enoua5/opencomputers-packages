/** Library for programatic package management */

import * as filesystem from "filesystem";
import * as lttp from "lttp";
import * as serialization from "serialization";
import * as dns from "dns";

const CONFIG_FILE = "/etc/pack_client.cfg"
const [config_file] = io.open(CONFIG_FILE, "r");
let config: { [key: string]: unknown | undefined } = {};
if(config_file) {
    const config_data = config_file.read("*a");
    config_file.close();
    if(config_data) {
        config = serialization.unserialize(config_data);
    }
}

/** Get the server domain from config */
function getServerPort(): number {
    const server_port = config["server_port"] || 8530;
    if(typeof server_port != "number") {
        throw "Configuration error - `server_port` must be a number"
    }
    return server_port;
}

/** Get the server domain from config */
function getServerDomain(): string {
    const server_address = config["server_address"] || "packages";
    if(typeof server_address != "string") {
        throw "Configuration error - `server_address` must be a string"
    }
    return server_address;
}

let resolved_server_address: string | null = null;

/** Resolve the server address, potentially from cache */
function getServerAddress(): string {
    if(!resolved_server_address) {
        const domain = getServerDomain();
        resolved_server_address = dns.resolve(domain);
    }
    return resolved_server_address;
}

/** Fetch a list of packages available on the packages server */
export function listAvailablePackages(): string[] {
    const [status, headers, body] = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/list",
    );
    if(status >= 300) {
        throw "Failed to list available packages, error " + status + " returned.";
    }
    if(!body) {
        throw "Failed to list available packages, no data returned";
    }
    const data = serialization.unserialize(body);
    return data;
}
