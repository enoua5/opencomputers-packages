
declare type Channel = number;
declare type Address = string;
declare type Port = number;
declare type Method = "GET" | "PUT" | "POST" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
declare type Path = string;
declare type Headers = { [key: string]: string };
declare type Body = string | null;
declare type Status = number;
declare type LttpResponseHandler = (status: Status, headers?: Headers, body?: Body) => void;
declare type LttpRequestEvent = [
    Channel,
    Address, // origin address
    Port,
    Method,
    Path,
    Headers,
    Body,
    LttpResponseHandler,
];
declare type LttpRequestCallback = (...args: [...LttpRequestEvent]) => void;

declare module "lttp" {
    export const listen: (port: number, callback: LttpRequestCallback, timeout?: number) => void;
    export const unlisten: (port: number) => void;
    export const request: (
        address: Address,
        port: Port,
        method: Method,
        path?: Path,
        headers?: Headers,
        body?: Body,
        connection_timeout?: number,
        response_timeout?: number,
    ) => LuaMultiReturn<[
        Status,
        Headers,
        Body,
    ]>;
}
