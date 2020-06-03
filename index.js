"use strict";

const udp = require('dgram'),
	  buffer = require('buffer'),
	  sprintf = require('sprintf-js').sprintf,
	  moment = require('moment');

function SMAInverter(host, password) {
	this.host = host;
	this.password = this._encodePassword(true, password);
	this.port = 9522;

	this.client = udp.createSocket('udp4');
	this.client.on('message', this._onMessage);

	this.cmdHeader = '534D4100000402A00000000100'; // SMA\0

	this.addressUnknown = 'FFFFFFFFFFFF';
	this.mySusyid = 'E900'; // random number, has to be different from any device in local network
	this.mySerial = '23BB5907'; // random number, has to be different from any device in local network

	this._logon();
}

SMAInverter.prototype = {

	_encodePassword: function(isUser, pass) {
		const encChar = (isUser) ? 0x88 : 0xBB;
		let encpasswd = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		let i;
		for (i = 0; i < pass.length && i < encpasswd.length; i++) {
			encpasswd[i] = sprintf("%02X", (pass.charCodeAt(i) + encChar) % 256);
		}
		for (; i < encpasswd.length; i++) {
			encpasswd[i] = sprintf("%02X", encChar);
		}

		return encpasswd.join('').toUpperCase();
	},

	_logon: function() {
		var data = Buffer.from(
			this.cmdHeader +
			"3A" + // pktlength = 58
			"001060650EA0" + // esignature
			this.addressUnknown + // target_ID
			"0001" +
			this.mySusyid + this.mySerial + // myID
			"0001" +
			"00000000" +
			"0180" + // spkt_ID
			"0C04FDFF" + "07000000" + "84030000" + // cmd_ID, 07L = userGroup, reversed 0x0384 = 900 = Timeout?
			sprintf("%08X", moment().format('X')) + // timestmp
			"00000000" +
			this.password + // encpasswd
			"00000000",
			'hex'
		);
		console.log(data.toString('hex').toUpperCase());
		this._sendData(data);
	},

	_sendData: function(data) {
		this.client.send(data, this.port, this.host, function(error) {
			if (error) {
				this.client.close();
			}
		});
	},

	_onMessage: function(msg, info) {
		console.log('Data received from server : ' + msg.toString('hex'));
		console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port);

		if (msg.length > 62) {
			const command = msg.slice(55, 57).readUInt16LE();
			const susyid = msg.slice(28, 30).readUInt16LE();
			const serial = msg.slice(30, 34).readUInt32LE();

			console.log('Command: ' + command.toString(16));
			console.log('Susyid: ' + susyid);
			console.log('Serial: ' + serial);
		}
	}
};

module.exports = SMAInverter;