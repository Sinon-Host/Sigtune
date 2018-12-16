const util = require('util');

const Channel = require('./../structures/Channel');
const Guild = require('./../structures/Guild');
const Member = require('./../structures/Member');
const Message = require('./../structures/Message');
const User = require('./../structures/User');

let WebSocket;
try {
    WebSocket = require('uws');
} catch (error) {
    WebSocket = require('ws');
}

let EventEmitter;
try {
    EventEmitter = require('eventemitter3');
} catch (e) {
    EventEmitter = require('events').EventEmitter;
}

class Client extends EventEmitter {
    /**
     * Creates an instance of Client
     *
     * @param {string} token Discord token
     * @param {Object} [options={}] Client options
     * @memberof Client
     */
    constructor(token, options = {}) {
        super();

        this.token = token;

        this.ping = null;

        this.options = options;
        this.shardID = this.options.shardID || 0;
        this.shardCount = this.options.shardCount || 1;
        this.largeThreshold = this.options.largeThreshold || 250;
        this.presence = {
            since: Date.now(),
            afk: false,
        };
        Object.assign(this.presence, this.options.presence);
    }

    /**
     * Connect to the websocket
     *
     * @memberof Client
     */
    connect() {
        this.ws = new WebSocket('wss://gateway.discord.gg/?v=6&encoding=json');
        this.guildCount = 0;
        this.bootTime = new Date();
        this.seq = 0;
        this.sessionID = null;

        this.ws.removeAllListeners();

        this.ws.once('open', () => this.identify());
        this.ws.on('error', (err) => { console.error('Websocket error', err); });
        this.ws.on('message', (data) => this.onWS(data));


        this.ws.on('close', (code) => {
            console.error('Websocket closed', code);

            if (code === 1000) {
                clearInterval(this.heartbeatInterval);

                this.resume();
            } else {
                this.disconnect();
                setTimeout(() => {
                    this.connect();
                }, 5000);
            }
        });
    }

    /**
     * Send the identify packet, used for the client handshake
     *
     * @returns {undefined}
     * @memberof Client
     */
    identify() {
        if (!this.ws || this.ws.readyState === 0 || this.ws.readyState === 2 || this.ws.readyState === 3) {
            return this.connect();
        }

        this.ws.send(JSON.stringify({
            op: 2,
            d: {
                token: `Bot ${this.token}`,
                properties: { $os: process.platform, $browser: 'test-lib', $device: 'test-lib' },
                compress: false,
                large_threshold: this.largeThreshold,
                shard: [this.shardID, this.shardCount],
                presence: this.presence,
            },
        }));
    }

    /**
     * Disconnect from the websocket
     *
     * @memberof Client
     */
    disconnect() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (!this.ws) { return; }

        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000);
        }

        this.ws = null;
    }

    /**
     *
     *
     * @memberof Client
     */
    resume() {
        if (!this.ws) {
            this.ws = new WebSocket('wss://gateway.discord.gg/?v=6&encoding=json');
        }

        this.ws.once('open', () => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    op: 6,
                    d: {
                        token: `Bot ${this.token}`,
                        session_id: this.sessionID,
                        seq: this.seq,
                    },
                }));
            } else {
                this.resume();
            }
        });
    }

    /**
     * Event to handle the data recieved from the websocket and process it properly
     *
     * @param {Object} data data object
     * @returns {void}
     * @memberof Client
     */
    onWS(data) {
        try {
            data = JSON.parse(data);
        } catch (e) {
            return console.error('Error parsing websocket data: ', data);
        }

        if (this.listeners('rawWS').length > 0) {
            this.emit('rawWS', data);
        }

        this.seq = data.s;

        switch (data.op) {
            case 0:
                this.handleDispatch(data);
                break;
            case 1:
                this.handleHeartBeat();
                break;
            case 7:
                this.emit('error', 'Reconnecting to websocket');
                console.error('OP7 Reconnecting to websocket');
                this.disconnect();
                setTimeout(() => {
                    this.connect();
                }, 6000);
                this.connect();
                break;
            case 9:
                this.emit('warn', 'Invalid session reidenifying');

                if (data.d === true && this.sessionID) {
                    this.resume();
                } else {
                    this.identify();
                }

                this.seq = 0;
                this.sessionID = null;

                this.identify();
                break;
            case 10:
                if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); }

                this.heartbeatInterval = setInterval(() => { this.handleHeartBeat(); }, data.d.heartbeat_interval);
                break;
            case 11:
                this.ping = new Date() - this.sendTime;

                if (!this.pings) { this.pings = []; }
                if (this.pings.length >= 3) { this.pings.shift(); }

                this.pings.push(this.ping);
                break;
            default:
                console.log('data', util.inspect(data, { depth: 1 }));
                break;
        }
    }

    /**
     * Handle heartbeating with the websocket
     *
     * @memberof Client
     */
    handleHeartBeat() {
        if (!this.ws || this.ws.readyState === 3 || this.ws.readyState === 2) {
            clearInterval(this.heartbeatInterval);

            return;
        }

        this.emit('debug', 'Sending heartbeat');

        this.ws.send(JSON.stringify({ op: 1, d: this.seq }));
        this.sendTime = new Date();
    }

    /**
     * Handle events dispatched by the websocket
     *
     * @param {Object} data data object
     * @memberof Client
     */
    handleDispatch(data) {
        this.emit('debug', data);
        switch (data.t) {
            case 'PRESENCE_UPDATE':
                this.emit('presenceUpdate', data.d);
                break;
            case 'READY':
                this.sessionID = data.d.session_id;
                this.emit('ready', data.d);
                break;
            case 'RESUME':
                this.emit('resume', data.d);
                break;
            case 'MESSAGE_CREATE':
                this.emit('messageCreate', new Message(data.d, this));
                break;
            case 'MESSAGE_UPDATE':
                this.emit('messageUpdate', new Message(data.d, this));
                break;
            case 'MESSAGE_DELETE':
                this.emit('messageDelete', data.d);
                break;
            case 'MESSAGE_DELETE_BULK':
                this.emit('messageDeleteBulk', data.d);
                break;
            case 'MESSAGE_REACTION_ADD':
                this.emit('messageReactionAdd', data.d);
                break;
            case 'MESSAGE_REACTION_REMOVE':
                this.emit('messageReactionRemove', data.d);
                break;
            case 'MESSAGE_REACTION_REMOVE_ALL':
                this.emit('messageReactionRemoveAll', data.d);
                break;
            case 'CHANNEL_CREATE':
                this.emit('channelCreate', new Channel(data.d));
                break;
            case 'CHANNEL_UPDATE':
                this.emit('channelUpdate', new Channel(data.d));
                break;
            case 'CHANNEL_DELETE':
                this.emit('channelDelete', data.d);
                break;
            case 'CHANNEL_PINS_UPDATE':
                this.emit('channelPinsUpdate', data.d);
                break;
            case 'GUILD_CREATE':
                if (data.d.large) { this.getGuildMembers(data.d.id); }
                this.emit('guildCreate', new Guild(data.d));
                this.guildCount++;
                break;
            case 'GUILD_UPDATE':
                this.emit('guildUpdate', new Guild(data.d));
                break;
            case 'GUILD_DELETE':
                if (data.d.unavailable) {
                    this.emit('guildUnavailable', data.d);
                } else {
                    this.emit('guildDelete', data.d);
                    this.guildCount--;
                }
                break;
            case 'GUILD_BAN_ADD':
                this.emit('guildBanAdd', data.d);
                break;
            case 'GUILD_BAN_REMOVE':
                this.emit('guildBanRemove', data.d);
                break;
            case 'GUILD_EMOJIS_UPDATE':
                this.emit('guildEmojisUpdate', data.d);
                break;
            case 'GUILD_MEMBER_ADD':
                this.emit('guildMemberAdd', new Member(data.d, this));
                break;
            case 'GUILD_MEMBER_UPDATE':
                this.emit('guildMemberUpdate', new User(data.d, this));
                break;
            case 'GUILD_MEMBER_REMOVE':
                this.emit('guildMemberRemove', new User(data.d.user, this), data.d.guild_id);
                break;
            case 'GUILD_MEMBERS_CHUNK':
                this.emit('guildMembersChunk', data.d);
                break;
            case 'GUILD_ROLE_CREATE':
                this.emit('guildRoleCreate', data.d);
                break;
            case 'GUILD_ROLE_UPDATE':
                this.emit('guildRoleUpdate', data.d);
                break;
            case 'GUILD_ROLE_DELETE':
                this.emit('guildRoleDelete', data.d);
                break;
            case 'VOICE_STATE_UPDATE':
                this.emit('voiceStateUpdate', data.d);
                break;
            case 'VOICE_SERVER_UPDATE':
                this.emit('voiceServerUpdate', data.d);
                break;
            case 'WEBHOOK_UPDATE':
                this.emit('webhookUpdate', data.d);
                break;
            case 'TYPING_START':
                this.emit('typingStart', data.d);
                break;
            default:
                console.error('UNKNOWN EVENT: ', data);
                this.emit('unknown', data);
                break;
        }
    }

    /**
     * Get all the guild members of the desired guild
     *
     * @param {*} guildID Guild ID to get the members from
     * @returns {undefined}
     * @memberof Client
     */
    getGuildMembers(guildID) {
        if (!guildID) { return; }
        this.ws.send(JSON.stringify({ op: 8, d: { guild_id: guildID, query: '', limit: 0 } }));
    }

    /**
     * Send a voice state update to join, move or disconnect the client from a voice channel
     *
     * @param {string} guild_id GuldID(not used)
     * @param {Object} data Voice state update data
     * @returns {undefined}
     * @memberof Client
     */
    voiceStateUpdate(guild_id, data) {
        if (!data) { return Promise.resolve(); }
        this.ws.send(JSON.stringify(data));
    }
}

module.exports = Client;