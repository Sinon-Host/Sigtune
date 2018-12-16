const Member = require('./Member');
const User = require('./User');

class Message {
    /**
     * Creates an instance of Message.
     *
     * @param {Object} data Message data
     * @param {Object} client Discord client
     * @memberof Message
     */
    constructor(data, client) {
        this.client = client;
        this.rest = client.rest;

        this.guildID = data.guild_id;
        this.attachments = data.attachments;
        this.author = new User(data.author, this.client);
        this.channelID = data.channel_id;
        this.content = data.content;
        this.editedTimestamp = data.edited_timestamp ? new Date(data.edited_timestamp) : null;
        this.embeds = data.embeds;
        this.id = data.id;
        this.member = data.member ? new Member(data.member, this.client, this.guildID) : null;
        this.mentionEveryone = data.mention_everyone;
        this.mentionRoles = data.mention_roles;
        this.mentions = data.mentions ? data.mentions.map(u => new User(u)) : [];
        this.pinned = data.pinned;
        this.timestamp = new Date(data.timestamp);
        this.type = data.type;
    }
}

module.exports = Message;
