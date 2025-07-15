import * as filesystem from "filesystem";
import * as shell from "shell";
import * as pack from "pack";
import * as uuid from "uuid";

const [args, options] = shell.parse(...$vararg);

function printHelp() {
    print("Usage: pack [...OPTIONS] COMMAND [...ARGS]");
    print("-h, --help: print this help message");
    print("");
    print("Commands:");
    print("list");
    print("    List all available packages");
    print("installed");
    print("    Display information about installed packages");
    print("info PACKAGE");
    print("    Display information about PACKAGE");
    print("files PACKAGE");
    print("    Display a file listing for PACKAGE");
    print("show-uninstall PACKAGE");
    print("    Display the uninstall script for PACKAGE");
    print("uninstall PACKAGE");
    print("    Uninstall PACKAGE from the system");
    print("install PACKAGE");
    print("    install or update PACKAGE");
    print("check");
    print("    List available updates");
    print("upgrade");
    print("    Update all installed packages");
}

function getAvailableUpdates(installed: pack.PackfileData) {
    const packs: { pack: string; version: string }[] = [];
    for (const [pack, info] of pairs(installed)) {
        packs.push({
            pack: pack as string,
            version: info.version,
        });
    }
    return pack.checkUpdates(packs);
}

function install(p: string) {
    print("Downloading " + p + "...");
    const files = pack.getPackageFileInformation(p);
    const [file_id] = string.gsub(uuid.next(), "-", "");
    const tmp = "/tmp/" + file_id;
    for (const file of files) {
        const filename = filesystem.concat(tmp, file.name);
        const pages = math.ceil(file.size / 1024);

        filesystem.makeDirectory(filesystem.path(filename));
        const [f] = io.open(filename, "w");
        if (f == null) {
            throw "Failed to create " + file.name;
        }
        for (let page = 0; page < pages; page++) {
            const chunk = pack.getPackageChunk(p, file.name, page);
            f.write(chunk);
            print("    " + String((((page + 1) / pages) * 1000) / 10) + "%");
        }
        f.close();
    }

    print("Installing " + p + "...");
    shell.execute("install --from=/tmp --fromDir=/" + file_id + " --noreboot");
    print("Cleaning up...");
    filesystem.remove(tmp);
}

function main() {
    if (args.length < 1 || options.h || options.help) {
        printHelp();
        return;
    }

    const command = args[0];

    if (command == "list") {
        if (args.length !== 1) {
            throw "`pack list` takes no arguments";
        }
        const packages = pack.listAvailablePackages();
        for (const p of packages) {
            print(p);
        }
        return;
    }
    if (command == "installed") {
        if (args.length !== 1) {
            throw "`pack installed` takes no arguments";
        }
        const installed = pack.readPackfile();
        for (const [pack, info] of pairs(installed)) {
            print(pack + " version " + info.version);
        }
        return;
    }
    if (command == "info") {
        if (args.length !== 2) {
            throw "`pack info` requires exactly 1 argument";
        }
        const info = pack.getPackageInformation(args[1]);
        print(info.name);
        print("Version " + info.version);
        print(info.description);
        print("Setup instructions: " + info.setup);
        return;
    }
    if (command == "files") {
        if (args.length !== 2) {
            throw "`pack files` requires exactly 1 argument";
        }
        const file_info = pack.getPackageFileInformation(args[1]);
        for (const f of file_info) {
            print(f.name + " (" + String(f.size) + " bytes)");
        }
        return;
    }
    if (command == "show-uninstall") {
        if (args.length !== 2) {
            throw "`pack show-uninstall` requires exactly 1 argument";
        }
        const uninstall_script = pack.getUninstallScript(args[1]);
        print(uninstall_script);
        return;
    }
    if (command == "uninstall") {
        if (args.length !== 2) {
            throw "`pack uninstall` requires exactly 1 argument";
        }
        print("Fetching uninstall script...");
        const uninstall_script = pack.getUninstallScript(args[1]);
        print("Preparing uninstall...");
        const [file_id] = string.gsub(uuid.next(), "-", "");
        const filename = "/tmp/" + file_id + ".lua";
        const [uninstall_file] = io.open(filename, "w");
        if (uninstall_file == null) {
            throw "failed to create uninstall script";
        }
        uninstall_file.write(uninstall_script);
        uninstall_file.close();
        print("Running uninstall...");
        shell.execute(filename);
        print("Cleaning up...");
        pack.removePackageRecord(args[1]);
        print("Done!");
        return;
    }
    if (command == "install") {
        if (args.length !== 2) {
            throw "`pack install` requires exactly 1 argument";
        }
        install(args[1]);
        return;
    }
    if (command == "check") {
        if (args.length !== 1) {
            throw "`pack check` takes no arguments";
        }
        const installed = pack.readPackfile();
        const updates = getAvailableUpdates(installed);
        for (const update of updates) {
            print(
                update.pack +
                    " " +
                    (installed[update.pack] || { version: "??" }).version +
                    " => " +
                    update.version
            );
        }
        return;
    }
    if (command == "upgrade") {
        if (args.length !== 1) {
            throw "`pack upgrade` takes no arguments";
        }
        const installed = pack.readPackfile();
        const updates = getAvailableUpdates(installed);
        for (const info of updates) {
            install(info.pack);
        }
        return;
    }

    throw "Unrecognized command '" + command + "'";
}

main();
