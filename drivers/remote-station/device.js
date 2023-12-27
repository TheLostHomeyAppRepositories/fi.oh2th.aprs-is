'use strict';

const mainDevice = require('../main-device');

module.exports = class stationDevice extends mainDevice {

	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit() {
		this.log(`${this.getName()} - onInit`);
		this.setUnavailable(`Initializing ${this.getName()}`).catch(this.error);

		const settings = this.getSettings();
		// TX Interval is only needed for devices that sends reports to APRS-IS. Some devices read only.
		// Interval in use with: wx-station
		if (settings.interval) this.txInterval = settings.interval;

		this.aprs = new APRSClient(settings.server, PORTNUMBER, settings.callsign, settings.passcode, settings.filter);
		this.aprs.appVersion = `${this.homey.manifest.id} ${this.homey.manifest.version}`;
		this.aprs.debug = DEBUG;

		checkCapabilities(this);
		startInterval(this, INTERVAL);

		this.aprs.connect().catch((err) => {
			this.log(`${this.getName()} - onInit - connect error: ${err}`);
		});

		this.log(`${this.getName()} - onInit done`);
	}


};
