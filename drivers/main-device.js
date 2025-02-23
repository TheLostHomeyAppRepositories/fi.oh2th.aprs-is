'use strict';

const { Device } = require('homey');

const { sleep, checkCapabilities, startInterval, clearIntervals } = require('../lib/helpers');
const APRSClient = require('../lib/aprs-client');

const INTERVAL = 60000;
const PORTNUMBER = 14580;
const DEBUG = false;

module.exports = class mainDevice extends Device {
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

    checkCapabilities(this);
    startInterval(this, INTERVAL);

    this.aprs.connect().catch((err) => {
      this.log(`${this.getName()} - onInit - connect error: ${err}`);
    });

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
          break;
        default:
          this.log(`${this.getName()} - onSettings - default`);
      }
    });

    if (reconnect) {
      this.log(`${this.getName()} - onSettings - reconnecting`);
      this.aprs.reconnect().catch((err) => {
        this.log(`${this.getName()} - onSettings - reconnect error: ${err}`);
      });
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
    this.aprs.removeAllListeners();
    this.aprs.disconnect();
    clearIntervals(this);
  }

  /**
   * @description On Connect, login
   */
  initOnConnect() {
    this.aprs.on('connect', (server) => {
      this.log(`${this.getName()} - APRSClient - connected: ${server}`);
      this.aprs
        .userLogin()
        .catch(this.error)
        .then(this.log(`${this.getName()} - APRSClient - logged in.`));
      this.setAvailable().catch(this.error);
    });
  }

  /**
   * @description On Data, process it
   */
  initOnData() {
    this.aprs.on('data', (packet) => {
      this.log(`${this.getName()} - APRSClient - packet: ${JSON.stringify(packet)}`);
    });
  }

  /**
   * @description On connection closed, reconnect
   */
  initOnConnectClose(autoReconnect = false) {
    this.aprs.on('close', (error) => {
      this.log(`${this.getName()} - APRSClient - close: ${error}`);

      if (autoReconnect) {
        this.log(`${this.getName()} - APRSClient - reconnecting`);
        this.setUnavailable(`APRSClient - close: ${error}`).catch(() => {});
        this.aprs.disconnect();
        sleep(1000);
        this.aprs.reconnect().catch((err) => {
          this.log(`${this.getName()} - APRSClient - reconnect error: ${err}`);
        });
      }
    });
  }

  /**
   * @description On connection end, reconnect
   */
  initOnConnectEnd(autoReconnect = false) {
    this.aprs.on('end', (error) => {
      this.log(`${this.getName()} - APRSClient - end: ${error}`);

      if (autoReconnect) {
        this.log(`${this.getName()} - APRSClient - reconnecting`);
        this.setUnavailable(`APRSClient - end: ${error}`).catch(() => {});
        this.aprs.disconnect();
        sleep(1000);
        this.aprs.reconnect().catch((err) => {
          this.log(`${this.getName()} - APRSClient - reconnect error: ${err}`);
        });
      }
    });
  }

  /**
   * @description On connection timeout, log it
   */
  initOnTimeout(autoReconnect = false) {
    this.aprs.on('timeout', (error) => {
      this.log(`${this.getName()} - APRSClient - timeout: ${error}`);
      // this.setUnavailable(`APRSClient - timeout: ${error}`).catch(() => {});
      // this.aprs.disconnect();

      // this.log(`${this.getName()} - APRSClient - reconnecting`);
      // this.aprs.reconnect().catch((err) => {
      //   this.log(`${this.getName()} - APRSClient - reconnect error: ${err}`);
      // });
    });
  }

  /**
   * @description On connection error, log it
   */
  initOnConnectError(autoReconnect = false) {
    this.aprs.on('error', (error) => {
      this.log(`${this.getName()} - APRSClient - error: ${error}`);
      // this.setUnavailable(`APRSClient - error: ${error}`).catch(() => {});
      // this.aprs.disconnect();

      // this.log(`${this.getName()} - APRSClient - reconnecting`);
      // this.aprs.reconnect().catch((err) => {
      //   this.log(`${this.getName()} - APRSClient - reconnect error: ${err}`);
      // });
    });
  }

  /**
   * @description Main polling interval to perform periodic actions.
   * Override this in the device.js, this is here as template
   */
  async onInterval() {
    const now = new Date();
    const nowMinutes = now.getMinutes();

    // Do what is needed here
    this.log(`${this.getName()} - onInterval`);

    // Restart Interval if offset in seconds is more than 5 seconds
    if (now.getSeconds() >= 5) {
      this.log(`${this.getName()} - onInterval - restart interval`);
      clearIntervals(this);
      startInterval(this, INTERVAL);
    }
    // this.log(`${this.getName()} - onInterval done`);
  }

  /**
   * @description onAction DEVICE_UPDATE_TEMPERATURE
   * @param {number} value
   */
  async onAction_DEVICE_UPDATE_TEMPERATURE(value) {
    this.setValue('measure_temperature', value);
  }

  /**
   * @description onAction DEVICE_UPDATE_HUMIDITY
   * @param {number} value
   */
  async onAction_DEVICE_UPDATE_HUMIDITY(value) {
    this.setValue('measure_humidity', value);
  }

  /**
   * @description onAction DEVICE_UPDATE_PRESSURE
   * @param {number} value
   */
  async onAction_DEVICE_UPDATE_PRESSURE(value) {
    this.setValue('measure_pressure', value);
  }

  /**
   * @description onAction DEVICE_UPDATE_WIND
   * @param {object} args
   */
  async onAction_DEVICE_UPDATE_WIND(args) {
    // Wind direction
    this.setValue('measure_wind_angle', Math.round(args.wind_angle));
    // Wind speed
    let wind_speed = args.wind_speed;
    if (args.units === 'm/s') wind_speed = Math.round(args.wind_speed * 36) / 10;
    if (args.units === 'km/h') wind_speed = Math.round(args.wind_speed * 10) / 10;
    if (args.units === 'mph') wind_speed = Math.round(args.wind_speed * 16.09) / 10;
    if (args.units === 'knots') wind_speed = Math.round(args.wind_speed * 18.52) / 10;
    this.setValue('measure_wind_strength', wind_speed);
    // Wind gust - optional argument in flow card
    if (args.wind_gust !== undefined) {
      let wind_gust = args.wind_gust;
      if (args.units === 'm/s') wind_gust = Math.round(args.wind_gust * 36) / 10;
      if (args.units === 'km/h') wind_gust = Math.round(args.wind_gust * 10) / 10;
      if (args.units === 'mph') wind_gust = Math.round(args.wind_gust * 16.09) / 10;
      if (args.units === 'knots') wind_gust = Math.round(args.wind_gust * 18.52) / 10;
      this.setValue('measure_gust_strength', wind_gust);
    } else {
      this.setValue('measure_gust_strength', null);
    }
  }

  /**
   * @description onAction DEVICE_UPDATE_RAIN
   * Here we calculate:
   * - Current rain rate (measure_rain, measure_rain)
   * - Cumulative rain since midnight local time (measure_rain.today)
   * - Cumulative rain for the past 1 hour (measure_rain.1h) - history is stored in the device store as rain1h array of objects { timestamp: Date, rain: number }
   * - Cumulative rain for the past 24 hours (measure_rain.24h) - history is stored in the device store as rain24h array of indexed [0..23] rain values
   * @param {object} args
   */
  async onAction_DEVICE_UPDATE_RAIN(args) {
    const now = new Date();
    // Delay 10 seconds to allow onInterval() to purge any counters during onInterval.
    if (now.getSeconds() === 0) sleep(10000);

    let rain = args.rain;
    if (args.units === 'mm') rain = Math.round(args.rain * 10) / 10;
    if (args.units === 'in') rain = Math.round(args.rain * 25.4 * 10) / 10;

    // Current rain rate
    await this.setValue('measure_rain', rain);

    /**
     * Cumulative rain since midnight local time
     */
    let rainToday = await this.getCapabilityValue('measure_rain.today');
    if (rainToday === null) rainToday = 0;
    rainToday += rain;
    await this.setValue('measure_rain.today', rainToday);
    await this.setStoreValue('rainToday', rainToday).catch(this.error);

    /**
     * 1-hour rain
     * Store the hourly rainfall in an array in the device's settings
     */
    const rain1h = JSON.parse(await this.getStoreValue('rain1h')) || [];
    rain1h.push({ t: now.getTime(), r: rain });
    const rain1hTotal = rain1h.reduce((total, entry) => total + entry.r, 0);
    await this.setValue('measure_rain.1h', rain1hTotal);
    await this.setStoreValue('rain1h', JSON.stringify(rain1h)).catch(this.error);

    /**
     * 24-hour rain
     * Store the hourly rainfall in an array in the device's settings
     */
    const hour = now.getUTCHours();
    const rain24h = JSON.parse(await this.getStoreValue('rain24h')) || [];
    rain24h[hour] = rain1hTotal;
    const rain24hTotal = rain24h.reduce((total, rainfall) => total + rainfall, 0);
    await this.setValue('measure_rain.24h', rain24hTotal);
    await this.setStoreValue('rain24h', JSON.stringify(rain24h)).catch(this.error);
  }

  /**
   * @description purge rain history
   */
  async purgeRainHistory() {
    // this.log(`${this.getName()} - purgeRainHistory`);
    const now = new Date();

    // 1-hour rain
    // Remove any entries from the hourly rainfall array that are more than 1 hour old
    const oldestTimestamp = now.getTime() - 60 * 60 * 1000;
    let rain1h = JSON.parse(await this.getStoreValue('rain1h')) || [];
    rain1h = rain1h.filter((entry) => new Date(entry.t).getTime() > oldestTimestamp);
    if (rain1h.length === 0) {
      this.setCapabilityValue('measure_rain', null).catch(this.error);
      this.setCapabilityValue('measure_rain.1h', null).catch(this.error);
    }
    await this.setStoreValue('rain1h', JSON.stringify(rain1h)).catch(this.error);
    // this.log(`${this.getName()} - purgeRainHistory - rain1h: ${JSON.stringify(rain1h)}`);

    // 24-hour rain on the hour zero the hourly rainfall entry before new data is received
    const rain24h = JSON.parse(await this.getStoreValue('rain24h')) || [];
    if (now.getMinutes() === 0) {
      rain24h[now.getUTCHours()] = 0;
      await this.setStoreValue('rain24h', JSON.stringify(rain24h)).catch(this.error);
      const rain24hTotal = rain24h.reduce((total, rainfall) => total + rainfall, 0);
      if (rain24hTotal === 0) {
        this.setCapabilityValue('measure_rain.24h', null).catch(this.error);
      } else {
        this.setCapabilityValue('measure_rain.24h', rain24hTotal).catch(this.error);
      }
    }
    // this.log(`${this.getName()} - purgeRainHistory - rain24h: ${rain24h}`);

    // Rain today - zero at midnight
    // Can't use getHours() as Homey OS misbehaves and returns UTC instead of local time, so we need to use toLocaleString() to get the current hour in local time.
    const nowHours = Number(now.toLocaleString('POSIX', { timeZone: this.homey.clock.getTimezone(), hour12: false, hour: 'numeric' }));
    if ((nowHours === 0 || nowHours === 24) && now.getMinutes() === 0) {
      this.setStoreValue('rainToday', 0).catch(this.error);
      this.setCapabilityValue('measure_rain.today', null).catch(this.error);
      this.log(`${this.getName()} - purgeRainHistory - rainToday: ${this.getCapabilityValue('measure_rain.today')}`);
    }

    this.log(`${this.getName()} - purgeRainHistory - done`);
  }

  /**
   * @description Set capability value and trigger flow cards if needed.
   * @param {string} key Capability key
   * @param {any} value Capability value, may be a string or number
   * @param {number} delay Delay in ms before setting capability value
   */
  async setValue(key, value, delay = 10) {
    if (this.hasCapability(key)) {
      const oldVal = await this.getCapabilityValue(key);

      if (oldVal !== value) {
        this.log(`${this.getName()} - setValue - oldValue=${oldVal}, newValue=${value} => ${key}`);
      }

      if (delay) await sleep(delay);

      await this.setCapabilityValue(key, value).catch(this.error);
    }
  }

  /**
   * @description Transmit location and current weather data to aprs-is network
   * Uses WX-Station device capability values and Homey location
   * API is in lib/aprs-client.js
   *
   */
  async transmitWXStationData() {
    const latitude = this.homey.geolocation.getLatitude();
    const longitude = this.homey.geolocation.getLongitude();
    const temperature = (await this.getCapabilityValue('measure_temperature')) || null;
    const windDirection = (await this.getCapabilityValue('measure_wind_angle')) || null;
    const windSpeed = (await this.getCapabilityValue('measure_wind_speed')) || null;
    const windSpeedGust = (await this.getCapabilityValue('measure_wind_gust')) || null;
    const humidity = (await this.getCapabilityValue('measure_humidity')) || null;
    const pressure = (await this.getCapabilityValue('measure_pressure')) || null;
    const rainLastHour = (await this.getCapabilityValue('measure_rain.1h')) || null;
    const rainLast24Hours = (await this.getCapabilityValue('measure_rain.24h')) || null;
    const rainSinceMidnight = (await this.getCapabilityValue('measure_rain.today')) || null;

    if (!temperature && !windDirection && !windSpeed && !windSpeedGust && !humidity && !pressure && !rainLastHour && !rainLast24Hours && !rainSinceMidnight) {
      this.log(`${this.getName()} - transmitWXStationData - nothing to send`);
      return;
    }

    this.log(
      `${this.getName()} - transmitWXStationData - lati=${latitude}, long=${longitude}, temp=${temperature}, wdir=${windDirection}, wspd=${windSpeed}, wgst=${windSpeedGust}, humi=${humidity}, baro=${pressure}, r1h=${rainLastHour}, r24h=${rainLast24Hours}, rday=${rainSinceMidnight}`
    );
    this.aprs.sendAprsWeatherReport({
      latitude,
      longitude,
      symbolTable: '/',
      symbolCode: '_',
      temperature,
      windDirection,
      windSpeed,
      windSpeedGust,
      humidity,
      pressure,
      rainLastHour,
      rainLast24Hours,
      rainSinceMidnight,
      comment: 'Homey WX-Station',
    });
  }
};
