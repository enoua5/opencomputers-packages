
import * as network from "network";
import * as event from "event";
import * as computer from "computer";
import * as serialization from "serialization";
import * as uuid from "uuid";

type Channel = number;
type Address = string;
type Port = number;
type Body = string | null;
type Headers = { [key: string]: string };
type TcpOpenArgs = ["connection", Channel, Address, Port];
type TcpCloseArgs = ["close", Channel, Address, Port];
type TcpMessageArgs = ["message", Channel, string, Address, Port];
type TcpEventArgs = TcpOpenArgs | TcpCloseArgs | TcpMessageArgs;

const tcp_listeners: {
    [port: number]: null | ((
        this: void,
        name: string,
        ...args: [...TcpEventArgs]
    ) => void)
} = {};

function getPort(args: TcpEventArgs) {
    print("getPort", ...args)
    if(args[0] == "connection" || args[0] == "close") {
        print("getPort => args[3] =", args[3])
        return args[3];
    }
    else if(args[0] == "message") {
        print("getPort => args[4] =", args[4])
        return args[4];
    }
    print("getPort => -1; unknown type", args[0])
    return -1;
}

export function listen(port: Port, timeout: number = 5): void {
    print("listen", port, timeout);
    if(tcp_listeners[port] != undefined) {
        throw "Port already bound";
    }

    const message_timeouts: { [channel: Channel]: number | null } = {};

    tcp_listeners[port] = (name, ...args) => {
        print("tcp_listener[", port, "]", name, ...args);
        if(getPort(args) === port) {
            print("port match")
            const [action, channel] = args;
            print("action", action, "channel", channel)

            if(action == "connection") {
                print("handle connection");
                const timeout_id= event.timer(timeout, () => {
                    print("timed out, closing", channel);
                    network.tcp.close(channel)
                });
                message_timeouts[channel] = timeout_id;
            }
            else if(action == "close") {
                print("handle close")
                if(message_timeouts[channel] != null) {
                    print("timeout still active, cancelling");
                    event.cancel(message_timeouts[channel]);
                    message_timeouts[channel] = null;
                }
            }
            else if(action == "message") {
                print("handle message")
                const document = args[2];
                const address = args[3];
                print("document", document);
                print("address", address);

                const respond = (status: number, headers?: Headers, body?: Body) => {
                    print("respond", channel, status, headers, body);
                    network.tcp.send(
                        channel,
                        serialization.serialize({
                            status,
                            headers,
                            body,
                        })
                    )
                }

                let headers: Headers | null = null;
                let body: Body = null;

                try {
                    print("trying parse")
                    const document_data = serialization.unserialize(document);
                    print("document_data", document_data);
                    if(typeof document_data === "object") {
                        print("document is object")
                        if(typeof document_data.headers === "object") {
                            print("document headers")
                            headers = document_data.headers;
                        }
                        if(typeof document_data.body === "string") {
                            print("document body")
                            body = document_data.body;
                        }
                    }
                }
                catch {
                    print("invalid")
                    respond(422);
                    return;
                }

                print("push lttp_request")
                computer.pushSignal(
                    "lttp_request",
                    channel,
                    address,
                    port,
                    headers || {},
                    body,
                    respond,
                )
            }
        }
    }
    print("adding listener to port", port);
    event.listen("tcp", tcp_listeners[port]);
    network.tcp.listen(port);
}

export function unlisten(port: Port): void {
    print("ending listener on port", port)
    if(tcp_listeners[port] != null) {
        print("removing event listener")
        event.ignore("tcp", tcp_listeners[port]);
        tcp_listeners[port] = null;
    }
    network.tcp.unlisten(port);
}

export function request(
    address: Address,
    port: Port,
    headers?: Headers,
    body?: Body,
    connection_timeout: number = 5,
    response_timeout: number = 5,
): LuaMultiReturn<[
    number,
    Headers,
    Body,
]> {
    print("request", address, port, headers, body, connection_timeout, response_timeout);
    const request_id = uuid.next();
    print("request_id", request_id)
    let channel: number | null = null;

    let channel_open = false;
    let response: string | null = null;

    const handler = (name: string, ...args: [...TcpEventArgs]) => {
        print("client handler", name, ...args);
        const [action, actual_channel] = args;
        print("action", action, "actual_channel", actual_channel, "channel", channel)
        if(channel == actual_channel) {
            print("channel match")
            if(action == "connection") {
                print("handle connection")
                channel_open = true;
                print("push", "connect" + request_id);
                computer.pushSignal("connect" + request_id);
            }
            if(action == "close") {
                print("handle close")
                channel_open = false;
                // stop waiting
                print("push", "connect" + request_id)
                computer.pushSignal("connect" + request_id);
                print("push", "message" + request_id)
                computer.pushSignal("message" + request_id);
            }
            if(action == "message") {
                print("handle message");
                response = args[2];
                print("response", response);
                print("push", "message" + request_id)
                computer.pushSignal("message" + request_id);
            }
        }
    }

    print("listen to tcp events")
    event.listen("tcp", handler);
    channel = network.tcp.open(address, port);
    print("tcp connection requested on channel", channel)
    print("waiting on", "connect" + request_id)
    event.pull(connection_timeout, "connect" + request_id);
    print("wait over", "channel_open", channel_open)
    if(!channel_open) {
        print("channel never opened");
        event.ignore("tcp", handler);
        throw "connection timeout";
    }
    print("channel open, sending", serialization.serialize({
        headers,
        body,
    }));
    network.tcp.send(channel, serialization.serialize({
        headers,
        body,
    }));
    print("waiting on", "message" + request_id)
    event.pull(response_timeout, "message" + request_id);
    print("wait over", "response", response);
    if(response == null) {
        print("no response recieved")
        if(channel_open) {
            print("channel still open, closing")
            network.tcp.close(channel);
        }
        print("remove tcp handler");
        event.ignore("tcp", handler);
        throw "response timeout";
    }

    let status: number = 500;
    let response_headers: Headers = {};
    let response_body: Body = null;

    print("parsing response")
    if(typeof response == "object") {
        print("response object found")
        type ItsNotNever = { [key: string]: unknown };
        if(typeof (response as ItsNotNever).status === "number") {
            status = (response as ItsNotNever).status as number;
            print("found status", status)
        }
        if(typeof (response as ItsNotNever).headers === "object") {
            response_headers = (response as ItsNotNever).headers as Headers;
            print("found headers", headers);
        }
        if(typeof (response as ItsNotNever).body === "string") {
            response_body = (response as ItsNotNever).body as Body;
            print("found body", body)
        }
    }
    print("status", status, "headers", headers, "body", body)

    if(channel_open) {
        print("channel open, closing");
        network.tcp.close(channel);
    }
    print("end request")
    event.ignore("tcp", handler);

    print("return request");
    return $multi(status, response_headers, response_body);
}
