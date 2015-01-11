'use strict';
var test = require('ava');
var nu = require('./');

test(function (t) {
	t.assert(nu('todomvc.com') === 'http://todomvc.com');
	t.assert(nu('HTTP://todomvc.com') === 'http://todomvc.com');
	t.assert(nu('//todomvc.com') === 'http://todomvc.com');
	t.assert(nu('http://TODOMVC.com') === 'http://todomvc.com');
	t.assert(nu('http://todomvc.com:80') === 'http://todomvc.com');
	t.assert(nu('https://todomvc.com:443') === 'https://todomvc.com');
	t.assert(nu('ftp://todomvc.com:21') === 'ftp://todomvc.com');
	t.assert(nu('http://www.todomvc.com') === 'http://todomvc.com');
	t.assert(nu('www.todomvc.com') === 'http://todomvc.com');
	t.assert(nu('http://todomvc.com/foo/') === 'http://todomvc.com/foo');
	t.assert(nu('todomvc.com/?foo=bar%20baz') === 'http://todomvc.com/?foo=bar baz');
	t.assert(nu('http://todomvc.com/?') === 'http://todomvc.com');
	t.assert(nu('http://xn--xample-hva.com') === 'http://êxample.com');
	t.assert(nu('http://todomvc.com/?b=bar&a=foo') === 'http://todomvc.com/?a=foo&b=bar');
	t.end();
});
