'use strict';

exports.init = async function(ctx) {
  /**
   * Device actions
   */
  const onAction_DEVICE_UPDATE_TEMPERATURE = ctx.homey.flow.getActionCard('device_update_temperature');
  onAction_DEVICE_UPDATE_TEMPERATURE.registerRunListener(async (args, state) => {
    await args.device.onAction_DEVICE_UPDATE_TEMPERATURE(args.temperature);
  });

  const onAction_DEVICE_UPDATE_HUMIDITY = ctx.homey.flow.getActionCard('device_update_humidity');
  onAction_DEVICE_UPDATE_HUMIDITY.registerRunListener(async (args, state) => {
    await args.device.onAction_DEVICE_UPDATE_HUMIDITY(args.humidity);
  });

  const onAction_DEVICE_UPDATE_PRESSURE = ctx.homey.flow.getActionCard('device_update_pressure');
  onAction_DEVICE_UPDATE_PRESSURE.registerRunListener(async (args, state) => {
    await args.device.onAction_DEVICE_UPDATE_PRESSURE(args.pressure);
  });

  const onAction_DEVICE_UPDATE_WIND = ctx.homey.flow.getActionCard('device_update_wind');
  onAction_DEVICE_UPDATE_WIND.registerRunListener(async (args, state) => {
    await args.device.onAction_DEVICE_UPDATE_WIND(args.wind_speed, args.wind_angle);
  });

  const action_DEVICE_UPDATE_RAIN = ctx.homey.flow.getActionCard('device_update_rain');
  action_DEVICE_UPDATE_RAIN.registerRunListener(async (args, state) => {
    await args.device.onAction_DEVICE_UPDATE_RAIN(args);
  });

}