class Channel {
    /**
     * Creates an instance of Channel.
     * @param {Object} data Channel data
     * @param {Object} client Discord client
     * @memberof Channel
     */
    constructor(data, client) {
        this.client = client;

        Object.assign(this, data);
    }

    /**
     * Get the creation date timestamp for the channel
     *
     * @readonly
     * @memberof Channel
    */
    get created_at() {
        return (this.id / 4194304) + 1420070400000;
    }
}

module.exports = Channel;
