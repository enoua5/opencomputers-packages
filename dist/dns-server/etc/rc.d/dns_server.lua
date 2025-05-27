local ____exports = {}
local network = require("network")
local event = require("event")
local component = require("component")
local ____serialization = require("serialization")
local serialize = ____serialization.serialize
local unserialize = ____serialization.unserialize
local DNS_PORT = 53
local DNS_AD_PORT = 54
local DNS_AD_RESPONSE_PORT = 55
local ad = {
    handle = function(name, receiverAddress, senderAddress, port, distance, ...)
        local payload = {...}
        if port == DNS_AD_PORT and #payload > 0 and payload[1] == "dns-search" then
            component.modem.send(senderAddress, DNS_AD_RESPONSE_PORT, "dns-ad")
        end
    end,
    start = function(self)
        event.listen("modem_message", self.handle)
        component.modem.open(DNS_AD_PORT)
    end,
    stop = function(self)
        component.modem.close(DNS_AD_PORT)
        event.ignore("modem_message", self.handle)
    end
}
local names = {}
local dns
dns = {
    timeouts = {},
    handleConnection = function(channel, address, port)
        dns.timeouts[channel] = event.timer(
            5,
            function() return network.tcp.close(channel) end
        )
    end,
    handleClose = function(channel, address, port)
        if dns.timeouts[channel] ~= nil then
            event.cancel(dns.timeouts[channel])
            dns.timeouts[channel] = nil
        end
    end,
    handleMessage = function(channel, message, address, port)
        local request = {}
        for part in string.gmatch(message, "[^%s]+") do
            request[#request + 1] = part
        end
        local command = request[1]
        if command == "register" then
            local name = request[2]
            if name == nil then
                network.tcp.send(channel, "invalid")
            elseif names[name] ~= nil then
                network.tcp.send(channel, "taken")
            else
                names[name] = address
                network.tcp.send(channel, "granted")
            end
        elseif command == "unregister" then
            local name = request[2]
            if name and names[name] == address then
                names[name] = nil
                network.tcp.send(channel, "ok")
            else
                network.tcp.send(channel, "unknown")
            end
        elseif command == "resolve" then
            local name = request[2]
            if name == nil then
                network.tcp.send(channel, "invalid")
            elseif names[name] ~= nil then
                network.tcp.send(channel, "address " .. names[name])
            else
                network.tcp.send(channel, "unknown")
            end
        else
            network.tcp.send(channel, "invalid")
        end
        network.tcp.close(channel)
    end,
    handle = function(name, ...)
        local args = {...}
        local method, channel = table.unpack(args)
        if method == "connection" then
            dns.handleConnection(channel, args[3], args[4])
        elseif method == "close" then
            dns.handleClose(channel, args[3], args[4])
        elseif method == "message" then
            dns.handleMessage(channel, args[3], args[4], args[5])
        end
    end,
    start = function(self)
        event.listen("tcp", self.handle)
        network.tcp.listen(DNS_PORT)
    end,
    stop = function(self)
        network.tcp.unlisten(DNS_PORT)
        event.ignore("tcp", self.handle)
    end
}
local function save()
    local file = io.open("/etc/dns-names", "w")
    if file ~= nil then
        file:write(serialize(names))
        file:close()
    end
end
local function load()
    local file = io.open("/etc/dns-names", "r")
    if file ~= nil then
        local data = file:read()
        if data ~= nil then
            local value = unserialize(data)
            if type(value) == "table" and value ~= nil then
                names = value
            end
        end
    end
end
local save_loop = nil
start = function()
    ad:start()
    dns:start()
    load()
    save_loop = event.timer(5, save, math.huge)
end
stop = function()
    ad:stop()
    dns:stop()
    if save_loop ~= nil then
        event.cancel(save_loop)
    end
end
return ____exports
