'use strict';

const Homey = require('homey');
const process = require('process');

const flowActions = require('./lib/flows/actions');

process.on('unhandledRejection', (reason, promise) => {
	console.error(`${new Date().toISOString()} [log] [process] Unhandled Rejection: ${promise}, reason: ${reason}`);
	// You can add additional error handling or logging here.
});
module.exports = class AprsApp extends Homey.App {

	/**
	 * onInit is called when the app is initialized.
	 */
	async onInit() {
		this.myAppIdVersion = `${this.homey.manifest.id}/${this.homey.manifest.version}`;

		this.log(`${this.myAppIdVersion} - onInit - starting...`);

		await flowActions.init(this);

		this.log(`${this.myAppIdVersion} - onInit - started.`);
	}

};
