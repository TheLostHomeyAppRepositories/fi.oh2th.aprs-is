'use strict';

const { Device } = require('homey');

const { sleep, checkCapabilities, setCapabilityValuesInterval, clearIntervals } = require('../../lib/helpers');
const APRSClient = require('../../lib/aprs-client');
const PORTNUMBER = 14580;
const DEBUG = false;

module.exports = class StationDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log(`${this.getName()} - onInit`);
    this.setUnavailable(`Initializing ${this.getName()}`);

    const settings = this.getSettings();
    this.interval = settings.interval * 60 * 1000;

    this.aprs = new APRSClient(settings.server, PORTNUMBER, settings.callsign, settings.passcode, settings.filter);
    this.aprs.appVersion = `${this.homey.manifest.id} ${this.homey.manifest.version}`;
    this.aprs.debug = DEBUG;

    this.aprs.on('connect', (server) => {
      this.log(`${this.getName()} - APRSClient - connected: ${server}`);
      this.aprs.userLogin();
      this.setAvailable();
    });

    this.aprs.on('error', (error) => {
      this.log(`${this.getName()} - APRSClient - error: ${error}`);
      this.setUnavailable(`APRSClient - error: ${error}`);
    });

    this.aprs.on('end', (error) => {
      this.log(`${this.getName()} - APRSClient - end: ${error}`);
      this.setUnavailable(`APRSClient - end: ${error}`);
    });

    this.aprs.on('close', (error) => {
      this.log(`${this.getName()} - APRSClient - close: ${error}`);
      this.setUnavailable(`APRSClient - close: ${error}`);
    });

    this.aprs.on('reconnect', (server) => {
      this.log(`${this.getName()} - APRSClient - reconnect: ${server}`);
      this.setUnavailable(`APRSClient - reconnect: ${server}`);
    });

    this.aprs.on('data', (packet) => {
      this.log(`${this.getName()} - APRSClient - packet: ${JSON.stringify(packet)}`);
    });

    checkCapabilities(this);
    await this.setCapabilityListeners();
    await this.setCapabilityValues(true);
    await this.setFlowListeners();
    await sleep(5000);
    setCapabilityValuesInterval(this, this.interval);

    try {
      this.aprs.connect();
    } catch (err) {
      // Nothing here as the error is hanled in the error event
    }

    this.log(`${this.getName()} - onInit done`);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log(`${this.getName()} - onAdded`);
    this.log(`${this.getName()} - onAdded done`);
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings = {}, newSettings = {}, changedKeys = [] }) {
    let reconnect = false;
    this.log(`${this.getName()} - onSettings: ${JSON.stringify(changedKeys)}`);
    changedKeys.forEach((key) => {
      switch (key) {
        case 'server':
          this.log(`${this.getName()} - onSettings - server: ${newSettings.server}`);
          this.aprs.host = newSettings.server;
          reconnect = true;
          break;
        case 'callsign':
          this.log(`${this.getName()} - onSettings - callsign: ${newSettings.callsign}`);
          this.aprs.callsign = newSettings.callsign;
          reconnect = true;
          break;
        case 'passcode':
          this.log(`${this.getName()} - onSettings - passcode: ${newSettings.passcode}`);
          this.aprs.passcode = newSettings.passcode;
          reconnect = true;
          break;
        case 'filter':
          this.log(`${this.getName()} - onSettings - filter: ${newSettings.filter}`);
          this.aprs.filter = newSettings.filter;
          reconnect = true;
          break;
        case 'interval':
          this.log(`${this.getName()} - onSettings - interval: ${newSettings.interval}`);
      }
    });

    if (reconnect) {
      this.log(`${this.getName()} - onSettings - reconnecting`);
      this.aprs.reconnect();
    }

    this.log(`${this.getName()} - onSettings done`);
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log(`${this.getName()} - onRenamed`);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log(`${this.getName()} - onDeleted`);
    this.aprs.disconnect();
    clearIntervals(this);
  }

  /**
   * @description Capability Listeners for UI actions
   *
   */
  async setCapabilityListeners() {
    //this.registerCapabilityListener('target_temperature', this.onCapability_TARGET_TEMPERATURE.bind(this));
    return;
  }

  /**
     * @description Capability Listeners for Flow actions
     * @todo Implement flow cards
     */
  async setFlowListeners() {
    // const action_TARGET_TEMPERATURE = this.homey.flow.getActionCard('set_target_temperature');
    // action_TARGET_TEMPERATURE.registerRunListener(async (args, state) => {
    //   const getCapabilityOptions = this.getCapabilityOptions('target_temperature');
    //   if (args.temperature < getCapabilityOptions.min || args.temperature > getCapabilityOptions.max) {
    //     return Promise.reject(new Error(`Temperature must be between ${getCapabilityOptions.min} and ${getCapabilityOptions.max}`));
    //   }
    //   await args.device.onCapability_TARGET_TEMPERATURE(args.temperature);
    // });
  }

  /**
   * @description onCapability TARGET_TEMPERATURE
   * @param {number} value
   */
  // async onCapability_TARGET_TEMPERATURE(value) {
  //   this.log(`${this.getName()} - onCapability_TARGET_TEMPERATURE: ${value}`);
  //   try {
  //     const settings = this.getSettings();
  //     this.aprs.setTemperature(value, settings.type);
  //   } catch (error) {
  //     this.log(`${this.getName()} - onCapability_TARGET_TEMPERATURE - error setting temperature => `, error);
  //   }
  // }

  /**
     * @description Main info and config update from device poll.
     * @param {boolean} check If true, this is first run and we don't need to trigger flow cards
     */
  async setCapabilityValues(check = false) {
    this.log(`${this.getName()} - setCapabilityValues`);
    this.setValue('measure_temperature', 10, check);
  }

  /**
   * @description Set capability value and trigger flow cards if needed.
   * @param {string} key Capability key
   * @param {any} value Capability value, may be a string or number
   * @param {boolean} firstRun If true, don't trigger flow cards
   * @param {number} delay Delay in ms before setting capability value
   */
  async setValue(key, value, firstRun = false, delay = 10) {
    if (this.hasCapability(key)) {
      const oldVal = await this.getCapabilityValue(key);

      if (oldVal !== value) {
        this.log(`${this.getName()} - oldValue=${oldVal}, newValue=${value} => ${key}`);
      }

      if (delay) await sleep(delay);

      await this.setCapabilityValue(key, value);

      //
      // Capability triggers
      //

      // Boolean capabilities where id starts with 'is_'.
      // if (typeof value === 'boolean' && key.startsWith('is_') && oldVal !== value && !firstRun) {
      //   const newKey = key.replace(/\./g, '_');
      //   const { triggers } = this.homey.manifest.flow;
      //   const triggerExists = triggers.find((trigger) => trigger.id === `${newKey}_changed`);

      //   if (triggerExists) {
      //     await this.homey.flow
      //       .getDeviceTriggerCard(`${newKey}_changed`)
      //       .trigger(this, { [`${key}`]: value })
      //       .catch(this.error)
      //       .then(this.log(`[Device] ${this.getName()} - setValue ${newKey}_changed - Triggered: "${newKey} | ${value}"`));
      //   }
      // }

      // Number capabilities.
      // if (typeof value === 'number' && key.startsWith('num_') && oldVal !== value && !firstRun) {
      //   const newKey = key.replace(/\./g, '_');
      //   const { triggers } = this.homey.manifest.flow;
      //   const triggerExists = triggers.find((trigger) => trigger.id === `${newKey}_changed`);

      //   if (triggerExists) {
      //     await this.homey.flow
      //       .getDeviceTriggerCard(`${newKey}_changed`)
      //       .trigger(this, { [`${key}`]: value })
      //       .catch(this.error)
      //       .then(this.log(`[Device] ${this.getName()} - setValue ${newKey}_changed - Triggered: "${newKey} | ${value}"`));
      //   }
      // }
    }
  }

};
