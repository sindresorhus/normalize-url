'use strict';
var url = require('url');
var punycode = require('punycode');
var querystring = require('querystring');
var prependHttp = require('prepend-http');
var sortKeys = require('sort-keys');

var DEFAULT_PORTS = {
	'http:': 80,
	'https:': 443,
	'ftp:': 21
};

module.exports = function (str) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	// prepend protocol
	str = prependHttp(str.trim()).replace(/^\/\//, 'http://');

	var urlObj = url.parse(str);

	// remove default port
	var port = DEFAULT_PORTS[urlObj.protocol];
	if (urlObj.port == port) {
		urlObj.host = urlObj.host.replace(new RegExp(':' + port + '$', ''));
	}

	// IDN to Unicode
	urlObj.host = punycode.toUnicode(urlObj.hostname).toLowerCase();

	// remove `www.`
	urlObj.host = urlObj.host.replace(/^www\./, '');

	// sort query parameters
	urlObj.search = querystring.stringify(sortKeys(querystring.parse(urlObj.query)));
	urlObj.search = decodeURIComponent(urlObj.search);

	// take advantage of many of the Node `url` normalizations
	str = url.format(urlObj);

	// remove URL with empty query string
	str = str.replace(/\?$/, '');

	// remove ending `/`
	str = str.replace(/\/$/, '');

	return str;
};
