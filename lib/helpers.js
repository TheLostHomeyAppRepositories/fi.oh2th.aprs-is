'use strict';

const self = module.exports;

/**
 * @description Wait for a number of milliseconds
 * @param {number} ms - Number of milliseconds to wait
 * @returns {Promise} Promise
 */
exports.sleep = async function(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * @description Update the Capabilities discovered with checkCapabilities()
 * @param {Object} ctx - Homey context
 * @param {Array} driverCapabilities - Capabilities from the driver
 * @param {Array} deviceCapabilities - Capabilities from the device
 */
exports.updateCapabilities = async function(ctx, driverCapabilities, deviceCapabilities) {
	try {
		const newC = driverCapabilities.filter((d) => !deviceCapabilities.includes(d));
		const oldC = deviceCapabilities.filter((d) => !driverCapabilities.includes(d));

		ctx.log(`${ctx.getName()} - Got old capabilities =>`, oldC);
		ctx.log(`${ctx.getName()} - Got new capabilities =>`, newC);

		oldC.forEach((c) => {
			ctx.log(`${ctx.getName()} - updateCapabilities => Remove `, c);
			ctx.removeCapability(c);
		});
		await self.sleep(2000);
		newC.forEach((c) => {
			ctx.log(`${ctx.getName()} - updateCapabilities => Add `, c);
			ctx.addCapability(c);
		});
		await self.sleep(2000);
	} catch (error) {
		ctx.log(error);
	}
};

/**
 * @description Check if Capabilities has changed and update them
 * @param {Object} ctx - Homey context
 * @returns {Object} deviceCapabilities - Device Capabilities
 */
exports.checkCapabilities = function(ctx) {
	try {
		const driverManifest = ctx.driver.manifest;
		const driverCapabilities = driverManifest.capabilities;
		const deviceCapabilities = ctx.getCapabilities();

		ctx.log(`${ctx.getName()} - checkCapabilities for`, driverManifest.id);
		ctx.log(`${ctx.getName()} - Found capabilities =>`, deviceCapabilities);

		self.updateCapabilities(ctx, driverCapabilities, deviceCapabilities);

		return deviceCapabilities;
	} catch (error) {
		ctx.log(error);
		return [];
	}
};

/**
 * @description Polling interval to update the device capability values
 * Synchonized to run on the minute
 * @param {Object} ctx - Homey context
 * @param {number} ms - Number of milliseconds for interval
 */
exports.startInterval = async function(ctx, ms) {
	// Calculate the time remaining until the next minute
	const now = new Date();
	const startDelay = (60 - now.getSeconds()) * 1000 + now.getMilliseconds();

	try {
		ctx.log(`${ctx.getName()} - onPollInterval =>`, ms);
		// Wait until the next minute before starting the interval
		setTimeout(() => {
			// Set the interval to run every 60 seconds
			ctx.onPollInterval = setInterval(ctx.onInterval.bind(ctx), ms);
		}, startDelay);
	} catch (error) {
		ctx.setUnavailable(error);
		ctx.log(error);
	}
};

/**
 * @description Clear all intervals
 * @param {Object} ctx - Homey context
 */
exports.clearIntervals = async function(ctx) {
	try {
		ctx.log(`${ctx.getName()} - clearIntervals`);
		clearInterval(ctx.onPollInterval);
	} catch (error) {
		ctx.log(error);
	}
};
