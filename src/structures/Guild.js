const Constants = require('./../util/constants');

class Guild {
    constructor(data, client) {
        if (data.roles) { delete data.roles; }

        this.client = client;
        Object.assign(this, data);
    }

    /**
     * Get the iconURL of the guild
     *
     * @readonly
     * @memberof Guild
     */
    get iconURL() {
        return `${Constants.CDN_URL}/icons/${this.id}/${this.icon}.png`;
    }

    /**
     * Get the creation date timestamp for the guild
     *
     * @readonly
     * @memberof Guild
    */
    get created_at() {
        return (this.id / 4194304) + 1420070400000;
    }
}

module.exports = Guild;
