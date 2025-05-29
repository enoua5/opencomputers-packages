
export type Channel = number;
export type Address = string;
export type Port = number;
export type Method = "GET" | "PUT" | "POST" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
export type Path = string;
export type Headers = { [key: string]: string };
export type Body = string | null;
export type Status = number;
export type LttpResponseHandler = (status: Status, headers?: Headers, body?: Body) => void;
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
