'use strict';

const { Driver } = require('homey');

module.exports = class StationDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('StationDriver has been initialized');
  }

  async onPair(session) {
    this.log('onPair new session...');
  }

};
