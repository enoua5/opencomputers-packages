local ____exports = {}
local network = require("network")
local event = require("event")
local computer = require("computer")
local serialization = require("serialization")
local uuid = require("uuid")
local tcp_listeners = {}
local function getPort(args)
    if args[1] == "connection" or args[1] == "close" then
        return args[4]
    elseif args[1] == "message" then
        return args[5]
    end
    return -1
end
function ____exports.listen(port, timeout)
    if timeout == nil then
        timeout = 5
    end
    if tcp_listeners[port] ~= nil then
        error("Port already bound", 0)
    end
    local message_timeouts = {}
    tcp_listeners[port] = function(name, ...)
        local args = {...}
        if getPort(args) == port then
            local action, channel = table.unpack(args)
            if action == "connection" then
                local timeout_id = event.timer(
                    timeout,
                    function() return network.tcp.close(channel) end
                )
                message_timeouts[channel] = timeout_id
            elseif action == "close" then
                if message_timeouts[channel] ~= nil then
                    event.cancel(message_timeouts[channel])
                    message_timeouts[channel] = nil
                end
            elseif action == "message" then
                local document = args[3]
                local address = args[4]
                local function respond(status, headers, body)
                    network.tcp.send(
                        channel,
                        serialization.serialize({status = status, headers = headers, body = body})
                    )
                end
                local headers = nil
                local body = nil
                do
                    local function ____catch()
                        respond(422)
                        return true
                    end
                    local ____try, ____hasReturned, ____returnValue = pcall(function()
                        local document_data = serialization.unserialize(document)
                        if type(document_data) == "table" then
                            if type(document_data.headers) == "table" then
                                headers = document_data.headers
                            end
                            if type(document_data.body) == "string" then
                                body = document_data.body
                            end
                        end
                    end)
                    if not ____try then
                        ____hasReturned, ____returnValue = ____catch()
                    end
                    if ____hasReturned then
                        return ____returnValue
                    end
                end
                computer.pushSignal(
                    "lttp_request",
                    channel,
                    address,
                    port,
                    headers or ({}),
                    body,
                    respond
                )
            end
        end
    end
    event.listen("tcp", tcp_listeners[port])
    network.tcp.listen(port)
end
function ____exports.unlisten(port)
    if tcp_listeners[port] ~= nil then
        event.ignore("tcp", tcp_listeners[port])
    end
    network.tcp.unlisten(port)
end
function ____exports.request(address, port, headers, body, connection_timeout, response_timeout)
    if connection_timeout == nil then
        connection_timeout = 5
    end
    if response_timeout == nil then
        response_timeout = 5
    end
    local request_id = uuid.next()
    local channel = nil
    local channel_open = false
    local response = nil
    local function handler(name, ...)
        local args = {...}
        local action, actual_channel = table.unpack(args)
        if channel == actual_channel then
            if action == "connection" then
                channel_open = true
                computer.pushSignal("connect" .. request_id)
            end
            if action == "close" then
                channel_open = false
                computer.pushSignal("connect" .. request_id)
                computer.pushSignal("message" .. request_id)
            end
            if action == "message" then
                response = args[3]
                computer.pushSignal("message" .. request_id)
            end
        end
    end
    event.listen("tcp", handler)
    channel = network.tcp.open(address, port)
    event.pull(connection_timeout, "connect" .. request_id)
    if not channel_open then
        event.ignore("tcp", handler)
        error("connection timeout", 0)
    end
    network.tcp.send(
        channel,
        serialization.serialize({headers = headers, body = body})
    )
    event.pull(response_timeout, "message" .. request_id)
    if response == nil then
        if channel_open then
            network.tcp.close(channel)
        end
        event.ignore("tcp", handler)
        error("response timeout", 0)
    end
    local status = 500
    local response_headers = {}
    local response_body = nil
    if type(response) == "table" then
        if type(response.status) == "number" then
            status = response.status
        end
        if type(response.headers) == "table" then
            response_headers = response.headers
        end
        if type(response.body) == "table" then
            response_body = response.body
        end
    end
    if channel_open then
        network.tcp.close(channel)
    end
    event.ignore("tcp", handler)
    return status, response_headers, response_body
end
return ____exports
