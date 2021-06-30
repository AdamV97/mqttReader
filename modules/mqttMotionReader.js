const mqtt = require('mqtt');
const mysql = require('mysql');
const fs = require('fs');
const {admin} = require('../firebase-config.js');

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

  if(currentTime > 7 && currentTime < 19){
    return false;
  }

  return true;
};

function getInstallationTokens(){
  return new Promise(resolve => {
    let tokens = [];
    let sql = "SELECT token FROM installation_token"

    con.query(sql, function (err, result, fields) {
      if (err) throw err;
      for(let i = 0; i < result.length; i++){
        tokens.push(result[i].token);
      }
      resolve(tokens);
    });
  });
}

async function sendNotification(){
  const tokens = await getInstallationTokens();

  const message = {
    notification: {
      title: 'Motion Sensor!',
      body: 'Somebody triggerd the motion sensor!'
    },
    android:{
      priority:"high"
    },
    tokens: tokens
  };
  
  admin.messaging().sendMulticast(message, false)
  .then((response) => {
    console.log(response.successCount + ' users have been alerted');
  });
}

function getActiveAlarms(){
  return new Promise(resolve => {
    let sql = "SELECT active FROM alarm WHERE id = 3"

    con.query(sql, function (err, result, fields) {
      if (err) throw err;

      resolve(result[0].active);

    });
  });
}

async function triggerAlarms(){
  const isActive = await getActiveAlarms();
  if(isActive){
    sendNotification();
  }
}

client.on('message', async (topic, message) => {
  let motionSensorData = JSON.parse(message.toString());
  motionSensorData.topic = topic;

  triggerAlarms();

  if(!motionSensorData.occupancy){
    client.publish('zigbee2mqtt/0x842e14fffe3597db/set', '{"state": "OFF"}');
  }else if(motionSensorData.occupancy && checkTime()){
    client.publish('zigbee2mqtt/0x842e14fffe3597db/set', '{"state": "ON"}');
  }

  writeData(motionSensorData);
});

