local ____exports = {}
local lttp = require("lttp")
local serialization = require("serialization")
local dns = require("dns")
local CONFIG_FILE = "/etc/pack_client.cfg"
local config_file = io.open(CONFIG_FILE, "r")
local config = {}
if config_file then
    local config_data = config_file:read("*a")
    config_file:close()
    if config_data then
        config = serialization.unserialize(config_data)
    end
end
--- Get the server domain from config
local function getServerPort()
    local server_port = config.server_port or 8530
    if type(server_port) ~= "number" then
        error("Configuration error - `server_port` must be a number", 0)
    end
    return server_port
end
--- Get the server domain from config
local function getServerDomain()
    local server_address = config.server_address or "packages"
    if type(server_address) ~= "string" then
        error("Configuration error - `server_address` must be a string", 0)
    end
    return server_address
end
local resolved_server_address = nil
--- Resolve the server address, potentially from cache
local function getServerAddress()
    if not resolved_server_address then
        local domain = getServerDomain()
        resolved_server_address = dns.resolve(domain)
    end
    return resolved_server_address
end
--- Fetch a list of packages available on the packages server
function ____exports.listAvailablePackages()
    local status, headers, body = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/list"
    )
    if status >= 300 then
        error(
            ("Failed to list available packages, error " .. tostring(status)) .. " returned.",
            0
        )
    end
    if not body then
        error("Failed to list available packages, no data returned", 0)
    end
    local data = serialization.unserialize(body)
    return data
end
return ____exports
