import * as network from "network";
import * as event from "event";
import * as computer from "computer";
import * as serialization from "serialization";
import * as uuid from "uuid";

type TcpOpenArgs = ["connection", Channel, Address, Port];
type TcpCloseArgs = ["close", Channel, Address, Port];
type TcpMessageArgs = ["message", Channel, string, Address, Port];
type TcpEventArgs = TcpOpenArgs | TcpCloseArgs | TcpMessageArgs;
export type Channel = number;
export type Address = string;
export type Port = number;
export type Method =
    | "GET"
    | "PUT"
    | "POST"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS";
export type Path = string;
export type Headers = { [key: string]: string };
export type Body = string | null;
export type Status = number;
export type LttpResponseHandler = (
    status: Status,
    headers?: Headers,
    body?: Body
) => void;
export type LttpRequestEvent = [
    Channel,
    Address, // origin address
    Port,
    Method,
    Path,
    Headers,
    Body,
    LttpResponseHandler,
];
export type LttpRequestCallback = (...args: [...LttpRequestEvent]) => void;

const tcp_listeners: {
    [port: number]:
        | null
        | ((this: void, name: string, ...args: [...TcpEventArgs]) => void);
} = {};

function getPort(args: TcpEventArgs) {
    if (args[0] == "connection" || args[0] == "close") {
        return args[3];
    } else if (args[0] == "message") {
        return args[4];
    }
    return -1;
}

export function listen(
    port: Port,
    callback: LttpRequestCallback,
    timeout: number = 5
): void {
    if (tcp_listeners[port] != undefined) {
        throw "Port already bound";
    }

    const message_timeouts: { [channel: Channel]: number | null } = {};

    tcp_listeners[port] = (name, ...args) => {
        if (getPort(args) === port) {
            const [action, channel] = args;

            if (action == "connection") {
                const timeout_id = event.timer(timeout, () => {
                    network.tcp.close(channel);
                });
                message_timeouts[channel] = timeout_id;
            } else if (action == "close") {
                if (message_timeouts[channel] != null) {
                    event.cancel(message_timeouts[channel]);
                    message_timeouts[channel] = null;
                }
            } else if (action == "message") {
                const document = args[2];
                const address = args[3];

                const respond: LttpResponseHandler = (
                    status: number,
                    headers?: Headers,
                    body?: Body
                ) => {
                    network.tcp.send(
                        channel,
                        serialization.serialize({
                            status,
                            headers,
                            body,
                        })
                    );
                };

                let headers: Headers | null = null;
                let body: Body = null;
                let method: string | null = null;
                let path: Path | null = null;

                try {
                    const document_data = serialization.unserialize(document);
                    if (typeof document_data === "object") {
                        if (typeof document_data.method === "string") {
                            method = document_data.method;
                        }
                        if (typeof document_data.path === "string") {
                            path = document_data.path;
                        }
                        if (typeof document_data.headers === "object") {
                            headers = document_data.headers;
                        }
                        if (typeof document_data.body === "string") {
                            body = document_data.body;
                        }
                    }
                } catch {
                    respond(555);
                    return;
                }
                if (
                    path == null ||
                    !(
                        method == "GET" ||
                        method == "PUT" ||
                        method == "POST" ||
                        method == "DELETE" ||
                        method == "PATCH" ||
                        method == "HEAD" ||
                        method == "OPTIONS"
                    )
                ) {
                    respond(555);
                    return;
                }

                callback(
                    channel,
                    address,
                    port,
                    method,
                    path,
                    headers || {},
                    body,
                    respond
                );
            }
        }
    };
    event.listen("tcp", tcp_listeners[port]);
    network.tcp.listen(port);
}

export function unlisten(port: Port): void {
    if (tcp_listeners[port] != null) {
        event.ignore("tcp", tcp_listeners[port]);
        tcp_listeners[port] = null;
    }
    network.tcp.unlisten(port);
}

export function request(
    address: Address,
    port: Port,
    method: Method,
    path: Path = "/",
    headers?: Headers,
    body?: Body,
    connection_timeout: number = 5,
    response_timeout: number = 5
): LuaMultiReturn<[number, Headers, Body]> {
    method = string.upper(method) as Method;

    const [request_id] = string.gsub(uuid.next(), "-", "");
    let channel: number | null = null;

    let channel_open = false;
    let response: string | null = null as string | null;

    const handler = (name: string, ...args: [...TcpEventArgs]) => {
        const [action, actual_channel] = args;
        if (channel == actual_channel) {
            if (action == "connection") {
                channel_open = true;
                computer.pushSignal("connect" + request_id);
            }
            if (action == "close") {
                channel_open = false;
                // stop waiting
                computer.pushSignal("connect" + request_id);
                computer.pushSignal("message" + request_id);
            }
            if (action == "message") {
                response = args[2];
                computer.pushSignal("message" + request_id);
            }
        }
    };

    event.listen("tcp", handler);
    channel = network.tcp.open(address, port);
    event.pull(connection_timeout, "connect" + request_id);
    if (!channel_open) {
        event.ignore("tcp", handler);
        throw "connection timeout";
    }
    network.tcp.send(
        channel,
        serialization.serialize({
            method,
            path,
            headers,
            body,
        })
    );
    event.pull(response_timeout, "message" + request_id);
    if (response == null) {
        if (channel_open) {
            network.tcp.close(channel);
        }
        event.ignore("tcp", handler);
        throw "response timeout";
    }

    let status: number = 500;
    let response_headers: Headers = {};
    let response_body: Body = null;

    const response_data = serialization.unserialize(response);

    if (typeof response_data == "object") {
        if (typeof response_data.status === "number") {
            status = response_data.status as number;
        }
        if (typeof response_data.headers === "object") {
            response_headers = response_data.headers as Headers;
        }
        if (typeof response_data.body === "string") {
            response_body = response_data.body as string;
        }
    }

    if (channel_open) {
        network.tcp.close(channel);
    }
    event.ignore("tcp", handler);

    return $multi(status, response_headers, response_body);
}
