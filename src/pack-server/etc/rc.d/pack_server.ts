import * as lttp from "lttp";
import * as filesystem from "filesystem";
import * as serialization from "serialization";

const PACK_PORT = 8530;

/**
 *
 * Fetch all files in the specified directory, recursively
 *
 * @param path - The directory to list
 * @returns An array of paths, each represented as an array of path components
 */
function recursiveDirectoryList(path: string): string[][] {
    const [listing] = filesystem.list(path);
    if (listing == null) {
        return [];
    }
    const files: string[][] = [];
    for (const file of listing) {
        if (string.sub(file, -1) == "/") {
            // directory, we need to recurse
            const segment = string.sub(file, 1, -2);
            const sublisting = recursiveDirectoryList(
                filesystem.concat(path, segment)
            );
            // we need to report segment/subpath for each
            for (const subpath of sublisting) {
                files.push([segment, ...subpath]);
            }
        } else {
            // not a directory, don't recurse
            files.push([file]);
        }
    }
    return files;
}

/**
 * Respond with a list of available packages
 *
 * @param respond The response handler
 */
function handleDirectoryRequest(respond: LttpResponseHandler) {
    const packages = [];
    // for everything in the packages directory
    const [listing] = filesystem.list("/packages");
    if (listing == null) {
        respond(500);
        return;
    }
    for (const pack of listing) {
        // directories are reported with an ending /
        // only directories are packages
        if (string.sub(pack, -1) == "/") {
            // slice off the slash before saving
            packages.push(string.sub(pack, 1, -2));
        }
    }
    respond(200, {}, serialization.serialize(packages));
}

/**
 * Fetch the information file for the package
 */
function getInformationFile(
    pack: string
):
    | { ok: false; error: number; content?: never }
    | { ok: true; content: string; error?: never } {
    const directory = filesystem.concat("/packages", pack);
    const segments = filesystem.segments(directory);

    if (segments[0] != "packages" || segments[1] != pack) {
        return { ok: false, error: 403 };
    }

    const cfg_path = filesystem.concat(directory, "info.cfg");
    const [cfg_file] = io.open(cfg_path, "r");
    if (cfg_file == null) {
        return { ok: false, error: 404 };
    }
    const content = cfg_file.read("*a");
    cfg_file.close();
    if (content == null) {
        return { ok: false, error: 404 };
    }
    return { ok: true, content };
}

/**
 * Respond with information about the requested package
 *
 * @param pack The package to respond with info about
 * @param respond The response handler
 */
function handleInfoRequest(pack: string, respond: LttpResponseHandler) {
    const data = getInformationFile(pack);
    if (!data.ok) {
        respond(data.error);
        return;
    }
    respond(200, {}, data.content);
}

/**
 * Handle a respond for a list of files in a package
 *
 * @param pack The package to list
 * @param respond The response handler
 */
function handleListPackageRequest(pack: string, respond: LttpResponseHandler) {
    const directory = filesystem.concat("/packages", pack);
    const segments = filesystem.segments(directory);

    if (segments[0] != "packages" || segments[1] != pack) {
        respond(403);
        return;
    }

    const listing = recursiveDirectoryList(
        filesystem.concat(directory, "install")
    );
    const report: { name: string; size: number }[] = [];
    for (const entry of listing) {
        const reported_path = filesystem.concat(...entry);
        const full_path = filesystem.concat(
            directory,
            "install",
            reported_path
        );
        const file_size = filesystem.size(full_path);
        report.push({
            name: reported_path,
            size: file_size,
        });
    }
    respond(200, {}, serialization.serialize(report));
}

/**
 * Respond with the uninstall script for the package
 *
 * @param pack The package to retreive the script for
 * @param respond The response handler
 */
function handleUninstallScriptRequest(
    pack: string,
    respond: LttpResponseHandler
) {
    const directory = filesystem.concat("/packages", pack);
    const segments = filesystem.segments(directory);

    if (segments[0] != "packages" || segments[1] != pack) {
        respond(403);
        return;
    }

    const script_path = filesystem.concat(directory, "uninstall.lua");
    const [script_file] = io.open(script_path, "r");
    if (script_file == null) {
        respond(404);
        return;
    }
    const content = script_file.read("*a");
    script_file.close();
    if (content == null) {
        respond(404);
        return;
    }
    respond(200, {}, content);
}

/**
 * Compare two semver-style strings. Return 1 if a is greater, -1 if b is greater, or 0 if they are equal
 */
function compareVersion(a: string, b: string) {
    const a_parts: string[] = [];
    const b_parts: string[] = [];
    for (const [part] of string.gmatch(a, "%d+")) {
        a_parts.push(part);
    }
    for (const [part] of string.gmatch(b, "%d+")) {
        b_parts.push(part);
    }

    for (let i = 1; i <= a_parts.length && i <= b_parts.length; i++) {
        const a_part = tonumber(a_parts[i - 1]) || 0;
        const b_part = tonumber(b_parts[i - 1]) || 0;
        if (a_part > b_part) {
            return 1;
        } else if (b_part > a_part) {
            return -1;
        }
    }
    return 0;
}

/**
 * Respond with a list of packages for which updates are available
 *
 * @param packages The list of packages and versions to check
 * @param respond The response handler
 */
function handleFetchUpdatesRequest(
    packages: { pack: string; version: string }[],
    respond: LttpResponseHandler
) {
    const updates: { pack: string; version: string }[] = [];
    for (const pack of packages) {
        const info_file = getInformationFile(pack.pack);
        if (info_file.ok) {
            const info = serialization.unserialize(info_file.content);
            if (info != null) {
                const version = info.version;
                if (
                    typeof version == "string" &&
                    typeof pack.version == "string"
                ) {
                    if (compareVersion(version, pack.version) > 0) {
                        updates.push({ pack: pack.pack, version: version });
                    }
                }
            }
        }
    }
    respond(200, {}, serialization.serialize(updates));
}

/**
 * Return file content for download
 *
 * @param pack The package the file belongs to
 * @param path The file within the package to install
 * @param page The offset within the file to fetch. Returns 1kb from page * 1kb
 * @param respond The response handler
 */
function handledownloadRequest(
    pack: string,
    path: string,
    page: number,
    respond: LttpResponseHandler
) {
    const directory = filesystem.concat("/packages", pack);
    const full_path = filesystem.concat(directory, "install", path);
    const segments = filesystem.segments(full_path);
    if (
        segments[0] != "packages" ||
        segments[1] != pack ||
        segments[2] != "install"
    ) {
        respond(403);
        return;
    }
    const [file] = io.open(full_path, "r");
    if (file == null) {
        respond(404);
        return;
    }
    file.seek("set", 1024 * page);
    const content = file.read(1024) ?? "";
    file.close();
    respond(200, {}, content);
}

start = () => {
    lttp.listen(
        PACK_PORT,
        (channel, address, port, method, path, headers, body, respond) => {
            const segments = filesystem.segments(path);
            if (method == "GET" && segments[0] == "list") {
                if (segments[1] != undefined) {
                    handleListPackageRequest(segments[1], respond);
                } else {
                    handleDirectoryRequest(respond);
                }
            } else if (method == "GET" && segments[0] == "info") {
                if (segments[1] != undefined) {
                    handleInfoRequest(segments[1], respond);
                } else {
                    respond(400);
                }
            } else if (method == "GET" && segments[0] == "remove") {
                if (segments[1] != undefined) {
                    handleUninstallScriptRequest(segments[1], respond);
                } else {
                    respond(400);
                }
            } else if (method == "GET" && segments[0] == "download") {
                if (segments[1] != undefined && body != null) {
                    const page = tonumber(segments[2]) ?? 0;
                    handledownloadRequest(segments[1], body, page, respond);
                } else {
                    respond(400);
                }
            } else if (method == "GET" && segments[0] == "updates") {
                if (body != null) {
                    const request = serialization.unserialize(body);
                    handleFetchUpdatesRequest(request, respond);
                } else {
                    respond(400);
                }
            } else {
                respond(405);
            }
        }
    );
};

stop = () => {
    lttp.unlisten(PACK_PORT);
};
