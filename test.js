import test from 'ava';
import fn from './';

test('main', t => {
	t.is(fn('sindresorhus.com'), 'http://sindresorhus.com');
	t.is(fn('HTTP://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(fn('//sindresorhus.com'), 'http://sindresorhus.com');
	t.is(fn('http://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(fn('http://sindresorhus.com:80'), 'http://sindresorhus.com');
	t.is(fn('https://sindresorhus.com:443'), 'https://sindresorhus.com');
	t.is(fn('ftp://sindresorhus.com:21'), 'ftp://sindresorhus.com');
	t.is(fn('http://www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(fn('www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(fn('http://sindresorhus.com/foo/'), 'http://sindresorhus.com/foo');
	t.is(fn('sindresorhus.com/?foo=bar%20baz'), 'http://sindresorhus.com/?foo=bar baz');
	t.is(fn('http://sindresorhus.com/?'), 'http://sindresorhus.com');
	t.is(fn('http://xn--xample-hva.com'), 'http://êxample.com');
	t.is(fn('http://sindresorhus.com/?b=bar&a=foo'), 'http://sindresorhus.com/?a=foo&b=bar');
	t.is(fn('http://sindresorhus.com/?foo=bar*|<>:"'), 'http://sindresorhus.com/?foo=bar*|<>:"');
	t.is(fn('http://sindresorhus.com:5000'), 'http://sindresorhus.com:5000');
	t.is(fn('http://sindresorhus.com////foo/bar'), 'http://sindresorhus.com/foo/bar');
	t.is(fn('//sindresorhus.com/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(fn('//sindresorhus.com:80/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(fn('http://sindresorhus.com/foo#bar'), 'http://sindresorhus.com/foo');
	t.is(fn('http://sindresorhus.com/foo#bar', {stripFragment: false}), 'http://sindresorhus.com/foo#bar');
	t.is(fn('http://sindresorhus.com/foo/bar/../baz'), 'http://sindresorhus.com/foo/baz');
	t.is(fn('http://sindresorhus.com/foo/bar/./baz'), 'http://sindresorhus.com/foo/bar/baz');
});

test('stripWWW option', t => {
	const opts = {stripWWW: false};
	t.is(fn('http://www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(fn('www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(fn('http://www.xn--xample-hva.com', opts), 'http://www.êxample.com');
});
