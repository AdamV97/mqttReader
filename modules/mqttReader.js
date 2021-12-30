const mqtt = require('mqtt');
const mysql = require('mysql');
const fs = require('fs');
const { json } = require('express');

//Read json with database data
let rawdata = fs.readFileSync('data.json');
let jsonData = JSON.parse(rawdata);

//mqtt server
const client = mqtt.connect(jsonData.mqttServer);

const con = mysql.createConnection({
  host: jsonData.database.host,
  user: jsonData.database.user,
  password: jsonData.database.password,
  database: jsonData.database.name,
  insecureAuth: true
});

let lastEntry;

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

  let sql = 'INSERT INTO data (device_id, battery, humidity, linkquality, pressure, temperature, voltage) VALUES (?, ?, ?, ?, ?, ?, ?)';

  con.query(sql, [deviceID, data.battery, data.humidity, data.linkquality, data.pressure, data.temperature, data.voltage], (err, res) => {
    if(err) throw err;
    console.log('Inserted ID = ' + res.insertId);
  });
}

client.on('connect', () => {
  client.subscribe('zigbee2mqtt/0x00158d00047b3223')
})

function checkConnection(){
  if(con.state !== 'authenticated'){
    con.connect(function(err) {
      if (err) throw err;
      console.log("Reconnected to Database!");
    });
  }
}

client.on('message', (topic, message) => {
  checkConnection();
  let ts = Date.now();
  ts = Math.floor(ts/1000);

  let sensorData = JSON.parse(message.toString());
  sensorData.topic = topic;

  //if statement so when sensor sends multiple data in 1 second it dosen't enter all the data
  if(lastEntry !== ts){
    writeData(sensorData);
  }

  lastEntry = ts;
});