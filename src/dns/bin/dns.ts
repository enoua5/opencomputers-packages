
import * as shell from "shell";
import * as dns from "dns";

const [args, options] = shell.parse(...$vararg);

function printHelp() {
    print("Usage: dns [...OPTIONS] COMMAND [...ARGS]")
    print("-h, --help: print this help message")
    print("")
    print("Commands:")
    print("setup [--timeout=N]")
    print("    Search for active DNS servers and provide an option to select one.")
    print("server")
    print("    Print the current server address")
    print("set-server ADDRESS")
    print("    Set the server address to ADDRESS")
    print("register DOMAIN")
    print("    Register your modem under DOMAIN")
    print("unregister DOMAIN")
    print("    Release your registration of DOMAIN")
    print("resolve DOMAIN")
    print("    Print the network address of DOMAIN")
}


function main() {
    if(args.length < 1 || options.h || options.help) {
        printHelp();
        return;
    }

    const command = args[0];

    if(command == "setup") {
        const timeout = tonumber(options.timeout) || 5;
        print("Searching for DNS servers...")
        const servers = dns.searchServers(timeout);
        if(servers.length === 0) {
            print("No servers found");
            return;
        }
        print("Select a server to use:");
        for(let i= 1; i <= servers.length; i++) {
            print("[" + i + "] " + servers[i - 1]);
        }
        print("[X] Abort");
        const response = tonumber(io.read());
        if(response == null) {
            print("Aborting.");
            return;
        }
        const selected_server = servers[response - 1];
        if(selected_server == null) {
            print("Aborting.");
            return;
        }
        dns.setServerAddress(selected_server);
        print("Set DNS server address to " + selected_server);
        return;

    }

    if(command == "server") {
        if(args.length !== 1) {
            throw "`dns server` takes no arguments";
        }
        print(dns.getServerAddress());
        return;
    }

    if(command == "set-server") {
        if(args.length !== 2) {
            throw "`dns set-server` requires exactly 1 argument";
        }
        dns.setServerAddress(args[1]);
        print("Set DNS server address to " + args[1]);
        return;
    }

    if(command == "register") {
        if(args.length !== 2) {
            throw "`dns register` requires exactly 1 argument";
        }
        try {
            dns.register(args[1]);
            print("Registered domain " + args[1]);
        }
        catch(e) {
            print("Failed to register domain " + args[1] + ": " + e);
        }
        return;
    }
    if(command == "unregister") {
        if(args.length !== 2) {
            throw "`dns unregister` requires exactly 1 argument";
        }
        try {
            dns.register(args[1]);
            print("Unregistered domain " + args[1]);
        }
        catch(e) {
            print("Failed to unregister domain " + args[1] + ": " + e);
        }
        return;
    }
    if(command == "resolve") {
        if(args.length !== 2) {
            throw "`dns resolve` requires exactly 1 argument";
        }
        try {
            const address = dns.resolve(args[1]);
            print(address);
        }
        catch(e) {
            print("Failed to resolve domain " + args[1] + ": " + e);
        }
        return;
    }


    throw "Unrecognized command '" + command + "'";
}

main();
