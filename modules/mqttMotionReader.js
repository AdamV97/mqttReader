const mqtt = require('mqtt');
const mysql = require('mysql');
const fs = require('fs');

//Read json with server data
let rawdata = fs.readFileSync('data.json');
let jsonData = JSON.parse(rawdata);

//mqtt server
const client = mqtt.connect(jsonData.mqttServer);

client.on('connect', () => {
  client.subscribe('zigbee2mqtt/0xbc33acfffe363aef');
})

const con = mysql.createConnection({
  host: jsonData.database.host,
  user: jsonData.database.user,
  password: jsonData.database.password,
  database: jsonData.database.name
});

function getDeviceDatabaseId(deviceID){
  return new Promise(resolve => {
    let sql = "SELECT id FROM device WHERE device_id = ?"

    con.query(sql, [deviceID], function (err, result, fields) {
      if (err) throw err;

      resolve(result[0].id);

    });
  });
}

async function writeData(data){
  let deviceID = data.topic.replace('zigbee2mqtt/', '');

  deviceID = await getDeviceDatabaseId(deviceID);

  let sql = 'INSERT INTO data (device_id, battery, linkquality, voltage) VALUES (?, ?, ?, ?)';

  con.query(sql, [deviceID, data.battery, data.linkquality, data.voltage], (err, res) => {
    if(err) throw err;
    console.log('Inserted ID = ' + res.insertId);
  });
}

function checkTime(){
  let currentTime = Date.now();
  currentTime = new Date(currentTime).getHours();

  if(currentTime > 7 && currentTime < 17){
    return false;
  }

  return true;
};

client.on('message', async (topic, message) => {
  let motionSensorData = JSON.parse(message.toString());
  motionSensorData.topic = topic;

  if(!motionSensorData.occupancy){
    client.publish('zigbee2mqtt/0x842e14fffe3597db/set', '{"state": "OFF"}');
  }else if(motionSensorData.occupancy && checkTime()){
    client.publish('zigbee2mqtt/0x842e14fffe3597db/set', '{"state": "ON"}');
  }

  writeData(motionSensorData);
});

