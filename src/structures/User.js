const Constants = require('./../util/constants');

class User {
    constructor(data, client) {
        this.client = client;

        Object.assign(this, data);
    }

    /**
     * Get the avatarURL of the user, either an animated one or static one depending on what they have
     *
     * @readonly
     * @memberof User
     */
    get avatarURL() {
        if (this.avatar.startsWith('a_')) {
            return `${Constants.CDN_URL}/avatars/${this.id}/${this.avatar}.gif`;
        } else {
            return `${Constants.CDN_URL}/avatars/${this.id}/${this.avatar}.png`;
        }
    }

    /**
     * Get the creation date timestamp for the user
     *
     * @readonly
     * @memberof User
     */
    get created_at() {
        return (this.id / 4194304) + 1420070400000;
    }
}

module.exports = User;
