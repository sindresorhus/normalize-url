import test from 'ava';
import m from '.';

test('main', t => {
	t.is(m('sindresorhus.com'), 'http://sindresorhus.com');
	t.is(m('sindresorhus.com '), 'http://sindresorhus.com');
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
	t.is(m('sindresorhus.com/?foo=bar baz'), 'http://sindresorhus.com/?foo=bar+baz');
	t.is(m('https://foo.com/https://bar.com'), 'https://foo.com/https://bar.com');
	t.is(m('https://foo.com/https://bar.com/foo//bar'), 'https://foo.com/https://bar.com/foo/bar');
	t.is(m('https://foo.com/http://bar.com'), 'https://foo.com/http://bar.com');
	t.is(m('https://foo.com/http://bar.com/foo//bar'), 'https://foo.com/http://bar.com/foo/bar');
	t.is(m('http://sindresorhus.com/%7Efoo/'), 'http://sindresorhus.com/~foo', 'decode URI octets');
	t.is(m('http://sindresorhus.com/?'), 'http://sindresorhus.com');
	t.is(m('êxample.com'), 'http://xn--xample-hva.com');
	t.is(m('http://sindresorhus.com/?b=bar&a=foo'), 'http://sindresorhus.com/?a=foo&b=bar');
	t.is(m('http://sindresorhus.com/?foo=bar*|<>:"'), 'http://sindresorhus.com/?foo=bar*%7C%3C%3E%3A%22');
	t.is(m('http://sindresorhus.com:5000'), 'http://sindresorhus.com:5000');
	t.is(m('http://sindresorhus.com////foo/bar'), 'http://sindresorhus.com/foo/bar');
	t.is(m('http://sindresorhus.com////foo////bar'), 'http://sindresorhus.com/foo/bar');
	t.is(m('//sindresorhus.com/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(m('//sindresorhus.com:80/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(m('http://sindresorhus.com/foo#bar'), 'http://sindresorhus.com/foo');
	t.is(m('http://sindresorhus.com/foo#bar', {stripFragment: false}), 'http://sindresorhus.com/foo#bar');
	t.is(m('http://sindresorhus.com/foo/bar/../baz'), 'http://sindresorhus.com/foo/baz');
	t.is(m('http://sindresorhus.com/foo/bar/./baz'), 'http://sindresorhus.com/foo/bar/baz');
	t.is(m('sindre://www.sorhus.com'), 'sindre://sorhus.com');
	t.is(m('sindre://www.sorhus.com/'), 'sindre://sorhus.com');
	t.is(m('sindre://www.sorhus.com/foo/bar'), 'sindre://sorhus.com/foo/bar');
	t.is(m('https://i.vimeocdn.com/filter/overlay?src0=https://i.vimeocdn.com/video/598160082_1280x720.jpg&src1=https://f.vimeocdn.com/images_v6/share/play_icon_overlay.png'), 'https://i.vimeocdn.com/filter/overlay?src0=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F598160082_1280x720.jpg&src1=https%3A%2F%2Ff.vimeocdn.com%2Fimages_v6%2Fshare%2Fplay_icon_overlay.png');
});

test('stripWWW option', t => {
	const opts = {stripWWW: false};
	t.is(m('http://www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(m('www.sindresorhus.com', opts), 'http://www.sindresorhus.com');
	t.is(m('http://www.êxample.com', opts), 'http://www.xn--xample-hva.com');
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

test('normalizeHttps option', t => {
	const opts = {normalizeHttps: true};

	t.is(m('https://sindresorhus.com'), 'https://sindresorhus.com');
	t.is(m('http://sindresorhus.com', opts), 'http://sindresorhus.com');
	t.is(m('https://www.sindresorhus.com', opts), 'http://sindresorhus.com');
	t.is(m('//sindresorhus.com', opts), 'http://sindresorhus.com');
});

test('normalizeHttps option with normalizeHttp', t => {
	t.throws(() => {
		m('https://www.sindresorhus.com', {normalizeHttps: true, normalizeHttp: true});
	}, 'The `normalizeHttp` and `normalizeHttps` options cannot be used together');
});

test('normalizeHttp option', t => {
	const opts = {normalizeHttp: true};

	t.is(m('https://sindresorhus.com'), 'https://sindresorhus.com');
	t.is(m('http://sindresorhus.com', opts), 'https://sindresorhus.com');
	t.is(m('https://www.sindresorhus.com', opts), 'https://sindresorhus.com');
	t.is(m('//sindresorhus.com', opts), 'https://sindresorhus.com');
});

test('removeTrailingSlash option', t => {
	const opts = {removeTrailingSlash: false};
	t.is(m('http://sindresorhus.com/'), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/', opts), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/redirect/'), 'http://sindresorhus.com/redirect');
	t.is(m('http://sindresorhus.com/redirect/', opts), 'http://sindresorhus.com/redirect/');
});

test('removeDirectoryIndex option', t => {
	const opts1 = {removeDirectoryIndex: ['index.html', 'index.php']};
	t.is(m('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	t.is(m('http://sindresorhus.com/index.html', opts1), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/index.htm', opts1), 'http://sindresorhus.com/index.htm');
	t.is(m('http://sindresorhus.com/index.php', opts1), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/path/index.html'), 'http://sindresorhus.com/path/index.html');
	t.is(m('http://sindresorhus.com/path/index.html', opts1), 'http://sindresorhus.com/path');
	t.is(m('http://sindresorhus.com/path/index.htm', opts1), 'http://sindresorhus.com/path/index.htm');
	t.is(m('http://sindresorhus.com/path/index.php', opts1), 'http://sindresorhus.com/path');
	t.is(m('http://sindresorhus.com/foo/bar/index.html', opts1), 'http://sindresorhus.com/foo/bar');

	const opts2 = {removeDirectoryIndex: [/^index\.[a-z]+$/, 'remove.html']};
	t.is(m('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	t.is(m('http://sindresorhus.com/index.html', opts2), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/index/index.html', opts2), 'http://sindresorhus.com/index');
	t.is(m('http://sindresorhus.com/remove.html', opts2), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/default.htm', opts2), 'http://sindresorhus.com/default.htm');
	t.is(m('http://sindresorhus.com/index.php', opts2), 'http://sindresorhus.com');

	const opts3 = {removeDirectoryIndex: true};
	t.is(m('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	t.is(m('http://sindresorhus.com/index.html', opts3), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/index.htm', opts3), 'http://sindresorhus.com');
	t.is(m('http://sindresorhus.com/index.php', opts3), 'http://sindresorhus.com');
});

test('removeTrailingSlash and removeDirectoryIndex options)', t => {
	const opts1 = {
		removeTrailingSlash: true,
		removeDirectoryIndex: true
	};
	t.is(m('http://sindresorhus.com/path/', opts1), 'http://sindresorhus.com/path');
	t.is(m('http://sindresorhus.com/path/index.html', opts1), 'http://sindresorhus.com/path');

	const opts2 = {
		removeTrailingSlash: false,
		removeDirectoryIndex: true
	};
	t.is(m('http://sindresorhus.com/path/', opts2), 'http://sindresorhus.com/path/');
	t.is(m('http://sindresorhus.com/path/index.html', opts2), 'http://sindresorhus.com/path/');
});

test('sortQueryParameters option', t => {
	let opts = {
		sortQueryParameters: true
	};
	t.is(m('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', opts), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(m('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', opts), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(m('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', opts), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(m('http://sindresorhus.com/', opts), 'http://sindresorhus.com');

	opts = {
		sortQueryParameters: false
	};

	t.is(m('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', opts), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(m('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', opts), 'http://sindresorhus.com/?b=Y&c=X&a=Z&d=W');
	t.is(m('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', opts), 'http://sindresorhus.com/?a=Z&d=W&b=Y&c=X');
	t.is(m('http://sindresorhus.com/', opts), 'http://sindresorhus.com');
});

test('invalid urls', t => {
	t.throws(() => {
		m('http://');
	}, 'Invalid URL: http://');

	t.throws(() => {
		m('/');
	}, 'Invalid URL: /');

	t.throws(() => {
		m('/relative/path/');
	}, 'Invalid URL: /relative/path/');
});
