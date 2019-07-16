/*
 * Copyright (c) 2015 Sylvain Peyrefitte
 *
 * This file is part of mstsc.js.
 *
 * mstsc.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var rdp 	= require('node-rdpjs');
var fs 		= require('fs');
var mysql 	= require('mysql');



/**
 * Create proxy between rdp layer and socket io
 * @param server {http(s).Server} http server
 */
module.exports = function (server) {
	var io = require('socket.io')(server);
	io.on('connection', function(client) {

		var rdpClient = null;
		client.on('b64use', function(b64) {
			var buf = Buffer.from(b64.b64, 'base64');
			let incomingPacket = JSON.parse(buf.toString('utf-8'))
			console.log(incomingPacket);
			console.log(incomingPacket.targets.eids[0]);
			console.log(incomingPacket.targets.store);
			var connection = mysql.createConnection({
				host: 'localhost',
				user: 'testUser',
				password: 'testPassword',
				database: 'nodejspractice'
			});
			connection.connect();
			connection.query("SELECT * FROM equipments WHERE id = ?", incomingPacket.targets.eids, function(error, results, fields) {
				console.log(error);
				console.log(results);
				if (null != results) {
					console.log(results[0].host + ":" + results[0].port + " " + results[0].username + " " + results[0].password);
					client.emit('rdp-data-connection', {
						ip: results[0].host,
						port: results[0].port,
						username: results[0].username,
						password: results[0].password
					});
				}
			});

		});
		client.on('infos', function (infos) {
			console.log(infos);
			if (rdpClient) {
				// clean older connection
				rdpClient.close();
			};
			
			rdpClient = rdp.createClient({ 
				domain : infos.domain, 
				userName : infos.username,
				password : infos.password,
				enablePerf : true,
				autoLogin : true,
				screen : infos.screen,
				locale : infos.locale,
				logLevel : process.argv[2] || 'INFO'
			}).on('connect', function () {
				client.emit('rdp-connect');
			}).on('bitmap', function(bitmap) {
				client.emit('rdp-bitmap', bitmap);
			}).on('close', function() {
				client.emit('rdp-close');
			}).on('error', function(err) {

				fs.writeFile("logs.txt", "[error] " + err, function (err) {
				if (err)
					console.log(err);
				});

				client.emit('rdp-error', err);
			}).connect(infos.ip, infos.port);
		}).on('mouse', function (x, y, button, isPressed) {
			if (!rdpClient)  return;

			rdpClient.sendPointerEvent(x, y, button, isPressed);
		}).on('wheel', function (x, y, step, isNegative, isHorizontal) {
			if (!rdpClient) {
				return;
			}
			rdpClient.sendWheelEvent(x, y, step, isNegative, isHorizontal);
		}).on('scancode', function (code, isPressed) {
			if (!rdpClient) return;

			fs.writeFile("logs.txt", "[KC] " + code + " ", function (err) {
				if (err)
					return console.log(err);
			});
			rdpClient.sendKeyEventScancode(code, isPressed);
		}).on('unicode', function (code, isPressed) {

			fs.writeFile("logs.txt", "[KC] " + code + " ", function (err) {
				if (err)
					return console.log(err);
			});
			
			if (!rdpClient) return;

			rdpClient.sendKeyEventUnicode(code, isPressed);
		}).on('disconnect', function() {
			if(!rdpClient) return;

			rdpClient.close();
		});
	});
}