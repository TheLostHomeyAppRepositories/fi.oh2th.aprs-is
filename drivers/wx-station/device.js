'use strict';

const mainDevice = require('../main-device');

const { sleep, checkCapabilities, startInterval, clearIntervals } = require('../../lib/helpers');
const APRSClient = require('../../lib/aprs-client');

const INTERVAL = 60000;
const PORTNUMBER = 14580;
const DEBUG = false;

module.exports = class stationDevice extends mainDevice {

	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit() {
		this.log(`${this.getName()} - onInit`);
		this.setUnavailable(`Initializing ${this.getName()}`).catch(() => {});

		const settings = this.getSettings();
		// TX Interval is only needed for devices that sends reports to APRS-IS. Some devices read only.
		// Interval in use with: wx-station
		if (settings.interval) this.txInterval = settings.interval;

		this.aprs = new APRSClient(settings.server, PORTNUMBER, settings.callsign, settings.passcode, settings.filter);
		this.aprs.appVersion = `${this.homey.manifest.id} ${this.homey.manifest.version}`;
		this.aprs.debug = DEBUG;

		this.initOnConnect();
		this.initOnData();
		this.initOnConnectClose(false);
		this.initOnConnectEnd(false);
		this.initOnConnectError(false);

		checkCapabilities(this);
		startInterval(this, INTERVAL);

		this.setAvailable().catch(this.error);

		this.log(`${this.getName()} - onInit done`);
	}

	/**
	 * @description Main polling interval to perform periodic actions.
	 */
	async onInterval() {
		// this.log(`${this.getName()} - onInterval`);
		const now = new Date();
		const nowMinutes = now.getMinutes();

		// Purge rain history every five minutes
		if (nowMinutes % 5 === 0) this.purgeRainHistory();

		// Trasmit data to APRS-IS every txInterval minutes for devices that transmit.
		if (this.txInterval) {
			if (nowMinutes % this.txInterval === 0) {
				this.log(`${this.getName()} - onInterval - txInterval - ${this.txInterval} minutes`);
				this.aprs.connect().catch((err) => {
					this.log(`${this.getName()} - onInit - connect error: ${err}`);
				});
			}
		}

		// Restart Interval if offset in seconds is more than 5 seconds
		if (now.getSeconds() >= 5) {
			this.log(`${this.getName()} - onInterval - restart interval`);
			clearIntervals(this);
			startInterval(this, INTERVAL);
		}
		// this.log(`${this.getName()} - onInterval done`);
	}

	/**
	 * @description On Connect, login, transmit data and disconnect.
	 */
	async initOnConnect() {
		this.aprs.on('connect', async (server) => {
			this.log(`${this.getName()} - APRSClient - connected: ${server}`);
			this.aprs.userLogin().catch(this.error).then(this.log(`${this.getName()} - APRSClient - logged in.`));
			this.transmitWXStationData();
			sleep(15000).then(() => {
				this.log(`${this.getName()} - APRSClient - disconnecting.`);
				this.aprs.disconnect();
			});
		});
	}

};
