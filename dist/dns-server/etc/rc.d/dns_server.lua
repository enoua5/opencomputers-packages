local ____exports = {}
local event = require("event")
local component = require("component")
local lttp = require("lttp")
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
    handleRequest = function(channel, address, port, method, path, headers, body, respond)
        local resource = string.sub(path, 2)
        if resource == "" then
            respond(422)
            return
        end
        if method == "POST" then
            if names[resource] ~= nil then
                respond(409)
                return
            else
                names[resource] = address
                respond(200)
                return
            end
        elseif method == "DELETE" then
            if names[resource] == nil then
                respond(404)
                return
            elseif names[resource] == address then
                names[resource] = nil
                respond(200)
                return
            else
                respond(403)
                return
            end
        elseif method == "GET" then
            if names[resource] ~= nil then
                respond(200, {}, names[resource])
                return
            else
                respond(404)
                return
            end
        else
            respond(405)
            return
        end
    end,
    start = function(self)
        lttp.listen(DNS_PORT, dns.handleRequest)
    end,
    stop = function(self)
        lttp.unlisten(DNS_PORT)
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
