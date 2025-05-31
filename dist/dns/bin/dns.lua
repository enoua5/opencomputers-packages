local ____exports = {}
local shell = require("shell")
local dns = require("dns")
local args, options = shell.parse(...)
local function printHelp()
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
end
local function main()
    if #args < 1 or options.h or options.help then
        printHelp()
        return
    end
    local command = args[1]
    if command == "setup" then
        local timeout = tonumber(options.timeout) or 5
        print("Searching for DNS servers...")
        local servers = dns.searchServers(timeout)
        if #servers == 0 then
            print("No servers found")
            return
        end
        print("Select a server to use:")
        do
            local i = 1
            while i <= #servers do
                print((("[" .. tostring(i)) .. "] ") .. servers[i])
                i = i + 1
            end
        end
        print("[X] Abort")
        local response = tonumber(io.read())
        if response == nil then
            print("Aborting.")
            return
        end
        local selected_server = servers[response]
        if selected_server == nil then
            print("Aborting.")
            return
        end
        dns.setServerAddress(selected_server)
        print("Set DNS server address to " .. selected_server)
        return
    end
    if command == "server" then
        if #args ~= 1 then
            error("`dns server` takes no arguments", 0)
        end
        print(dns.getServerAddress())
        return
    end
    if command == "set-server" then
        if #args ~= 2 then
            error("`dns set-server` requires exactly 1 argument", 0)
        end
        dns.setServerAddress(args[2])
        print("Set DNS server address to " .. args[2])
        return
    end
    if command == "register" then
        if #args ~= 2 then
            error("`dns register` requires exactly 1 argument", 0)
        end
        do
            local function ____catch(e)
                print((("Failed to register domain " .. args[2]) .. ": ") .. tostring(e))
            end
            local ____try, ____hasReturned = pcall(function()
                local ok, status = dns.register(args[2])
                if not ok then
                    if status == 409 then
                        error("Domain already registered", 0)
                    end
                    error(
                        "DNS server responded with status " .. tostring(status),
                        0
                    )
                end
                print("Registered domain " .. args[2])
            end)
            if not ____try then
                ____catch(____hasReturned)
            end
        end
        return
    end
    if command == "unregister" then
        if #args ~= 2 then
            error("`dns unregister` requires exactly 1 argument", 0)
        end
        do
            local function ____catch(e)
                print((("Failed to unregister domain " .. args[2]) .. ": ") .. tostring(e))
            end
            local ____try, ____hasReturned = pcall(function()
                local ok, status = dns.unregister(args[2])
                if not ok then
                    if status == 404 then
                        error("Domain not registered", 0)
                    end
                    if status == 403 then
                        error("Domain belongs to another address", 0)
                    end
                    error(
                        "DNS server responded with status " .. tostring(status),
                        0
                    )
                end
                print("Unregistered domain " .. args[2])
            end)
            if not ____try then
                ____catch(____hasReturned)
            end
        end
        return
    end
    if command == "resolve" then
        if #args ~= 2 then
            error("`dns resolve` requires exactly 1 argument", 0)
        end
        do
            local function ____catch(e)
                print((("Failed to resolve domain " .. args[2]) .. ": ") .. tostring(e))
            end
            local ____try, ____hasReturned = pcall(function()
                local address = dns.resolve(args[2])
                print(address)
            end)
            if not ____try then
                ____catch(____hasReturned)
            end
        end
        return
    end
    error(("Unrecognized command '" .. command) .. "'", 0)
end
main()
return ____exports
