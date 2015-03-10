'use strict';
var test = require('ava');
var nu = require('./');

test(function (t) {
	t.assert(nu('sindresorhus.com') === 'http://sindresorhus.com');
	t.assert(nu('HTTP://sindresorhus.com') === 'http://sindresorhus.com');
	t.assert(nu('//sindresorhus.com') === 'http://sindresorhus.com');
	t.assert(nu('http://sindresorhus.com') === 'http://sindresorhus.com');
	t.assert(nu('http://sindresorhus.com:80') === 'http://sindresorhus.com');
	t.assert(nu('https://sindresorhus.com:443') === 'https://sindresorhus.com');
	t.assert(nu('ftp://sindresorhus.com:21') === 'ftp://sindresorhus.com');
	t.assert(nu('http://www.sindresorhus.com') === 'http://sindresorhus.com');
	t.assert(nu('www.sindresorhus.com') === 'http://sindresorhus.com');
	t.assert(nu('http://sindresorhus.com/foo/') === 'http://sindresorhus.com/foo');
	t.assert(nu('sindresorhus.com/?foo=bar%20baz') === 'http://sindresorhus.com/?foo=bar baz');
	t.assert(nu('http://sindresorhus.com/?') === 'http://sindresorhus.com');
	t.assert(nu('http://xn--xample-hva.com') === 'http://êxample.com');
	t.assert(nu('http://sindresorhus.com/?b=bar&a=foo') === 'http://sindresorhus.com/?a=foo&b=bar');
	t.assert(nu('http://sindresorhus.com/?foo=bar*|<>:"') === 'http://sindresorhus.com/?foo=bar*|<>:"');
	t.assert(nu('http://sindresorhus.com:5000') === 'http://sindresorhus.com:5000');
	t.assert(nu('http://sindresorhus.com////foo/bar') === 'http://sindresorhus.com/foo/bar');
	t.assert(nu('//sindresorhus.com/', {normalizeProtocol: false}) === '//sindresorhus.com');
	t.assert(nu('//sindresorhus.com:80/', {normalizeProtocol: false}) === '//sindresorhus.com');
	t.assert(nu('http://sindresorhus.com/foo#bar') === 'http://sindresorhus.com/foo');
	t.end();
});
