
export type Channel = number;
export type Address = string;
export type Port = number;
export type Headers = { [key: string]: string };
export type Body = string | null;
export type Status = number;
export type LttpResponseHandler = (status: Status, headers?: Headers, body?: Body) => void;
export type LttpRequestEvent = [
    Channel,
    Address, // origin address
    Port,
    Headers,
    Body,
    LttpResponseHandler,
]

declare module "lttp" {
    export const listen: (port: number, timeout?: number) => void;
    export const unlisten: (port: number) => void;
    export const request: (
        address: Address,
        port: Port,
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
