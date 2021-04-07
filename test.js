import test from 'ava';
import normalizeUrl from '.';

test('main', t => {
	t.is(normalizeUrl('sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('sindresorhus.com '), 'http://sindresorhus.com');
	t.is(normalizeUrl('sindresorhus.com.'), 'http://sindresorhus.com');
	t.is(normalizeUrl('SindreSorhus.com'), 'http://sindresorhus.com');
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
	t.is(normalizeUrl('https://foo.com/%FAIL%/07/94/ca/55.jpg'), 'https://foo.com/%FAIL%/07/94/ca/55.jpg');
	t.is(normalizeUrl('http://sindresorhus.com/?'), 'http://sindresorhus.com');
	t.is(normalizeUrl('êxample.com'), 'http://xn--xample-hva.com');
	t.is(normalizeUrl('http://sindresorhus.com/?b=bar&a=foo'), 'http://sindresorhus.com/?a=foo&b=bar');
	t.is(normalizeUrl('http://sindresorhus.com/?foo=bar*|<>:"'), 'http://sindresorhus.com/?foo=bar*%7C%3C%3E%3A%22');
	t.is(normalizeUrl('http://sindresorhus.com:5000'), 'http://sindresorhus.com:5000');
	t.is(normalizeUrl('//sindresorhus.com/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(normalizeUrl('//sindresorhus.com:80/', {normalizeProtocol: false}), '//sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/foo#bar'), 'http://sindresorhus.com/foo#bar');
	t.is(normalizeUrl('http://sindresorhus.com/foo#bar', {stripHash: true}), 'http://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com/foo#bar:~:text=hello%20world', {stripHash: true}), 'http://sindresorhus.com/foo');
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

test('stripTextFragment option', t => {
	t.is(normalizeUrl('http://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/about#'), 'http://sindresorhus.com/about');
	t.is(normalizeUrl('http://sindresorhus.com/about#:~:text=hello'), 'http://sindresorhus.com/about');
	t.is(normalizeUrl('http://sindresorhus.com/about#main'), 'http://sindresorhus.com/about#main');
	t.is(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello'), 'http://sindresorhus.com/about#main');
	t.is(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello%20world'), 'http://sindresorhus.com/about#main');

	const options = {stripTextFragment: false};
	t.is(normalizeUrl('http://sindresorhus.com', options), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/about#:~:text=hello', options), 'http://sindresorhus.com/about#:~:text=hello');
	t.is(normalizeUrl('http://sindresorhus.com/about#main', options), 'http://sindresorhus.com/about#main');
	t.is(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello', options), 'http://sindresorhus.com/about#main:~:text=hello');
	t.is(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello%20world', options), 'http://sindresorhus.com/about#main:~:text=hello%20world');

	const options2 = {stripHash: true, stripTextFragment: false};
	t.is(normalizeUrl('http://sindresorhus.com', options2), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/about#:~:text=hello', options2), 'http://sindresorhus.com/about');
	t.is(normalizeUrl('http://sindresorhus.com/about#main', options2), 'http://sindresorhus.com/about');
	t.is(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello', options2), 'http://sindresorhus.com/about');
	t.is(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello%20world', options2), 'http://sindresorhus.com/about');
});

test('stripWWW option', t => {
	const options = {stripWWW: false};
	t.is(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	t.is(normalizeUrl('www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	t.is(normalizeUrl('http://www.êxample.com', options), 'http://www.xn--xample-hva.com');
	t.is(normalizeUrl('sindre://www.sorhus.com', options), 'sindre://www.sorhus.com');

	const options2 = {stripWWW: true};
	t.is(normalizeUrl('http://www.vue.amsterdam', options2), 'http://vue.amsterdam');
	t.is(normalizeUrl('http://www.sorhus.xx--bck1b9a5dre4c', options2), 'http://sorhus.xx--bck1b9a5dre4c');

	const tooLongTLDURL = 'http://www.sorhus.' + ''.padEnd(64, 'a');
	t.is(normalizeUrl(tooLongTLDURL, options2), tooLongTLDURL);
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
	t.is(normalizeUrl('http://sindresorhus.com'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/'), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com', options), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/', options), 'http://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/redirect'), 'http://sindresorhus.com/redirect');
	t.is(normalizeUrl('http://sindresorhus.com/redirect/'), 'http://sindresorhus.com/redirect');
	t.is(normalizeUrl('http://sindresorhus.com/redirect/', options), 'http://sindresorhus.com/redirect/');
	t.is(normalizeUrl('http://sindresorhus.com/redirect/', options), 'http://sindresorhus.com/redirect/');
	t.is(normalizeUrl('http://sindresorhus.com/#/'), 'http://sindresorhus.com/#/');
	t.is(normalizeUrl('http://sindresorhus.com/#/', options), 'http://sindresorhus.com/#/');
	t.is(normalizeUrl('http://sindresorhus.com/?unicorns=true'), 'http://sindresorhus.com/?unicorns=true');
	t.is(normalizeUrl('http://sindresorhus.com/?unicorns=true', options), 'http://sindresorhus.com/?unicorns=true');
});

test('removeSingleSlash option', t => {
	const options = {removeSingleSlash: false};
	t.is(normalizeUrl('https://sindresorhus.com', options), 'https://sindresorhus.com');
	t.is(normalizeUrl('https://sindresorhus.com/', options), 'https://sindresorhus.com/');
	t.is(normalizeUrl('https://sindresorhus.com/redirect', options), 'https://sindresorhus.com/redirect');
	t.is(normalizeUrl('https://sindresorhus.com/redirect/', options), 'https://sindresorhus.com/redirect');
	t.is(normalizeUrl('https://sindresorhus.com/#/', options), 'https://sindresorhus.com/#/');
	t.is(normalizeUrl('https://sindresorhus.com/?unicorns=true', options), 'https://sindresorhus.com/?unicorns=true');
});

test('removeSingleSlash option combined with removeTrailingSlash option', t => {
	const options = {removeTrailingSlash: false, removeSingleSlash: false};
	t.is(normalizeUrl('https://sindresorhus.com', options), 'https://sindresorhus.com');
	t.is(normalizeUrl('https://sindresorhus.com/', options), 'https://sindresorhus.com/');
	t.is(normalizeUrl('https://sindresorhus.com/redirect', options), 'https://sindresorhus.com/redirect');
	t.is(normalizeUrl('https://sindresorhus.com/redirect/', options), 'https://sindresorhus.com/redirect/');
	t.is(normalizeUrl('https://sindresorhus.com/#/', options), 'https://sindresorhus.com/#/');
	t.is(normalizeUrl('https://sindresorhus.com/?unicorns=true', options), 'https://sindresorhus.com/?unicorns=true');
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

test('allowCustomProtocols option', t => {
	const options1 = {
		allowCustomProtocols: true
	};
	t.is(normalizeUrl('http://sindresorhus.com', options1), 'http://sindresorhus.com');
	t.is(normalizeUrl('https://sindresorhus.com', options1), 'https://sindresorhus.com');
	t.is(normalizeUrl('custom://sindresorhus.com', options1), 'custom://sindresorhus.com');
	t.is(normalizeUrl('custom.with.periods://sindresorhus.com', options1), 'custom.with.periods://sindresorhus.com');
	t.is(normalizeUrl('custom+with+plusses://sindresorhus.com', options1), 'custom+with+plusses://sindresorhus.com');

	const options2 = {
		allowCustomProtocols: false
	};
	t.is(normalizeUrl('http://sindresorhus.com', options2), 'http://sindresorhus.com');
	t.is(normalizeUrl('https://sindresorhus.com', options2), 'https://sindresorhus.com');
	t.is(normalizeUrl('custom://sindresorhus.com', options2), 'custom://sindresorhus.com');
	t.is(normalizeUrl('custom.with.periods://sindresorhus.com', options2), 'http://custom.with.periods/sindresorhus.com');
	t.is(normalizeUrl('custom+with+plusses://sindresorhus.com', options2), 'http://custom+with+plusses/sindresorhus.com');
});

test('allowCustomProtocols option with stripProtocol, forceHttp, forceHttps', t => {
	t.throws(() => {
		normalizeUrl('https://www.sindresorhus.com', {allowCustomProtocols: true, stripProtocol: true});
	}, 'The `allowCustomProtocols` and `stripProtocol` options cannot be used together');

	t.throws(() => {
		normalizeUrl('https://www.sindresorhus.com', {allowCustomProtocols: true, forceHttp: true});
	}, 'The `allowCustomProtocols` and `forceHttp` options cannot be used together');

	t.throws(() => {
		normalizeUrl('https://www.sindresorhus.com', {allowCustomProtocols: true, forceHttps: true});
	}, 'The `allowCustomProtocols` and `forceHttps` options cannot be used together');
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
	t.is(normalizeUrl('http://sindresorhus.com/s3://sindresorhus.com'), 'http://sindresorhus.com/s3://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/s3://sindresorhus.com//foo'), 'http://sindresorhus.com/s3://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com//foo/s3://sindresorhus.com'), 'http://sindresorhus.com/foo/s3://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/git://sindresorhus.com'), 'http://sindresorhus.com/git://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/git://sindresorhus.com//foo'), 'http://sindresorhus.com/git://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com//foo/git://sindresorhus.com//foo'), 'http://sindresorhus.com/foo/git://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com/a://sindresorhus.com//foo'), 'http://sindresorhus.com/a:/sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo'), 'http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo'), 'http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx:/sindresorhus.com/foo');
	t.is(normalizeUrl('http://sindresorhus.com/a2-.+://sindresorhus.com'), 'http://sindresorhus.com/a2-.+://sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/a2-.+_://sindresorhus.com'), 'http://sindresorhus.com/a2-.+_:/sindresorhus.com');
	t.is(normalizeUrl('http://sindresorhus.com/2abc://sindresorhus.com'), 'http://sindresorhus.com/2abc:/sindresorhus.com');
});

test('data URL', t => {
	// Invalid URL.
	t.throws(() => normalizeUrl('data:'), 'Invalid URL: data:');

	// Strip default MIME type
	t.is(normalizeUrl('data:text/plain,foo'), 'data:,foo');

	// Strip default charset
	t.is(normalizeUrl('data:;charset=us-ascii,foo'), 'data:,foo');

	// Normalize away trailing semicolon.
	t.is(normalizeUrl('data:;charset=UTF-8;,foo'), 'data:;charset=utf-8,foo');

	// Empty MIME type.
	t.is(normalizeUrl('data:,'), 'data:,');

	// Empty MIME type with charset.
	t.is(normalizeUrl('data:;charset=utf-8,foo'), 'data:;charset=utf-8,foo');

	// Lowercase the MIME type.
	t.is(normalizeUrl('data:TEXT/HTML,foo'), 'data:text/html,foo');

	// Strip empty hash.
	t.is(normalizeUrl('data:,foo# '), 'data:,foo');

	// Key only mediaType attribute.
	t.is(normalizeUrl('data:;foo=;bar,'), 'data:;foo;bar,');

	// Lowercase the charset.
	t.is(normalizeUrl('data:;charset=UTF-8,foo'), 'data:;charset=utf-8,foo');

	// Remove spaces after the comma when it's base64.
	t.is(normalizeUrl('data:;base64, Zm9v #foo #bar'), 'data:;base64,Zm9v#foo #bar');

	// Keep spaces when it's not base64.
	t.is(normalizeUrl('data:, foo #bar'), 'data:, foo #bar');

	// Options.
	const options = {
		defaultProtocol: 'http:',
		normalizeProtocol: true,
		forceHttp: true,
		stripHash: true,
		stripWWW: true,
		stripProtocol: true,
		removeQueryParameters: [/^utm_\w+/i, 'ref'],
		sortQueryParameters: true,
		removeTrailingSlash: true,
		removeDirectoryIndex: true
	};
	t.is(normalizeUrl('data:,sindresorhus.com/', options), 'data:,sindresorhus.com/');
	t.is(normalizeUrl('data:,sindresorhus.com/index.html', options), 'data:,sindresorhus.com/index.html');
	t.is(normalizeUrl('data:,sindresorhus.com?foo=bar&a=a&utm_medium=test', options), 'data:,sindresorhus.com?foo=bar&a=a&utm_medium=test');
	t.is(normalizeUrl('data:,foo#bar', options), 'data:,foo');
	t.is(normalizeUrl('data:,www.sindresorhus.com', options), 'data:,www.sindresorhus.com');
});

test('prevents homograph attack', t => {
	// The input string uses Unicode to make it look like a valid `ebay.com` URL.
	t.is(normalizeUrl('https://ebаy.com'), 'https://xn--eby-7cd.com');
});

test('view-source URL', t => {
	t.throws(() => {
		normalizeUrl('view-source:https://www.sindresorhus.com');
	}, '`view-source:` is not supported as it is a non-standard protocol');
});
