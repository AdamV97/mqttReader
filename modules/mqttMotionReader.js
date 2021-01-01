const mqtt = require('mqtt');
const fs = require('fs');

//Read json with server data
let rawdata = fs.readFileSync('data.json');
let jsonData = JSON.parse(rawdata);

//mqtt server
const client = mqtt.connect(jsonData.mqttServer);

client.on('connect', () => {
  client.subscribe('zigbee2mqtt/0xbc33acfffe363aef');
})

function checkTime(){
  let currentTime = Date.now();
  currentTime = new Date(currentTime).getHours();

  if(currentTime > 7 && currentTime < 16){
    return false;
  }

  return true;
};

client.on('message', async (topic, message) => {
  let motionSensorData = JSON.parse(message.toString());

  if(!motionSensorData.occupancy){
    client.publish('zigbee2mqtt/0x842e14fffe3597db/set', '{"state": "OFF"}');
  }else if(motionSensorData.occupancy && checkTime()){
    client.publish('zigbee2mqtt/0x842e14fffe3597db/set', '{"state": "ON"}');
  }

});
