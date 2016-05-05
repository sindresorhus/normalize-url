import test from 'ava';
import m from './';

test('main', t => {
	t.is(m('sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('sindresorhus.com.'), 'http://sindresorhus.com');
	t.is(m('HTTP://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('//sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com:80'), 'http://sindresorhus.com');
	t.is(m('https://sindresorhus.com:443'), 'https://sindresorhus.com');
	t.is(m('ftp://sindresorhus.com:21'), 'ftp://sindresorhus.com');
	t.is(m('http://www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/foo/'), 'http://sindresorhus.com/foo');
	t.is(m('sindresorhus.com/?foo=bar%20baz'), 'http://sindresorhus.com/?foo=bar baz');
	t.is(m('http://sindresorhus.com/?'), 'http://sindresorhus.com');
	t.is(m('http://xn--xample-hva.com'), 'http://êxample.com');
	t.is(m('http://sindresorhus.com/?b=bar&a=foo'), 'http://sindresorhus.com/?a=foo&b=bar');
	t.is(m('http://sindresorhus.com/?foo=bar*|<>:"'), 'http://sindresorhus.com/?foo=bar*|<>:"');
	t.is(m('http://sindresorhus.com:5000'), 'http://sindresorhus.com:5000');
	t.is(m('http://sindresorhus.com////foo/bar'), 'http://sindresorhus.com/foo/bar');
	t.is(m('//sindresorhus.com/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(m('//sindresorhus.com:80/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(m('http://sindresorhus.com/foo#bar'), 'http://sindresorhus.com/foo');
	t.is(m('http://sindresorhus.com/foo#bar', {stripFragment: false}), 'http://sindresorhus.com/foo#bar');
	t.is(m('http://sindresorhus.com/foo/bar/../baz'), 'http://sindresorhus.com/foo/baz');
	t.is(m('http://sindresorhus.com/foo/bar/./baz'), 'http://sindresorhus.com/foo/bar/baz');
	t.is(m('/relative/path/'), '/relative/path');
	t.is(m('/'), '');
	t.is(m('sindre://www.sorhus.com'), 'sindre://sorhus.com');
	t.is(m('sindre://www.sorhus.com/'), 'sindre://sorhus.com');
	t.is(m('sindre://www.sorhus.com/foo/bar'), 'sindre://sorhus.com/foo/bar');
});

test('stripWWW option', t => {
	const opts = {stripWWW: false};
	t.is(m('http://www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(m('www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(m('http://www.xn--xample-hva.com', opts), 'http://www.êxample.com');
	t.is(m('sindre://www.sorhus.com', opts), 'sindre://www.sorhus.com');
});

test('removeQueryParameters option', t => {
	const opts = {
		stripWWW: false,
		removeQueryParameters: [/^utm_\w+/i, 'ref']
	};
	t.is(m('www.sindresorhus.com?foo=bar&utm_medium=test'), 'http://sindresorhus.com/?foo=bar');
	t.is(m('http://www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(m('www.sindresorhus.com?foo=bar', opts), 'http://www.sindresorhus.com/?foo=bar');
	t.is(m('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', opts), 'http://www.sindresorhus.com/?foo=bar');
});
