// Make sure members from the MessageCreate handle properly
class Member {
    constructor(data, client, guildID) {
        this.client = client;
        this.guildID = guildID;

        Object.assign(this, data);
    }
}

module.exports = Member;
