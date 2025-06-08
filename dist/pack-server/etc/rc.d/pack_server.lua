local ____exports = {}
local lttp = require("lttp")
local filesystem = require("filesystem")
local serialization = require("serialization")
local PACK_PORT = 8530
--- Fetch all files in the specified directory, recursively
-- 
-- @param path - The directory to list
-- @returns An array of paths, each represented as an array of path components
local function recursiveDirectoryList(path)
    local listing = filesystem.list(path)
    if listing == nil then
        return {}
    end
    local files = {}
    for path in listing do
        if string.sub(path, -1) == "/" then
            local segment = string.sub(path, 1, -2)
            local sublisting = recursiveDirectoryList(filesystem.concat(path, segment))
            for ____, subpath in ipairs(sublisting) do
                files[#files + 1] = {
                    segment,
                    table.unpack(subpath)
                }
            end
        else
            files[#files + 1] = {path}
        end
    end
    return files
end
--- Respond with a list of available packages
-- 
-- @param respond The response handler
local function handleDirectoryRequest(respond)
    local packages = {}
    local listing = filesystem.list("/packages")
    if listing == nil then
        respond(500)
        return
    end
    for pack in listing do
        if string.sub(pack, -1) == "/" then
            packages[#packages + 1] = string.sub(pack, 1, -2)
        end
    end
    respond(
        200,
        {},
        serialization.serialize(packages)
    )
end
--- Fetch the information file for the package
local function getInformationFile(pack)
    local directory = filesystem.concat("/packages", pack)
    local segments = filesystem.segments(directory)
    if segments[1] ~= "packages" or segments[2] ~= pack then
        return {ok = false, error = 403}
    end
    local cfg_path = filesystem.concat(directory, "info.cfg")
    local cfg_file = io.open(cfg_path, "r")
    if cfg_file == nil then
        return {ok = false, error = 404}
    end
    local content = cfg_file:read("*a")
    cfg_file:close()
    if content == nil then
        return {ok = false, error = 404}
    end
    return {ok = true, content = content}
end
--- Respond with information about the requested package
-- 
-- @param pack The package to respond with info about
-- @param respond The response handler
local function handleInfoRequest(pack, respond)
    local data = getInformationFile(pack)
    if not data.ok then
        respond(data.error)
        return
    end
    respond(200, {}, data.content)
end
--- Handle a respond for a list of files in a package
-- 
-- @param pack The package to list
-- @param respond The response handler
local function handleListPackageRequest(pack, respond)
    local directory = filesystem.concat("/packages", pack)
    local segments = filesystem.segments(directory)
    if segments[1] ~= "packages" or segments[2] ~= pack then
        respond(403)
        return
    end
    local listing = recursiveDirectoryList(filesystem.concat(directory, "install"))
    local report = {}
    for ____, entry in ipairs(listing) do
        local reported_path = filesystem.concat(table.unpack(entry))
        local full_path = filesystem.concat(directory, "install", reported_path)
        local file_size = filesystem.size(full_path)
        report[#report + 1] = {name = reported_path, size = file_size}
    end
    respond(
        200,
        {},
        serialization.serialize(report)
    )
end
--- Respond with the uninstall script for the package
-- 
-- @param pack The package to retreive the script for
-- @param respond The response handler
local function handleUninstallScriptRequest(pack, respond)
    local directory = filesystem.concat("/packages", pack)
    local segments = filesystem.segments(directory)
    if segments[1] ~= "packages" or segments[2] ~= pack then
        respond(403)
        return
    end
    local script_path = filesystem.concat(directory, "uninstall.lua")
    local script_file = io.open(script_path, "r")
    if script_file == nil then
        respond(404)
        return
    end
    local content = script_file:read("*a")
    script_file:close()
    if content == nil then
        respond(404)
        return
    end
    respond(200, {}, content)
end
--- Compare two semver-style strings. Return 1 if a is greater, -1 if b is greater, or 0 if they are equal
local function compareVersion(a, b)
    local a_parts = {}
    local b_parts = {}
    for part in string.gmatch(a, "%d+") do
        a_parts[#a_parts + 1] = part
    end
    for part in string.gmatch(b, "%d+") do
        b_parts[#b_parts + 1] = part
    end
    do
        local i = 1
        while i <= #a_parts and i <= #b_parts do
            local a_part = tonumber(a_parts[i]) or 0
            local b_part = tonumber(b_parts[i]) or 0
            if a_part > b_part then
                return 1
            elseif b_part > a_part then
                return -1
            end
            i = i + 1
        end
    end
    return 0
end
--- Respond with a list of packages for which updates are available
-- 
-- @param packages The list of packages and versions to check
-- @param respond The response handler
local function handleFetchUpdatesRequest(packages, respond)
    local updates = {}
    for ____, pack in ipairs(packages) do
        local info_file = getInformationFile(pack.pack)
        if info_file.ok then
            local info = serialization.unserialize(info_file.content)
            if info ~= nil then
                local version = info.version
                if type(version) == "string" and type(pack.version) == "string" then
                    if compareVersion(version, pack.version) > 0 then
                        updates[#updates + 1] = {pack = pack.pack, version = version}
                    end
                end
            end
        end
    end
    respond(
        200,
        {},
        serialization.serialize(updates)
    )
end
--- Return file content for download
-- 
-- @param pack The package the file belongs to
-- @param path The file within the package to install
-- @param page The offset within the file to fetch. Returns 1kb from page * 1kb
-- @param respond The response handler
local function handledownloadRequest(pack, path, page, respond)
    local directory = filesystem.concat("/packages", pack)
    local full_path = filesystem.concat(directory, "install", path)
    local segments = filesystem.segments(full_path)
    if segments[1] ~= "packages" or segments[2] ~= "install" or segments[3] ~= pack then
        respond(403)
        return
    end
    local file = io.open(full_path, "r")
    if file == nil then
        respond(404)
        return
    end
    file:seek("set", 1024 * page)
    local content = file:read(1024) or ""
    file:close()
    respond(200, {}, content)
end
start = function()
    lttp.listen(
        PACK_PORT,
        function(channel, address, port, method, path, headers, body, respond)
            local segments = filesystem.segments(path)
            if method == "GET" and segments[1] == "list" then
                if segments[2] ~= nil then
                    handleListPackageRequest(segments[2], respond)
                else
                    handleDirectoryRequest(respond)
                end
            elseif method == "GET" and segments[1] == "info" then
                if segments[2] ~= nil then
                    handleInfoRequest(segments[2], respond)
                else
                    respond(400)
                end
            elseif method == "GET" and segments[1] == "remove" then
                if segments[2] ~= nil then
                    handleUninstallScriptRequest(segments[2], respond)
                else
                    respond(400)
                end
            elseif method == "GET" and segments[1] == "download" then
                if segments[2] ~= nil and body ~= nil then
                    local page = tonumber(segments[3]) or 0
                    handledownloadRequest(segments[2], body, page, respond)
                else
                    respond(400)
                end
            elseif method == "GET" and segments[1] == "updates" then
                if body ~= nil then
                    local request = serialization.unserialize(body)
                    handleFetchUpdatesRequest(request, respond)
                else
                    respond(400)
                end
            else
                respond(405)
            end
        end
    )
end
stop = function()
    lttp.unlisten(PACK_PORT)
end
return ____exports
