const net = require('net');
const EventEmitter = require('events');

/**
 * APRS client class for connecting to an APRS server and receiving packets.
 *
 * @extends EventEmitter
 */
module.exports = class APRSClient extends EventEmitter {
  /**
   * Creates a new instance of the APRSClient class.
   *
   * @param {string} host - The hostname of the APRS server to connect to.
   * @param {number} port - The port number of the APRS server to connect to.
   * @param {string} callsign - The callsign to use when connecting to the APRS server.
   * @param {string} passcode - The passcode associated with the callsign.
   * @param {string} filter - The APRS filter to use when connecting to the server.
   * @param {string} [appVersion='AprsClient 1.0.0'] - The application ID to send when connecting to the server.
   * @param {number} [reconnectTimeout=10000] - The number of milliseconds to wait before reconnecting if the connection is lost.
   * @param {boolean} [debug=false] - Whether or not to log debug messages.
   */
  constructor(host, port, callsign, passcode, filter = '', appVersion = 'AprsClient 1.0.0', reconnectTimeout = 10000, debug = false) {
    super();
    this.host = host;
    this.port = port;
    this.callsign = callsign;
    this.passcode = passcode;
    this.filter = filter;
    this.appVersion = appVersion;
    this.reconnectTimeout = reconnectTimeout;
    this.debug = debug;
    this.connected = false;
    this.socket = null;
  }

  /**
   * Establishes a connection to the APRS server.
   *
   * @fires APRSClient#connect
   * @fires APRSClient#data
   * @fires APRSClient#error
   * @fires APRSClient#end
   * @fires APRSClient#close
   * @returns {Promise<void>} A promise that resolves when the connection has been established.
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        return reject(new Error('Already connected'));
      }

      this.socket = net.createConnection({
        host: this.host,
        port: this.port
      });

      this.socket.on('connect', () => {
        /**
         * Emitted when the client connects to the server.
         * @event APRSClient#connect
        */
        this.connected = true;
        this.emit('connect', this.host);
        resolve();
      });

      this.socket.on('data', (data) => {
        /**
         * Use regex to split the packet data into an array of call sign, path, and payload.
         * Match callsigns with optional SSID - ([a-zA-Z0-9]{1,3}[0-9][a-zA-Z0-9]{0,3}[a-zA-Z]-?1?[0-9A-Z]?)
         * - sepatated by >
         * Match path - (.*?) lazy match
         * - sepatated by the first :
         * Match payload - (.*) - rest of the line
         */
        const regex = /^([a-zA-Z0-9]{1,3}[0-9][a-zA-Z0-9]{0,3}[a-zA-Z]-?1?[0-9A-Z]?)>(.*?):(.*)$/;
        let packetData = data.toString('utf-8').trim();
        packetData = packetData.replace(/\r\n/g, '\n');
        if (this.debug) console.log(packetData);
        // Skip server messages
        if (packetData.startsWith('#')) return

        const packetArray = packetData.split(regex);
        const packet = {
          source: packetArray[1],
          path: packetArray[2],
          payload: packetArray[3]
        };
        if (this.debug) console.log(packet);
        // Skip packets that don't match the regex
        if (packet.source === undefined || packet.path === undefined || packet.payload === undefined) return;
        this.emit('data', packet);
      });

      this.socket.on('error', (error) => {
        /**
         * Emitted when an error occurs while connecting to or receiving data from the server.
         *
         * @event APRSClient#error
         * @type {Error}
         */
        this.emit('error', `Error from ${this.host}: ${error}`);
        this.connected = false;
        reject(error);
      });

      this.socket.on('end', (error) => {
        /**
         * Emitted when the connection to the server is disconnected by server.
         *
         * @event APRSClient#end
         */
        this.emit('end', `Disconnected from ${this.host}: ${error}`);
        this.connected = false;
        reject(error);
      });

      this.socket.on('close', () => {
        /**
         * Emitted when the APRS client is disconnected by us.
         *
         * @event APRSClient#close
         */
        this.emit('close', `Disconnected from ${this.host}`);
        this.connected = false;
        reject(new Error('Connection closed'));
      });
    });
  }

  /**
   * Closes the existing connection and connects a new session.
   *
   * @fires APRSClient#reconnect
   * @returns {Promise<void>} A promise that resolves when the new connection has been established.
   */
  reconnect() {
    return new Promise((resolve, reject) => {
      /**
       * Emitted when the APRS client is attempting to reconnect to the server.
       *
       * @event APRSClient#reconnecting
       */
      this.emit('reconnect', this.host);
      this.socket.destroy();
      this.connected = false;
      setTimeout(() => {
        this.connect()
          .then(() => {
            resolve();
          })
          .catch((error) => {
            reject(error);
          });
      }, this.reconnectTimeout);
    });
  }

  /**
   * Disconnects from the APRS server without reconnecting.
   */
  disconnect() {
    this.socket.removeAllListeners();
    this.socket.end();
    this.socket.destroy();
    this.connected = false;
  }

  /**
   * Login to the APRS server.
   * 
   * @returns {Promise<void>} A promise that resolves when the login has been completed.
   */
  userLogin() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to APRS server.'));
      }
      const userString = `user ${this.callsign} pass ${this.passcode} vers ${this.appVersion}`;
      const filterString = `#filter ${this.filter}`;
      if (this.debug) console.log(`User Login: ${userString}`);
      this.socket.write(userString + '\r\n');
      if (this.debug) console.log(`Filter: ${filterString}`);
      this.socket.write(filterString + '\r\n');
      resolve();
    });
  }

  /**
   * Filter for the APRS server.
   * 
   * @returns {Promise<void>} A promise that resolves when the filter has been completed.
   */
  userFilter() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to APRS server.'));
      }
      const filterString = `#filter ${this.filter}`;
      if (this.debug) console.log(`Filter: ${filterString}`);
      this.socket.write(filterString + '\r\n');
      resolve();
    });
  }

  /**
   * Sends a message to the APRS server.
   *
   * @param message - The message to send.
   */
  sendMessage(message) {
    if(this.debug) console.log(`Sending message: ${message}`);
    if (this.socket) {
      this.socket.write(`${this.callsign}>APHMEY,TCPIP*:${message}\r\n`);
    } else {
      console.error('Error: not connected to APRS server.');
    }
  }

  /**
   * Sends a position report to the APRS server, with optional speed and heading.
   *
   * @param positionReport - The position report to send.
   * @param positionReport.latitude - The latitude of the position.
   * @param positionReport.longitude - The longitude of the position.
   * @param positionReport.symbolTable - The symbol table to use for the position.
   * @param positionReport.symbolCode - The symbol code to use for the position.
   * @param positionReport.speed - An optional speed in knots to include in the position report.
   * @param positionReport.heading - An optional heading in degrees to include in the position report.
   * @param positionReport.comment - An optional comment to include in the position report.
   */
  sendPositionReport(positionReport) {
    const { latitude, longitude, symbolTable = '/', symbolCode = '-', speed = null, heading = null, comment = null } = positionReport;
    // Default symbol from primary table is a house.

    const latDeg = Math.floor(Math.abs(latitude));
    const latMin = (Math.abs(latitude) - latDeg) * 60;
    const latHemisphere = latitude >= 0 ? 'N' : 'S';

    const longDeg = Math.floor(Math.abs(longitude));
    const longMin = (Math.abs(longitude) - longDeg) * 60;
    const longHemisphere = longitude >= 0 ? 'E' : 'W';

    let message = `!${latDeg.toString().padStart(2, '0')}${latMin.toFixed(2)}${latHemisphere}${symbolTable}${longDeg.toString().padStart(3, '0')}${longMin.toFixed(2)}${longHemisphere}${symbolCode}`;

    if (speed !== undefined && heading !== undefined) {
      const speedKnots = Math.round(speed);
      const headingDegrees = Math.round(heading);
      message += `#${speedKnots.toString().padStart(3, '0')}${headingDegrees.toString().padStart(3, '0')}`;
    }

    message += `${comment ? ` ${comment}` : ''}`;

    console.log(`Sending position report: ${message}`);
    // this.sendMessage(message);
  }

  /**
   * Sends an APRS weather report with latitude, longitude, and timestamp.
   *
   * @param weatherReport - An object containing weather data properties.
   * @param weatherReport.latitude - The latitude of the weather station.
   * @param weatherReport.longitude - The longitude of the weather station.
   * @param weatherReport.symbolTable - The symbol table to use for the weather report.
   * @param weatherReport.symbolCode - The symbol code to use for the weather report.
   * @param weatherReport.temperature - The temperature in degrees Celsius.
   * @param weatherReport.windDirection - The wind direction in degrees.
   * @param weatherReport.windSpeed - The wind speed in knots.
   * @param weatherReport.windSpeedGust - The wind speed gust in knots.
   * @param weatherReport.humidity - The humidity in percent.
   * @param weatherReport.pressure - The pressure in millibars.
   * @param weatherReport.rainLastHour - The rain in the last hour in millimeters.
   * @param weatherReport.rainLast24Hours - The rain in the last 24 hours in millimeters.
   * @param weatherReport.rainSinceMidnight - The rain since midnight in millimeters.
   * @param weatherReport.comment - An optional comment to include in the weather report.
   */
  sendAprsWeatherReport(weatherReport) {
    let {
      latitude,
      longitude,
      symbolTable = '/',
      symbolCode = '_',
      temperature = null,
      windDirection = null,
      windSpeed = null,
      windSpeedGust = null,
      humidity = null,
      pressure = null,
      rainLastHour = null,
      rainLast24Hours = null,
      rainSinceMidnight = null,
      comment = null,
    } = weatherReport;

    const timestamp = new Date();

    const dom = timestamp.getUTCDate().toString().padStart(2, '0');
    const hour = timestamp.getUTCHours().toString().padStart(2, '0');
    const minute = timestamp.getUTCMinutes().toString().padStart(2, '0');

    if (this.debug) console.log(JSON.stringify(weatherReport));

    //  t is in degrees Fahrenheit, rounded to the nearest integer.
    if(temperature !== null) {
      temperature = (temperature * 1.8 + 32).toFixed(0).padStart(3, '0');
    } else {
      temperature = '...';
    }

    // c is wind direction in degrees, rounded to the nearest integer.
    if(windDirection !== null) {
      windDirection = windDirection.toFixed(0).padStart(3, '0');
    } else {
      windDirection = '...';
    }

    // s is sustained winds in mph
    if(windSpeed !== null) {
      windSpeed = (windSpeed / 1.609).toFixed(0).padStart(3, '0');
    } else {
      windSpeed = '...';
    }

    // g is Gust (peak winds in last 5 minutes) in mph
    if(windSpeedGust !== null) {
      windSpeedGust = (windSpeedGust / 1.609).toFixed(0).padStart(3, '0');
    } else {
      windSpeedGust = '...';
    }

    // h is humidity in percent. 00=100
    if(humidity !== null) {
      if (humidity === 100) humidity = 0;
      humidity = humidity.toFixed(0).padStart(2, '0');
    } else {
      humidity = '..';
    }

    // b is Baro in tenths of a mb 
    if(pressure !== null) {
      pressure = (pressure * 10).toFixed(0).padStart(5, '0');
    } else {
      pressure = '.....';
    }

    // r is Rain per last 60 minutes in hundredths of an inch, rounded to the nearest integer.
    if(rainLastHour !== null) {
      rainLastHour = (rainLastHour * 25.4 / 100).toFixed(0).padStart(3, '0');
    } else {
      rainLastHour = '...';
    }

    // p is precipitation per last 24 hours (sliding 24 hour window) in hundredths of an inch, rounded to the nearest integer.
    if(rainLast24Hours !== null) {
      rainLast24Hours = (rainLast24Hours * 25.4 / 100).toFixed(0).padStart(3, '0');
    } else {
      rainLast24Hours = '...';
    }

    // P is precipitation since midnight (local time) in hundredths of an inch, rounded to the nearest integer.
    if(rainSinceMidnight !== null) {
      rainSinceMidnight = (rainSinceMidnight * 25.4 / 100).toFixed(0).padStart(3, '0');
    } else {
      rainSinceMidnight = '...';
    }

    const latDeg = Math.floor(Math.abs(latitude));
    const latMin = (Math.abs(latitude) - latDeg) * 60;
    const latHemisphere = latitude >= 0 ? 'N' : 'S';

    const longDeg = Math.floor(Math.abs(longitude));
    const longMin = (Math.abs(longitude) - longDeg) * 60;
    const longHemisphere = longitude >= 0 ? 'E' : 'W';

    // as seen in raw data from aprs.fi
    // 2023-02-24 23:35:57 EET: OH2TH>APRS,TCPIP*,qAC,CWOP-6:@242130z6011.82N/02435.40E_.../...g...t024r000p004P004b09940h98.weewx-4.5.1-netatmo
    // 2023-02-25 00:06:23 EET: OH2TH>APRS,TCPIP*,qAC,CWOP-7:@242200z6011.82N/02435.40E_.../...g...t024r000p004P000b09939h98.weewx-4.5.1-netatmo
    // and new format with this app
    // APRS report:                                          @251920z6011.82N/02435.42E_.../...g...t025r...p005P007b10010h00 Homey WX-Station
    const positionReport = `${latDeg.toString().padStart(2, '0')}${latMin.toFixed(2)}${latHemisphere}${symbolTable}${longDeg.toString().padStart(3, '0')}${longMin.toFixed(2)}${longHemisphere}${symbolCode}`;
    let message = `@${dom}${hour}${minute}z${positionReport}${windDirection}/${windSpeed}g${windSpeedGust}t${temperature}r${rainLastHour}p${rainLast24Hours}P${rainSinceMidnight}b${pressure}h${humidity}`;
    message += `${comment ? ` ${comment}` : ''}`;

    if(this.debug) console.log('APRS report:', message);
    this.sendMessage(message);
  }

}