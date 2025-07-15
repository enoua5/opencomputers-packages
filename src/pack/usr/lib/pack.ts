/** Library for programatic package management */

import * as lttp from "lttp";
import * as serialization from "serialization";
import * as dns from "dns";

const CONFIG_FILE = "/etc/pack_client.cfg";
const [config_file] = io.open(CONFIG_FILE, "r");
let config: { [key: string]: unknown | undefined } = {};
if (config_file) {
    const config_data = config_file.read("*a");
    config_file.close();
    if (config_data) {
        config = serialization.unserialize(config_data);
    }
}

const PACKFILE = "/etc/packfile";
type PackfileData = {
    [pack: string]: {
        version: string;
    } | null;
};

function writePackfile(data: PackfileData) {
    const [packfile] = io.open(PACKFILE, "w");
    if (packfile == null) {
        throw "Filed to update packfile";
    }
    packfile.write(serialization.serialize(data));
}

/** Read information about installed packages */
export function readPackfile(): PackfileData {
    const [packfile] = io.open(PACKFILE, "r");
    if (packfile == null) {
        const [packfile_write] = io.open(PACKFILE, "w");
        if (packfile_write == null) {
            throw "Filed to create packfile";
        }
        packfile_write.write("{}");
        packfile_write.close();
        return {};
    }
    const content = packfile.read("*a");
    if (content == null) {
        throw "Filed to read packfile";
    }
    return serialization.unserialize(content);
}

/** Set the package information listed in the packfile */
export function setInstalledPackageInformation(
    pack: string,
    info: PackfileData[string]
): void {
    const data = readPackfile();
    data[pack] = info;
    writePackfile(data);
}

/** Remove the package form the installed package list */
export function removePackageRecord(pack: string): void {
    const data = readPackfile();
    data[pack] = null;
    writePackfile(data);
}

/** Get the server domain from config */
function getServerPort(): number {
    const server_port = config["server_port"] || 8530;
    if (typeof server_port != "number") {
        throw "Configuration error - `server_port` must be a number";
    }
    return server_port;
}

/** Get the server domain from config */
function getServerDomain(): string {
    const server_address = config["server_address"] || "packages";
    if (typeof server_address != "string") {
        throw "Configuration error - `server_address` must be a string";
    }
    return server_address;
}

let resolved_server_address: string | null = null;

/** Resolve the server address, potentially from cache */
function getServerAddress(): string {
    if (!resolved_server_address) {
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
        "/list"
    );
    if (status >= 300) {
        throw (
            "Failed to list available packages, error " + status + " returned."
        );
    }
    if (!body) {
        throw "Failed to list available packages, no data returned";
    }
    const data = serialization.unserialize(body);
    return data;
}

/** Fetch file information for a package */
export function getPackageFileInformation(
    pack: string
): { name: string; size: number }[] {
    const [status, headers, body] = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/list/" + pack
    );
    if (status >= 300) {
        throw "Failed to fetch file list, error " + status + " returned.";
    }
    if (!body) {
        throw "Failed to fetch file list, no data returned";
    }
    const data = serialization.unserialize(body);
    return data;
}

/** Get information about a package */
export function getPackageInformation(pack: string): {
    version: string;
    name: string;
    description: string;
    setup: string;
} {
    const [status, headers, body] = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/info/" + pack
    );
    if (status >= 300) {
        throw "Failed to fetch package info, error " + status + " returned.";
    }
    if (!body) {
        throw "Failed to fetch package info, no data returned";
    }
    const data = serialization.unserialize(body);
    return data;
}

/** Fetch uninstall script */
export function getUninstallScript(pack: string): string {
    const [status, headers, body] = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/remove/" + pack
    );
    if (status >= 300) {
        throw (
            "Failed to fetch uninstall script, error " + status + " returned."
        );
    }
    if (!body) {
        throw "Failed to fetch uninstall script, no data returned";
    }
    return body;
}

/** Fetch a chunk from a package directory */
export function getPackageChunk(
    pack: string,
    file: string,
    page: number = 0
): string {
    const [status, headers, body] = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/download/" + pack + "/" + String(page),
        {},
        file
    );
    if (status >= 300) {
        throw "Failed to fetch chunk, error " + status + " returned.";
    }
    if (!body) {
        throw "Failed to fetch chunk, no data returned";
    }
    return body;
}

/** Fetch a list of packages that have updates available */
export function checkUpdates(
    packages_to_check: {
        pack: string;
        version: string;
    }[]
): {
    pack: string;
    version: string;
}[] {
    const [status, headers, body] = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/updates",
        {},
        serialization.serialize(packages_to_check)
    );
    if (status >= 300) {
        throw "Failed to check for updates, error " + status + " returned.";
    }
    if (!body) {
        throw "Failed to check for updates, no data returned";
    }
    const data = serialization.unserialize(body);
    return data;
}
