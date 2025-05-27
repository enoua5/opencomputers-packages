local ____exports = {}
local filesystem = require("filesystem")
local component = require("component")
local event = require("event")
local network = require("network")
local uuid = require("uuid")
local DNS_ADDRESS_FILE = "/etc/dns.address"
local DNS_PORT = 53
local DNS_AD_PORT = 54
local DNS_AD_RESPONSE_PORT = 55
--- Return the set address for DNS, or throw an error if not set
function ____exports.getServerAddress()
    if not filesystem.exists(DNS_ADDRESS_FILE) then
        error("Address of DNS server not set. Please run `dns set-server NETWORK_ADDRESS`.", 0)
    end
    local file = io.open(DNS_ADDRESS_FILE, "r")
    if file == nil then
        error("Failed to read " .. DNS_ADDRESS_FILE, 0)
    end
    local file_length = filesystem.size(DNS_ADDRESS_FILE)
    local file_data = file:read(file_length)
    if file_data == nil or file_data == "" then
        error("Failed to read " .. DNS_ADDRESS_FILE, 0)
    end
    file:close()
    local stripped = {string.gsub(file_data, "[%s\n]+", "")}
    return stripped[1]
end
--- Set the DNS server address
function ____exports.setServerAddress(address)
    local file = io.open(DNS_ADDRESS_FILE, "w")
    if file == nil then
        error("Failed to write to " .. DNS_ADDRESS_FILE, 0)
    end
    file:write(address)
    file:close()
end
--- Search for DNS servers for `timeout` seconds, and return the list
-- 
-- WARNING: This method is not "thread safe". It will open and close port 55
function ____exports.searchServers(timeout)
    if timeout == nil then
        timeout = 5
    end
    component.modem.open(DNS_AD_RESPONSE_PORT)
    local servers_found = {}
    local function handleDnsAd(name, receiverAddress, senderAddress, port, distance, ...)
        local payload = {...}
        if port == DNS_AD_RESPONSE_PORT and #payload > 0 and payload[1] == "dns-ad" then
            servers_found[senderAddress] = true
        end
    end
    event.listen("modem_message", handleDnsAd)
    component.modem.broadcast(DNS_AD_PORT, "dns-search")
    os.sleep(timeout)
    component.modem.close(DNS_AD_RESPONSE_PORT)
    event.ignore("modem_message", handleDnsAd)
    local server_list = {}
    for k, v in pairs(servers_found) do
        server_list[#server_list + 1] = k
    end
    return server_list
end
function ____exports.register(name, timeout)
    if timeout == nil then
        timeout = 5
    end
    local server_address = ____exports.getServerAddress()
    local channel = network.tcp.open(server_address, DNS_PORT)
    local request_id = uuid.next()
    local open = true
    local status = nil
    local function handleResponse(name, ...)
        local args = {...}
        local event_type, on_channel = table.unpack(args)
        if on_channel == channel then
            if event_type == "close" then
                open = false
                event.push(request_id)
            elseif event_type == "message" then
                local message = args[3]
                status = message
                event.push(request_id)
            end
        end
    end
    event.listen("tcp", handleResponse)
    network.tcp.send(channel, "register " .. name)
    event.pull(timeout, request_id)
    event.ignore("tcp", handleResponse)
    if open then
        network.tcp.close(channel)
    end
    if status == "granted" then
        return true
    end
    error(status or "timeout", 0)
end
function ____exports.unregister(name, timeout)
    if timeout == nil then
        timeout = 5
    end
    local server_address = ____exports.getServerAddress()
    local channel = network.tcp.open(server_address, DNS_PORT)
    local request_id = uuid.next()
    local open = true
    local status = nil
    local function handleResponse(name, ...)
        local args = {...}
        local event_type, on_channel = table.unpack(args)
        if on_channel == channel then
            if event_type == "close" then
                open = false
                event.push(request_id)
            elseif event_type == "message" then
                local message = args[3]
                status = message
                event.push(request_id)
            end
        end
    end
    event.listen("tcp", handleResponse)
    network.tcp.send(channel, "unregister " .. name)
    event.pull(timeout, request_id)
    event.ignore("tcp", handleResponse)
    if open then
        network.tcp.close(channel)
    end
    if status == "ok" then
        return true
    end
    error(status or "timeout", 0)
end
function ____exports.resolve(name, timeout)
    if timeout == nil then
        timeout = 5
    end
    local server_address = ____exports.getServerAddress()
    local channel = network.tcp.open(server_address, DNS_PORT)
    local request_id = uuid.next()
    local open = true
    local status = nil
    local function handleResponse(name, ...)
        local args = {...}
        local event_type, on_channel = table.unpack(args)
        if on_channel == channel then
            if event_type == "close" then
                open = false
                event.push(request_id)
            elseif event_type == "message" then
                local message = args[3]
                status = message
                event.push(request_id)
            end
        end
    end
    event.listen("tcp", handleResponse)
    network.tcp.send(channel, "resolve " .. name)
    event.pull(timeout, request_id)
    event.ignore("tcp", handleResponse)
    if open then
        network.tcp.close(channel)
    end
    if status ~= nil and string.gmatch(status, "^address ") then
        local address = string.gsub(status, "^address ", "")
        return address
    end
    error(status or "timeout", 0)
end
return ____exports
