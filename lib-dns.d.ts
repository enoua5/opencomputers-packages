declare module "dns" {
    /** Return the set address for DNS, or throw an error if not set */
    export function getServerAddress(): string;
    /** Set the DNS server address */
    export function setServerAddress(address: string): void;
    /**
     * Search for DNS servers for `timeout` seconds, and return the list
     *
     * WARNING: This method is not "thread safe". It will open and close port 55
     */
    export function searchServers(timeout?: number): string[];
    export function register(name: string, connection_timeout?: number, response_timeout?: number): boolean;
    export function unregister(name: string, connection_timeout?: number, response_timeout?: number): boolean;
    export function resolve(name: string, connection_timeout?: number, response_timeout?: number): string;
}
