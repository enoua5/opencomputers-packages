
/*
 * EVENTS
 *
 * icmp.ping => * => "ping_reply", origin, id, payload
 * 
 * udp.send => "datagram", origin, port, data
 * 
 * tcp.open => "tcp", "connection", channel, origin, port
 * tcp.open => reject => x
 * tcp.open => accept => "tcp", "connection", channel origin, port
 * tcp.close => "tcp", "close", channel, origin, port
 * tcp.message => "tcp", "message", channel, message, address, port
 */


declare module "network" {
    export const icmp: {
        /**
         * Sends ping message to addr, message will come back triggering
         * 'ping_reply' event
         */
        ping(this: void, addr: string, payload: string): number;
    }
    export const ip: {
        /**
         * Attaches addnitional address to this computer, useful for
         * core servers which addresses must me easisy rememberable
         * Address SOULD be up to 64 characters, allowed characters: a-zA-Z, '-'
         */
        bind(this: void, addr: string): void;
    }
    export const udp: {
        /**
         * Starts listening on specified port, when data arrives at port "datagram"
         * event is triggered with origin, port, data parameters
         * 
         */
        open(this: void, port: number): void;
        /** Stops listening on specified port */
        close(this: void, port: number): void;
        /**
         * Sends data to specified host and port. Specified port MUST be open
         * on remote machine
         */
        send(this: void, addr: string, port: number, data: string): void;
    }
    export const tcp: {
        /**
         * Starts listening at specified port. When connection arrives event
         * "tcp", "connection", channel, remoteaddr, port
         * is trigerred
         */
        listen(this: void, port: number): void;
        /**
         * Stops listening on specified port. Note that all connections made to
         * this port will remain untouched
         */
        unlisten(this: void, port: number): void;
        /**
         * Tries to open a new connection. Will trigger event
         * "tcp", "connection", channel, remoteaddr, port
         * When remote host accepted the connection
         */
        open(this: void, addr: string, port: number): number;
        /**
         * Closes earlier opened connection, will trigger
         * "tcp", "close", channel, remoteaddr, port
         * on remote side
         */
        close(this: void, channel: number): void;
        /**
         * Sends data to other side, will trigger
         * "tcp", "message", ch, data, remoteaddr, port
         * event on remote side
         */
        send(this: void, channel: number, data: string): boolean;
    }
}
