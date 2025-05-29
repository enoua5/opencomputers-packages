local ____exports = {}
local network = require("network")
local event = require("event")
local computer = require("computer")
local serialization = require("serialization")
local uuid = require("uuid")
local tcp_listeners = {}
local function getPort(args)
    print(
        "getPort",
        table.unpack(args)
    )
    if args[1] == "connection" or args[1] == "close" then
        print("getPort => args[3] =", args[4])
        return args[4]
    elseif args[1] == "message" then
        print("getPort => args[4] =", args[5])
        return args[5]
    end
    print("getPort => -1; unknown type", args[0])
    return -1
end
function ____exports.listen(port, timeout)
    if timeout == nil then
        timeout = 5
    end
    print("listen", port, timeout)
    if tcp_listeners[port] ~= nil then
        error("Port already bound", 0)
    end
    local message_timeouts = {}
    tcp_listeners[port] = function(name, ...)
        local args = {...}
        print(
            "tcp_listener[",
            port,
            "]",
            name,
            ...
        )
        if getPort(args) == port then
            print("port match")
            local action, channel = table.unpack(args)
            print("action", action, "channel", channel)
            if action == "connection" then
                print("handle connection")
                local timeout_id = event.timer(
                    timeout,
                    function()
                        print("timed out, closing", channel)
                        network.tcp.close(channel)
                    end
                )
                message_timeouts[channel] = timeout_id
            elseif action == "close" then
                print("handle close")
                if message_timeouts[channel] ~= nil then
                    print("timeout still active, cancelling")
                    event.cancel(message_timeouts[channel])
                    message_timeouts[channel] = nil
                end
            elseif action == "message" then
                print("handle message")
                local document = args[3]
                local address = args[4]
                print("document", document)
                print("address", address)
                local function respond(status, headers, body)
                    print(
                        "respond",
                        channel,
                        status,
                        headers,
                        body
                    )
                    network.tcp.send(
                        channel,
                        serialization.serialize({status = status, headers = headers, body = body})
                    )
                end
                local headers = nil
                local body = nil
                do
                    local function ____catch()
                        print("invalid")
                        respond(422)
                        return true
                    end
                    local ____try, ____hasReturned, ____returnValue = pcall(function()
                        print("trying parse")
                        local document_data = serialization.unserialize(document)
                        print("document_data", document_data)
                        if type(document_data) == "table" then
                            print("document is object")
                            if type(document_data.headers) == "table" then
                                print("document headers")
                                headers = document_data.headers
                            end
                            if type(document_data.body) == "string" then
                                print("document body")
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
                print("push lttp_request")
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
    print("adding listener to port", port)
    event.listen("tcp", tcp_listeners[port])
    network.tcp.listen(port)
end
function ____exports.unlisten(port)
    print("ending listener on port", port)
    if tcp_listeners[port] ~= nil then
        print("removing event listener")
        event.ignore("tcp", tcp_listeners[port])
        tcp_listeners[port] = nil
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
    print(
        "request",
        address,
        port,
        headers,
        body,
        connection_timeout,
        response_timeout
    )
    local request_id = uuid.next()
    print("request_id", request_id)
    local channel = nil
    local channel_open = false
    local response = nil
    local function handler(name, ...)
        local args = {...}
        print("client handler", name, ...)
        local action, actual_channel = table.unpack(args)
        print(
            "action",
            action,
            "actual_channel",
            actual_channel,
            "channel",
            channel
        )
        if channel == actual_channel then
            print("channel match")
            if action == "connection" then
                print("handle connection")
                channel_open = true
                print("push", "connect" .. request_id)
                computer.pushSignal("connect" .. request_id)
            end
            if action == "close" then
                print("handle close")
                channel_open = false
                print("push", "connect" .. request_id)
                computer.pushSignal("connect" .. request_id)
                print("push", "message" .. request_id)
                computer.pushSignal("message" .. request_id)
            end
            if action == "message" then
                print("handle message")
                response = args[3]
                print("response", response)
                print("push", "message" .. request_id)
                computer.pushSignal("message" .. request_id)
            end
        end
    end
    print("listen to tcp events")
    event.listen("tcp", handler)
    channel = network.tcp.open(address, port)
    print("tcp connection requested on channel", channel)
    print("waiting on", "connect" .. request_id)
    event.pull(connection_timeout, "connect" .. request_id)
    print("wait over", "channel_open", channel_open)
    if not channel_open then
        print("channel never opened")
        event.ignore("tcp", handler)
        error("connection timeout", 0)
    end
    print(
        "channel open, sending",
        serialization.serialize({headers = headers, body = body})
    )
    network.tcp.send(
        channel,
        serialization.serialize({headers = headers, body = body})
    )
    print("waiting on", "message" .. request_id)
    event.pull(response_timeout, "message" .. request_id)
    print("wait over", "response", response)
    if response == nil then
        print("no response recieved")
        if channel_open then
            print("channel still open, closing")
            network.tcp.close(channel)
        end
        print("remove tcp handler")
        event.ignore("tcp", handler)
        error("response timeout", 0)
    end
    local status = 500
    local response_headers = {}
    local response_body = nil
    print("parsing response")
    if type(response) == "table" then
        print("response object found")
        if type(response.status) == "number" then
            status = response.status
            print("found status", status)
        end
        if type(response.headers) == "table" then
            response_headers = response.headers
            print("found headers", headers)
        end
        if type(response.body) == "string" then
            response_body = response.body
            print("found body", body)
        end
    end
    print(
        "status",
        status,
        "headers",
        headers,
        "body",
        body
    )
    if channel_open then
        print("channel open, closing")
        network.tcp.close(channel)
    end
    print("end request")
    event.ignore("tcp", handler)
    print("return request")
    return status, response_headers, response_body
end
return ____exports
