const config = require('./env');

module.exports = {
    iceServers: config.stun.servers.map(url => ({ urls: url }))
};
