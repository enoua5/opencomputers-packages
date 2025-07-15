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
local PACKFILE = "/etc/packfile"
local function writePackfile(data)
    local packfile = io.open(PACKFILE, "w")
    if packfile == nil then
        error("Filed to update packfile", 0)
    end
    packfile:write(serialization.serialize(data))
end
--- Read information about installed packages
function ____exports.readPackfile()
    local packfile = io.open(PACKFILE, "r")
    if packfile == nil then
        local packfile_write = io.open(PACKFILE, "w")
        if packfile_write == nil then
            error("Filed to create packfile", 0)
        end
        packfile_write:write("{}")
        packfile_write:close()
        return {}
    end
    local content = packfile:read("*a")
    if content == nil then
        error("Filed to read packfile", 0)
    end
    return serialization.unserialize(content)
end
--- Set the package information listed in the packfile
function ____exports.setInstalledPackageInformation(pack, info)
    local data = ____exports.readPackfile()
    data[pack] = info
    writePackfile(data)
end
--- Remove the package form the installed package list
function ____exports.removePackageRecord(pack)
    local data = ____exports.readPackfile()
    data[pack] = nil
    writePackfile(data)
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
--- Fetch file information for a package
function ____exports.getPackageFileInformation(pack)
    local status, headers, body = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/list/" .. pack
    )
    if status >= 300 then
        error(
            ("Failed to fetch file list, error " .. tostring(status)) .. " returned.",
            0
        )
    end
    if not body then
        error("Failed to fetch file list, no data returned", 0)
    end
    local data = serialization.unserialize(body)
    return data
end
--- Get information about a package
function ____exports.getPackageInformation(pack)
    local status, headers, body = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/info/" .. pack
    )
    if status >= 300 then
        error(
            ("Failed to fetch package info, error " .. tostring(status)) .. " returned.",
            0
        )
    end
    if not body then
        error("Failed to fetch package info, no data returned", 0)
    end
    local data = serialization.unserialize(body)
    return data
end
--- Fetch uninstall script
function ____exports.getUninstallScript(pack)
    local status, headers, body = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/remove/" .. pack
    )
    if status >= 300 then
        error(
            ("Failed to fetch uninstall script, error " .. tostring(status)) .. " returned.",
            0
        )
    end
    if not body then
        error("Failed to fetch uninstall script, no data returned", 0)
    end
    return body
end
--- Fetch a chunk from a package directory
function ____exports.getPackageChunk(pack, file, page)
    if page == nil then
        page = 0
    end
    local status, headers, body = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        (("/download/" .. pack) .. "/") .. tostring(page),
        {},
        file
    )
    if status >= 300 then
        error(
            ("Failed to fetch chunk, error " .. tostring(status)) .. " returned.",
            0
        )
    end
    if not body then
        error("Failed to fetch chunk, no data returned", 0)
    end
    return body
end
--- Fetch a list of packages that have updates available
function ____exports.checkUpdates(packages_to_check)
    local status, headers, body = lttp.request(
        getServerAddress(),
        getServerPort(),
        "GET",
        "/updates",
        {},
        serialization.serialize(packages_to_check)
    )
    if status >= 300 then
        error(
            ("Failed to check for updates, error " .. tostring(status)) .. " returned.",
            0
        )
    end
    if not body then
        error("Failed to check for updates, no data returned", 0)
    end
    local data = serialization.unserialize(body)
    return data
end
return ____exports
