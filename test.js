import test from 'ava';
import normalizeUrl from '.';

test('main', t => {
	t.is(normalizeUrl('sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('sindresorhus.com '), 'http://sindresorhus.com');
	t.is(normalizeUrl('sindresorhus.com.'), 'http://sindresorhus.com');
	t.is(normalizeUrl('sindresorhus.com', {defaultProtocol: 'https:'}), 'https://sindresorhus.com');
	t.is(normalizeUrl('HTTP://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('//sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com:80'), 'http://sindresorhus.com');
	t.is(normalizeUrl('https://sindresorhus.com:443'), 'https://sindresorhus.com');
	t.is(normalizeUrl('ftp://sindresorhus.com:21'), 'ftp://sindresorhus.com');
	t.is(normalizeUrl('http://www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('www.com'), 'http://www.com');
	t.is(normalizeUrl('http://www.www.sindresorhus.com'), 'http://www.www.sindresorhus.com');
	t.is(normalizeUrl('www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/foo/'), 'http://sindresorhus.com/foo');
	t.is(normalizeUrl('sindresorhus.com/?foo=bar baz'), 'http://sindresorhus.com/?foo=bar+baz');
	t.is(normalizeUrl('https://foo.com/https://bar.com'), 'https://foo.com/https://bar.com');
	t.is(normalizeUrl('https://foo.com/https://bar.com/foo//bar'), 'https://foo.com/https://bar.com/foo/bar');
	t.is(normalizeUrl('https://foo.com/http://bar.com'), 'https://foo.com/http://bar.com');
	t.is(normalizeUrl('https://foo.com/http://bar.com/foo//bar'), 'https://foo.com/http://bar.com/foo/bar');
	t.is(normalizeUrl('http://sindresorhus.com/%7Efoo/'), 'http://sindresorhus.com/~foo', 'decode URI octets');
	t.is(normalizeUrl('http://sindresorhus.com/?'), 'http://sindresorhus.com');
	t.is(normalizeUrl('êxample.com'), 'http://xn--xample-hva.com');
	t.is(normalizeUrl('http://sindresorhus.com/?b=bar&a=foo'), 'http://sindresorhus.com/?a=foo&b=bar');
	t.is(normalizeUrl('http://sindresorhus.com/?foo=bar*|<>:"'), 'http://sindresorhus.com/?foo=bar*%7C%3C%3E%3A%22');
	t.is(normalizeUrl('http://sindresorhus.com:5000'), 'http://sindresorhus.com:5000');
	t.is(normalizeUrl('//sindresorhus.com/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(normalizeUrl('//sindresorhus.com:80/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/foo#bar'), 'http://sindresorhus.com/foo#bar');
	t.is(normalizeUrl('http://sindresorhus.com/foo#bar', {stripHash: true}), 'http://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com/foo/bar/../baz'), 'http://sindresorhus.com/foo/baz');
	t.is(normalizeUrl('http://sindresorhus.com/foo/bar/./baz'), 'http://sindresorhus.com/foo/bar/baz');
	t.is(normalizeUrl('sindre://www.sorhus.com'), 'sindre://sorhus.com');
	t.is(normalizeUrl('sindre://www.sorhus.com/'), 'sindre://sorhus.com');
	t.is(normalizeUrl('sindre://www.sorhus.com/foo/bar'), 'sindre://sorhus.com/foo/bar');
	t.is(normalizeUrl('https://i.vimeocdn.com/filter/overlay?src0=https://i.vimeocdn.com/video/598160082_1280x720.jpg&src1=https://f.vimeocdn.com/images_v6/share/play_icon_overlay.png'), 'https://i.vimeocdn.com/filter/overlay?src0=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F598160082_1280x720.jpg&src1=https%3A%2F%2Ff.vimeocdn.com%2Fimages_v6%2Fshare%2Fplay_icon_overlay.png');
});

test('stripAuthentication option', t => {
	t.is(normalizeUrl('http://user:password@www.sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('https://user:password@www.sindresorhus.com'), 'https://sindresorhus.com');
	t.is(normalizeUrl('https://user:password@www.sindresorhus.com/@user'), 'https://sindresorhus.com/@user');
	t.is(normalizeUrl('user:password@sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://user:password@www.êxample.com'), 'http://xn--xample-hva.com');
	t.is(normalizeUrl('sindre://user:password@www.sorhus.com'), 'sindre://sorhus.com');

	const options = {stripAuthentication: false};
	t.is(normalizeUrl('http://user:password@www.sindresorhus.com', options), 'http://user:password@sindresorhus.com');
	t.is(normalizeUrl('https://user:password@www.sindresorhus.com', options), 'https://user:password@sindresorhus.com');
	t.is(normalizeUrl('https://user:password@www.sindresorhus.com/@user', options), 'https://user:password@sindresorhus.com/@user');
	t.is(normalizeUrl('user:password@sindresorhus.com', options), 'http://user:password@sindresorhus.com');
	t.is(normalizeUrl('http://user:password@www.êxample.com', options), 'http://user:password@xn--xample-hva.com');
	t.is(normalizeUrl('sindre://user:password@www.sorhus.com', options), 'sindre://user:password@sorhus.com');
});

test('stripProtocol option', t => {
	const options = {stripProtocol: true};
	t.is(normalizeUrl('http://www.sindresorhus.com', options), 'sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com', options), 'sindresorhus.com');
	t.is(normalizeUrl('https://www.sindresorhus.com', options), 'sindresorhus.com');
	t.is(normalizeUrl('//www.sindresorhus.com', options), 'sindresorhus.com');
	t.is(normalizeUrl('sindre://user:password@www.sorhus.com', options), 'sindre://sorhus.com');
	t.is(normalizeUrl('sindre://www.sorhus.com', options), 'sindre://sorhus.com');
});

test('stripWWW option', t => {
	const options = {stripWWW: false};
	t.is(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	t.is(normalizeUrl('www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	t.is(normalizeUrl('http://www.êxample.com', options), 'http://www.xn--xample-hva.com');
	t.is(normalizeUrl('sindre://www.sorhus.com', options), 'sindre://www.sorhus.com');
});

test('removeQueryParameters option', t => {
	const options = {
		stripWWW: false,
		removeQueryParameters: [/^utm_\w+/i, 'ref']
	};
	t.is(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test'), 'http://sindresorhus.com/?foo=bar');
	t.is(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	t.is(normalizeUrl('www.sindresorhus.com?foo=bar', options), 'http://www.sindresorhus.com/?foo=bar');
	t.is(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options), 'http://www.sindresorhus.com/?foo=bar');
});

test('forceHttp option', t => {
	const options = {forceHttp: true};
	t.is(normalizeUrl('https://sindresorhus.com'), 'https://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com', options), 'http://sindresorhus.com');
	t.is(normalizeUrl('https://www.sindresorhus.com', options), 'http://sindresorhus.com');
	t.is(normalizeUrl('//sindresorhus.com', options), 'http://sindresorhus.com');
});

test('forceHttp option with forceHttps', t => {
	t.throws(() => {
		normalizeUrl('https://www.sindresorhus.com', {forceHttp: true, forceHttps: true});
	}, 'The `forceHttp` and `forceHttps` options cannot be used together');
});

test('forceHttps option', t => {
	const options = {forceHttps: true};
	t.is(normalizeUrl('https://sindresorhus.com'), 'https://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com', options), 'https://sindresorhus.com');
	t.is(normalizeUrl('https://www.sindresorhus.com', options), 'https://sindresorhus.com');
	t.is(normalizeUrl('//sindresorhus.com', options), 'https://sindresorhus.com');
});

test('removeTrailingSlash option', t => {
	const options = {removeTrailingSlash: false};
	t.is(normalizeUrl('http://sindresorhus.com/'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/', options), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/redirect/'), 'http://sindresorhus.com/redirect');
	t.is(normalizeUrl('http://sindresorhus.com/redirect/', options), 'http://sindresorhus.com/redirect/');
	t.is(normalizeUrl('http://sindresorhus.com/#/', options), 'http://sindresorhus.com/#/');
});

test('removeDirectoryIndex option', t => {
	const options1 = {removeDirectoryIndex: ['index.html', 'index.php']};
	t.is(normalizeUrl('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	t.is(normalizeUrl('http://sindresorhus.com/index.html', options1), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/index.htm', options1), 'http://sindresorhus.com/index.htm');
	t.is(normalizeUrl('http://sindresorhus.com/index.php', options1), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/path/index.html'), 'http://sindresorhus.com/path/index.html');
	t.is(normalizeUrl('http://sindresorhus.com/path/index.html', options1), 'http://sindresorhus.com/path');
	t.is(normalizeUrl('http://sindresorhus.com/path/index.htm', options1), 'http://sindresorhus.com/path/index.htm');
	t.is(normalizeUrl('http://sindresorhus.com/path/index.php', options1), 'http://sindresorhus.com/path');
	t.is(normalizeUrl('http://sindresorhus.com/foo/bar/index.html', options1), 'http://sindresorhus.com/foo/bar');

	const options2 = {removeDirectoryIndex: [/^index\.[a-z]+$/, 'remove.html']};
	t.is(normalizeUrl('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	t.is(normalizeUrl('http://sindresorhus.com/index.html', options2), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/index/index.html', options2), 'http://sindresorhus.com/index');
	t.is(normalizeUrl('http://sindresorhus.com/remove.html', options2), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/default.htm', options2), 'http://sindresorhus.com/default.htm');
	t.is(normalizeUrl('http://sindresorhus.com/index.php', options2), 'http://sindresorhus.com');

	const options3 = {removeDirectoryIndex: true};
	t.is(normalizeUrl('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	t.is(normalizeUrl('http://sindresorhus.com/index.html', options3), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/index.htm', options3), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/index.php', options3), 'http://sindresorhus.com');
});

test('removeTrailingSlash and removeDirectoryIndex options)', t => {
	const options1 = {
		removeTrailingSlash: true,
		removeDirectoryIndex: true
	};
	t.is(normalizeUrl('http://sindresorhus.com/path/', options1), 'http://sindresorhus.com/path');
	t.is(normalizeUrl('http://sindresorhus.com/path/index.html', options1), 'http://sindresorhus.com/path');
	t.is(normalizeUrl('http://sindresorhus.com/#/path/', options1), 'http://sindresorhus.com/#/path/');
	t.is(normalizeUrl('http://sindresorhus.com/foo/#/bar/', options1), 'http://sindresorhus.com/foo#/bar/');

	const options2 = {
		removeTrailingSlash: false,
		removeDirectoryIndex: true
	};
	t.is(normalizeUrl('http://sindresorhus.com/path/', options2), 'http://sindresorhus.com/path/');
	t.is(normalizeUrl('http://sindresorhus.com/path/index.html', options2), 'http://sindresorhus.com/path/');
	t.is(normalizeUrl('http://sindresorhus.com/#/path/', options2), 'http://sindresorhus.com/#/path/');
});

test('sortQueryParameters option', t => {
	const options1 = {
		sortQueryParameters: true
	};
	t.is(normalizeUrl('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options1), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(normalizeUrl('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options1), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(normalizeUrl('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options1), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(normalizeUrl('http://sindresorhus.com/', options1), 'http://sindresorhus.com');

	const options2 = {
		sortQueryParameters: false
	};
	t.is(normalizeUrl('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options2), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	t.is(normalizeUrl('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options2), 'http://sindresorhus.com/?b=Y&c=X&a=Z&d=W');
	t.is(normalizeUrl('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options2), 'http://sindresorhus.com/?a=Z&d=W&b=Y&c=X');
	t.is(normalizeUrl('http://sindresorhus.com/', options2), 'http://sindresorhus.com');
});

test('invalid urls', t => {
	t.throws(() => {
		normalizeUrl('http://');
	}, 'Invalid URL: http://');

	t.throws(() => {
		normalizeUrl('/');
	}, 'Invalid URL: /');

	t.throws(() => {
		normalizeUrl('/relative/path/');
	}, 'Invalid URL: /relative/path/');
});

test('remove duplicate pathname slashes', t => {
	t.is(normalizeUrl('http://sindresorhus.com////foo/bar'), 'http://sindresorhus.com/foo/bar');
	t.is(normalizeUrl('http://sindresorhus.com////foo////bar'), 'http://sindresorhus.com/foo/bar');
	t.is(normalizeUrl('//sindresorhus.com//foo', {normalizeProtocol: false}), '//sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com:5000///foo'), 'http://sindresorhus.com:5000/foo');
	t.is(normalizeUrl('http://sindresorhus.com///foo'), 'http://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com:5000//foo'), 'http://sindresorhus.com:5000/foo');
	t.is(normalizeUrl('http://sindresorhus.com//foo'), 'http://sindresorhus.com/foo');
});

test('DataURLs', t => {
	t.throws(() => {
		normalizeUrl('data:text/plain;charset=UTF-8;,foo');
	}, 'Invalid URL: data:text/plain;charset=UTF-8;,foo');
	// Lowercase the mimeType
	t.is(normalizeUrl('data:TEXT/plain;charset=UTF-8,foo'), 'data:text/plain;charset=utf-8,foo');
	// Remove spaces after the comma when it's base64
	t.is(normalizeUrl('data:image/gif;base64, R0lGODlhAQABAAAAACw= ?foo=bar'), 'data:image/gif;base64,R0lGODlhAQABAAAAACw=?foo=bar');
	// Keep spaces when it's not base64
	t.is(normalizeUrl('data:text/plain;charset=utf-8, foo ?foo=bar'), 'data:text/plain;charset=utf-8, foo?foo=bar');
	// with query and hash
	t.is(normalizeUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=?foo=bar#baz'), 'data:image/gif;base64,R0lGODlhAQABAAAAACw=?foo=bar#baz');
	// removeQueryParameters & stripHash
	t.is(normalizeUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=?foo=bar&utm_medium=test#baz', {
		removeQueryParameters: [/^utm_\w+/i, 'ref'],
		stripHash: true
	}), 'data:image/gif;base64,R0lGODlhAQABAAAAACw=?foo=bar');
})
