local filesystem = require("filesystem")
local rc = require("rc")
rc.unload("pack_server")
filesystem.remove("/etc/rc.d/pack_server.lua")
