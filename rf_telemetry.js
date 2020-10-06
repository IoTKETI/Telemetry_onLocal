/**
 * Created by Il Yeup, Ahn in KETI on 2020-09-04.
 */

var mqtt = require('mqtt');
var fs = require('fs');
var util = require('util');
var moment = require('moment');
var SerialPort = require('serialport');

var mavPort = null;

var mqtt_client = null;

var mavPortNum = '/dev/ttyAMA0';
var mavBaudrate = '57600';
mavPortNum = check_port();
// console.log('- ', mavPortNum);

var ae_name = 'UTM_UVARC';
var cnt_name = 'KETI_Air_01';

var my_parent_cnt_name = '/Mobius/' + ae_name + '/Drone_Data/' + cnt_name;
var my_cnt_name = '/Mobius/' + ae_name + '/Drone_Data/' + cnt_name + '/disarm';
var sub_gcs_topic = '/Mobius/' + ae_name + '/GCS_Data/' + cnt_name;
var noti_topic = util.format('/oneM2M/req/+/S%s/#', ae_name);
tas_ready();

function check_port(){
    if (process.platform == 'win32') {
        SerialPort.list(function(err, ports){
            ports.forEach(function(port){
            // console.log("Port: ", port);
            mavPortNum = port.comName;
            console.log('Windows - ', mavPortNum);
            })
        });
    }
    else if (process.platform == 'darwin') {
        let portser;
        (async () => {
            try {
              const serialList = await SerialPort.list();
              findPort = serialList.find(port => port.vendorId === '0403');
              mavPortNum = findPort.comName;
              console.log('MacOS - ', mavPortNum);
            } catch (e) {
              console.log(e);
            }
        })()
    }
    return mavPortNum;
}

function tas_ready() {
    // if(my_drone_type === 'dji') {
    //     if (_server == null) {
    //         _server = net.createServer(function (socket) {
    //             console.log('socket connected');
    //             socket.id = Math.random() * 1000;

    //             socket.on('data', dji_handler);

    //             socket.on('end', function () {
    //                 console.log('end');
    //             });

    //             socket.on('close', function () {
    //                 console.log('close');
    //             });

    //             socket.on('error', function (e) {
    //                 console.log('error ', e);
    //             });
    //         });

    //         _server.listen(conf.ae.tas_mav_port, function () {
    //             console.log('TCP Server (' + ip.address() + ') for TAS is listening on port ' + conf.ae.tas_mav_port);

    //             // setTimeout(dji_sdk_launch, 1500);
    //         });
    //     }
    // }
    // else if(my_drone_type === 'pixhawk') {
    mavBaudrate = '57600';
    if (mavPortNum != '/dev/ttyAMA0'){
        check_port();
    }
    else{
        setTimeout(mavPortOpening, 2000);
    }
    // }
    // else {

    // }
};

setTimeout(tas_ready, 2000);

function noti (path_arr, cinObj, socket) {
    var cin = {};
    cin.ctname = path_arr[path_arr.length - 2];
    cin.con = (cinObj.con != null) ? cinObj.con : cinObj.content;

    if (cin.con == '') {
        console.log('---- is not cin message');
    }
    else {
        socket.write(JSON.stringify(cin));
    }
};

function gcs_noti_handler (message) {
    // if(my_drone_type === 'dji') {
    //     var com_msg = message.toString();
    //     var com_message = com_msg.split(":");
    //     var msg_command = com_message[0];

    //     if (msg_command == 't' || msg_command == 'h' || msg_command == 'l') {
    //         socket_mav.write(message);
    //     }
    //     else if (msg_command == 'g') {
    //         if(com_message.length < 5) {
    //             for(var i = 0; i < (5-com_message.length); i++) {
    //                 com_msg += ':0';
    //             }
    //             message = Buffer.from(com_msg);
    //         }
    //         socket_mav.write(message);

    //         var msg_lat = com_message[1].substring(0,7);
    //         var msg_lon = com_message[2].substring(0,7);
    //         var msg_alt = com_message[3].substring(0,3);
    //     }
    //     else if (msg_command == 'm'|| msg_command == 'a') {
    //         socket_mav.write(message);
    //     }
    // }
    // else if(my_drone_type === 'pixhawk') {
    if (mavPort != null) {
        if (mavPort.isOpen) {
            mavPort.write(message);
        }
    }
    // }
    // else {

    // }
};

function mavPortOpening() {
    // mavPortNum = check_port();
    console.log('mav Port ' + mavPortNum + ' Opening...');
    if (mavPort == null) {
        mavPort = new SerialPort(mavPortNum, {
            baudRate: parseInt(mavBaudrate, 10),
        });

        mavPort.on('open', mavPortOpen);
        mavPort.on('close', mavPortClose);
        mavPort.on('error', mavPortError);
        mavPort.on('data', mavPortData);
    }
    else {
        if (mavPort.isOpen) {

        }
        else {
            mavPort.open();
        }
    }
}

function mavPortOpen() {
    console.log('mavPort open. ' + mavPortNum + ' Data rate: ' + mavBaudrate);
    mqtt_connect('localhost', 1883, sub_gcs_topic, noti_topic);
}

function mavPortClose() {
    console.log('mavPort closed.');

    setTimeout(mavPortOpening, 2000);
}

function mavPortError(error) {
    var error_str = error.toString();
    console.log('[mavPort error]: ' + error.message);
    if (error_str.substring(0, 14) == "Error: Opening") {

    }
    else {
        console.log('mavPort error : ' + error);
    }
    setTimeout(mavPortOpening, 2000);
}

global.mav_ver = 1;

var mavStr = [];
var mavStrPacket = '';

var pre_seq = 0;
function mavPortData(data) {
    console.log('===Data===\r\n', data);
    mavStr += data.toString('hex');
    if(data[0] == 0xfe || data[0] == 0xfd) {
        var mavStrArr = [];

        var str = '';
        var split_idx = 0;

        mavStrArr[split_idx] = str;
        for (var i = 0; i < mavStr.length; i+=2) {
            str = mavStr.substr(i, 2);

            if(mav_ver == 1) {
                if (str == 'fe') {
                    mavStrArr[++split_idx] = '';
                }
            }
            else if(mav_ver == 2) {
                if (str == 'fd') {
                    mavStrArr[++split_idx] = '';
                }
            }

            mavStrArr[split_idx] += str;
        }
        mavStrArr.splice(0, 1);

        var mavPacket = '';
        for (var idx in mavStrArr) {
            if(mavStrArr.hasOwnProperty(idx)) {
                mavPacket = mavStrPacket + mavStrArr[idx];

                if(mav_ver == 1) {
                    var refLen = (parseInt(mavPacket.substr(2, 2), 16) + 8) * 2;
                }
                else if(mav_ver == 2) {
                    refLen = (parseInt(mavPacket.substr(2, 2), 16) + 12) * 2;
                }

                if(refLen == mavPacket.length) {
                    mqtt_client.publish(my_cnt_name, Buffer.from(mavPacket, 'hex'));
                    // send_aggr_to_Mobius(my_cnt_name, mavPacket, 1500);
                    mavStrPacket = '';

                    setTimeout(parseMav, 0, mavPacket);
                }
                else if(refLen < mavPacket.length) {
                    mavStrPacket = '';
                    //console.log('                        ' + mavStrArr[idx]);
                }
                else {
                    mavStrPacket = mavPacket;
                    //console.log('                ' + mavStrPacket.length + ' - ' + mavStrPacket);
                }
            }
        }

        if(mavStrPacket != '') {
            mavStr = mavStrPacket;
            mavStrPacket = '';
        }
        else {
            mavStr = '';
        }
    }
}

var fc = {};
try {
    fc = JSON.parse(fs.readFileSync('fc_data_model.json', 'utf8'));
}
catch (e) {
    fc.heartbeat = {};
    fc.heartbeat.type = 2;
    fc.heartbeat.autopilot = 3;
    fc.heartbeat.base_mode = 0;
    fc.heartbeat.custom_mode = 0;
    fc.heartbeat.system_status = 0;
    fc.heartbeat.mavlink_version = 1;

    fc.attitude = {};
    fc.attitude.time_boot_ms = 123456789;
    fc.attitude.roll = 0.0;
    fc.attitude.pitch = 0.0;
    fc.attitude.yaw = 0.0;
    fc.attitude.rollspeed = 0.0;
    fc.attitude.pitchspeed = 0.0;
    fc.attitude.yawspeed = 0.0;

    fc.global_position_int = {};
    fc.global_position_int.time_boot_ms = 123456789;
    fc.global_position_int.lat = 0;
    fc.global_position_int.lon = 0;
    fc.global_position_int.alt = 0;
    fc.global_position_int.vx = 0;
    fc.global_position_int.vy = 0;
    fc.global_position_int.vz = 0;
    fc.global_position_int.hdg = 65535;

    fc.battery_status = {};
    fc.battery_status.id = 0;
    fc.battery_status.battery_function = 0;
    fc.battery_status.type = 3;
    fc.battery_status.temperature = 32767;
    fc.battery_status.voltages = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    fc.battery_status.current_battery = -1;
    fc.battery_status.current_consumed = -1;
    fc.battery_status.battery_remaining = -1;
    fc.battery_status.time_remaining = 0;
    fc.battery_status.charge_state = 0;

    fs.writeFileSync('fc_data_model.json', JSON.stringify(fc, null, 4), 'utf8');
}

var flag_base_mode = 0;

function parseMav(mavPacket) {
    var ver = mavPacket.substr(0, 2);
    if (ver == 'fd') {
        var sysid = mavPacket.substr(10, 2).toLowerCase();
        var msgid = mavPacket.substr(14, 6).toLowerCase();
    }
    else {
        sysid = mavPacket.substr(6, 2).toLowerCase();
        msgid = mavPacket.substr(10, 2).toLowerCase();
    }

    var cur_seq = parseInt(mavPacket.substr(4, 2), 16);

    if(pre_seq == cur_seq) {
        //console.log('        ' + pre_seq + ' - ' + cur_seq + ' - ' + mavPacket);
    }
    else {
        //console.log('        ' + pre_seq + ' - ' + cur_seq + ' - ' + mavPacket;
    }
    pre_seq = (cur_seq + 1) % 256;

    // if(sysid == '37' ) {
    //     console.log('55 - ' + content_each);
    // }
    // else if(sysid == '0a' ) {
    //     console.log('10 - ' + content_each);
    // }
    // else if(sysid == '21' ) {
    //     console.log('33 - ' + content_each);
    // }
    // else if(sysid == 'ff' ) {
    //     console.log('255 - ' + content_each);
    // }

    if (msgid == '21') { // #33
        if (ver == 'fd') {
            var base_offset = 20;
            var time_boot_ms = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var lat = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var lon = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var alt = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var relative_alt = mavPacket.substr(base_offset, 8).toLowerCase();
        }
        else {
            base_offset = 12;
            time_boot_ms = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            lat = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            lon = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            alt = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            relative_alt = mavPacket.substr(base_offset, 8).toLowerCase();
        }

        fc.global_position_int.time_boot_ms = Buffer.from(time_boot_ms, 'hex').readUInt32LE(0);
        fc.global_position_int.lat = Buffer.from(lat, 'hex').readInt32LE(0);
        fc.global_position_int.lon = Buffer.from(lon, 'hex').readInt32LE(0);
        fc.global_position_int.alt = Buffer.from(alt, 'hex').readInt32LE(0);
        fc.global_position_int.relative_alt = Buffer.from(relative_alt, 'hex').readInt32LE(0);

//         mqtt_client.publish(fc_topic, JSON.stringify(fc.global_position_int));
    }

    else if (msgid == '4c') { // #76 : COMMAND_LONG
        // if(authResult == 'done') {
        //     if (secPort.isOpen) {
        //         len = parseInt(mavPacket.substr(2, 2), 16);
        //         const tr_ch = new Uint8Array(5 + len);
        //         tr_ch[0] = 0x5a;
        //         tr_ch[1] = 0xa5;
        //         tr_ch[2] = 0xf7;
        //         tr_ch[3] = (len / 256);
        //         tr_ch[4] = (len % 256);
        //
        //         for (idx = 0; idx < len; idx++) {
        //             tr_ch[5 + idx] = parseInt(mavPacket.substr((10 + idx) * 2, 2), 16);
        //         }
        //
        //         const message = new Buffer.from(tr_ch.buffer);
        //         secPort.write(message);
        //     }
        // }
    }

    else if (msgid == '00') { // #00 : HEARTBEAT
        if (ver == 'fd') {
            base_offset = 20;
            var custom_mode = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var type = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var autopilot = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var base_mode = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var system_status = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var mavlink_version = mavPacket.substr(base_offset, 2).toLowerCase();
        }
        else {
            base_offset = 12;
            custom_mode = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            type = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            autopilot = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            base_mode = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            system_status = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            mavlink_version = mavPacket.substr(base_offset, 2).toLowerCase();
        }

        //console.log(mavPacket);
        fc.heartbeat.type = Buffer.from(type, 'hex').readUInt8(0);
        fc.heartbeat.autopilot = Buffer.from(autopilot, 'hex').readUInt8(0);
        fc.heartbeat.base_mode = Buffer.from(base_mode, 'hex').readUInt8(0);
        fc.heartbeat.custom_mode = Buffer.from(custom_mode, 'hex').readUInt32LE(0);
        fc.heartbeat.system_status = Buffer.from(system_status, 'hex').readUInt8(0);
        fc.heartbeat.mavlink_version = Buffer.from(mavlink_version, 'hex').readUInt8(0);

//         mqtt_client.publish(fc_topic, JSON.stringify(fc.heartbeat));

        if(fc.heartbeat.base_mode & 0x80) {
            if(flag_base_mode == 0) {
                flag_base_mode = 1;

                my_sortie_name = moment().format('YYYY_MM_DD_T_HH_mm');
                my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
                // sh_adn.crtct(my_parent_cnt_name+'?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
                // });

                // for(var idx in mission_parent) {
                //     if(mission_parent.hasOwnProperty(idx)) {
                //         setTimeout(createMissionContainer, 50, idx);
                //     }
                // }
            }
        }
        else {
            flag_base_mode = 0;
            my_sortie_name = 'disarm';
            my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
        }

        //console.log(hb);
    }
}

var fc_topic = [];
fc_topic.push(my_cnt_name);

function mqtt_connect(broker_ip, port, sub_gcs_topic, noti_topic) {
    console.log(mqtt_client);
    if(mqtt_client == null) {
        console.log("mqtt client is null");
        var connectOptions = {
            host: broker_ip,
            port: port,
//              username: 'keti',
//              password: 'keti123',
            protocol: "mqtt",
            keepalive: 10,
//              clientId: serverUID,
            protocolId: "MQTT",
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 2000,
            connectTimeout: 2000,
            rejectUnauthorized: false
        };

        mqtt_client = mqtt.connect(connectOptions);

        mqtt_client.on('connect', function () {
            console.log('mqtt_client connected: ', mqtt_client.connected);
            console.log('fc_mqtt is connected');

            if(sub_gcs_topic != '') {
                mqtt_client.subscribe(sub_gcs_topic, function () {
                    console.log('[mqtt_connect] sub_gcs_topic is subscribed: ' + sub_gcs_topic);
                });
            }

            if(noti_topic != '') {
                mqtt_client.subscribe(noti_topic, function () {
                    console.log('[mqtt_connect] noti_topic is subscribed:  ' + noti_topic);
                });
            }
        });

        mqtt_client.on('message', function (topic, message) {
            if(topic == sub_gcs_topic) {
                gcs_noti_handler(message);
            }
            else {
                if(topic.includes('/oneM2M/req/')) {
                    var jsonObj = JSON.parse(message.toString());

                    if (jsonObj['m2m:rqp'] == null) {
                        jsonObj['m2m:rqp'] = jsonObj;
                    }

                    noti.mqtt_noti_action(topic.split('/'), jsonObj);
                }
                else {
                }
            }
        });

        mqtt_client.on('error', function (err) {
            console.log(err.message);
        });
    }
}