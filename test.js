import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import normalizeUrl from './index.js';

/*
What a browser makes of a data URL. `fetch` runs the browser `data:` URL processor, so it is the oracle. A URL it rejects gives `undefined`, as there is nothing to compare.
*/
const readDataURL = async url => {
	try {
		const response = await fetch(url);
		const body = await response.arrayBuffer();
		return {
			contentType: response.headers.get('content-type'),
			body: new TextDecoder().decode(body),
		};
	} catch {
		return undefined;
	}
};

/*
The WHATWG percent-decode, so a component compares as a browser reads it. A `%` that starts no escape is a literal character.
*/
const percentDecode = input => {
	const bytes = [];
	for (let index = 0; index < input.length; index++) {
		if (input[index] === '%' && /^[\da-f]{2}$/iv.test(input.slice(index + 1, index + 3))) {
			bytes.push(Number.parseInt(input.slice(index + 1, index + 3), 16));
			index += 2;
			continue;
		}

		for (const byte of new TextEncoder().encode(input[index])) {
			bytes.push(byte);
		}
	}

	return new TextDecoder().decode(new Uint8Array(bytes));
};

// The order `Array#sort` uses without a compare function.
const compareCodeUnits = (left, right) => left < right ? -1 : (left > right ? 1 : 0);
const comparePairs = (left, right) => compareCodeUnits(String(left), String(right));

/*
The best of three timed calls, each after a warmup, since the first call pays for compilation and a garbage collection pause can cost hundreds of milliseconds on a shared machine.
*/
const timeBestOfThree = body => {
	let best = Infinity;
	for (let run = 0; run < 3; run++) {
		body();
		const start = Date.now();
		body();
		best = Math.min(best, Date.now() - start);
	}

	return best;
};

test('fragment escapes do not become text directives', () => {
	for (const prefix of ['https://example.com/', 'data:,foo']) {
		for (const fragment of ['section%3A~%3Atext=x', 'section:%7E:text=x', 'section:~:te%78t=x']) {
			const input = `${prefix}#${fragment}`;
			for (const stripTextFragment of [true, false]) {
				assert.equal(normalizeUrl(input, {stripTextFragment}), input);
			}
		}
	}
});

test('a data URL text directive leaves the leading hash in the fragment', () => {
	assert.equal(normalizeUrl('data:,foo##:~:text=x'), 'data:,foo##');
	assert.equal(normalizeUrl('data:,foo###:~:text=x'), 'data:,foo###');
});

test('a data URL preserves percent-looking text in MIME parameter values', async () => {
	const input = 'data:application/octet-stream;name=report%2f2026.txt,abc';
	const output = normalizeUrl(input);
	assert.equal(output, input);
	const response = await fetch(output);
	assert.equal(response.headers.get('content-type'), 'application/octet-stream;name=report%2f2026.txt');
});

test('main', () => {
	assert.equal(normalizeUrl('sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com '), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com.'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com..'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com...'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com../foo/.'), 'http://sindresorhus.com/foo');

	// A hostname of only dots is the root, so it keeps one dot
	assert.equal(normalizeUrl('http://.'), 'http://.');
	assert.equal(normalizeUrl('http://..'), 'http://.');
	assert.equal(normalizeUrl('http://...'), 'http://.');
	assert.equal(normalizeUrl('http://..a'), 'http://..a');
	assert.equal(normalizeUrl('file://.'), 'file://.');
	assert.equal(normalizeUrl('file://..'), 'file://.');
	assert.equal(normalizeUrl('file://./a'), 'file://./a');
	assert.equal(normalizeUrl('file://../a'), 'file://./a');
	assert.equal(normalizeUrl('SindreSorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('HTTP://sindresorhus.com'), 'http://sindresorhus.com');

	// A root path keeps its slash when the host is empty, as `file://` is not a valid URL.
	assert.equal(normalizeUrl('file:///'), 'file:///');
	assert.equal(normalizeUrl('file://'), 'file:///');
	assert.equal(normalizeUrl('file:///index.html', {removeDirectoryIndex: true}), 'file:///');
	assert.equal(normalizeUrl('file:///a/'), 'file:///a');
	assert.equal(normalizeUrl('file:///a/b'), 'file:///a/b');

	// A scheme is followed by any number of slashes, so it must not be mistaken for a missing one.
	assert.equal(normalizeUrl('http:/sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http:sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https:/sindresorhus.com'), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('file:/foo'), 'file:///foo');

	// A supported protocol is a scheme, not a host with a port
	assert.equal(normalizeUrl('http:1'), 'http://0.0.0.1');
	assert.equal(normalizeUrl('https:1'), 'https://0.0.0.1');
	assert.equal(normalizeUrl('file:1'), 'file:///1');
	assert.equal(normalizeUrl('http:80'), 'http://0.0.0.80');
	assert.equal(normalizeUrl('https:443'), 'https://0.0.1.187');
	assert.equal(normalizeUrl('https:80'), 'https://0.0.0.80');

	// A scheme is followed by any number of slashes, so it must not be mistaken for a missing one.
	assert.equal(normalizeUrl('sindre:/foo', {customProtocols: ['sindre']}), 'sindre:/foo');

	// A host and a port is not a scheme, so the protocol is still prepended.
	assert.equal(normalizeUrl('sindresorhus.com:123'), 'http://sindresorhus.com:123');
	assert.equal(normalizeUrl('localhost:9802'), 'http://localhost:9802');
	assert.equal(normalizeUrl('localhost:9802/foo'), 'http://localhost:9802/foo');
	assert.equal(normalizeUrl('sindresorhus.com:80?x'), 'http://sindresorhus.com/?x');
	assert.equal(normalizeUrl('1a.b:80'), 'http://1a.b'); // A scheme cannot start with a digit.

	// A scheme may contain digits, plus, and hyphen, so these are schemes and not hosts
	assert.equal(normalizeUrl('a1.b:baz'), 'a1.b:baz');
	assert.equal(normalizeUrl('a+b.c:baz'), 'a+b.c:baz');
	assert.equal(normalizeUrl('a-b.c:baz'), 'a-b.c:baz');

	// A port is digits, however many of them, and may have leading zeros.
	assert.equal(normalizeUrl('localhost:00000080'), 'http://localhost');
	assert.equal(normalizeUrl('x.com:0000080'), 'http://x.com');
	assert.equal(normalizeUrl('http://x.com:0000080'), 'http://x.com');
	assert.equal(normalizeUrl('localhost:0080/foo'), 'http://localhost/foo');
	assert.equal(normalizeUrl('sindresorhus.com:80#foo'), 'http://sindresorhus.com/#foo');
	assert.equal(normalizeUrl('a1.b-c+d:foo'), 'a1.b-c+d:foo');

	// A port above 65535 is invalid, so it is rejected like any other invalid port.
	assert.throws(() => {
		normalizeUrl('sindresorhus.com:123456');
	}, {message: /Invalid URL/v});
	assert.throws(() => {
		normalizeUrl('sindresorhus.com:99999');
	}, {message: /Invalid URL/v});
	assert.equal(normalizeUrl('//sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com:80'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com:443'), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('http://www.sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('www.com'), 'http://www.com');
	assert.equal(normalizeUrl('http://www.www.sindresorhus.com'), 'http://www.www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo/'), 'http://sindresorhus.com/foo');
	assert.equal(normalizeUrl('sindresorhus.com/?foo=bar baz'), 'http://sindresorhus.com/?foo=bar+baz');
	assert.equal(normalizeUrl('https://foo.com/https://bar.com'), 'https://foo.com/https://bar.com');
	assert.equal(normalizeUrl('https://foo.com/https://bar.com/foo//bar'), 'https://foo.com/https://bar.com/foo/bar');
	assert.equal(normalizeUrl('https://foo.com/http://bar.com'), 'https://foo.com/http://bar.com');
	assert.equal(normalizeUrl('https://foo.com/http://bar.com/foo//bar'), 'https://foo.com/http://bar.com/foo/bar');
	assert.equal(normalizeUrl('http://sindresorhus.com/%7Efoo/'), 'http://sindresorhus.com/~foo', 'decode URI octets');

	// A `%` is only valid as part of an escape, so `%25` must not be decoded into a lone `%`.
	assert.equal(normalizeUrl('http://sindresorhus.com/100%25'), 'http://sindresorhus.com/100%25');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%25%2Fb'), 'http://sindresorhus.com/a%25%2Fb');
	assert.equal(normalizeUrl('http://sindresorhus.com/%252e%252e/etc'), 'http://sindresorhus.com/%252e%252e/etc');
	assert.equal(normalizeUrl('http://sindresorhus.com/%2525'), 'http://sindresorhus.com/%2525');

	// Tab, carriage return, and line feed must not be decoded into a raw one, which the parser removes.
	assert.equal(normalizeUrl('http://sindresorhus.com/%09'), 'http://sindresorhus.com/%09');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%09b'), 'http://sindresorhus.com/a%09b');

	// Both spellings of a percent escape normalize to the uppercase one, as RFC 3986 asks.
	assert.equal(normalizeUrl('http://sindresorhus.com/a%2fb'), 'http://sindresorhus.com/a%2Fb');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%2Fb'), 'http://sindresorhus.com/a%2Fb');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%2fb%3a%40%26%2b%3b%3d%3f%24%23%2c'), 'http://sindresorhus.com/a%2Fb%3A%40%26%2B%3B%3D%3F%24%23%2C');
	assert.equal(normalizeUrl('http://sindresorhus.com/%5c'), 'http://sindresorhus.com/%5C');
	assert.equal(normalizeUrl('http://sindresorhus.com/100%25'), 'http://sindresorhus.com/100%25');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%2fc'), 'http://sindresorhus.com/a#b%2Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%2Fc'), 'http://sindresorhus.com/a#b%2Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#%7eb'), 'http://sindresorhus.com/a#%7Eb');

	// An unreserved escape stays encoded in the hash, so it cannot create a text directive
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%41c'), 'http://sindresorhus.com/a#b%41c');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%2Ec'), 'http://sindresorhus.com/a#b%2Ec');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%5Fc'), 'http://sindresorhus.com/a#b%5Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%2Dc'), 'http://sindresorhus.com/a#b%2Dc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#%3A%7E%3Atext=x'), 'http://sindresorhus.com/a#%3A%7E%3Atext=x');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#%7E%3A%7E%3Atext=x'), 'http://sindresorhus.com/a#%7E%3A%7E%3Atext=x');

	// A reserved or otherwise non-unreserved escape in the hash is left encoded
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%2Fc'), 'http://sindresorhus.com/a#b%2Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%20c'), 'http://sindresorhus.com/a#b%20c');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#b%3Ac'), 'http://sindresorhus.com/a#b%3Ac');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#%C3%A9'), 'http://sindresorhus.com/a#%C3%A9');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#%zz'), 'http://sindresorhus.com/a#%zz');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#100%'), 'http://sindresorhus.com/a#100%');

	// The same escapes are canonicalized in the search, with and without sorting, and in a transform
	assert.equal(normalizeUrl('http://sindresorhus.com/a?b%2fc'), 'http://sindresorhus.com/a?b%2Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a?b%2fc', {sortQueryParameters: false}), 'http://sindresorhus.com/a?b%2Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a?b%2fc', {emptyQueryValue: 'always'}), 'http://sindresorhus.com/a?b%2Fc=');
	assert.equal(normalizeUrl('http://sindresorhus.com/a', {transformPath: components => [...components, 'b%2fc']}), 'http://sindresorhus.com/a/b%2Fc');
	assert.equal(normalizeUrl('http://sindresorhus.com/a#plain'), 'http://sindresorhus.com/a#plain');

	// An empty hash is kept when the hash is not being stripped
	assert.equal(normalizeUrl('http://sindresorhus.com#', {stripTextFragment: false}), 'http://sindresorhus.com/#');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=1#', {stripTextFragment: false}), 'http://sindresorhus.com/?a=1#');
	assert.equal(normalizeUrl('http://sindresorhus.com#'), 'http://sindresorhus.com');

	// A component with many escapes, which is where the canonicalization is the most work
	assert.equal(normalizeUrl('http://sindresorhus.com/' + '%2f'.repeat(500)), 'http://sindresorhus.com/' + '%2F'.repeat(500));
	assert.equal(normalizeUrl('http://sindresorhus.com/' + '%2F'.repeat(500)), 'http://sindresorhus.com/' + '%2F'.repeat(500));
	assert.equal(normalizeUrl('http://sindresorhus.com/#' + '%2f'.repeat(500)), 'http://sindresorhus.com/#' + '%2F'.repeat(500));
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=' + '%2f'.repeat(500)), 'http://sindresorhus.com/?a=' + '%2F'.repeat(500));
	assert.equal(normalizeUrl('http://sindresorhus.com/%0A%0D'), 'http://sindresorhus.com/%0A%0D');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%09=1'), 'http://sindresorhus.com/?%09=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a%09b=1'), 'http://sindresorhus.com/?a%09b=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=%09'), 'http://sindresorhus.com/?a=%09');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%0A=1'), 'http://sindresorhus.com/?%0A=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%0D=1'), 'http://sindresorhus.com/?%0D=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%00=1'), 'http://sindresorhus.com/?%00=1');
	assert.equal(normalizeUrl('https://example.com/public/%252e%252e/%252e%252e/etc/passwd'), 'https://example.com/public/%252e%252e/%252e%252e/etc/passwd');

	// ASCII tab, carriage return, and line feed are removed from the input, like a URL parser does.
	assert.equal(normalizeUrl('ht\ttp://sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http\n://sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http\r://sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https://foo.com/%FAIL%/07/94/ca/55.jpg'), 'https://foo.com/%FAIL%/07/94/ca/55.jpg');

	// A malformed escape in one segment does not stop the other segments from being decoded
	assert.equal(normalizeUrl('http://sindresorhus.com/%7Ea/%'), 'http://sindresorhus.com/~a/%');
	assert.equal(normalizeUrl('http://sindresorhus.com/%7Ea/%zz/b'), 'http://sindresorhus.com/~a/%zz/b');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%20b/%'), 'http://sindresorhus.com/a%20b/%');

	// A segment that decodes to a space round-trips, and a dot inside a segment stays
	assert.equal(normalizeUrl('http://sindresorhus.com/a%20b'), 'http://sindresorhus.com/a%20b');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%2E/b'), 'http://sindresorhus.com/a./b');
	assert.equal(normalizeUrl('http://sindresorhus.com/index%2Ehtml', {removeDirectoryIndex: true}), 'http://sindresorhus.com');

	// The escapes the search protects are decoded in the path, since it is not a query
	assert.equal(normalizeUrl('http://sindresorhus.com/a%5Bb%5Dc'), 'http://sindresorhus.com/a[b]c');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%7Cb'), 'http://sindresorhus.com/a|b');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%5cb/c'), 'http://sindresorhus.com/a%5Cb/c');

	// A lone percent sign and an incomplete escape are left alone
	assert.equal(normalizeUrl('http://sindresorhus.com/%'), 'http://sindresorhus.com/%');
	assert.equal(normalizeUrl('http://sindresorhus.com/%2ff'), 'http://sindresorhus.com/%2Ff');
	assert.equal(normalizeUrl('http://sindresorhus.com/?'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('êxample.com'), 'http://xn--xample-hva.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/?b=bar&a=foo'), 'http://sindresorhus.com/?a=foo&b=bar');
	assert.equal(normalizeUrl('http://sindresorhus.com/?foo=bar*|<>:"'), 'http://sindresorhus.com/?foo=bar*|%3C%3E:%22');
	assert.equal(normalizeUrl('http://sindresorhus.com:5000'), 'http://sindresorhus.com:5000');
	assert.equal(normalizeUrl('//sindresorhus.com/', {normalizeProtocol: false}), '//sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com:80/', {normalizeProtocol: false}), '//sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo#bar'), 'http://sindresorhus.com/foo#bar');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo#bar', {stripHash: true}), 'http://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo#bar:~:text=hello%20world', {stripHash: true}), 'http://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo/bar/../baz'), 'http://sindresorhus.com/foo/baz');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo/bar/./baz'), 'http://sindresorhus.com/foo/bar/baz');
	assert.equal(normalizeUrl('https://i.vimeocdn.com/filter/overlay?src0=https://i.vimeocdn.com/video/598160082_1280x720.jpg&src1=https://f.vimeocdn.com/images_v6/share/play_icon_overlay.png'), 'https://i.vimeocdn.com/filter/overlay?src0=https://i.vimeocdn.com/video/598160082_1280x720.jpg&src1=https://f.vimeocdn.com/images_v6/share/play_icon_overlay.png');
	assert.equal(normalizeUrl('sindresorhus.com:123'), 'http://sindresorhus.com:123');
});

test('normalizeProtocol option', () => {
	const options = {normalizeProtocol: false};
	assert.equal(normalizeUrl('//sindresorhus.com', options), '//sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com/foo/', options), '//sindresorhus.com/foo');
	assert.equal(normalizeUrl('//sindresorhus.com:80/../baz?b=bar&a=foo', options), '//sindresorhus.com/baz?a=foo&b=bar');

	// The relative protocol is restored whatever protocol ended up being used.
	assert.equal(normalizeUrl('//sindresorhus.com', {...options, defaultProtocol: 'https'}), '//sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com', {...options, forceHttps: true}), '//sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com/https://foo.com', options), '//sindresorhus.com/https://foo.com');
	assert.equal(normalizeUrl('//sindresorhus.com', {...options, defaultProtocol: 'https', stripProtocol: true}), 'sindresorhus.com');

	// Without the option the protocol is added.
	assert.equal(normalizeUrl('//sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', options), 'http://sindresorhus.com');

	// The relative protocol is restored for a non-special scheme too, since the host is written with its `//`.
	assert.equal(normalizeUrl('//sindresorhus.com', {...options, defaultProtocol: 'sindre'}), '//sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com/a', {...options, defaultProtocol: 'sindre'}), '//sindresorhus.com/a');
	assert.equal(normalizeUrl('//sindresorhus.com', {...options, defaultProtocol: 'file'}), '//sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com:8080/a', options), '//sindresorhus.com:8080/a');
});

test('options explicitly set to undefined fall back to their defaults', () => {
	// TypeScript allows `undefined` for an optional property, and spreading the options as-is would otherwise switch off everything that is on by default.
	assert.equal(normalizeUrl('https://www.sindresorhus.com', {stripWWW: undefined}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com/?utm_source=a&b=1', {removeQueryParameters: undefined}), 'https://sindresorhus.com/?b=1');
	assert.equal(normalizeUrl('https://sindresorhus.com/#:~:text=a', {stripTextFragment: undefined}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com/?b=2&a=1', {sortQueryParameters: undefined}), 'https://sindresorhus.com/?a=1&b=2');
	assert.equal(normalizeUrl('https://sindresorhus.com/a/', {removeTrailingSlash: undefined}), 'https://sindresorhus.com/a');
	assert.equal(normalizeUrl('https://sindresorhus.com/', {removeSingleSlash: undefined}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://user:password@sindresorhus.com', {stripAuthentication: undefined}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com', {normalizeProtocol: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {stripHash: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {stripProtocol: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {forceHttps: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {forceHttp: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {removePath: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {removeExplicitPort: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {removeDirectoryIndex: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {transformPath: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {emptyQueryValue: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {customProtocols: undefined}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {keepQueryParameters: undefined}), 'http://sindresorhus.com');

	// An explicitly `false` still wins over the default.
	assert.equal(normalizeUrl('https://www.sindresorhus.com', {stripWWW: false}), 'https://www.sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com/', {removeSingleSlash: false}), 'https://sindresorhus.com/');
});

test('defaultProtocol option', () => {
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: 'https'}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: 'http'}), 'http://sindresorhus.com');

	// Legacy
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: 'https:'}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: 'http:'}), 'http://sindresorhus.com');

	/*
	A value that is not a scheme, which starts with a letter, throws rather than silently falling back to `http`, since `'https://'` is an easy mistake. It must not reach the replacement either, where a `$` is a substitution pattern.
	*/
	for (const defaultProtocol of [null, '', 123, [], '1http', 'ht tp', 'a b', '-', '.', '/x', 'a%20b', 'https://', 'x$\'y', '$&y', 'a$$b', ':']) {
		assert.throws(() => {
			normalizeUrl('sindresorhus.com', {defaultProtocol});
		}, error => error instanceof TypeError && /defaultProtocol/v.test(error.message), JSON.stringify(defaultProtocol));
	}

	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: undefined}), 'http://sindresorhus.com');

	// A non-special scheme keeps the host a host rather than reading it as a path.
	assert.equal(normalizeUrl('sindresorhus.com/a', {defaultProtocol: 'sindre'}), 'sindre://sindresorhus.com/a');
	assert.equal(normalizeUrl('//sindresorhus.com/a', {defaultProtocol: 'git+ssh'}), 'git+ssh://sindresorhus.com/a');

	// A scheme can still be any protocol, not only the two the readme lists.
	assert.equal(normalizeUrl('//sindresorhus.com', {defaultProtocol: 'ftp'}), 'ftp://sindresorhus.com');

	// Surrounding whitespace and case are not significant, the same as for a `customProtocols` entry.
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: ' https '}), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('sindresorhus.com', {defaultProtocol: 'HTTPS'}), 'https://sindresorhus.com');
});

test('stripAuthentication option', () => {
	assert.equal(normalizeUrl('http://user:password@www.sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https://user:password@www.sindresorhus.com'), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://user:password@www.sindresorhus.com/@user'), 'https://sindresorhus.com/@user');
	assert.equal(normalizeUrl('http://user:password@www.êxample.com'), 'http://xn--xample-hva.com');

	const options = {stripAuthentication: false};
	assert.equal(normalizeUrl('http://user:password@www.sindresorhus.com', options), 'http://user:password@sindresorhus.com');
	assert.equal(normalizeUrl('https://user:password@www.sindresorhus.com', options), 'https://user:password@sindresorhus.com');
	assert.equal(normalizeUrl('https://user:password@www.sindresorhus.com/@user', options), 'https://user:password@sindresorhus.com/@user');
	assert.equal(normalizeUrl('http://user:password@www.êxample.com', options), 'http://user:password@xn--xample-hva.com');
	// An unreserved escape in the userinfo is decoded, the same way as in the other components
	const keepAuthentication = {stripAuthentication: false};
	assert.equal(normalizeUrl('http://u%7Es@x.com/', keepAuthentication), 'http://u~s@x.com');
	assert.equal(normalizeUrl('http://u~s@x.com/', keepAuthentication), 'http://u~s@x.com');
	assert.equal(normalizeUrl('http://u%41s:p%7Ew@x.com/', keepAuthentication), 'http://uAs:p~w@x.com');
	assert.equal(normalizeUrl('http://u%2Fs:p%2Fw@x.com/', keepAuthentication), 'http://u%2Fs:p%2Fw@x.com');
	assert.equal(normalizeUrl('http://u%20s:p%20w@x.com/', keepAuthentication), 'http://u%20s:p%20w@x.com');
	assert.equal(normalizeUrl('http://u%3As:p%3Bw@x.com/', keepAuthentication), 'http://u%3As:p%3Bw@x.com');
	assert.equal(normalizeUrl('http://u%7Es%zz@x.com/', keepAuthentication), 'http://u~s%zz@x.com');

	// A reserved escape in the userinfo is canonicalized the same way as in the other components
	assert.equal(normalizeUrl('http://u%2fs@x.com/', keepAuthentication), 'http://u%2Fs@x.com');
	assert.equal(normalizeUrl('http://u%3as:p%40w@x.com/', keepAuthentication), 'http://u%3As:p%40w@x.com');
	assert.equal(normalizeUrl('http://u%5bs@x.com/', keepAuthentication), 'http://u%5Bs@x.com');
});

test('stripProtocol option', () => {
	const options = {stripProtocol: true};
	assert.equal(normalizeUrl('http://www.sindresorhus.com', options), 'sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com', options), 'sindresorhus.com');
	assert.equal(normalizeUrl('https://www.sindresorhus.com', options), 'sindresorhus.com');
	assert.equal(normalizeUrl('//www.sindresorhus.com', options), 'sindresorhus.com');
});

test('stripTextFragment option', () => {
	assert.equal(normalizeUrl('http://sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#'), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~:text=hello'), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main'), 'http://sindresorhus.com/about#main');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello'), 'http://sindresorhus.com/about#main');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello%20world'), 'http://sindresorhus.com/about#main');

	const options = {stripTextFragment: false};
	assert.equal(normalizeUrl('http://sindresorhus.com', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~:text=hello', options), 'http://sindresorhus.com/about#:~:text=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main', options), 'http://sindresorhus.com/about#main');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello', options), 'http://sindresorhus.com/about#main:~:text=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello%20world', options), 'http://sindresorhus.com/about#main:~:text=hello%20world');

	const options2 = {stripHash: true, stripTextFragment: false};
	assert.equal(normalizeUrl('http://sindresorhus.com', options2), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~:text=hello', options2), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main', options2), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello', options2), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:text=hello%20world', options2), 'http://sindresorhus.com/about');

	// The `:~:text=` delimiter is matched case-insensitively
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~:TEXT=hello'), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~:Text=hello'), 'http://sindresorhus.com/about');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:TEXT=hello'), 'http://sindresorhus.com/about#main');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:TEXT=hello', options2), 'http://sindresorhus.com/about'); // StripHash wins
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main:~:TEXT=hello', {stripTextFragment: false}), 'http://sindresorhus.com/about#main:~:TEXT=hello');

	// A browser matches the directive before decoding, so an encoded delimiter stays
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3A~%3Atext=hello'), 'http://sindresorhus.com/about#%3A~%3Atext=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3a~%3atext=hello'), 'http://sindresorhus.com/about#%3A~%3Atext=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#main%3A~%3Atext=hello'), 'http://sindresorhus.com/about#main%3A~%3Atext=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3A~%3Atext=hello', {stripTextFragment: false}), 'http://sindresorhus.com/about#%3A~%3Atext=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3A~%3Ax=hello'), 'http://sindresorhus.com/about#%3A~%3Ax=hello');

	// A `:~:text` that is not followed by `=` is not a text fragment, so it is not a fragment to strip
	assert.equal(normalizeUrl('http://sindresorhus.com/about#see:~:textbook'), 'http://sindresorhus.com/about#see:~:textbook');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#x:~:textual=1'), 'http://sindresorhus.com/about#x:~:textual=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#a:b:~:textbook=1'), 'http://sindresorhus.com/about#a:b:~:textbook=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#x:~:text'), 'http://sindresorhus.com/about#x:~:text');

	// An encoded or partial delimiter is content rather than a directive
	assert.equal(normalizeUrl('http://sindresorhus.com/about#a%3A~%3Atext=hello'), 'http://sindresorhus.com/about#a%3A~%3Atext=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~:text%3Dhello'), 'http://sindresorhus.com/about#:~:text%3Dhello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3a~:text=hello'), 'http://sindresorhus.com/about#%3A~:text=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3A%3Atext=hello'), 'http://sindresorhus.com/about#%3A%3Atext=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#%3A~text=hello'), 'http://sindresorhus.com/about#%3A~text=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#:~text=hello'), 'http://sindresorhus.com/about#:~text=hello');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#see:~:textbook', {stripTextFragment: false}), 'http://sindresorhus.com/about#see:~:textbook');
});

test('a parameter value keeps the whitespace a MIME parser keeps', () => {
	/*
	A MIME parser strips only trailing whitespace from a parameter value, so `charset= us-ascii` is not the default charset and must stay.
	*/
	for (const [input, output] of [
		['data:text/plain;charset= us-ascii,x', 'data:text/plain;charset= us-ascii,x'],
		['data:text/plain;charset=  us-ascii  ,x', 'data:text/plain;charset=  us-ascii,x'],
		['data:text/plain;charset=us-ascii ,x', 'data:,x'],
		['data:text/plain; charset=us-ascii,x', 'data:,x'],
		['data:text/plain;charset = us-ascii ,x', 'data:text/plain;charset = us-ascii,x'],
		['data:text/html;charset= us-ascii,x', 'data:text/html;charset= us-ascii,x'],
	]) {
		assert.equal(normalizeUrl(input), output, input);
		assert.equal(normalizeUrl(output), output, `a fixed point: ${input}`);
	}
});

test('base64 data is stripped of ASCII whitespace only', async () => {
	/*
	A forgiving base64 decode strips only tab, line feed, form feed, carriage return and space. Stripping another C0 control made a URL a browser refuses readable.
	*/
	for (const [name, character] of [
		['tab', '\u{9}'],
		['line feed', '\u{A}'],
		['form feed', '\u{C}'],
		['carriage return', '\u{D}'],
		['space', ' '],
	]) {
		assert.equal(normalizeUrl(`data:;base64,${character}QUJD${character}`), 'data:;base64,QUJD', `stripped: ${name}`);
	}

	for (const [name, character] of [
		['vertical tab', '\u{B}'],
		['null', '\u{0}'],
		['start of heading', '\u{1}'],
		['backspace', '\u{8}'],
		['unit separator', '\u{1F}'],
	]) {
		assert.equal(normalizeUrl(`data:;base64,${character}QUJD`), `data:;base64,${character}QUJD`, `kept: ${name}`);
		assert.equal(normalizeUrl(`data:;base64,QUJD${character}`), 'data:;base64,QUJD', `stripped at the end: ${name}`);
	}

	// And a browser still reads both the same way, which is the point.
	const inputs = ['data:;base64,\u{B}QUJD', 'data:;base64,\u{0}QUJD', 'data:;base64,\u{9}QUJD', 'data:;base64,QUJD\u{1F}'];
	for (const input of inputs) {
		// eslint-disable-next-line no-await-in-loop -- One at a time, so a failure names its input.
		assert.deepEqual(await readDataURL(normalizeUrl(input)), await readDataURL(input), `the bytes of ${input}`);
	}
});

test('a form feed in a data URL media type is not whitespace the marker can be spelled with', async () => {
	/*
	A URL parser escapes a form feed as `%0C` rather than removing it, so it is not whitespace to a browser. Trimming it can spell a base64 marker a browser does not see.
	*/
	for (const [input, output] of [
		['data:;base64\f,SGk=', 'data:;base64\f,SGk='],
		['data:text/plain;base64\f,SGVsbG8=', 'data:text/plain;base64\f,SGVsbG8='],
		['data:text/plain;p="x;base64\f,SGk=', 'data:text/plain;p="x;base64\f,SGk='],
		// A form feed before the word is the same character of the parameter name, not a separator.
		['data:image/png;\fbase64,QUJD', 'data:image/png;\fbase64,QUJD'],
		['data:image/png;a=\fx,QUJD', 'data:image/png;a=\fx,QUJD'],
	]) {
		assert.equal(normalizeUrl(input), output, input);
		assert.equal(normalizeUrl(output), output, `a fixed point: ${input}`);
	}

	// And the bytes a browser decodes are the same before and after, which is the whole point.
	const inputs = ['data:;base64\f,SGk=', 'data:text/plain;base64\f,SGVsbG8=', 'data:image/png;a=\fx,QUJD', 'data:text/plain;a= \u{A0},QUJD', 'data:text/plain;a= \u{1F},QUJD'];
	for (const input of inputs) {
		// eslint-disable-next-line no-await-in-loop -- One at a time, so a failure names its input.
		assert.deepEqual(await readDataURL(normalizeUrl(input)), await readDataURL(input), `the bytes of ${input}`);
	}
});

test('a control at the end of a data URL media type is written as an escape', () => {
	/*
	The input trim takes a C0 control off the end of the URL, which a media type without a comma is. Invalid data URLs without a comma are normalized best-effort; generated escapes can be lowercased on another pass as MIME names.
	*/
	for (const [name, character] of [
		['vertical tab', '\u{B}'],
		['null', '\u{0}'],
		['start of heading', '\u{1}'],
		['unit separator', '\u{1F}'],
	]) {
		const escaped = encodeURIComponent(character);
		assert.equal(normalizeUrl(`data:text/plain;${character}`), 'data:,', `at the end of the input: ${name}`);
		assert.equal(normalizeUrl(`data:text/plain;${character}#`), `data:text/plain;${escaped}`, `before a hash: ${name}`);
		assert.equal(normalizeUrl(`data:text/plain;${character}#a`, {stripHash: true}), `data:text/plain;${escaped}`, `with the hash stripped: ${name}`);
		assert.equal(normalizeUrl(`data:text/plain;${character}#h`), `data:text/plain;${escaped}#h`, `with a hash kept: ${name}`);
		// Before a comma the media type does not end the URL, so the control stays raw. Escaping it there would also escape a space before it, which a browser does not decode in a media type.
		assert.equal(normalizeUrl(`data:text/plain;${character},QUJD`), `data:text/plain;${character},QUJD`, `before a comma: ${name}`);
	}
});

test('a data URL media type is trimmed of the whitespace a parser leaves in it', () => {
	/*
	A space is the only HTTP whitespace a URL parser leaves in a media type. Trimming anything else could spell a base64 marker a browser does not see.
	*/
	const mediaTypeOf = url => {
		const {pathname} = new URL(url);
		return pathname.slice(0, pathname.indexOf(','));
	};

	/*
	A control is not whitespace, so it stays in the value and does not spell the marker. Its escape reads the same.
	*/
	for (const [name, character] of [
		['form feed', '\u{C}'],
		['vertical tab', '\u{B}'],
		['null', '\u{0}'],
		['start of heading', '\u{1}'],
		['unit separator', '\u{1F}'],
		['no-break space', '\u{A0}'],
		['ideographic space', '\u{3000}'],
	]) {
		assert.equal(normalizeUrl(`data:image/png;a=${character}x,QUJD`), `data:image/png;a=${character}x,QUJD`, `in a value: ${name}`);
		assert.equal(mediaTypeOf(normalizeUrl(`data:image/png;${character}base64,QUJD`)), `image/png;${encodeURIComponent(character)}base64`, `as a marker: ${name}`);
	}

	// And the ones a parser removes are gone before the media type is read, so the marker does fire.
	for (const character of ['\u{9}', '\u{A}', '\u{D}']) {
		assert.equal(normalizeUrl(`data:image/png;a=${character}x,QUJD`), 'data:image/png;a=x,QUJD', `in a value: ${character}`);
		assert.equal(mediaTypeOf(normalizeUrl(`data:image/png;${character}base64,QUJD`)), 'image/png;base64', `as a marker: ${character}`);
	}

	/*
	A space is the one a URL parser keeps, and a MIME parser strips only trailing parameter whitespace, which the two halves pin.
	*/
	assert.equal(normalizeUrl('data:image/png;a=x ,QUJD'), 'data:image/png;a=x,QUJD');
	assert.equal(normalizeUrl('data:image/png;a= x,QUJD'), 'data:image/png;a= x,QUJD');
	assert.equal(normalizeUrl('data:image/png;a=x ,QUJD'), 'data:image/png;a=x,QUJD');
	assert.equal(normalizeUrl('data:image/png; a=x,QUJD'), 'data:image/png;a=x,QUJD');
	assert.equal(normalizeUrl('data:image/png;a =x,QUJD'), 'data:image/png;a =x,QUJD');
});

test('a space of another kind is a character of the URL, except at the ends', () => {
	/*
	Inside the URL, whitespace a URL parser does not remove is content, escaped or kept as written. A zero width space is not whitespace, so it is content at the ends too.
	*/
	for (const character of ['\u{A0}', '\u{FEFF}', '\u{200B}', '\u{3000}']) {
		assert.equal(normalizeUrl(`http://sindresorhus.com/a${character}b`), `http://sindresorhus.com/a${encodeURIComponent(character)}b`, character);
		assert.equal(normalizeUrl(`http://sindresorhus.com/?a=${character}b`), `http://sindresorhus.com/?a=${encodeURIComponent(character)}b`, character);
		assert.equal(normalizeUrl(`http://sindresorhus.com/#${character}b`), `http://sindresorhus.com/#${encodeURIComponent(character)}b`, character);
		assert.equal(normalizeUrl(`data:text/plain,${character}b`), `data:,${character}b`, character);
		assert.equal(normalizeUrl('  http://sindresorhus.com/a  '), 'http://sindresorhus.com/a', 'and a real space still goes');
	}

	/*
	At the ends it is almost always left over from copying the URL, as `String#trim` sees it, so it goes. Kept, it would make the URL invalid at the front, or a different URL at the end.
	*/
	for (const character of ['\u{A0}', '\u{FEFF}', '\u{2028}', '\u{3000}']) {
		assert.equal(normalizeUrl(`${character}http://sindresorhus.com/a`), 'http://sindresorhus.com/a', character);
		assert.equal(normalizeUrl(`${character}sindresorhus.com/a`), 'http://sindresorhus.com/a', character);
		assert.equal(normalizeUrl(`http://sindresorhus.com/a${character}`), 'http://sindresorhus.com/a', character);
		assert.equal(normalizeUrl(`sindresorhus.com${character}`), 'http://sindresorhus.com', character);
		assert.equal(normalizeUrl(`http://sindresorhus.com/?a=1${character}`), 'http://sindresorhus.com/?a=1', character);
		assert.equal(normalizeUrl(`${character} sindre://sindresorhus.com/a ${character}`), 'sindre://sindresorhus.com/a', character);
	}

	assert.equal(normalizeUrl('http://sindresorhus.com/a\u{200B}'), 'http://sindresorhus.com/a%E2%80%8B');
});

test('a dotted scheme with an authority is a custom protocol', () => {
	/*
	A dotted scheme followed by `//` is a protocol, so the URL passes through untouched. Without the `//` it is a host, so the two cannot be told apart.
	*/
	assert.equal(normalizeUrl('example.com/path'), 'http://example.com/path');
	assert.equal(normalizeUrl('example.com://host/path'), 'example.com://host/path');
	assert.equal(normalizeUrl('example.com://host/www.x.com/a/../b?x=1'), 'example.com://host/www.x.com/a/../b?x=1');
	assert.equal(normalizeUrl('exämple.com://host/path'), 'http://xn--exmple-cua.com/host/path');
	assert.equal(normalizeUrl('view-source://www.x.com/a/'), 'view-source://www.x.com/a/');

	// Naming it in `customProtocols` is what opts into normalizing one.
	assert.equal(normalizeUrl('example.com://host/www.x.com/a/../b?x=1', {customProtocols: ['example.com']}), 'example.com://host/www.x.com/b?x=1');
	assert.equal(normalizeUrl('view-source://www.x.com/a/', {customProtocols: ['view-source']}), 'view-source://x.com/a');
});

test('a backslash the parser reads as a slash is one it wrote', () => {
	/*
	A backslash is a slash in the path of a special scheme, so the root slash stays. A template literal cannot end in a backslash, hence the variable.
	*/
	const slash = '\\';
	const options = {removeTrailingSlash: false, removeSingleSlash: false};

	assert.equal(normalizeUrl(`http://sindresorhus.com/${slash}`, options), 'http://sindresorhus.com/');
	// Two backslashes are two slashes to a parser, and the duplicate slash removal takes them to one.
	assert.equal(normalizeUrl(`http://sindresorhus.com/${slash}${slash}`, options), 'http://sindresorhus.com/');
	assert.equal(normalizeUrl(`http://sindresorhus.com/a${slash}`, options), 'http://sindresorhus.com/a/');
	assert.equal(normalizeUrl('http://sindresorhus.com/?q=1', options), 'http://sindresorhus.com/?q=1');
	assert.equal(normalizeUrl(`http://sindresorhus.com/${slash}?q=1`, options), 'http://sindresorhus.com/?q=1');
	assert.equal(normalizeUrl(`http://sindresorhus.com/a${slash}b`, options), 'http://sindresorhus.com/a/b');

	// With the options on, the slash still goes, and a backslash the parser turned into a slash is removed like any other.
	assert.equal(normalizeUrl(`http://sindresorhus.com/${slash}`), 'http://sindresorhus.com');
	assert.equal(normalizeUrl(`http://sindresorhus.com/a${slash}`), 'http://sindresorhus.com/a');
	assert.equal(normalizeUrl(`http://sindresorhus.com/a${slash}b`), 'http://sindresorhus.com/a/b');

	// A non-special scheme keeps a backslash as a character of its path, written as `%5C`, so there it is not a slash and the root slash goes.
	const sindre = {customProtocols: ['sindre']};
	assert.equal(normalizeUrl(`sindre://h/${slash}`, {...options, ...sindre}), 'sindre://h/%5C');
	// Two of them are two characters, and neither is a slash, so the duplicate slash removal leaves them.
	assert.equal(normalizeUrl(`sindre://h/${slash}${slash}`, {...options, ...sindre}), 'sindre://h/%5C%5C');
	assert.equal(normalizeUrl(`sindre:a${slash}`, sindre), `sindre:a${slash}`);
});

test('a hostname has its percent escapes canonicalized', () => {
	/*
	The parser decodes the host of a special scheme, so it has no escapes. An opaque host keeps them, so its hexadecimal digits are canonicalized like any other component.
	*/
	const options = {customProtocols: ['sindre']};
	for (const [spelling, canonical] of [
		['%4a', '%4A'],
		['%4A', '%4A'],
		['%7e', '%7E'],
		['%7E', '%7E'],
		['%c3%a9', '%C3%A9'],
		['%C3%A9', '%C3%A9'],
		['%2e', '%2E'],
		['%2E', '%2E'],
		['%2f', '%2F'],
	]) {
		assert.equal(normalizeUrl(`sindre://a${spelling}x/p`, options), `sindre://a${canonical}x/p`, spelling);
		// A trailing dot is kept on an opaque host, so the line is kept on one here too.
		assert.equal(normalizeUrl(`sindre://a${spelling}x./p`, options), `sindre://a${canonical}x./p`, spelling);
	}

	// And a special scheme, whose host the parser has already read, is unaffected.
	assert.equal(normalizeUrl('http://%4a%78/p'), 'http://jx/p');
	assert.equal(normalizeUrl('https://%41%42/p'), 'https://ab/p');

	for (const url of ['sindre://a%4ax/p', 'sindre://a%4ax./p', 'sindre://a%c3%a9x/p']) {
		assert.equal(normalizeUrl(url, options), normalizeUrl(normalizeUrl(url, options), options), url);
	}
});

test('the www and the trailing dot rules compose in one pass', () => {
	/*
	Whether a host of numbers reads as an IPv4 address depends on every label, `www.` included, so removing the dots before the `www.` was not a fixed point.
	*/
	for (const [url, output] of [
		['http://www.127.0.0.1..', 'http://127.0.0.1'],
		['http://www.8080...', 'http://8080...'],
		['http://8080...', 'http://8080...'],
		['https://www.159.189.213..', 'https://159.189.213..'],
		['http://www.sindresorhus.com..', 'http://sindresorhus.com'],
		['http://www.sindresorhus.com.', 'http://sindresorhus.com'],
	]) {
		assert.equal(normalizeUrl(url), output, url);
		assert.equal(normalizeUrl(normalizeUrl(url)), normalizeUrl(url), `a fixed point: ${url}`);
	}
});

test('a trailing dot comes off a domain and not off an opaque host', () => {
	/*
	Only the host of a special scheme is IDNA mapped, where a trailing dot is the same name. An opaque host keeps its case and trailing dot.
	*/
	assert.equal(normalizeUrl('http://sindresorhus.com./a'), 'http://sindresorhus.com/a');
	assert.equal(normalizeUrl('https://sindresorhus.com../a'), 'https://sindresorhus.com/a');
	assert.equal(normalizeUrl('file://sindresorhus.com./a'), 'file://sindresorhus.com/a');
	assert.equal(normalizeUrl('http://sindresorhus.com.'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com..'), 'http://sindresorhus.com');

	const opaque = {customProtocols: ['foo']};
	assert.equal(normalizeUrl('foo://WWW.Example.COM./x', opaque), 'foo://WWW.Example.COM./x');
	assert.equal(normalizeUrl('foo://example.com./x', opaque), 'foo://example.com./x');
	assert.equal(normalizeUrl('foo://x.com..', opaque), 'foo://x.com..');
	assert.equal(normalizeUrl('foo://WWW.Example.COM/x', opaque), 'foo://WWW.Example.COM/x');

	// And the two spellings of one domain host still come out as one.
	assert.equal(normalizeUrl('http://SINDRE.Example.COM../a'), 'http://sindre.example.com/a');
});

test('a hostname a URL parser reads back as another one is left alone', () => {
	/*
	Stripping the trailing dots off a name of numbers can change or break the IPv4 address, so they stay. The `www.` still goes, as a separate rule.
	*/
	assert.equal(normalizeUrl('https://www.159.189.213..'), 'https://159.189.213..');
	assert.equal(normalizeUrl('https://159.189.213..'), 'https://159.189.213..');
	// The `www.` still goes, and the dots stay, which is the same split the opaque host gets.
	assert.equal(normalizeUrl('www.8080...'), 'http://8080...');
	assert.equal(normalizeUrl('8080...'), 'http://8080...');
	assert.equal(normalizeUrl('www.127.0.0.1..'), 'http://127.0.0.1');
	assert.equal(normalizeUrl('http://1.2.3.4.5..'), 'http://1.2.3.4.5..');

	// A name that does read back as itself still has its dots removed, and so does one that becomes another name by dropping them.
	assert.equal(normalizeUrl('http://127.0.0.1..'), 'http://127.0.0.1');
	assert.equal(normalizeUrl('sindresorhus.com..'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com..'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com.'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://.'), 'http://.');
	assert.equal(normalizeUrl('http://..'), 'http://.');
	assert.equal(normalizeUrl('http://[::1]/'), 'http://[::1]');
	assert.equal(normalizeUrl('http://exämple.com..'), 'http://xn--exmple-cua.com');

	// Every one of them is a fixed point.
	for (const url of ['https://www.159.189.213..', 'www.8080...', 'www.127.0.0.1..', 'http://1.2.3.4.5..', 'http://127.0.0.1..']) {
		assert.equal(normalizeUrl(url), normalizeUrl(normalizeUrl(url)), url);
	}
});

test('stripWWW option', () => {
	const options = {stripWWW: false};
	assert.equal(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('http://www.êxample.com', options), 'http://www.xn--xample-hva.com');

	const options2 = {stripWWW: true};
	assert.equal(normalizeUrl('http://www.vue.amsterdam', options2), 'http://vue.amsterdam');
	assert.equal(normalizeUrl('http://www.sorhus.xx--bck1b9a5dre4c', options2), 'http://sorhus.xx--bck1b9a5dre4c');

	const tooLongTLDURL = 'http://www.sorhus.' + ''.padEnd(64, 'a');
	assert.equal(normalizeUrl(tooLongTLDURL, options2), tooLongTLDURL);

	// Issue #109 - Should strip www from multi-level subdomains
	assert.equal(normalizeUrl('www.unix.stackexchange.com'), 'http://unix.stackexchange.com');
	assert.equal(normalizeUrl('https://www.unix.stackexchange.com'), 'https://unix.stackexchange.com');
	assert.equal(normalizeUrl('www.api.example.com'), 'http://api.example.com');

	// Issue #38 - Should NOT strip www when it would break the domain
	assert.equal(normalizeUrl('www.com'), 'http://www.com');
	assert.equal(normalizeUrl('https://www.com'), 'https://www.com');

	// Edge case: www.www.com should NOT be stripped (intentional behavior)
	assert.equal(normalizeUrl('www.www.com'), 'http://www.www.com');
	assert.equal(normalizeUrl('www.www.example.com'), 'http://www.www.example.com');

	// Labels may contain digits and hyphens, and a single label of one character is allowed
	assert.equal(normalizeUrl('http://www.a1.com'), 'http://a1.com');
	assert.equal(normalizeUrl('http://www.1a.com'), 'http://1a.com');
	assert.equal(normalizeUrl('http://www.a-b.com'), 'http://a-b.com');
	assert.equal(normalizeUrl('http://www.a1.b2.com'), 'http://a1.b2.com');
	assert.equal(normalizeUrl('http://www.a.b'), 'http://www.a.b');
	assert.equal(normalizeUrl('http://www..com'), 'http://www..com');
});

test('removeQueryParameters option', () => {
	const options = {
		stripWWW: false,
		removeQueryParameters: [/^utm_\w+/iv, 'ref'],
	};
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test'), 'http://sindresorhus.com/?foo=bar');
	assert.equal(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar', options), 'http://www.sindresorhus.com/?foo=bar');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options), 'http://www.sindresorhus.com/?foo=bar');
	assert.equal(normalizeUrl('https://example.com?foo=1&foo2=2&bar=3', {removeQueryParameters: [/^foo/giv]}), 'https://example.com/?bar=3');
	assert.equal(normalizeUrl('https://example.com?foo=1&foo2=2&bar=3', {removeQueryParameters: [/^foo/vy]}), 'https://example.com/?bar=3');
	assert.equal(normalizeUrl('https://example.com?foo=1&foo2=2&bar=3', {removeQueryParameters: ['foo', /^foo2/vy]}), 'https://example.com/?bar=3');
	const globalFilter = /^foo/gv;
	globalFilter.lastIndex = 2;
	assert.equal(normalizeUrl('https://example.com?foo=1&bar=2', {removeQueryParameters: [globalFilter]}), 'https://example.com/?bar=2');
});

test('removeQueryParameters boolean `true` option', () => {
	const options = {
		stripWWW: false,
		removeQueryParameters: true,
	};

	assert.equal(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options), 'http://www.sindresorhus.com');
});

test('removeQueryParameters boolean `false` option', () => {
	const options = {
		stripWWW: false,
		removeQueryParameters: false,
	};

	assert.equal(normalizeUrl('http://www.sindresorhus.com', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar', options), 'http://www.sindresorhus.com/?foo=bar');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options), 'http://www.sindresorhus.com/?foo=bar&ref=test_ref&utm_medium=test');
});

test('keepQueryParameters option', () => {
	const options = {
		stripWWW: false,
		removeQueryParameters: false,
		keepQueryParameters: [/^utm_\w+/iv, 'ref'],
	};
	assert.equal(normalizeUrl('https://sindresorhus.com', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar', options), 'http://www.sindresorhus.com');
	assert.equal(normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options), 'http://www.sindresorhus.com/?ref=test_ref&utm_medium=test');

	assert.equal(normalizeUrl('https://example.com?foo=1&bar=2', {
		removeQueryParameters: ['foo'],
		keepQueryParameters: ['foo', 'bar'],
	}), 'https://example.com/?bar=2&foo=1');

	assert.equal(normalizeUrl('https://example.com?foo=1&bar=2', {
		removeQueryParameters: true,
		keepQueryParameters: ['foo'],
	}), 'https://example.com/?foo=1');

	assert.equal(normalizeUrl('https://example.com?foo=1&bar=2', {
		keepQueryParameters: [],
	}), 'https://example.com');

	assert.equal(normalizeUrl('https://example.com?foo=1&foo2=2&bar=3', {
		keepQueryParameters: [/^foo/giv],
	}), 'https://example.com/?foo=1&foo2=2');

	assert.equal(normalizeUrl('https://example.com?foo=1&foo2=2&bar=3', {
		keepQueryParameters: [/^foo/vy],
	}), 'https://example.com/?foo=1&foo2=2');

	assert.equal(normalizeUrl('https://example.com?foo=1&foo2=2&bar=3', {
		keepQueryParameters: ['foo2', /^foo/vy],
	}), 'https://example.com/?foo=1&foo2=2');

	const globalKeep = /^foo/gv;
	globalKeep.lastIndex = 10;
	assert.equal(normalizeUrl('https://example.com?foo=1&bar=2', {
		keepQueryParameters: [globalKeep],
	}), 'https://example.com/?foo=1');
});

test('forceHttp option', () => {
	const options = {forceHttp: true};
	assert.equal(normalizeUrl('https://sindresorhus.com'), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https://www.sindresorhus.com', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com', options), 'http://sindresorhus.com');
});

test('changing the scheme with an option drops the port that was the default one', () => {
	/*
	The port is read again against the new scheme, so the old default goes and any other port stays.
	*/
	assert.equal(normalizeUrl('https://sindresorhus.com:443/a', {forceHttp: true}), 'http://sindresorhus.com/a');
	assert.equal(normalizeUrl('https://sindresorhus.com:8080/a', {forceHttp: true}), 'http://sindresorhus.com:8080/a');
	assert.equal(normalizeUrl('http://sindresorhus.com:80/a', {forceHttps: true}), 'https://sindresorhus.com/a');
	assert.equal(normalizeUrl('http://sindresorhus.com:8080/a', {forceHttps: true}), 'https://sindresorhus.com:8080/a');
	assert.equal(normalizeUrl('//sindresorhus.com:443/a', {defaultProtocol: 'https'}), 'https://sindresorhus.com/a');

	// And the port that is a default without any option is still removed.
	assert.equal(normalizeUrl('https://sindresorhus.com:443/a'), 'https://sindresorhus.com/a');
	assert.equal(normalizeUrl('http://sindresorhus.com:80/a'), 'http://sindresorhus.com/a');
});

test('forceHttp option with forceHttps', () => {
	assert.throws(() => {
		normalizeUrl('https://www.sindresorhus.com', {forceHttp: true, forceHttps: true});
	}, {
		message: 'The `forceHttp` and `forceHttps` options cannot be used together',
	});

	// The error does not depend on the URL being parseable, nor on its protocol.
	for (const url of ['not a url', 'data:,foo', 'mailto:foo@sindresorhus.com', 'file:///foo']) {
		assert.throws(() => {
			normalizeUrl(url, {forceHttp: true, forceHttps: true});
		}, {
			message: 'The `forceHttp` and `forceHttps` options cannot be used together',
		});
	}
});

test('forceHttps option', () => {
	const options = {forceHttps: true};
	assert.equal(normalizeUrl('https://sindresorhus.com'), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://www.sindresorhus.com', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('//sindresorhus.com', options), 'https://sindresorhus.com');
});

test('removeTrailingSlash option', () => {
	const options = {removeTrailingSlash: false};
	assert.equal(normalizeUrl('http://sindresorhus.com'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/'), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/redirect'), 'http://sindresorhus.com/redirect');
	assert.equal(normalizeUrl('http://sindresorhus.com/redirect/'), 'http://sindresorhus.com/redirect');
	assert.equal(normalizeUrl('http://sindresorhus.com/redirect/', options), 'http://sindresorhus.com/redirect/');
	assert.equal(normalizeUrl('http://sindresorhus.com/#/'), 'http://sindresorhus.com/#/');
	assert.equal(normalizeUrl('http://sindresorhus.com/#/', options), 'http://sindresorhus.com/#/');
	assert.equal(normalizeUrl('http://sindresorhus.com/?unicorns=true'), 'http://sindresorhus.com/?unicorns=true');
	assert.equal(normalizeUrl('http://sindresorhus.com/?unicorns=true', options), 'http://sindresorhus.com/?unicorns=true');

	// A trailing slash that belongs to the search must be kept.
	assert.equal(normalizeUrl('http://sindresorhus.com?a/'), 'http://sindresorhus.com/?a/');
	assert.equal(normalizeUrl('http://sindresorhus.com?a=b/'), 'http://sindresorhus.com/?a=b/');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=b/'), 'http://sindresorhus.com/?a=b/');
	assert.equal(normalizeUrl('http://sindresorhus.com?/'), 'http://sindresorhus.com/?/');
	assert.equal(normalizeUrl('http://sindresorhus.com?//'), 'http://sindresorhus.com/?//');
	assert.equal(normalizeUrl('http://sindresorhus.com?a=b/', options), 'http://sindresorhus.com/?a=b/');
	assert.equal(normalizeUrl('http://sindresorhus.com/redirect/?a=b/'), 'http://sindresorhus.com/redirect?a=b/');
	assert.equal(normalizeUrl('http://sindresorhus.com?a=b/', {removeSingleSlash: false}), 'http://sindresorhus.com/?a=b/');
	assert.equal(normalizeUrl('http://sindresorhus.com/', options), 'http://sindresorhus.com');
});

test('removeExplicitPort option', () => {
	const options = {removeExplicitPort: true};
	assert.equal(normalizeUrl('http://sindresorhus.com:123', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com:123', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com:443', options), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com:80', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('localhost:9802', options), 'http://localhost');
	assert.equal(normalizeUrl('localhost:9802', {...options, stripProtocol: true}), 'localhost');
	assert.equal(normalizeUrl('localhost:9802/path', options), 'http://localhost/path');
});

test('removeSingleSlash option', () => {
	const options = {removeSingleSlash: false};
	assert.equal(normalizeUrl('https://sindresorhus.com', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com/', options), 'https://sindresorhus.com/');
	assert.equal(normalizeUrl('https://sindresorhus.com/redirect', options), 'https://sindresorhus.com/redirect');
	assert.equal(normalizeUrl('https://sindresorhus.com/redirect/', options), 'https://sindresorhus.com/redirect');
	assert.equal(normalizeUrl('https://sindresorhus.com/#/', options), 'https://sindresorhus.com/#/');
	assert.equal(normalizeUrl('https://sindresorhus.com/?unicorns=true', options), 'https://sindresorhus.com/?unicorns=true');

	// A trailing slash written before a query or hash is still a trailing slash on the path
	assert.equal(normalizeUrl('https://sindresorhus.com/#', options), 'https://sindresorhus.com/');
	assert.equal(normalizeUrl('https://sindresorhus.com/?', options), 'https://sindresorhus.com/');
	assert.equal(normalizeUrl('https://sindresorhus.com/?a=1', options), 'https://sindresorhus.com/?a=1');
	assert.equal(normalizeUrl('https://sindresorhus.com', options), 'https://sindresorhus.com');

	// A custom protocol with a host is normalized too, so the sole slash is the same case here
	assert.equal(normalizeUrl('sindre://sindresorhus.com/', {...options, customProtocols: ['sindre']}), 'sindre://sindresorhus.com/');
	assert.equal(normalizeUrl('sindre://sindresorhus.com/#', {...options, customProtocols: ['sindre']}), 'sindre://sindresorhus.com/');
	assert.equal(normalizeUrl('sindre://sindresorhus.com/?a=1', {...options, customProtocols: ['sindre']}), 'sindre://sindresorhus.com/?a=1');
	assert.equal(normalizeUrl('sindre://sindresorhus.com/redirect/', {...options, customProtocols: ['sindre']}), 'sindre://sindresorhus.com/redirect');

	/*
	A limitation: the slash is read off the input as written, so `a/../` keeps the root slash while the same URL `a/..` does not.
	*/
	assert.equal(normalizeUrl('https://sindresorhus.com/a/../', options), 'https://sindresorhus.com/');
	assert.equal(normalizeUrl('https://sindresorhus.com/a/..', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com/a/b/..', options), 'https://sindresorhus.com/a');
	assert.equal(normalizeUrl('s3://host/a/../', {...options, customProtocols: ['s3']}), 's3://host/');
	assert.equal(normalizeUrl('s3://host/a/..', {...options, customProtocols: ['s3']}), 's3://host');
});

test('removeSingleSlash option combined with removeTrailingSlash option', () => {
	const options = {removeTrailingSlash: false, removeSingleSlash: false};
	assert.equal(normalizeUrl('https://sindresorhus.com', options), 'https://sindresorhus.com');
	assert.equal(normalizeUrl('https://sindresorhus.com/', options), 'https://sindresorhus.com/');
	assert.equal(normalizeUrl('https://sindresorhus.com/redirect', options), 'https://sindresorhus.com/redirect');
	assert.equal(normalizeUrl('https://sindresorhus.com/redirect/', options), 'https://sindresorhus.com/redirect/');
	assert.equal(normalizeUrl('https://sindresorhus.com/#/', options), 'https://sindresorhus.com/#/');
	assert.equal(normalizeUrl('https://sindresorhus.com/?unicorns=true', options), 'https://sindresorhus.com/?unicorns=true');
});

test('removeDirectoryIndex option', () => {
	const options1 = {removeDirectoryIndex: ['index.html', 'index.php']};
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', options1), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.htm', options1), 'http://sindresorhus.com/index.htm');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.php', options1), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/path/index.html'), 'http://sindresorhus.com/path/index.html');
	assert.equal(normalizeUrl('http://sindresorhus.com/path/index.html', options1), 'http://sindresorhus.com/path');
	assert.equal(normalizeUrl('http://sindresorhus.com/path/index.htm', options1), 'http://sindresorhus.com/path/index.htm');
	assert.equal(normalizeUrl('http://sindresorhus.com/path/index.php', options1), 'http://sindresorhus.com/path');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo/bar/index.html', options1), 'http://sindresorhus.com/foo/bar');

	const options2 = {removeDirectoryIndex: [/^index\.[a-z]+$/v, 'remove.html']};
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', options2), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/index/index.html', options2), 'http://sindresorhus.com/index');
	assert.equal(normalizeUrl('http://sindresorhus.com/remove.html', options2), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/default.htm', options2), 'http://sindresorhus.com/default.htm');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.php', options2), 'http://sindresorhus.com');

	const globalIndex = /index\.html/gv;
	globalIndex.lastIndex = 5;
	const options2b = {removeDirectoryIndex: [globalIndex, /index\.php/vy]};
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', options2b), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.php', options2b), 'http://sindresorhus.com');

	// A filter that matches everything empties the path, and one that matches nothing leaves it alone
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', {removeDirectoryIndex: [/^/v]}), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', {removeDirectoryIndex: [/^$/v]}), 'http://sindresorhus.com/index.html');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', {removeDirectoryIndex: []}), 'http://sindresorhus.com/index.html');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', {removeDirectoryIndex: 'index.html'}), 'http://sindresorhus.com/index.html');

	const options3 = {removeDirectoryIndex: true};
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html'), 'http://sindresorhus.com/index.html');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.html', options3), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.htm', options3), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/index.php', options3), 'http://sindresorhus.com');

	// Should handle trailing slashes consistently
	const options4 = {removeDirectoryIndex: ['fr']};
	assert.equal(normalizeUrl('http://example.com/fr', options4), 'http://example.com');
	assert.equal(normalizeUrl('http://example.com/fr/', options4), 'http://example.com');
	assert.equal(normalizeUrl('http://example.com/path/fr', options4), 'http://example.com/path');
	assert.equal(normalizeUrl('http://example.com/path/fr/', options4), 'http://example.com/path');

	// A path ending in several index files has all of them removed, so the result is a fixed point
	const options5 = {removeDirectoryIndex: true};
	assert.equal(normalizeUrl('http://example.com/a/index.html/index.html', options5), 'http://example.com/a');
	assert.equal(normalizeUrl('http://example.com/a/index.html/index.php', options5), 'http://example.com/a');
	assert.equal(normalizeUrl('http://example.com/index.html/index.html/index.html', options5), 'http://example.com');
	assert.equal(normalizeUrl('http://example.com/a/b', options5), 'http://example.com/a/b');
	assert.equal(normalizeUrl('http://example.com/a/b', {...options5, removeTrailingSlash: false}), 'http://example.com/a/b');
	assert.equal(normalizeUrl('http://example.com/a/index.html/index.html', {...options5, removeTrailingSlash: false}), 'http://example.com/a/');
	assert.equal(normalizeUrl('http://example.com/a/default.php/default.php', {removeDirectoryIndex: [/^default\.[a-z]+$/v]}), 'http://example.com/a');
});

test('removeTrailingSlash and removeDirectoryIndex options)', () => {
	const options1 = {
		removeTrailingSlash: true,
		removeDirectoryIndex: true,
	};
	assert.equal(normalizeUrl('http://sindresorhus.com/path/', options1), 'http://sindresorhus.com/path');
	assert.equal(normalizeUrl('http://sindresorhus.com/path/index.html', options1), 'http://sindresorhus.com/path');
	assert.equal(normalizeUrl('http://sindresorhus.com/#/path/', options1), 'http://sindresorhus.com/#/path/');
	assert.equal(normalizeUrl('http://sindresorhus.com/foo/#/bar/', options1), 'http://sindresorhus.com/foo#/bar/');

	const options2 = {
		removeTrailingSlash: false,
		removeDirectoryIndex: true,
	};
	assert.equal(normalizeUrl('http://sindresorhus.com/path/', options2), 'http://sindresorhus.com/path/');
	assert.equal(normalizeUrl('http://sindresorhus.com/path/index.html', options2), 'http://sindresorhus.com/path/');
	assert.equal(normalizeUrl('http://sindresorhus.com/#/path/', options2), 'http://sindresorhus.com/#/path/');
});

test('sortQueryParameters option', () => {
	const options1 = {
		sortQueryParameters: true,
	};
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options1), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	assert.equal(normalizeUrl('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options1), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options1), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	assert.equal(normalizeUrl('http://sindresorhus.com/', options1), 'http://sindresorhus.com');

	const options2 = {
		sortQueryParameters: false,
	};
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options2), 'http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
	assert.equal(normalizeUrl('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options2), 'http://sindresorhus.com/?b=Y&c=X&a=Z&d=W');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options2), 'http://sindresorhus.com/?a=Z&d=W&b=Y&c=X');
	assert.equal(normalizeUrl('http://sindresorhus.com/', options2), 'http://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/?a=/path', options1), normalizeUrl('http://sindresorhus.com/?a=/path', options2));
});

test('whitespace other than tab, CR and LF is stripped only from the ends', () => {
	/*
	A URL parser escapes whitespace that is not at the ends, so dropping that would change the URL. At the ends it goes, the same as `String#trim` takes it.
	*/
	const characters = ['\u{A0}', '\u{1680}', '\u{2000}', '\u{2028}', '\u{2029}', '\u{202F}', '\u{205F}', '\u{3000}', '\u{FEFF}'];
	for (const character of characters) {
		assert.equal(normalizeUrl(`http://example.com/${character}`), 'http://example.com', character);
		assert.equal(normalizeUrl(`http://example.com/${character}/`), `http://example.com/${encodeURIComponent(character)}`, character);
		assert.equal(normalizeUrl(`http://example.com/a${character}b`), `http://example.com/a${encodeURIComponent(character)}b`, character);
		assert.equal(normalizeUrl(`http://example.com/?a=${character}&b`, {removeQueryParameters: false}), `http://example.com/?a=${encodeURIComponent(character)}&b`, character);
		assert.equal(normalizeUrl(`http://example.com/#${character}b`), `http://example.com/#${encodeURIComponent(character)}b`, character);
		// The data of a data URL is written as it stands, so a kept character is not percent-encoded.
		assert.equal(normalizeUrl(`data:text/plain,${character}b`), `data:,${character}b`, character);
		assert.equal(normalizeUrl(`sindre://example.com/${character}b`, {customProtocols: ['sindre']}), `sindre://example.com/${encodeURIComponent(character)}b`, character);
		// A data URL whose text would otherwise end in it escapes it, so the next pass does not strip it.
		assert.equal(normalizeUrl(`data:,a${character}#b`, {stripHash: true}), `data:,a${encodeURIComponent(character)}`, character);
		assert.equal(normalizeUrl(`data:;base64,QUJD${character}#b`, {stripHash: true}), `data:;base64,QUJD${encodeURIComponent(character)}`, character);
		assert.equal(normalizeUrl(`data:text/plain;a=b${character};`), `data:text/plain;a=b${encodeURIComponent(character)}`, character);
		// Before a comma the media type does not end the URL, so the character stays part of the value.
		assert.equal(normalizeUrl(`data:text/plain;a=b${character},z`), `data:text/plain;a=b${character},z`, character);
	}

	/*
	Those a parser strips still go, and tab, carriage return and line feed go from anywhere.
	*/
	assert.equal(normalizeUrl('  http://example.com  '), 'http://example.com');
	assert.equal(normalizeUrl('\u{0}http://example.com\u{1}'), 'http://example.com');
	assert.equal(normalizeUrl('\u{1F}http://example.com/a\u{1F}'), 'http://example.com/a');
	assert.equal(normalizeUrl('http://exa\tmple.com/a\r/b\nc'), 'http://example.com/a/bc');
	assert.equal(normalizeUrl('data:text/\tplain,a\nb'), 'data:,ab');
	assert.equal(normalizeUrl('data:text/ht\tml,a\rb'), 'data:text/html,ab');
});

test('invalid urls', () => {
	assert.throws(() => {
		normalizeUrl('http://');
	}, {
		message: /^Invalid URL/v,
	});

	assert.throws(() => {
		normalizeUrl('/');
	}, {
		message: /^Invalid URL/v,
	});

	assert.throws(() => {
		normalizeUrl('/relative/path/');
	}, {
		message: /^Invalid URL/v,
	});
});

test('a path rebuilt from its components keeps a protocol lookalike only as far as it can', () => {
	/*
	A limitation: a path rebuilt from components cannot keep the empty one between the two slashes of a lookalike. The result is still a fixed point for the same resource.
	*/
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://'), 'http://sindresorhus.com/ab://');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://x'), 'http://sindresorhus.com/ab://x');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://', {transformPath: pathComponents => pathComponents}), 'http://sindresorhus.com/ab:');
	assert.equal(normalizeUrl('http://sindresorhus.com/s3://x/y', {transformPath: pathComponents => pathComponents}), 'http://sindresorhus.com/s3:/x/y');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://index.html', {removeDirectoryIndex: true}), 'http://sindresorhus.com/ab:');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/http://b/index.html', {removeDirectoryIndex: true}), 'http://sindresorhus.com/a/http:/b');

	for (const [url, options] of [
		['http://sindresorhus.com/ab://', {transformPath: pathComponents => pathComponents}],
		['http://sindresorhus.com/ab://index.html', {removeDirectoryIndex: true}],
		['http://sindresorhus.com/a/http://b/index.html', {removeDirectoryIndex: true}],
	]) {
		assert.equal(normalizeUrl(url, options), normalizeUrl(normalizeUrl(url, options), options), url);
	}
});

test('remove duplicate pathname slashes', () => {
	assert.equal(normalizeUrl('http://sindresorhus.com////foo/bar'), 'http://sindresorhus.com/foo/bar');
	assert.equal(normalizeUrl('http://sindresorhus.com////foo////bar'), 'http://sindresorhus.com/foo/bar');
	assert.equal(normalizeUrl('//sindresorhus.com//foo', {normalizeProtocol: false}), '//sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com:5000///foo'), 'http://sindresorhus.com:5000/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com///foo'), 'http://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com:5000//foo'), 'http://sindresorhus.com:5000/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com//foo'), 'http://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/s3://sindresorhus.com'), 'http://sindresorhus.com/s3://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/s3://sindresorhus.com//foo'), 'http://sindresorhus.com/s3://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com//foo/s3://sindresorhus.com'), 'http://sindresorhus.com/foo/s3://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/git://sindresorhus.com'), 'http://sindresorhus.com/git://sindresorhus.com');

	// Scheme names are case-insensitive, so an uppercase one is still a protocol.
	assert.equal(normalizeUrl('http://sindresorhus.com/HTTPS://sindresorhus.com//foo'), 'http://sindresorhus.com/HTTPS://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/AbC://sindresorhus.com//foo'), 'http://sindresorhus.com/AbC://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/S3://sindresorhus.com//foo'), 'http://sindresorhus.com/S3://sindresorhus.com/foo');

	// A protocol at the very end of the path keeps both its slashes, since removing one on this pass would leave the other to be removed on the next.
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://'), 'http://sindresorhus.com/ab://');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://#h'), 'http://sindresorhus.com/ab://#h');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://?q=1'), 'http://sindresorhus.com/ab://?q=1');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab:///'), 'http://sindresorhus.com/ab://');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab:///', {removeTrailingSlash: false}), 'http://sindresorhus.com/ab:///');
	assert.equal(normalizeUrl('http://sindresorhus.com/git://sindresorhus.com//foo'), 'http://sindresorhus.com/git://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com//foo/git://sindresorhus.com//foo'), 'http://sindresorhus.com/foo/git://sindresorhus.com/foo');
	// A scheme is one letter followed by any number of them, so a single letter is a scheme too
	assert.equal(normalizeUrl('http://sindresorhus.com/a://sindresorhus.com//foo'), 'http://sindresorhus.com/a://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/a://'), 'http://sindresorhus.com/a://');

	/*
	The heuristic reads the decoded path, so an escape can spell a lookalike, and escape letters are not a scheme.
	*/
	assert.equal(normalizeUrl('http://sindresorhus.com/%61://sindresorhus.com//foo'), 'http://sindresorhus.com/a://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/%41://sindresorhus.com//foo'), 'http://sindresorhus.com/A://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/%7A%39://'), 'http://sindresorhus.com/z9://');
	assert.equal(normalizeUrl('http://sindresorhus.com/a%2Db://sindresorhus.com//foo'), 'http://sindresorhus.com/a-b://sindresorhus.com/foo');
	/*
	A limitation: the parser returns the path encoded, so the escape letters of a character that is not ASCII can read as a scheme, which only keeps two slashes that could have gone.
	*/
	assert.equal(normalizeUrl('http://sindresorhus.com/%C3%A9://foo//bar'), 'http://sindresorhus.com/%C3%A9://foo/bar');
	assert.equal(normalizeUrl('http://sindresorhus.com/%A9://foo//bar'), 'http://sindresorhus.com/%A9://foo/bar');

	// A scheme cannot start with a digit or contain an underscore, so these are not schemes
	assert.equal(normalizeUrl('http://sindresorhus.com/2abc://sindresorhus.com//foo'), 'http://sindresorhus.com/2abc:/sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/a2-.+_://sindresorhus.com'), 'http://sindresorhus.com/a2-.+_:/sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo'), 'http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo'), 'http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx:/sindresorhus.com/foo');
	assert.equal(normalizeUrl('http://sindresorhus.com/a2-.+://sindresorhus.com'), 'http://sindresorhus.com/a2-.+://sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/a2-.+_://sindresorhus.com'), 'http://sindresorhus.com/a2-.+_:/sindresorhus.com');
	assert.equal(normalizeUrl('http://sindresorhus.com/2abc://sindresorhus.com'), 'http://sindresorhus.com/2abc:/sindresorhus.com');

	// Around the 51 character boundary, and with a second lookalike after the first
	assert.equal(normalizeUrl('http://sindresorhus.com/aaa://a//b'), 'http://sindresorhus.com/aaa://a/b');
	assert.equal(normalizeUrl('http://sindresorhus.com/aaa://'), 'http://sindresorhus.com/aaa://');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://x://y'), 'http://sindresorhus.com/ab://x://y');
	assert.equal(normalizeUrl('http://sindresorhus.com/ab://?#'), 'http://sindresorhus.com/ab://');
});

test('data URL', () => {
	// A URL parser accepts a `data:` URL with no comma and reads the whole thing as the media type with empty data, so the same is accepted here.
	assert.equal(normalizeUrl('data:'), 'data:,');
	assert.equal(normalizeUrl('data:text/plain'), 'data:,');
	assert.equal(normalizeUrl('data:text/plain,'), 'data:,');
	assert.equal(normalizeUrl('data:abc'), 'data:abc');
	assert.equal(normalizeUrl('data:;base64'), 'data:;base64');
	assert.equal(normalizeUrl('data:#x'), 'data:,#x');
	assert.equal(normalizeUrl('data:text/plain#x'), 'data:,#x');
	assert.equal(normalizeUrl('data:text/html;charset=utf-8'), 'data:text/html;charset=utf-8');

	// The input is trimmed, so whitespace at the end of a fragment must not be put back
	assert.equal(normalizeUrl('data:,foo#bar '), 'data:,foo#bar');
	assert.equal(normalizeUrl('data:,foo# a'), 'data:,foo# a');
	assert.equal(normalizeUrl('data:,foo '), 'data:,foo');
	// The `#` starts the fragment, so the comma is inside it and there is no data at all
	assert.equal(normalizeUrl('data:a#b, a #:~:text=y'), 'data:a#b, a #');

	// Strip default MIME type
	assert.equal(normalizeUrl('data:text/plain,foo'), 'data:,foo');

	// Strip default charset
	assert.equal(normalizeUrl('data:;charset=us-ascii,foo'), 'data:,foo');

	// Normalize away trailing semicolon.
	assert.equal(normalizeUrl('data:;charset=UTF-8;,foo'), 'data:;charset=utf-8,foo');

	// Empty MIME type.
	assert.equal(normalizeUrl('data:,'), 'data:,');

	// ASCII tab, carriage return, and line feed are removed from the input, like a URL parser does.
	assert.equal(normalizeUrl('data:,foo\nbar'), 'data:,foobar');
	assert.equal(normalizeUrl('data:,foo\rbar'), 'data:,foobar');
	assert.equal(normalizeUrl('data:,foo\tbar'), 'data:,foobar');
	assert.equal(normalizeUrl('data:text/ht\nml,foo'), 'data:text/html,foo');
	assert.equal(normalizeUrl('data:,foo#bar\nbaz'), 'data:,foo#barbaz');
	assert.equal(normalizeUrl('da\nta:,foo'), 'data:,foo');

	// The `stripTextFragment` option applies to data URLs too.
	assert.equal(normalizeUrl('data:,foo#:~:text=hi'), 'data:,foo');
	assert.equal(normalizeUrl('data:,foo#bar:~:text=hi'), 'data:,foo#bar');
	assert.equal(normalizeUrl('data:,foo#:~:text=hi', {stripTextFragment: false}), 'data:,foo#:~:text=hi');

	/*
	A parser writes a space in a fragment as `%20`, so whitespace left at the end by a text fragment strip is escaped, not trimmed.
	*/
	assert.equal(normalizeUrl('data:,foo#a :~:text=x'), 'data:,foo#a%20');
	assert.equal(normalizeUrl('data:,foo#a b :~:text=x'), 'data:,foo#a b%20');
	assert.equal(normalizeUrl('data:,foo#a #h', {stripTextFragment: false}), 'data:,foo#a #h');
	assert.equal(normalizeUrl('data:,foo#a '), 'data:,foo#a');
	assert.equal(normalizeUrl('data:,foo# :~:text=x'), 'data:,foo#%20');
	assert.equal(normalizeUrl('data:,foo#a%20:~:text=x'), 'data:,foo#a%20');
	assert.equal(normalizeUrl('data:,foo#a'), 'data:,foo#a');

	// And the fragment a browser reads is the one the input had, minus the directive: the input's fragment is `a `, which a URL parser writes as `a%20`.
	assert.equal(new URL('data:,foo#a :~:text=x').hash, '#a%20:~:text=x');
	assert.equal(new URL(normalizeUrl('data:,foo#a :~:text=x')).hash, '#a%20');
	assert.equal(new URL(normalizeUrl('data:,foo# :~:text=x')).hash, '#%20');
	assert.equal(normalizeUrl('data:,foo#see:~:textbook'), 'data:,foo#see:~:textbook');
	assert.equal(normalizeUrl('data:,foo#:~:text=hi', {stripHash: true}), 'data:,foo');
	assert.equal(normalizeUrl('data:,foo#bar'), 'data:,foo#bar');
	assert.equal(normalizeUrl('data:,foo#'), 'data:,foo');

	/*
	A space in the path is a data byte, so dropping a hash leaves it as `%20` rather than trimming it.
	*/
	assert.equal(normalizeUrl('data:,foo #'), 'data:,foo%20');
	assert.equal(normalizeUrl('data:,foo #:~:text=x'), 'data:,foo%20');
	assert.equal(normalizeUrl('data:,  foo #'), 'data:,  foo%20');
	assert.equal(normalizeUrl('data:,foo #bar', {stripHash: true}), 'data:,foo%20');
	assert.equal(normalizeUrl('data:text/html,foo #bar', {stripHash: true}), 'data:text/html,foo%20');
	assert.equal(normalizeUrl('data:,foo #bar'), 'data:,foo #bar');
	assert.equal(normalizeUrl('data:, foo #bar'), 'data:, foo #bar');

	// Both spellings of a percent escape in the hash normalize to the uppercase one
	assert.equal(normalizeUrl('data:,foo#a%2fb'), 'data:,foo#a%2Fb');
	assert.equal(normalizeUrl('data:,foo#a%2Fb'), 'data:,foo#a%2Fb');

	// Both spellings of a percent escape in the data normalize to the uppercase one
	assert.equal(normalizeUrl('data:,a%2fb'), 'data:,a%2Fb');
	assert.equal(normalizeUrl('data:,a%2Fb'), 'data:,a%2Fb');

	// An unreserved escape in the data is decoded, while the hash stays encoded
	assert.equal(normalizeUrl('data:,a%7Eb'), 'data:,a~b');
	assert.equal(normalizeUrl('data:,a~b'), 'data:,a~b');
	assert.equal(normalizeUrl('data:,a%41b'), 'data:,aAb');
	assert.equal(normalizeUrl('data:,a%2Fb'), 'data:,a%2Fb');
	assert.equal(normalizeUrl('data:,a%20b'), 'data:,a%20b');
	assert.equal(normalizeUrl('data:,a%zzb'), 'data:,a%zzb');
	assert.equal(normalizeUrl('data:;base64,QUJDRA'), 'data:;base64,QUJDRA');
	assert.equal(normalizeUrl('data:,x#a%7Eb'), 'data:,x#a%7Eb');
	assert.equal(normalizeUrl('data:,x#a%2Fb'), 'data:,x#a%2Fb');
	assert.equal(normalizeUrl('data:,a%7Eb#c%7Ed'), 'data:,a~b#c%7Ed');

	/*
	Percent-looking text in the media type stays as spelled, apart from lowercasing the MIME type, parameter names and charset, since a browser reads it literally.
	*/
	assert.equal(normalizeUrl('data:%74ext/plain,x'), 'data:%74ext/plain,x');
	assert.equal(normalizeUrl('data:;base6%34,QUJD'), 'data:;base6%34,QUJD');
	assert.equal(normalizeUrl('data:;%42ASE64,QUJD'), 'data:;%42ase64,QUJD');
	assert.equal(normalizeUrl('data:%2fext/plain,x'), 'data:%2fext/plain,x');
	assert.equal(normalizeUrl('data:%2Fext/plain,x'), 'data:%2fext/plain,x');
	assert.equal(normalizeUrl('data:text/html;charset=%55TF-8,x'), 'data:text/html;charset=%55tf-8,x');
	assert.equal(normalizeUrl('data:%zzext/plain,x'), 'data:%zzext/plain,x');

	/*
	The marker is a last parameter of the bare word `base64`, so `base64=a` is an ordinary parameter and the data decodes as written.
	*/
	assert.equal(normalizeUrl('data:text/plain;base64=a,Zm9v'), 'data:text/plain;base64=a,Zm9v');
	assert.equal(normalizeUrl('data:text/plain;base64=,foo'), 'data:text/plain;base64=,foo');
	assert.equal(normalizeUrl('data:;base64=,Zm9v'), 'data:;base64=,Zm9v');
	// A space before the `=` is part of the name, so this is a parameter called `base64 ` and not the marker, which is what a browser reads as well.
	assert.equal(normalizeUrl('data:;base64 =,QUJD'), 'data:;base64 =,QUJD');
	assert.equal(normalizeUrl('data:text/plain;charset=\'x\';base64=a b;,Zm9v'), 'data:text/plain;charset=\'x\';base64=a b,Zm9v');
	assert.equal(normalizeUrl('data:text/html;base64;charset=utf-8,foo'), 'data:text/html;base64;charset=utf-8,foo');
	assert.equal(normalizeUrl('data:;base64;QUJD'), 'data:;base64;qujd');
	assert.equal(normalizeUrl('data:;a=b;base64,QUJD'), 'data:;a=b;base64,QUJD');

	/*
	An empty part or name, from a trailing `;` or `=`, is dropped, unless that leaves the bare `base64` marker at the end.
	*/
	assert.equal(normalizeUrl('data:text/plain;a=1;,x'), 'data:text/plain;a=1,x');
	assert.equal(normalizeUrl('data:text/plain;;base64,Zm9v'), 'data:text/plain;base64,Zm9v');
	assert.equal(normalizeUrl('data:text/plain;=;base64,Zm9v'), 'data:text/plain;base64,Zm9v');
	/*
	The trailing `;` stays, since dropping the empty part would make the marker.
	*/
	assert.equal(normalizeUrl('data:text/plain;base64;,Zm9v'), 'data:text/plain;base64;,Zm9v');
	assert.equal(normalizeUrl('data:text/plain;base64 ;,Zm9v'), 'data:text/plain;base64;,Zm9v');
	assert.equal(normalizeUrl('data:;base64;,Zm9v'), 'data:;base64;,Zm9v');
	assert.equal(normalizeUrl('data:;base6%34;,Zm9v'), 'data:;base6%34,Zm9v');
	assert.equal(normalizeUrl('data:;base64;,Zm9v'), 'data:;base64;,Zm9v');
	assert.equal(normalizeUrl('data:text/plain;charset=us-ascii;base64,Zm9v'), 'data:text/plain;base64,Zm9v');
	assert.equal(normalizeUrl('data:;base64;charset=us-ascii,Zm9v'), 'data:;base64;charset=us-ascii,Zm9v');

	// A text fragment written with the delimiter escaped stays encoded in a data URL too
	assert.equal(normalizeUrl('data:,x#%3A~%3Atext=y'), 'data:,x#%3A~%3Atext=y');
	assert.equal(normalizeUrl('data:,x#%7E%3A%7E%3Atext=y'), 'data:,x#%7E%3A%7E%3Atext=y');

	// Empty MIME type with charset.
	assert.equal(normalizeUrl('data:;charset=utf-8,foo'), 'data:;charset=utf-8,foo');

	// Lowercase the MIME type.
	assert.equal(normalizeUrl('data:TEXT/HTML,foo'), 'data:text/html,foo');

	// Strip whitespace around the MIME type and its parameters.
	assert.equal(normalizeUrl('data: text/plain,x'), 'data:,x');
	assert.equal(normalizeUrl('data:text/plain ,x'), 'data:,x');
	assert.equal(normalizeUrl('data: text/html ,x'), 'data:text/html,x');
	// A space either side of the `=` is part of the name or the value, not separator whitespace.
	assert.equal(normalizeUrl('data:text/plain; foo = bar,x'), 'data:text/plain;foo = bar,x');
	assert.equal(normalizeUrl('data: text/html ; base64 , Zm9v '), 'data:text/html;base64,Zm9v');
	assert.equal(normalizeUrl('data: base64 ,x'), 'data:base64,x');

	// The `data:` scheme is case-insensitive, so an uppercase scheme is still a data URL.
	assert.equal(normalizeUrl('DATA:TEXT/HTML,foo'), 'data:text/html,foo');
	assert.equal(normalizeUrl('Data:,foo'), 'data:,foo');
	assert.equal(normalizeUrl('dAtA:;base64,Zm9v'), 'data:;base64,Zm9v');
	assert.equal(normalizeUrl('DATA:,foo#bar', {stripHash: true}), 'data:,foo');

	// Strip empty hash.
	assert.equal(normalizeUrl('data:,foo# '), 'data:,foo');

	/*
	Whitespace alone after a text fragment strip is escaped, since a bare `#` is not a fixed point and a browser keeps the space.
	*/
	assert.equal(normalizeUrl('data:,a# :~:text=x'), 'data:,a#%20');
	assert.equal(normalizeUrl('data:,a # :~:text=x'), 'data:,a #%20');
	assert.equal(normalizeUrl('data:,a#\u{A0}:~:text=x'), 'data:,a#%C2%A0');
	assert.equal(normalizeUrl('data:,a# :~:text=x', {stripTextFragment: false}), 'data:,a# :~:text=x');
	assert.equal(normalizeUrl('data:,a# '), 'data:,a');

	/*
	A regex `.` does not match a line separator, but the parser accepts one, so normalizing must not throw. Alone at the end it is stripped, like any whitespace at the ends.
	*/
	assert.equal(normalizeUrl('data:,x#\u{2028}'), 'data:,x');
	assert.equal(normalizeUrl('data:,x#a\u{2028}b'), 'data:,x#a\u{2028}b');
	assert.equal(normalizeUrl('data:,x#a\u{2029}b'), 'data:,x#a\u{2029}b');
	assert.equal(normalizeUrl('data:,x#a\u{2028}b', {stripHash: true}), 'data:,x');
	assert.equal(normalizeUrl('data:,a\u{2028}b'), 'data:,a\u{2028}b');

	/*
	Key only mediaType attribute. The separator stays, since the input wrote one.
	*/
	assert.equal(normalizeUrl('data:;foo=;bar,'), 'data:;foo=;bar,');

	// Only the first `=` separates a media type parameter name from its value.
	assert.equal(normalizeUrl('data:text/plain;foo=bar=baz,hello'), 'data:text/plain;foo=bar=baz,hello');
	assert.equal(normalizeUrl('data:text/plain;foo=a=b;charset=us-ascii,hello'), 'data:text/plain;foo=a=b,hello');
	assert.equal(normalizeUrl('data:;charset=utf-8=a,foo'), 'data:;charset=utf-8=a,foo');

	// Lowercase the charset.
	assert.equal(normalizeUrl('data:;charset=UTF-8,foo'), 'data:;charset=utf-8,foo');

	/*
	Parameter names are case-insensitive, so they are lowercased. `us-ascii` is the default charset only of `text/plain`.
	*/
	assert.equal(normalizeUrl('data:text/html;CHARSET=US-ASCII,foo'), 'data:text/html;charset=us-ascii,foo');
	assert.equal(normalizeUrl('data:text/plain;CHARSET=US-ASCII,foo'), 'data:,foo');
	assert.equal(normalizeUrl('data:;CHARSET=US-ASCII,foo'), 'data:,foo');
	assert.equal(normalizeUrl('data:image/png;charset=us-ascii,foo'), 'data:image/png;charset=us-ascii,foo');
	assert.equal(normalizeUrl('data:text/html;Charset=UTF-8,foo'), 'data:text/html;charset=utf-8,foo');
	assert.equal(normalizeUrl('data:text/html;Foo=Bar,foo'), 'data:text/html;foo=Bar,foo');

	// Several parameters, a quoted value, and a `base64` that is not the last parameter
	assert.equal(normalizeUrl('data:text/plain;a=1;b=2;c=3,x'), 'data:text/plain;a=1;b=2;c=3,x');
	assert.equal(normalizeUrl('data:text/plain;foo="a b",x'), 'data:text/plain;foo="a b",x');
	assert.equal(normalizeUrl('data:text/html;base64;charset=utf-8,foo'), 'data:text/html;base64;charset=utf-8,foo');

	// A `;` inside a quoted value is part of the value, not a separator
	assert.equal(normalizeUrl('data:;a="b;FOO",d'), 'data:;a="b;FOO",d');
	assert.equal(normalizeUrl('data:;a="b;FOO=Bar",d'), 'data:;a="b;FOO=Bar",d');
	assert.equal(normalizeUrl('data:;a="b;FOO ;C",d'), 'data:;a="b;FOO ;C",d');
	assert.equal(normalizeUrl(String.raw`data:;a="b\";c",d`), String.raw`data:;a="b\";c",d`);

	/*
	Like in a browser, a quoted string opens only with a double quote right after the `=`.
	*/
	assert.equal(normalizeUrl('data:text/html;title=It\'s;charset=us-ascii,foo'), 'data:text/html;title=It\'s;charset=us-ascii,foo');
	assert.equal(normalizeUrl('data:;a=b";charset=us-ascii,c'), 'data:;a=b",c');
	assert.equal(normalizeUrl('data:;a=b";c,d'), 'data:;a=b";c,d');
	assert.equal(normalizeUrl('data:;a=\'b;c\',d'), 'data:;a=\'b;c\',d');
	assert.equal(normalizeUrl('data:;a=;"x;y",d'), 'data:;a=;"x;y",d');

	// A default `charset` inside a quoted value is not dropped, only a real one is
	assert.equal(normalizeUrl('data:;a="b;charset=us-ascii;c",d'), 'data:;a="b;charset=us-ascii;c",d');
	assert.equal(normalizeUrl('data:text/html;title=A;charset=us-ascii,d'), 'data:text/html;title=A;charset=us-ascii,d');

	/*
	The media type ends at the first comma even inside quotes, but a `;` inside quotes does not separate.
	*/
	assert.equal(normalizeUrl('data:text/html;title="A,B";charset=us-ascii,d'), 'data:text/html;title="A,B";charset=us-ascii,d');
	assert.equal(normalizeUrl('data:text/html;title="A;B";charset=us-ascii,d'), 'data:text/html;title="A;B";charset=us-ascii,d');
	assert.equal(normalizeUrl('data:;a=\'x,y\''), 'data:;a=\'x,y\'');
	/*
	The separator is only written when there is data, so no comma is added on each pass. An existing one stays, since a parser fails on a data URL without it.
	*/
	assert.equal(normalizeUrl('data:text/html,'), 'data:text/html,');
	assert.equal(normalizeUrl('data:image/png,'), 'data:image/png,');
	assert.equal(normalizeUrl('data:;base64,'), 'data:;base64,');
	assert.equal(normalizeUrl('data:text/plain;charset=us-ascii,'), 'data:,');
	assert.equal(normalizeUrl('data:;foo=;bar,'), 'data:;foo=;bar,');
	assert.equal(normalizeUrl('data:text/html, ', {removeQueryParameters: false}), 'data:text/html,');
	assert.equal(normalizeUrl('data:text/html,#h'), 'data:text/html,#h');
	assert.equal(normalizeUrl('data:text/html'), 'data:text/html');
	assert.equal(normalizeUrl('data:;base64'), 'data:;base64');
	assert.equal(normalizeUrl('data:;foo=;bar'), 'data:;foo=;bar');
	assert.equal(normalizeUrl('data:,a,b'), 'data:,a,b');
	// The `;` inside the quoted value still does not separate, and the comma round-trips as data
	assert.equal(normalizeUrl('data:;a=\'x,y\','), 'data:;a=\'x,y\',');
	assert.equal(normalizeUrl('data:abc'), 'data:abc');
	assert.equal(normalizeUrl('data:text/plain;charset=us-ascii;foo="a;b",d'), 'data:text/plain;foo="a;b",d');
	assert.equal(normalizeUrl('data:text/plain;charset=UTF-8;x="a;b;c;d",e'), 'data:text/plain;charset=utf-8;x="a;b;c;d",e');

	// The default charset is dropped, but the other parameters and the empty MIME type stay
	assert.equal(normalizeUrl('data:;charset=us-ascii;foo=bar,foo'), 'data:;foo=bar,foo');
	assert.equal(normalizeUrl('data:text/plain;charset=us-ascii;charset=,x'), 'data:text/plain;charset=us-ascii;charset=,x');

	// A duplicate `charset` is not redundant, since the first one is the one that applies.
	assert.equal(normalizeUrl('data:text/html;charset=us-ascii;charset=utf-8,foo'), 'data:text/html;charset=us-ascii;charset=utf-8,foo');
	assert.equal(normalizeUrl('data:text/html;charset=utf-8;charset=us-ascii,foo'), 'data:text/html;charset=utf-8;charset=us-ascii,foo');
	assert.equal(normalizeUrl('data:text/html;CHARSET=US-ASCII;charset=utf-8,foo'), 'data:text/html;charset=us-ascii;charset=utf-8,foo');
	assert.equal(normalizeUrl('data:text/html;charset=utf-8;charset=iso-8859-1,foo'), 'data:text/html;charset=utf-8;charset=iso-8859-1,foo');

	// Remove spaces after the comma when it's base64.
	assert.equal(normalizeUrl('data:;base64, Zm9v #foo #bar'), 'data:;base64,Zm9v#foo #bar');

	// A lone `base64` is a MIME type, not the base64 marker, so it must not crash.
	assert.equal(normalizeUrl('data:base64,Zm9v'), 'data:base64,Zm9v');
	assert.equal(normalizeUrl('data:BASE64,Zm9v'), 'data:base64,Zm9v');
	assert.equal(normalizeUrl('data:base64'), 'data:base64');
	assert.equal(normalizeUrl('DATA:base64,Zm9v'), 'data:base64,Zm9v');
	assert.equal(normalizeUrl('data:base64,Zm9v#bar'), 'data:base64,Zm9v#bar');

	// The `base64` marker is matched case-insensitively, like browsers do.
	assert.equal(normalizeUrl('data:image/png;BASE64, iVBORw0KGgo= '), 'data:image/png;base64,iVBORw0KGgo=');
	assert.equal(normalizeUrl('data:;Base64,Zm9v'), 'data:;base64,Zm9v');
	assert.equal(normalizeUrl('data:;BASE64, Zm9v '), 'data:;base64,Zm9v');

	// A `base64` parameter with a value is not the marker, since a browser looks for the bare word
	assert.equal(normalizeUrl('data:text/plain;base64=, a b'), 'data:text/plain;base64=, a b');
	assert.equal(normalizeUrl('data:text/plain;base64=,foo'), 'data:text/plain;base64=,foo');
	assert.equal(normalizeUrl('data:text/plain;BASE64,foo'), 'data:text/plain;base64,foo');
	assert.equal(normalizeUrl('data:text/plain;foo=base64,foo'), 'data:text/plain;foo=base64,foo');
	assert.equal(normalizeUrl('data:text/html;base64;charset=utf-8,foo'), 'data:text/html;base64;charset=utf-8,foo');

	// Keep spaces when it's not base64.
	assert.equal(normalizeUrl('data:, foo #bar'), 'data:, foo #bar');

	// Options.
	const options = {
		defaultProtocol: 'http',
		normalizeProtocol: true,
		forceHttp: true,
		stripHash: true,
		stripWWW: true,
		stripProtocol: true,
		removeQueryParameters: [/^utm_\w+/iv, 'ref'],
		sortQueryParameters: true,
		removeTrailingSlash: true,
		removeDirectoryIndex: true,
	};
	assert.equal(normalizeUrl('data:,sindresorhus.com/', options), 'data:,sindresorhus.com/');
	assert.equal(normalizeUrl('data:,sindresorhus.com/index.html', options), 'data:,sindresorhus.com/index.html');
	assert.equal(normalizeUrl('data:,sindresorhus.com?foo=bar&a=a&utm_medium=test', options), 'data:,sindresorhus.com?foo=bar&a=a&utm_medium=test');
	assert.equal(normalizeUrl('data:,foo#bar', options), 'data:,foo');
	assert.equal(normalizeUrl('data:,www.sindresorhus.com', options), 'data:,www.sindresorhus.com');
});

test('prevents homograph attack', () => {
	// The input string uses Unicode to make it look like a valid `ebay.com` URL.
	assert.equal(normalizeUrl('https://ebаy.com'), 'https://xn--eby-7cd.com');
});

test('does not have quadratic performance for the query parameter filters', () => {
	/*
	Filtering a key at a time serialised the query again per call: 8000 parameters took over half a minute. The inputs are big enough for one wall clock timing.
	*/
	const url = `http://example.com/?${Array.from({length: 8000}, (value, index) => `k${String(index).padStart(6, '0')}=1`).join('&')}`;

	for (const [label, options] of [
		['removeQueryParameters matching every key', {removeQueryParameters: [/.*/v]}],
		['removeQueryParameters matching one key', {removeQueryParameters: [/^k0{5}1$/v]}],
		['removeQueryParameters matching nothing', {removeQueryParameters: [/^zzz/v]}],
		['keepQueryParameters keeping nothing', {keepQueryParameters: [/^zzz/v]}],
		['keepQueryParameters keeping everything', {keepQueryParameters: [/./v]}],
	]) {
		const difference = timeBestOfThree(() => {
			normalizeUrl(url, options);
		});
		assert.ok(difference < 1000, `${label} (${url.length} bytes) took ${difference}ms`);
	}
});

test('does not have quadratic performance for runs of whitespace or escapes', () => {
	/*
	A regex with a `+` over the set is quadratic on a run of these, and a 50 KB run of spaces is a small untrusted payload. The budget is well above a garbage collection pause and far below a quadratic cost.
	*/
	const runs = [
		length => `http://example.com/a b${' '.repeat(length)}c`,
		length => `http://example.com/a${'\u{1}'.repeat(length)}c`,
		length => `http://example.com/a#${' '.repeat(length)}b`,
		length => `http://example.com/?a=${' '.repeat(length)}b`,
		length => `data:text/plain,${' '.repeat(length)}b`,
		length => `data:text/plain;base64,${' '.repeat(length)}b`,
		length => `data:,${' '.repeat(length)}b#${' '.repeat(length)}c`,
		length => `http://example.com/a/${'%20'.repeat(length)}b`,
		length => `http://example.com/a/${'x'.repeat(length)}/../b`,
		length => `${'\u{A0}'.repeat(length)}http://example.com/a${'\u{A0}'.repeat(length)}`,
		length => `http://example.com/a${'\u{A0}'.repeat(length)}b`,
	];

	for (const build of runs) {
		const url = build(50_000);
		const difference = timeBestOfThree(() => {
			normalizeUrl(url);
		});
		assert.ok(difference < 1000, `${url.slice(0, 40)} (${url.length} bytes) took ${difference}ms`);
	}
});

test('does not have exponential performance for data URLs', () => {
	/*
	A throw is a failure here, or a regression that makes everything throw would pass as the fastest case.
	*/
	for (let index = 0; index < 1000; index += 50) {
		const url = `data:${',#'.repeat(index)}\ra`;
		const difference = timeBestOfThree(() => {
			normalizeUrl(url);
		});
		assert.ok(difference < 100, `${url.length} bytes: ${difference}ms`);
	}
});

test('ignore custom schemes', () => {
	assert.equal(normalizeUrl('tel:004346382763'), 'tel:004346382763');
	assert.equal(normalizeUrl('tel:12345'), 'tel:12345');
	assert.equal(normalizeUrl('tel:12345', {removeExplicitPort: true}), 'tel:12345');
	assert.equal(normalizeUrl('sms:911'), 'sms:911');
	assert.equal(normalizeUrl('sms:911', {removeExplicitPort: true}), 'sms:911');
	assert.equal(normalizeUrl('mailto:office@foo.com'), 'mailto:office@foo.com');
	assert.equal(normalizeUrl('sindre://www.sindresorhus.com'), 'sindre://www.sindresorhus.com');
	assert.equal(normalizeUrl('foo.bar://www.example.com'), 'foo.bar://www.example.com');
	assert.equal(normalizeUrl('foo:bar'), 'foo:bar');

	// Opt-in via customProtocols
	assert.equal(normalizeUrl('sindre://www.sindresorhus.com', {customProtocols: ['sindre']}), 'sindre://sindresorhus.com');
});

test('customProtocols option', () => {
	const options = {customProtocols: ['sindre']};

	// Basic normalization
	assert.equal(normalizeUrl('sindre://www.sorhus.com', options), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com/', options), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com/foo/bar', options), 'sindre://sorhus.com/foo/bar');

	// Auth stripping
	assert.equal(normalizeUrl('sindre://user:password@www.sorhus.com', options), 'sindre://sorhus.com');

	// Trailing slash removal
	assert.equal(normalizeUrl('sindre://sorhus.com/foo/', options), 'sindre://sorhus.com/foo');

	// Query sorting
	assert.equal(normalizeUrl('sindre://sorhus.com?b=two&a=one', options), 'sindre://sorhus.com?a=one&b=two');

	// Hash handling
	assert.equal(normalizeUrl('sindre://sorhus.com/foo#bar', options), 'sindre://sorhus.com/foo#bar');
	assert.equal(normalizeUrl('sindre://sorhus.com/foo#bar', {...options, stripHash: true}), 'sindre://sorhus.com/foo');

	// Default UTM stripping applies
	assert.equal(normalizeUrl('sindre://sorhus.com?foo=bar&utm_source=test', options), 'sindre://sorhus.com?foo=bar');

	// Duplicate slashes in pathname
	assert.equal(normalizeUrl('sindre://sorhus.com//foo//bar', options), 'sindre://sorhus.com/foo/bar');

	// URI decoding of pathname
	assert.equal(normalizeUrl('sindre://sorhus.com/%7Efoo/', options), 'sindre://sorhus.com/~foo');

	// Empty customProtocols array behaves like not providing the option
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: []}), 'sindre://www.sorhus.com');

	// Unmatched protocols still pass through
	assert.equal(normalizeUrl('other://www.sorhus.com', options), 'other://www.sorhus.com');
	assert.equal(normalizeUrl('tel:004346382763', options), 'tel:004346382763');

	// Multiple custom protocols
	const multiOptions = {customProtocols: ['sindre', 'app']};
	assert.equal(normalizeUrl('sindre://www.sorhus.com', multiOptions), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('app://www.sorhus.com', multiOptions), 'app://sorhus.com');
	assert.equal(normalizeUrl('other://www.sorhus.com', multiOptions), 'other://www.sorhus.com');

	// Dotted protocol names
	assert.equal(normalizeUrl('foo.bar://www.example.com', {customProtocols: ['foo.bar']}), 'foo.bar://example.com');
	assert.equal(normalizeUrl('FOO.BAR://www.example.com', {customProtocols: ['foo.bar']}), 'foo.bar://example.com');

	// ForceHttp/forceHttps don't affect custom protocols
	assert.equal(normalizeUrl('sindre://sorhus.com', {...options, forceHttp: true}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://sorhus.com', {...options, forceHttps: true}), 'sindre://sorhus.com');

	// StripProtocol doesn't affect custom protocols
	assert.equal(normalizeUrl('sindre://sorhus.com', {...options, stripProtocol: true}), 'sindre://sorhus.com');

	// Port handling
	assert.equal(normalizeUrl('sindre://sorhus.com:8080', options), 'sindre://sorhus.com:8080');
	assert.equal(normalizeUrl('sindre://sorhus.com:8080/foo', {...options, removeExplicitPort: true}), 'sindre://sorhus.com/foo');

	// Case-insensitive protocol matching
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['SINDRE']}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['Sindre']}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre:']}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: [' sindre ']}), 'sindre://sorhus.com');

	// Invalid entries are ignored
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre', 123]}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre', '']}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre', ' '.repeat(3)]}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre', ':']}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre', null]}), 'sindre://sorhus.com');
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre', undefined]}), 'sindre://sorhus.com');

	// Invalid option type is ignored
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {customProtocols: 'sindre'}), 'sindre://www.sorhus.com');

	// Path traversal
	assert.equal(normalizeUrl('sindre://sorhus.com/foo/../bar', options), 'sindre://sorhus.com/bar');
	assert.equal(normalizeUrl('sindre://sorhus.com/foo/./bar', options), 'sindre://sorhus.com/foo/bar');

	// Auth stripping with stripAuthentication: false
	assert.equal(normalizeUrl('sindre://user:password@www.sorhus.com', {...options, stripAuthentication: false}), 'sindre://user:password@sorhus.com');

	// StripWWW: false
	assert.equal(normalizeUrl('sindre://www.sorhus.com', {...options, stripWWW: false}), 'sindre://www.sorhus.com');

	// RemoveTrailingSlash: false
	assert.equal(normalizeUrl('sindre://sorhus.com/foo/', {...options, removeTrailingSlash: false}), 'sindre://sorhus.com/foo/');

	// RemoveQueryParameters: true removes all query params
	assert.equal(normalizeUrl('sindre://sorhus.com?foo=bar', {...options, removeQueryParameters: true}), 'sindre://sorhus.com');

	// KeepQueryParameters
	assert.equal(normalizeUrl('sindre://sorhus.com?foo=bar&baz=qux', {...options, keepQueryParameters: ['foo']}), 'sindre://sorhus.com?foo=bar');

	// A root path keeps its slash, as `sindre://` is not a valid URL
	assert.equal(normalizeUrl('sindre://', options), 'sindre://');
	assert.equal(normalizeUrl('sindre:/', options), 'sindre:/');
	assert.equal(normalizeUrl('sindre://h/', options), 'sindre://h');

	/*
	An opaque path cannot be set through the pathname, so the trailing and duplicate slash removal happens on the string.
	*/
	assert.equal(normalizeUrl('sindre:x/a/', options), 'sindre:x/a');
	assert.equal(normalizeUrl('sindre:x/', options), 'sindre:x');
	assert.equal(normalizeUrl('sindre:x/a/', {...options, removeTrailingSlash: false}), 'sindre:x/a/');
	assert.equal(normalizeUrl('sindre:x/a/', {...options, removeSingleSlash: false}), 'sindre:x/a');
	assert.equal(normalizeUrl('sindre:x/a//', options), 'sindre:x/a');
	assert.equal(normalizeUrl('sindre:x/a///', options), 'sindre:x/a');
	assert.equal(normalizeUrl('sindre:x/a//b//', options), 'sindre:x/a/b');
	// A duplicate slash is not a trailing slash, so it goes even when the option is off
	assert.equal(normalizeUrl('sindre:x//a', options), 'sindre:x/a');
	assert.equal(normalizeUrl('sindre:x//a', {...options, removeTrailingSlash: false}), 'sindre:x/a');
	assert.equal(normalizeUrl('sindre:x/a//b', {...options, removeTrailingSlash: false}), 'sindre:x/a/b');
	// A fragment does not stop either of them, the same as for a path with an authority
	assert.equal(normalizeUrl('sindre:x/a/#h', options), 'sindre:x/a#h');
	assert.equal(normalizeUrl('sindre:x/a/#h', {...options, removeTrailingSlash: false}), 'sindre:x/a/#h');
	assert.equal(normalizeUrl('sindre:x//a#h', options), 'sindre:x/a#h');
	assert.equal(normalizeUrl('sindre:x/a//#h', options), 'sindre:x/a#h');
	assert.equal(normalizeUrl('sindre:x/a/?q=1#h', options), 'sindre:x/a?q=1#h');
	/*
	A parser strips trailing ASCII whitespace, so whitespace left at the end of the path is escaped. Otherwise the URL changes, since `x:8080` is a host and a port, not a scheme.
	*/
	assert.equal(normalizeUrl('sindresorhus.com:8080 /', {customProtocols: ['sindresorhus.com']}), 'sindresorhus.com:8080%20');
	// Only a run at the end is at risk, since a parser keeps whitespace in the middle of a path as it is.
	assert.equal(normalizeUrl('sindresorhus.com:8080 /a ', {customProtocols: ['sindresorhus.com']}), 'sindresorhus.com:8080 /a');
	assert.equal(normalizeUrl('sindresorhus.com:8080 /a', {customProtocols: ['sindresorhus.com']}), 'sindresorhus.com:8080 /a');
	assert.equal(normalizeUrl('sindre:x/a /', options), 'sindre:x/a%20');
	assert.equal(normalizeUrl('sindre:x/a/?q=1', options), 'sindre:x/a?q=1');
	// The search keeps a `/` of its own either way, so the path slash still goes
	assert.equal(normalizeUrl('sindre:x/a/?q=/', options), 'sindre:x/a?q=/');
	assert.equal(normalizeUrl('sindre://h/x/a/?q=/', options), 'sindre://h/x/a?q=/');
	assert.equal(normalizeUrl('sindre:x?q=//y', options), 'sindre:x?q=//y');

	// A trailing slash that is one of a protocol lookalike's two is kept, as it is for a normal path
	assert.equal(normalizeUrl('sindre:ab://', options), 'sindre:ab://');
	assert.equal(normalizeUrl('sindre:a://', options), 'sindre:a://');
	assert.equal(normalizeUrl('sindre:a:///', options), 'sindre:a://');
	assert.equal(normalizeUrl('sindre:ab://?q=1', options), 'sindre:ab://?q=1');
	assert.equal(normalizeUrl('sindre:ab://#h', options), 'sindre:ab://#h');
	assert.equal(normalizeUrl('sindre:ab://x//y', options), 'sindre:ab://x/y');

	// A path that a parser would encode comes out encoded, whichever way the path is spelled
	assert.equal(normalizeUrl('sindre: /?q=1', options), 'sindre:%20?q=1');
	assert.equal(normalizeUrl('sindre: //?q=1', options), 'sindre:%20?q=1');
	assert.equal(normalizeUrl('sindre:a/ /?q=1', options), 'sindre:a/%20?q=1');
	// A path that is only whitespace is not the empty path, and a parser would strip it if it were left to, so it comes out as the escape that keeps it.
	assert.equal(normalizeUrl('sindre: /', options), 'sindre:%20');
	assert.equal(normalizeUrl('sindre:%20', options), 'sindre:%20');
	assert.equal(normalizeUrl('sindre://h/ /?q=1', options), 'sindre://h/%20?q=1');

	// A `//` that only looks like a protocol is collapsed, the same as for a normal path
	assert.equal(normalizeUrl('sindre:a%3Abab://%25', options), 'sindre:a%3Abab:/%25');
	assert.equal(normalizeUrl('sindre:x://y', options), 'sindre:x://y');
	assert.equal(normalizeUrl('sindre:1a://a//b', options), 'sindre:1a:/a/b');

	// A protocol opted into is used even when it has a dot in it, which otherwise reads as a host
	assert.equal(normalizeUrl('com.example.app:run', {customProtocols: ['com.example.app']}), 'com.example.app:run');
	assert.equal(normalizeUrl('com.example.app:run'), 'com.example.app:run');
	assert.equal(normalizeUrl('x.com:abc', {customProtocols: ['x.com']}), 'x.com:abc');
	assert.equal(normalizeUrl('localhost:9802', {customProtocols: ['localhost']}), 'localhost:9802');

	// Built-in protocols still work normally
	assert.equal(normalizeUrl('http://www.sorhus.com', options), 'http://sorhus.com');
	assert.equal(normalizeUrl('https://www.sorhus.com', options), 'https://sorhus.com');
});

test('encoded backslashes do not get decoded', () => {
	assert.equal(normalizeUrl('https://foo.com/some%5Bthing%5Celse/that-is%40great@coding'), 'https://foo.com/some[thing%5Celse/that-is%40great@coding');
	assert.equal(normalizeUrl('https://foo.com/something%5Celse/great'), 'https://foo.com/something%5Celse/great');

	// Non-encoded backslashes should remain as-is.
	assert.equal(normalizeUrl(String.raw`https://foo.com/something\else/great`), 'https://foo.com/something/else/great');

	// A segment with a malformed escape does not affect a backslash in a neighbouring one.
	assert.equal(normalizeUrl('https://foo.com/a%5Cb/%zz'), 'https://foo.com/a%5Cb/%zz');
	assert.equal(normalizeUrl('https://foo.com/%zz/a%5Cb'), 'https://foo.com/%zz/a%5Cb');
	assert.equal(normalizeUrl('https://foo.com/a%5cb'), 'https://foo.com/a%5Cb');
});

test('removePath option', () => {
	// Boolean: Remove entire path
	assert.equal(normalizeUrl('https://example.com/path/to/page', {removePath: true}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com/path/to/page?query=1', {removePath: true}), 'https://example.com/?query=1');
	assert.equal(normalizeUrl('https://example.com/path/to/page#hash', {removePath: true}), 'https://example.com/#hash');
	assert.equal(normalizeUrl('https://example.com/', {removePath: true}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com', {removePath: true}), 'https://example.com');

	// With other options
	assert.equal(normalizeUrl('https://example.com/path/', {removePath: true, removeTrailingSlash: true}), 'https://example.com');
	assert.equal(normalizeUrl('https://www.example.com/path', {removePath: true, stripWWW: true}), 'https://example.com');
});

test('transformPath option and a trailing slash', () => {
	/*
	The transform rebuilds the path, so it must put back a trailing slash the input wrote when `removeTrailingSlash` is off.
	*/
	const options = {removeTrailingSlash: false, transformPath: pathComponents => pathComponents};
	assert.equal(normalizeUrl('http://sindresorhus.com/a/', options), 'http://sindresorhus.com/a/');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/b/', options), 'http://sindresorhus.com/a/b/');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/b/', {...options, transformPath: pathComponents => pathComponents.slice(0, 1)}), 'http://sindresorhus.com/a/');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/index.html', {...options, removeDirectoryIndex: true}), 'http://sindresorhus.com/a/');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/b/index.html', {...options, removeDirectoryIndex: true, transformPath: pathComponents => pathComponents.filter(component => component !== 'b')}), 'http://sindresorhus.com/a/');

	// With the option on, the transform is not a way to keep a trailing slash either.
	const keepSlash = {transformPath: pathComponents => pathComponents};
	assert.equal(normalizeUrl('http://sindresorhus.com/a/', keepSlash), 'http://sindresorhus.com/a');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/index.html', {...keepSlash, removeDirectoryIndex: true}), 'http://sindresorhus.com/a');
	assert.equal(normalizeUrl('http://sindresorhus.com/a/', {...keepSlash, transformPath: () => []}), 'http://sindresorhus.com');
});

test('transformPath is not called for a path it cannot rewrite', () => {
	/*
	Path options only apply to a path that starts with `/`, as an opaque one cannot be changed. `transformPath` runs caller code, so being ignored must be visible.
	*/
	let calls = 0;
	const spy = pathComponents => {
		calls++;
		return pathComponents;
	};

	for (const url of ['sindre:a/b', 'sindre:', 'sindre:#h', 'sindre://h', 'sindre://h#x']) {
		calls = 0;
		normalizeUrl(url, {customProtocols: ['sindre'], transformPath: spy});
		assert.equal(calls, 0, url);
	}

	for (const url of ['sindre:/a/b', 'sindre://h/a/b']) {
		calls = 0;
		normalizeUrl(url, {customProtocols: ['sindre'], transformPath: spy});
		assert.equal(calls, 1, url);
	}

	// A transform that throws is not reached for a path the library cannot rewrite.
	const explode = () => {
		throw new Error('should not be called');
	};

	assert.equal(normalizeUrl('sindre:a/b', {customProtocols: ['sindre'], transformPath: explode}), 'sindre:a/b');
	assert.equal(normalizeUrl('sindre:a/b', {customProtocols: ['sindre']}), 'sindre:a/b');
	assert.equal(normalizeUrl('sindre://h#x', {customProtocols: ['sindre'], transformPath: spy}), 'sindre://h#x');
	assert.equal(normalizeUrl('sindre://h?a=1', {customProtocols: ['sindre'], transformPath: spy}), 'sindre://h?a=1');
});

test('transformPath is given the percent-decoded path components', () => {
	/*
	The function gets decoded components, and what it returns is not decoded again.
	*/
	const seen = [];
	const output = normalizeUrl('http://example.com/a%7Eb/%41c/d%2Fe/%C3%A9', {
		transformPath(pathComponents) {
			seen.push([...pathComponents]);
			return pathComponents;
		},
	});
	assert.deepEqual(seen[0], ['a~b', 'Ac', 'd%2Fe', '%C3%A9']);
	assert.equal(output, 'http://example.com/a~b/Ac/d%2Fe/%C3%A9');

	// A reserved escape and a non-ASCII escape are left encoded, which is what the unreserved set says.
	const second = [];
	normalizeUrl('http://example.com/%2F/%3A/%2B/%7E', {
		transformPath(pathComponents) {
			second.push([...pathComponents]);
			return pathComponents;
		},
	});
	assert.deepEqual(second[0], ['%2F', '%3A', '%2B', '~']);
});

test('transformPath option', () => {
	// Function: Keep only first path component
	const keepFirst = pathComponents => pathComponents.slice(0, 1);
	assert.equal(normalizeUrl('https://example.com/api/v1/users', {transformPath: keepFirst}), 'https://example.com/api');
	assert.equal(normalizeUrl('https://example.com/path/to/page', {transformPath: keepFirst}), 'https://example.com/path');
	assert.equal(normalizeUrl('https://example.com/', {transformPath: keepFirst}), 'https://example.com');

	// Function: Remove specific component
	const removeAdmin = pathComponents => pathComponents.filter(c => c !== 'admin');
	assert.equal(normalizeUrl('https://example.com/admin/users', {transformPath: removeAdmin}), 'https://example.com/users');
	assert.equal(normalizeUrl('https://example.com/path/admin/page', {transformPath: removeAdmin}), 'https://example.com/path/page');

	// Function: Custom logic
	// Keep /api only, and remove everything else
	const customLogic = pathComponents => pathComponents[0] === 'api' ? pathComponents.slice(0, 1) : [];

	assert.equal(normalizeUrl('https://example.com/api/v1/users', {transformPath: customLogic}), 'https://example.com/api');
	assert.equal(normalizeUrl('https://example.com/other/path', {transformPath: customLogic}), 'https://example.com');

	// Edge cases
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => []}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => null}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => undefined}), 'https://example.com');

	// The result gets the same duplicate-slash removal as the rest of the pathname
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => ['a', 'b//c']}), 'https://example.com/a/b/c');
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => ['a', 's3://b//c']}), 'https://example.com/a/s3://b/c');
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => ['//a']}), 'https://example.com/a');

	// A path with a malformed escape is decoded the same way on every pass
	const firstComponent = {transformPath: pathComponents => pathComponents.slice(0, 1)};
	assert.equal(normalizeUrl('https://example.com/%7Euser/%', firstComponent), 'https://example.com/~user');
	assert.equal(normalizeUrl('https://example.com/%7Euser/%zz/x', firstComponent), 'https://example.com/~user');

	// A directory index left as the last component by a transform is removed here, not on the next pass
	const firstComponentAndIndex = {removeDirectoryIndex: true, transformPath: firstComponent.transformPath};
	assert.equal(normalizeUrl('https://example.com/index.html/api', firstComponentAndIndex), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com/a/index.html/b', firstComponentAndIndex), 'https://example.com/a');
	assert.equal(normalizeUrl('https://example.com/a/index.html', firstComponentAndIndex), 'https://example.com/a');

	// An empty component in the result is dropped, the same way one in the input is
	const splitOnDots = {transformPath: pathComponents => pathComponents.flatMap(component => component.split('.')), removeTrailingSlash: false};
	assert.equal(normalizeUrl('https://example.com/a.com.', splitOnDots), 'https://example.com/a/com');
	assert.equal(normalizeUrl('https://example.com/a..b', splitOnDots), 'https://example.com/a/b');
	assert.equal(normalizeUrl('file:/a.com.', splitOnDots), 'file:///a/com');
	assert.equal(normalizeUrl('https://example.com/a/b', {transformPath: () => ['']}), 'https://example.com');

	// Combining with removePath (removePath should take precedence)
	assert.equal(normalizeUrl('https://example.com/path/to/page', {
		removePath: true,
		transformPath: pathComponents => pathComponents.slice(0, 2),
	}), 'https://example.com');

	// A transform cannot bring back the path that removePath removed
	assert.equal(normalizeUrl('https://example.com/path', {removePath: true, transformPath: () => ['x']}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com/path', {removePath: true, transformPath: pathComponents => [...pathComponents, 'x']}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com/path', {transformPath: () => ['x']}), 'https://example.com/x');
});

test('path-like query strings without equals signs are preserved', () => {
	// Issue #193 - Path-like query strings should not get '=' appended
	assert.equal(normalizeUrl('https://example.com/index.php?/Some/Route/To/Path/12345'), 'https://example.com/index.php?/Some/Route/To/Path/12345');
	assert.equal(normalizeUrl('https://example.com/script.php?/api/v1/users/123'), 'https://example.com/script.php?/api/v1/users/123');
	assert.equal(normalizeUrl('https://example.com/app.php?/admin/dashboard'), 'https://example.com/app.php?/admin/dashboard');
	// A trailing slash that belongs to the query is not affected by the `removeTrailingSlash` option
	assert.equal(normalizeUrl('https://example.com/index.php?/path/'), 'https://example.com/index.php?/path/');
	assert.equal(normalizeUrl('https://example.com/index.php?/path/', {removeTrailingSlash: false}), 'https://example.com/index.php?/path/');
	// A trailing slash in the path is removed by the `removeTrailingSlash` option
	assert.equal(normalizeUrl('https://example.com/index.php/path/'), 'https://example.com/index.php/path');
	assert.equal(normalizeUrl('https://example.com/index.php/path/', {removeTrailingSlash: false}), 'https://example.com/index.php/path/');

	// Mixed parameters: path-like without '=' and regular with '='
	assert.equal(normalizeUrl('https://example.com/index.php?b=2&/path/to/resource&a=1'), 'https://example.com/index.php?/path/to/resource&a=1&b=2');
	assert.equal(normalizeUrl('https://example.com/index.php?/path&param=value'), 'https://example.com/index.php?/path&param=value');

	// Regular parameters with empty values should keep '='
	assert.equal(normalizeUrl('https://example.com/index.php?key='), 'https://example.com/index.php?key=');
	assert.equal(normalizeUrl('https://example.com/index.php?key=&another='), 'https://example.com/index.php?another=&key=');

	// Parameters without values should not get '=' added
	assert.equal(normalizeUrl('https://example.com/index.php?key'), 'https://example.com/index.php?key');
	assert.equal(normalizeUrl('https://example.com/index.php?a&b&c'), 'https://example.com/index.php?a&b&c');

	// With sortQueryParameters disabled, original format is preserved
	assert.equal(normalizeUrl('https://example.com/index.php?/Some/Route/To/Path/12345', {sortQueryParameters: false}), 'https://example.com/index.php?/Some/Route/To/Path/12345');
	assert.equal(normalizeUrl('https://example.com/index.php?key', {sortQueryParameters: false}), 'https://example.com/index.php?key');

	// Safety: parameters with similar names should not interfere with each other
	assert.equal(normalizeUrl('https://example.com/index.php?/path&/longpath'), 'https://example.com/index.php?/longpath&/path');
	assert.equal(normalizeUrl('https://example.com/index.php?key&anotherkey'), 'https://example.com/index.php?anotherkey&key');
	assert.equal(normalizeUrl('https://example.com/index.php?/api&/api/v1/users'), 'https://example.com/index.php?/api&/api/v1/users');
});

test('a host and a port are told from a scheme by what follows the port', () => {
	/*
	`localhost:9802` is a host and a port when a slash, `?`, `#` or nothing follows the digits, and a scheme otherwise.
	*/
	assert.equal(normalizeUrl('localhost:9802'), 'http://localhost:9802');
	assert.equal(normalizeUrl('localhost:9802/'), 'http://localhost:9802');
	assert.equal(normalizeUrl('localhost:9802/a'), 'http://localhost:9802/a');
	assert.equal(normalizeUrl('localhost:9802?a=1'), 'http://localhost:9802/?a=1');
	assert.equal(normalizeUrl('localhost:9802#h'), 'http://localhost:9802/#h');
	assert.equal(normalizeUrl('localhost:9802#'), 'http://localhost:9802');
	assert.equal(normalizeUrl('localhost://9802/a'), 'localhost://9802/a');
	assert.equal(normalizeUrl('localhost:9802a'), 'localhost:9802a');

	// And the same port shapes for a host that is not `localhost`, which is a host either way.
	assert.equal(normalizeUrl('example.com:9802#h'), 'http://example.com:9802/#h');
	assert.equal(normalizeUrl('example.com:9802/a'), 'http://example.com:9802/a');
});

test('a run of whitespace at the end is stripped whole', () => {
	// The run is walked, so two or more characters go and not only the last one.
	assert.equal(normalizeUrl('data:;base64,QUJD  '), 'data:;base64,QUJD');
	assert.equal(normalizeUrl('data:;base64,QUJD   '), 'data:;base64,QUJD');
	assert.equal(normalizeUrl('data:;base64,QUJD\t '), 'data:;base64,QUJD');
	assert.equal(normalizeUrl('data:;base64,  QUJD'), 'data:;base64,QUJD');
	assert.equal(normalizeUrl('data:,a  '), 'data:,a');
	assert.equal(normalizeUrl('data:text/plain,a   '), 'data:,a');
	assert.equal(normalizeUrl('data:,a#b  '), 'data:,a#b');
	assert.equal(normalizeUrl('  data:,a'), 'data:,a');
	assert.equal(normalizeUrl('  data:;base64,QUJD  '), 'data:;base64,QUJD');

	// And the escaped form of a trailing run is a fixed point, since the run is then characters of the data rather than whitespace in it.
	assert.equal(normalizeUrl('data:;base64,QUJD%20%20'), 'data:;base64,QUJD%20%20');
	assert.equal(normalizeUrl('data:,a%20%20'), 'data:,a%20%20');
});

test('a filter is matched against the percent-decoded name', () => {
	/*
	A filter sees keys and path components as `URLSearchParams` reads them, so `+` is a space and `%2F` is a slash.
	*/
	assert.equal(normalizeUrl('http://example.com/?a%2Fb=1&c=2', {removeQueryParameters: ['a/b']}), 'http://example.com/?c=2');
	assert.equal(normalizeUrl('http://example.com/?a%2Fb=1&c=2', {removeQueryParameters: ['a%2Fb']}), 'http://example.com/?a%2Fb=1&c=2');
	assert.equal(normalizeUrl('http://example.com/?a%7Eb=1&c=2', {removeQueryParameters: ['a~b']}), 'http://example.com/?c=2');
	assert.equal(normalizeUrl('http://example.com/?a+b=1&c=2', {removeQueryParameters: ['a b']}), 'http://example.com/?c=2');
	assert.equal(normalizeUrl('http://example.com/?a%2Fb=1&c=2', {keepQueryParameters: ['c']}), 'http://example.com/?c=2');

	// A directory index filter sees the decoded component, the same as a transform is given.
	assert.equal(normalizeUrl('http://example.com/a/index%2Ehtml', {removeDirectoryIndex: ['index.html']}), 'http://example.com/a');
	assert.equal(normalizeUrl('http://example.com/a/index%2Ehtml', {removeDirectoryIndex: ['index%2Ehtml']}), 'http://example.com/a/index.html');

	// And a protocol name is matched without regard to case, with a trailing colon however many there are.
	for (const entry of ['sindre', 'sindre:', 'sindre::', 'SINDRE', 'Sindre:']) {
		assert.equal(normalizeUrl('sindre://www.example.com/a/', {customProtocols: [entry]}), 'sindre://example.com/a', entry);
	}
});

test('the query parameter filters keep the order and the spelling of what they keep', () => {
	/*
	The filters write the kept parameters back in one go, so everything they do not match must come out unchanged.
	*/
	const url = 'http://example.com/?z=1&a=%2F&b=a+b&c=&a=2&utm_source=x&d=%3A&a%2Db=e&e';
	const sorted = 'http://example.com/?a=%2F&a=2&a-b=e&b=a+b&c=&d=%3A&e&utm_source=x&z=1';
	assert.equal(normalizeUrl(url, {removeQueryParameters: [/^nope$/v]}), sorted);
	assert.equal(normalizeUrl(url, {keepQueryParameters: [/./v]}), sorted);

	// A repeated key is dropped whole, as deleting it once would, and the rest keep their order.
	assert.equal(normalizeUrl('http://example.com/?a=1&b=2&a=3&c=4&a=5', {removeQueryParameters: ['a']}), 'http://example.com/?b=2&c=4');
	assert.equal(normalizeUrl('http://example.com/?a=1&b=2&a=3&c=4&a=5', {keepQueryParameters: ['a']}), 'http://example.com/?a=1&a=3&a=5');

	// An encoded reserved character is matched on the character it escapes, and kept encoded.
	assert.equal(normalizeUrl('http://example.com/?a%2Fb=1&c=2', {removeQueryParameters: ['a/b']}), 'http://example.com/?c=2');
	assert.equal(normalizeUrl('http://example.com/?a%2Fb=1&c=2', {removeQueryParameters: ['a%2Fb']}), 'http://example.com/?a%2Fb=1&c=2');

	// Dropping the first parameter and the last one both leave a well formed search.
	assert.equal(normalizeUrl('http://example.com/?a=1&b=2&c=3', {removeQueryParameters: ['a']}), 'http://example.com/?b=2&c=3');
	assert.equal(normalizeUrl('http://example.com/?a=1&b=2&c=3', {removeQueryParameters: ['c']}), 'http://example.com/?a=1&b=2');
	assert.equal(normalizeUrl('http://example.com/?a=1&b=2&c=3', {removeQueryParameters: [/./v]}), 'http://example.com');
	assert.equal(normalizeUrl('http://example.com/?a=1&b=2&c=3', {keepQueryParameters: [/nope/v]}), 'http://example.com');
});

test('sortQueryParameters should preserve encoded reserved characters in query values', () => {
	// Issue #189 - `%2F` in query values must remain encoded
	assert.equal(
		normalizeUrl('https://example.com/?X-Amz-Credential=AKIA%2F20200101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host'),
		'https://example.com/?X-Amz-Credential=AKIA%2F20200101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host',
	);
	assert.equal(normalizeUrl('https://example.com/?token=a%2Fb%2Fc'), 'https://example.com/?token=a%2Fb%2Fc');
	assert.equal(normalizeUrl('https://example.com/?token=a%2fb%2fc'), 'https://example.com/?token=a%2Fb%2Fc');

	/*
	The token for an encoded reserved character must not collide with token-shaped text in the search, whichever way the option is set. `doubled` shares a `__` between two matches, which once hid that the next index was taken.
	*/
	// The inputs spell the library's internal token.
	const doubled = '__normalize_url_encoded_reserved__0__normalize_url_encoded_reserved__1__';
	for (const taken of ['', '0', '1', '9', '10', '007', '0__', '__', '2F__', '-1__', '0__0__', doubled]) {
		const literal = `literal=__normalize_url_encoded_reserved__${taken}__`;
		const unsortedLiteral = `https://example.com/?q=a%2Fb&${literal}`;
		assert.equal(normalizeUrl(unsortedLiteral), `https://example.com/?${literal}&q=a%2Fb`);
		assert.equal(normalizeUrl(unsortedLiteral, {sortQueryParameters: false}), unsortedLiteral);

		// The same, with the token-shaped text in a key rather than a value.
		const unsortedKey = `https://example.com/?${literal}&q=a%2Fb`;
		assert.equal(normalizeUrl(unsortedKey), unsortedKey);
		assert.equal(normalizeUrl(unsortedKey, {sortQueryParameters: false}), unsortedKey);
	}

	/*
	The option is about order, not encoding, so both modes agree. `#` and `&` have no literal form in a query.
	*/
	const unsorted = {sortQueryParameters: false};
	for (const query of ['a=%2F', 'a=/', 'a=%3A', 'a=:', 'a=%2B', 'a=+', 'a=%3F', 'a=?', 'a=%3D', 'a=;', 'a=%40', 'a=%2C', 'a=%23', 'a=%26', 'b=%2Fy%3Az&c=1']) {
		assert.equal(
			normalizeUrl(`https://example.com/?${query}`, unsorted),
			normalizeUrl(`https://example.com/?${query}`),
		);
	}

	for (const query of ['a=%7E', 'a=~', 'a=b%20c', 'a=b+c', 'a=%41', 'a=A', 'a=100%', 'a=%zz', 'a=%2f', 'a=%3a', 'x=%2Fy%3Az']) {
		assert.equal(
			normalizeUrl(`https://example.com/?${query}`, unsorted),
			normalizeUrl(`https://example.com/?${query}`),
		);
	}

	const encodedReservedCharacters = ['%3A', '%2F', '%3F', '%23', '%5B', '%5D', '%40', '%21', '%24', '%26', '%27', '%28', '%29', '%2A', '%2B', '%2C', '%3B', '%3D'];
	for (const encodedReservedCharacter of encodedReservedCharacters) {
		assert.equal(normalizeUrl(`https://example.com/?value=${encodedReservedCharacter}`), `https://example.com/?value=${encodedReservedCharacter}`);
	}

	// Every one of them also survives in the key, and sorts as its decoded code point rather than as `%`
	for (const encodedReservedCharacter of encodedReservedCharacters) {
		assert.equal(
			normalizeUrl(`https://example.com/?${encodedReservedCharacter}b=1&a=2`),
			`https://example.com/?${encodedReservedCharacter}b=1&a=2`,
		);
	}

	// A key sorts by its decoded code point, not by the `%` that starts its escape.
	assert.equal(normalizeUrl('https://example.com/?%3Ab=1&0=2'), 'https://example.com/?0=2&%3Ab=1'); // : (58) > 0 (48)
	assert.equal(normalizeUrl('https://example.com/?%2Fb=1&0=2'), 'https://example.com/?%2Fb=1&0=2'); // / (47) < 0 (48)
	assert.equal(normalizeUrl('https://example.com/?a=1&%3Ab=2'), 'https://example.com/?%3Ab=2&a=1'); // : (58) < a (97)

	// Two keys that decode to the same code point keep their relative order
	assert.equal(normalizeUrl('https://example.com/?%3A=1&:=2'), 'https://example.com/?%3A=1&:=2');
	assert.equal(normalizeUrl('https://example.com/?%3a=2&%3A=1'), 'https://example.com/?%3A=2&%3A=1');

	assert.equal(normalizeUrl('https://example.com/?value=:@[];,'), 'https://example.com/?value=:@[];,');

	// Encoded reserved characters survive sort reordering
	assert.equal(normalizeUrl('https://example.com/?z=1&token=a%2Fb'), 'https://example.com/?token=a%2Fb&z=1');

	// Encoded reserved characters in keys with sort reordering
	assert.equal(normalizeUrl('https://example.com/?A=1&%3A=2'), 'https://example.com/?%3A=2&A=1');
	assert.equal(normalizeUrl('https://example.com/?foo%3Abar=1&a=2'), 'https://example.com/?a=2&foo%3Abar=1');
	assert.equal(normalizeUrl('https://example.com/?foo%3Dbar=1&a=2'), 'https://example.com/?a=2&foo%3Dbar=1');
	assert.equal(normalizeUrl('https://example.com/?b%26c=1&a=2'), 'https://example.com/?a=2&b%26c=1');

	// Both keys with encoded reserved characters sort by decoded code point
	assert.equal(normalizeUrl('https://example.com/?%3A=1&%2F=2'), 'https://example.com/?%2F=2&%3A=1'); // / (47) < : (58)
	assert.equal(normalizeUrl('https://example.com/?%5B=1&%3A=2'), 'https://example.com/?%3A=2&%5B=1'); // : (58) < [ (91)

	// Encoded reserved characters in both keys and values with sort reordering
	assert.equal(normalizeUrl('https://example.com/?z%3A=val%2F&a%2F=val%3A'), 'https://example.com/?a%2F=val%3A&z%3A=val%2F');

	// Multiple different encoded reserved characters in a single value
	assert.equal(normalizeUrl('https://example.com/?q=%3A%2F%3F'), 'https://example.com/?q=%3A%2F%3F');

	// Interaction with removeQueryParameters
	assert.equal(normalizeUrl('https://example.com/?utm_source=test&token=a%2Fb'), 'https://example.com/?token=a%2Fb');
	assert.equal(normalizeUrl('https://example.com/?token=a/b&utm_source=test'), 'https://example.com/?token=a/b');
	assert.equal(
		normalizeUrl('https://example.com/?foo%3Abar=1&baz=2', {removeQueryParameters: ['foo:bar']}),
		'https://example.com/?baz=2',
	);
	assert.equal(
		normalizeUrl('https://example.com/?foo%3Abar=1&baz=2', {removeQueryParameters: false, keepQueryParameters: ['foo:bar']}),
		'https://example.com/?foo%3Abar=1',
	);

	// Preserved when sortQueryParameters is disabled
	assert.equal(normalizeUrl('https://example.com/?token=a%2Fb', {sortQueryParameters: false}), 'https://example.com/?token=a%2Fb');
	assert.equal(normalizeUrl('https://example.com/?token=%3A%2F%3F', {sortQueryParameters: false}), 'https://example.com/?token=%3A%2F%3F');

	// Malformed percent-encoding should not allow token-collision rewrites in user data
	assert.equal(
		normalizeUrl('https://example.com/?broken=%E0%A4&literal=%5F%5Fnormalize_url_encoded_reserved__2F&token=a%2Fb'),
		'https://example.com/?broken=%EF%BF%BD&literal=__normalize_url_encoded_reserved__2F&token=a%2Fb',
	);
	assert.equal(
		normalizeUrl('https://example.com/?broken=%E0%A4&literal=%5F%5Fnormalize_url_encoded_reserved__0__2F&token=a%2Fb'),
		'https://example.com/?broken=%EF%BF%BD&literal=__normalize_url_encoded_reserved__0__2F&token=a%2Fb',
	);

	const longPadding = '_'.repeat(4000);
	assert.equal(
		normalizeUrl(`https://example.com/?token=a%2Fb&literal=${longPadding}__normalize_url_encoded_reserved__${longPadding}`),
		`https://example.com/?literal=${longPadding}__normalize_url_encoded_reserved__${longPadding}&token=a%2Fb`,
	);

	// Token indexes already taken in the search, including multi-digit ones, are stepped over
	for (const taken of ['', '0', '1', '9', '10', '007', '99']) {
		assert.equal(
			normalizeUrl(`https://example.com/?token=a%2Fb&literal=__normalize_url_encoded_reserved__${taken}__`),
			`https://example.com/?literal=__normalize_url_encoded_reserved__${taken}__&token=a%2Fb`,
		);
	}

	// Token-shaped text that is not an index is left alone
	for (const literal of ['__', '2F__', '-1__', '0__2F', '0__0__']) {
		assert.equal(
			normalizeUrl(`https://example.com/?a=__normalize_url_encoded_reserved__${literal}&token=a%2Fb`),
			`https://example.com/?a=__normalize_url_encoded_reserved__${literal}&token=a%2Fb`,
		);
	}

	assert.equal(
		normalizeUrl('https://example.com/?a=__normalize_url_encoded_reserved__0__&a=__normalize_url_encoded_reserved__1__&token=a%2Fb'),
		'https://example.com/?a=__normalize_url_encoded_reserved__0__&a=__normalize_url_encoded_reserved__1__&token=a%2Fb',
	);

	// A `?` in a query value is canonicalized to its percent-encoded spelling
	assert.equal(normalizeUrl('https://example.com/?a=b?c'), 'https://example.com/?a=b%3Fc');
	assert.equal(normalizeUrl('https://example.com/?a=b%3Fc'), 'https://example.com/?a=b%3Fc');
});

test('emptyQueryValue option', () => {
	// Default 'preserve' behavior - keeps original format
	assert.equal(normalizeUrl('https://example.com?key'), 'https://example.com/?key');
	assert.equal(normalizeUrl('https://example.com?key='), 'https://example.com/?key=');
	assert.equal(normalizeUrl('https://example.com?a&b=&c=1'), 'https://example.com/?a&b=&c=1');

	// 'always' - always include equals sign
	const always = {emptyQueryValue: 'always'};
	assert.equal(normalizeUrl('https://example.com?key', always), 'https://example.com/?key=');
	assert.equal(normalizeUrl('https://example.com?key=', always), 'https://example.com/?key=');
	assert.equal(normalizeUrl('https://example.com?a&b=&c=1', always), 'https://example.com/?a=&b=&c=1');
	assert.equal(normalizeUrl('https://example.com?foo&bar&baz=value', always), 'https://example.com/?bar=&baz=value&foo=');

	// 'never' - never include equals sign for empty values
	const never = {emptyQueryValue: 'never'};
	assert.equal(normalizeUrl('https://example.com?key', never), 'https://example.com/?key');
	assert.equal(normalizeUrl('https://example.com?key=', never), 'https://example.com/?key');
	assert.equal(normalizeUrl('https://example.com?a&b=&c=1', never), 'https://example.com/?a&b&c=1');
	assert.equal(normalizeUrl('https://example.com?foo=&bar=&baz=value', never), 'https://example.com/?bar&baz=value&foo');

	// Works with sortQueryParameters disabled
	assert.equal(normalizeUrl('https://example.com?b&a=', {emptyQueryValue: 'always', sortQueryParameters: false}), 'https://example.com/?b=&a=');
	assert.equal(normalizeUrl('https://example.com?b=&a', {emptyQueryValue: 'never', sortQueryParameters: false}), 'https://example.com/?b&a');

	// 'never' should not strip = when value itself ends with =
	assert.equal(normalizeUrl('https://example.com?key==', {emptyQueryValue: 'never'}), 'https://example.com/?key==');
	assert.equal(normalizeUrl('https://example.com?key=value=', {emptyQueryValue: 'never'}), 'https://example.com/?key=value=');

	// 'preserve' should work correctly when removeQueryParameters modifies the URL
	assert.equal(normalizeUrl('https://example.com?key&utm_source=test'), 'https://example.com/?key');
	assert.equal(normalizeUrl('https://example.com?key&utm_source=test', {sortQueryParameters: false}), 'https://example.com/?key');

	// 'preserve' should work correctly with URL-encoded keys containing spaces
	assert.equal(normalizeUrl('https://example.com?foo%20bar'), 'https://example.com/?foo%20bar');
	assert.equal(normalizeUrl('https://example.com?foo%20bar='), 'https://example.com/?foo%20bar=');
	assert.equal(normalizeUrl('https://example.com?foo%20bar=', {emptyQueryValue: 'never'}), 'https://example.com/?foo%20bar');

	// 'preserve' with duplicate keys having mixed formats normalizes all to the same format
	assert.equal(normalizeUrl('https://example.com?a&a=', {sortQueryParameters: false}), 'https://example.com/?a&a');
	assert.equal(normalizeUrl('https://example.com?a=&a', {sortQueryParameters: false}), 'https://example.com/?a&a');

	// Keys with + (which means space in query strings)
	assert.equal(normalizeUrl('https://example.com?foo+bar'), 'https://example.com/?foo%20bar');
	assert.equal(normalizeUrl('https://example.com?foo+bar='), 'https://example.com/?foo%20bar=');
	assert.equal(normalizeUrl('https://example.com?foo+bar=', {emptyQueryValue: 'never'}), 'https://example.com/?foo%20bar');
	assert.equal(normalizeUrl('https://example.com?foo+bar=value'), 'https://example.com/?foo%20bar=value');
	assert.equal(normalizeUrl('https://example.com?foo+bar=value', {sortQueryParameters: false}), 'https://example.com/?foo%20bar=value');

	// Keys with encoded plus should stay literal
	assert.equal(normalizeUrl('https://example.com?foo%2Bbar=1'), 'https://example.com/?foo%2Bbar=1');
	assert.equal(normalizeUrl('https://example.com?foo%2Bbar='), 'https://example.com/?foo%2Bbar=');
	assert.equal(normalizeUrl('https://example.com?foo%2Bbar=', {emptyQueryValue: 'never'}), 'https://example.com/?foo%2Bbar');

	// Invalid percent-encoding in key should not throw
	assert.equal(normalizeUrl('https://example.com?%E0%A4'), 'https://example.com/?%EF%BF%BD');
	assert.equal(normalizeUrl('https://example.com?%E0%A4='), 'https://example.com/?%EF%BF%BD=');
	assert.equal(normalizeUrl('https://example.com?%E0%A4&%E0%A4='), 'https://example.com/?%EF%BF%BD&%EF%BF%BD');
	assert.equal(normalizeUrl('https://example.com?%E0%A4=&%EF%BF%BD='), 'https://example.com/?%EF%BF%BD=&%EF%BF%BD=');

	// Keys with + when sortQueryParameters is disabled
	assert.equal(normalizeUrl('https://example.com?foo+bar', {sortQueryParameters: false}), 'https://example.com/?foo%20bar');
	assert.equal(normalizeUrl('https://example.com?foo+bar=', {sortQueryParameters: false}), 'https://example.com/?foo%20bar=');
	assert.equal(normalizeUrl('https://example.com?foo+bar&baz+qux=', {sortQueryParameters: false}), 'https://example.com/?foo%20bar&baz%20qux=');

	// Unicode keys
	assert.equal(normalizeUrl('https://example.com?café'), 'https://example.com/?caf%C3%A9');
	assert.equal(normalizeUrl('https://example.com?café='), 'https://example.com/?caf%C3%A9=');
	assert.equal(normalizeUrl('https://example.com?café=', {emptyQueryValue: 'never'}), 'https://example.com/?caf%C3%A9');

	// Encoded delimiters in keys
	assert.equal(normalizeUrl('https://example.com?foo%26bar=', {emptyQueryValue: 'never'}), 'https://example.com/?foo%26bar');
	assert.equal(normalizeUrl('https://example.com?foo%3Dbar=', {emptyQueryValue: 'never'}), 'https://example.com/?foo%3Dbar');
	assert.equal(normalizeUrl('https://example.com?foo%26bar&utm_source=test'), 'https://example.com/?foo%26bar');
	assert.equal(normalizeUrl('https://example.com?foo%2526bar='), 'https://example.com/?foo%2526bar=');
	assert.equal(normalizeUrl('https://example.com?foo%2526bar=', {emptyQueryValue: 'never'}), 'https://example.com/?foo%2526bar');

	// Multiple keys with mixed formats
	assert.equal(normalizeUrl('https://example.com?a&b=&c=1'), 'https://example.com/?a&b=&c=1');
	assert.equal(normalizeUrl('https://example.com?foo%20bar&baz'), 'https://example.com/?baz&foo%20bar');

	// Duplicate keys with sorting enabled (default) - mixed formats normalize to same format
	assert.equal(normalizeUrl('https://example.com?a&a='), 'https://example.com/?a&a');
	assert.equal(normalizeUrl('https://example.com?a=&a'), 'https://example.com/?a&a');
	assert.equal(normalizeUrl('https://example.com?a&a&a='), 'https://example.com/?a&a&a');
	assert.equal(normalizeUrl('https://example.com?a=&a=&a'), 'https://example.com/?a&a&a');

	// Multiple = in values (only first = is the delimiter)
	assert.equal(normalizeUrl('https://example.com?key=a=b=c'), 'https://example.com/?key=a=b=c');
	assert.equal(normalizeUrl('https://example.com?data=abc=='), 'https://example.com/?data=abc==');

	// Encoded = (%3D) in values is preserved
	assert.equal(normalizeUrl('https://example.com?key=val%3Due'), 'https://example.com/?key=val%3Due');
	assert.equal(normalizeUrl('https://example.com?key=%3D'), 'https://example.com/?key=%3D');
	assert.equal(normalizeUrl('https://example.com?key=val%3Due', {sortQueryParameters: false}), 'https://example.com/?key=val%3Due');

	// All params removed leaves no query string
	assert.equal(normalizeUrl('https://example.com?utm_source=test&utm_medium=web'), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com?key', {removeQueryParameters: true}), 'https://example.com');

	// Single param edge cases
	assert.equal(normalizeUrl('https://example.com?=value'), 'https://example.com/?=value');
	assert.equal(normalizeUrl('https://example.com?='), 'https://example.com/?=');
	assert.equal(normalizeUrl('https://example.com?=value', {emptyQueryValue: 'always'}), 'https://example.com/?=value');
	assert.equal(normalizeUrl('https://example.com?=value', {emptyQueryValue: 'never'}), 'https://example.com/?=value');
	assert.equal(normalizeUrl('https://example.com?=', {emptyQueryValue: 'always'}), 'https://example.com/?=');
	assert.equal(normalizeUrl('https://example.com?=', {emptyQueryValue: 'never'}), 'https://example.com/?=');
	assert.equal(normalizeUrl('https://example.com?=&a=', {emptyQueryValue: 'never'}), 'https://example.com/?=&a');
	assert.equal(normalizeUrl('https://example.com?=&=', {emptyQueryValue: 'always'}), 'https://example.com/?=&=');
	assert.equal(normalizeUrl('https://example.com?=&=', {emptyQueryValue: 'never'}), 'https://example.com/?=&=');
	assert.equal(normalizeUrl('https://example.com?=&a', {emptyQueryValue: 'always'}), 'https://example.com/?=&a=');
	assert.equal(normalizeUrl('https://example.com?&', {emptyQueryValue: 'always'}), 'https://example.com');
	assert.equal(normalizeUrl('https://example.com?&', {emptyQueryValue: 'never'}), 'https://example.com');

	// Empty segments are removed even when sorting is disabled
	assert.equal(normalizeUrl('https://example.com?foo&&bar', {sortQueryParameters: false}), 'https://example.com/?foo&bar');
	assert.equal(normalizeUrl('https://example.com?foo&&bar', {sortQueryParameters: false, emptyQueryValue: 'always'}), 'https://example.com/?foo=&bar=');
	assert.equal(normalizeUrl('https://example.com?foo&&bar', {sortQueryParameters: false, emptyQueryValue: 'never'}), 'https://example.com/?foo&bar');
	assert.equal(normalizeUrl('https://example.com?&&', {sortQueryParameters: false}), 'https://example.com');

	// Hash does not affect query normalization
	assert.equal(normalizeUrl('https://example.com?key#hash'), 'https://example.com/?key#hash');
	assert.equal(normalizeUrl('https://example.com?key=#hash'), 'https://example.com/?key=#hash');

	// A key that is only a plus becomes a space, while a plus in a value stays one
	assert.equal(normalizeUrl('https://example.com?+'), 'https://example.com/?%20');
	assert.equal(normalizeUrl('https://example.com?a=+'), 'https://example.com/?a=+');
	assert.equal(normalizeUrl('https://example.com?a=b%20c'), 'https://example.com/?a=b+c');
	assert.equal(normalizeUrl('https://example.com?a=%41'), 'https://example.com/?a=A');

	// An empty value next to a non-empty one of the same key only affects the empty one
	assert.equal(normalizeUrl('https://example.com?a=1&a', {emptyQueryValue: 'always'}), 'https://example.com/?a=1&a=');
	assert.equal(normalizeUrl('https://example.com?%2F&%2F=', {emptyQueryValue: 'always'}), 'https://example.com/?%2F=&%2F=');

	// An escaped key that decodes to one seen in both forms loses the `=` everywhere, in both modes
	const unsortedEmpty = {emptyQueryValue: 'preserve', sortQueryParameters: false, removeQueryParameters: false};
	assert.equal(normalizeUrl('http://sindresorhus.com/?%7Ea&%7Ea='), 'http://sindresorhus.com/?~a&~a');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%7Ea&%7Ea=', unsortedEmpty), 'http://sindresorhus.com/?~a&~a');
	assert.equal(normalizeUrl('http://sindresorhus.com/?x&%78='), 'http://sindresorhus.com/?x&x');
	assert.equal(normalizeUrl('http://sindresorhus.com/?x&%78=', unsortedEmpty), 'http://sindresorhus.com/?x&x');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%2F&%2F='), 'http://sindresorhus.com/?%2F&%2F');
	assert.equal(normalizeUrl('http://sindresorhus.com/?%2F&%2F=', unsortedEmpty), 'http://sindresorhus.com/?%2F&%2F');

	// Equal keys keep their input order, and an uppercase key sorts before a lowercase one
	assert.equal(normalizeUrl('https://example.com?b=2&b=1'), 'https://example.com/?b=2&b=1');
	assert.equal(normalizeUrl('https://example.com?B=1&b=2'), 'https://example.com/?B=1&b=2');

	// A query with a repeated key means different things in a different order, so the order is kept
	assert.equal(normalizeUrl('https://example.com?a=1&a=2&b=3'), 'https://example.com/?a=1&a=2&b=3');
	assert.equal(normalizeUrl('https://example.com?a=2&a=1&b=3'), 'https://example.com/?a=2&a=1&b=3');
	assert.equal(normalizeUrl('https://example.com?b=3&a=2&a=1'), 'https://example.com/?a=2&a=1&b=3');
});

// A small generator with a fixed seed, so a failure names a reproducible input.
const createSeededRandom = () => {
	let seed = 20_260_927;
	const random = () => {
		seed = ((seed * 1_103_515_245) + 12_345) % 2_147_483_648;
		return seed / 2_147_483_648;
	};

	const pick = list => list[Math.floor(random() * list.length)];
	const take = (list, count) => Array.from({length: count}, () => pick(list));
	return {random, pick, take};
};

// A generated corpus for the property tests below.
const buildCorpus = () => {
	const {random, pick, take} = createSeededRandom();

	const SCHEMES = ['http://', 'https://', 'HTTP://', '//', 'sindre://', 'a://', 'x.y://', 'file://'];
	const HOSTS = ['sindresorhus.com',
		'www.sindresorhus.com',
		'SINDRESORHUS.COM',
		'sindresorhus.com.',
		'localhost',
		'localhost:9802',
		'127.0.0.1',
		'[::1]',
		'[::1]:80',
		'user:pw@sindresorhus.com',
		'user:@sindresorhus.com',
		'exämple.com',
		'xn--exmple-cua.com',
		'a.b.c.d.e',
		'159.189.213..'];
	const SEGMENTS = ['a',
		'b',
		'A',
		'~',
		'-',
		'_',
		'..',
		'.',
		'a b',
		'a+b',
		'%41',
		'%7e',
		'%7E',
		'%2F',
		'%2f',
		'%25',
		'%2525',
		'%2%45',
		'%zz',
		'%',
		'%09',
		'%5C',
		'a%2Db',
		'%C3%A9',
		'%E2%84%AA',
		'é',
		'日本',
		'😀',
		'index.html',
		'index.php',
		'a//b',
		's3://',
		'a://b',
		'-a://',
		'1a://',
		'\\',
		'a;b',
		'a=b',
		'a#b',
		'a?b',
		'a&b',
		'a%2By'];
	const QUERIES = ['a=1',
		'a',
		'a=',
		'b=2',
		'utm_source=x',
		'a=%2F',
		'a=%3A',
		'a=%3a',
		'a=%25',
		'a=%2525',
		'a=%2%45',
		'a=%zz',
		'a=%',
		'a+b=c+d',
		'a%20b=c',
		'a=1&a=2',
		'a&a=',
		'a=&a',
		'=a',
		'a==',
		'a[]=1',
		'a=%2Bb',
		'a=+',
		'a=~',
		'a=%7e',
		'a=%09',
		'a=%00',
		'é=é',
		'a=%C3%A9',
		'a[]',
		'a[0]=1'];
	const HASHES = ['',
		'#h',
		'#a b',
		'#a%20b',
		'#a#b',
		'#a#:~:text=x',
		'#:~:text=x',
		'###:~:text=x',
		'#%3A~%3Atext=x',
		'#a:~:text=x',
		'#see:~:textbook',
		'#',
		'#%2E',
		'#%2%45',
		'#%zz',
		'#%',
		'#é',
		'#a?b',
		'#%7E',
		'# '];
	const DATA_TYPES = ['',
		'text/plain,',
		'TEXT/PLAIN,',
		'text/html,',
		'image/png,',
		';base64,',
		';base64=,',
		';BASE64,',
		'; base64,',
		';base6%34,',
		';%42ASE64,',
		';charset=utf-8,',
		';charset=us-ascii,',
		';charset=US-ASCII,',
		';a="b;c",',
		';a=\'b;c\'',
		';a=b',
		';a=',
		';=',
		';',
		';;',
		';base64;charset=us-ascii,',
		';base64;charset=utf-8,',
		'%41ext/plain,',
		'%2fext/plain,',
		';title=It\'s;charset=us-ascii,'];
	const DATA_PAYLOADS = ['',
		'x',
		'QUJD',
		'a b',
		'a,b',
		'a;b',
		'a#b',
		'%41',
		'%2f',
		'%zz',
		'%',
		'a+b',
		'é',
		' Zm9v ',
		'a%20b',
		'a#b c'];

	const urls = [];
	for (let index = 0; index < 400; index++) {
		if (random() < 0.25) {
			urls.push(`data:${pick(DATA_TYPES)}${pick(DATA_PAYLOADS)}${pick(HASHES)}`);
			continue;
		}

		const scheme = pick(SCHEMES);
		const host = pick(HOSTS);
		const segments = take(SEGMENTS, 1 + Math.floor(random() * 4));
		const parts = [scheme, host, '/', segments.join('/')];
		if (random() < 0.5) {
			const queries = take(QUERIES, 1 + Math.floor(random() * 3));
			parts.push('?', queries.join('&'));
		}

		parts.push(pick(HASHES));
		urls.push(parts.join(''));
	}

	// An input the library rejects is not a candidate: the property is about a URL it normalizes, and there is a separate test for the ones it refuses.
	return urls.filter(url => {
		try {
			normalizeUrl(url);
			return true;
		} catch {
			return false;
		}
	});
};

const CORPUS = buildCorpus();

test('the output is already the spelling a URL parser writes', () => {
	/*
	An output that a parser would rewrite is not finished. Every custom protocol is named, since an unnamed one is returned as written.
	*/
	const named = ['s3', 'sindre', 'a'];
	const {random, pick, take} = createSeededRandom();

	const build = () => {
		const scheme = pick(['http://', 'https://', 'file://', '//', 's3://', 'sindre://', 'a://']);
		const authority = pick(['',
			'x.com',
			'www.x.com',
			'X.COM',
			'x.com.',
			'x.com..',
			'localhost',
			'127.0.0.1',
			'[::1]',
			'[::1]:8080',
			'u:p@x.com',
			'exämple.com',
			'xn--exmple-cua.com',
			'x.com:8080']);
		const path = take(['a',
			'b',
			'~',
			'..',
			'.',
			'a b',
			'%41',
			'%7e',
			'%2F',
			'%25',
			'%2%45',
			'%zz',
			'%',
			'%09',
			'é',
			'日本',
			'😀',
			'index.html',
			'a//b',
			'a%2Db',
			'%C3%A9',
			String.raw`a\b`,
			'a|b',
			'a^b',
			'a{b}',
			'a`b',
			'a"b',
			'a\'b',
			'a<b>',
			'a[b]',
			'a;b',
			'a,b',
			'a=b',
			'a&b',
			'a?b',
			'a#b'], 1 + Math.trunc(random() * 3)).join('/');
		const search = pick(['?a=1',
			'?a',
			'?a=',
			'?utm_source=x&a=1',
			'?a=%2F',
			'?a=%zz',
			'?a+b=c+d',
			'?a=%',
			'?a=1&a=2',
			'?a[]=1',
			'?a=%C3%A9',
			'?b=2&a=1',
			'?=1',
			'?=',
			'?a=%20']);
		const hash = pick(['', '#h', '#a b', '#a#:~:text=x', '#:~:text=x', '#a:~:text=x', '#%2%45', '#%7E', '#é']);
		return `${scheme}${authority}/${path}${search}${hash}`;
	};

	const optionSets = [{},
		{removeTrailingSlash: false},
		{removeSingleSlash: false},
		{stripWWW: false},
		{emptyQueryValue: 'never'},
		{emptyQueryValue: 'always'},
		{sortQueryParameters: false},
		{removeQueryParameters: false}];

	let checked = 0;
	for (let index = 0; index < 1500; index++) {
		const url = build();
		const options = {...pick(optionSets), customProtocols: named};
		let output;
		try {
			output = normalizeUrl(url, options);
		} catch {
			continue;
		}

		let reparsed;
		try {
			reparsed = new URL(output).href;
		} catch {
			continue;
		}

		checked++;
		assert.equal(reparsed, output, `${url} with ${JSON.stringify(options)}`);
	}

	assert.ok(checked > 1000, `only ${checked} outputs were compared`);
});

test('normalizing an already normalized URL is a no-op', () => {
	/*
	A normalizer must be a fixed point, or it cannot compare or deduplicate URLs. This covers the whole option matrix.
	*/
	const urls = [
		'http://sindresorhus.com',
		'http://sindresorhus.com/a/b?a=1&b=2#c',
		'http://sindresorhus.com/a%2Fb?c%2Fd#e%2Ff',
		'http://sindresorhus.com/?a&a=',
		'http://sindresorhus.com/100%25',
		'http://sindresorhus.com/%09',
		'http://sindresorhus.com/?a=%09',
		'http://sindresorhus.com/?a=b/',
		'http://sindresorhus.com/?%2F=1&a=2',
		'http://sindresorhus.com/a/index.html',
		'http://sindresorhus.com/a//b',
		'http://sindresorhus.com/s3://x//y',
		'http://sindresorhus.com/AB://x//y',
		'http://sindresorhus.com/..',
		'http://sindresorhus.com/a/b/',
		'file:///a/b',
		'file:///',
		'data:,a%2Fb#c%2Fd',
		'data:;base64,Zm9v',
		'data:text/html;charset=utf-8,x',
		'data:,foo #:~:text=x',
		'data:BASE64,x',
		'http://sindresorhus.com/#:~:text=x',
		'http://sindresorhus.com/#a:~:text=x',
		'http://sindresorhus.com/a?b=1&a=%2F&c=%3A',
		'//sindresorhus.com/a',
		'localhost:9802/a',
		'sindresorhus.com:80',
	];

	const optionSets = [
		{},
		{sortQueryParameters: false},
		{emptyQueryValue: 'always'},
		{emptyQueryValue: 'never'},
		{removeTrailingSlash: false},
		{removeSingleSlash: false},
		{keepQueryParameters: ['a']},
		{removeQueryParameters: false},
		{removeQueryParameters: true},
		{removePath: true},
		{removeDirectoryIndex: true},
		{stripHash: true},
		{stripTextFragment: false},
		{removeExplicitPort: true},
	];

	for (const url of [...urls, ...CORPUS]) {
		for (const options of optionSets) {
			const once = normalizeUrl(url, options);
			assert.equal(normalizeUrl(once, options), once, `${url} with ${JSON.stringify(options)}`);
		}
	}
});

test('normalizing a URL leaves the parts a browser reads alone', () => {
	/*
	A normalizer may re-spell a URL but not change what it addresses. With the removal options off, every part must read the same to a browser.
	*/
	const read = (text, plusIsSpace) => percentDecode(plusIsSpace ? text.replaceAll('+', '%20') : text);
	const parameters = url => [...url.searchParams]
		.map(([key, value]) => `${read(key, false)}=${read(value, true)}`)
		.toSorted(compareCodeUnits);

	const optionSets = [
		{sortQueryParameters: false},
		{emptyQueryValue: 'always'},
		{emptyQueryValue: 'never'},
		{sortQueryParameters: true},
	];

	const neutral = {
		normalizeProtocol: false,
		forceHttp: false,
		forceHttps: false,
		stripAuthentication: false,
		stripHash: false,
		stripProtocol: false,
		stripTextFragment: false,
		stripWWW: false,
		removeQueryParameters: false,
		removeTrailingSlash: false,
		removeSingleSlash: false,
		removeDirectoryIndex: false,
		removeExplicitPort: false,
		removePath: false,
		transformPath: false,
		emptyQueryValue: 'preserve',
	};

	for (const url of CORPUS) {
		if (url.startsWith('data:')) {
			// A data URL is checked by comparing what a browser decodes it to, which `fetch` does.
			continue;
		}

		let before;
		try {
			before = new URL(url);
		} catch {
			continue;
		}

		for (const variant of optionSets) {
			const options = {...neutral, ...variant};
			const output = normalizeUrl(url, options);

			// A custom protocol is documented to come back untouched, and a no-op cannot have changed a part, so neither is a finding.
			if (output === url) {
				continue;
			}

			let after;
			try {
				after = new URL(output);
			} catch {
				assert.fail(`${url} with ${JSON.stringify(variant)} normalized to ${output}, which is not a URL`);
			}

			const label = `${url} with ${JSON.stringify(variant)} -> ${output}`;
			assert.equal(after.protocol, before.protocol, `protocol of ${label}`);
			/*
			A trailing dot is removed only when the name still reads as itself: `159.189.213` parses as an IPv4 address, which is not the host `159.189.213..` names.
			*/
			const strippedHost = before.host.replace(/(?<!\.)\.+$/v, '') || '.';
			assert.ok(after.host === strippedHost || after.host === before.host, `host of ${label}: ${after.host} is neither ${strippedHost} nor ${before.host}`);
			assert.equal(after.port, before.port, `port of ${label}`);
			/*
			Which duplicate slash a path keeps is the protocol-lookalike rule, so segments are compared, not spelling.
			*/
			assert.deepEqual(
				read(after.pathname, false).split('/').filter(Boolean),
				read(before.pathname, false).split('/').filter(Boolean),
				`path of ${label}`,
			);
			assert.deepEqual(parameters(after), parameters(before), `query of ${label}`);
			assert.equal(read(after.hash, false), read(before.hash, false), `hash of ${label}`);
		}
	}
});

test('a search that spells the token base twice keeps its value', () => {
	/*
	The round trip prefix must not occur in the search, or part of the value becomes an escape that the next pass decodes.
	*/
	// The inputs spell the library's internal token.
	const doubled = '__normalize_url_encoded_reserved__0__normalize_url_encoded_reserved__1__';
	assert.equal(normalizeUrl(`https://example.com/?q=a%2Fb&k=${doubled}2F`), `https://example.com/?k=${doubled}2F&q=a%2Fb`);
	assert.equal(normalizeUrl(`https://example.com/?q=a%2Fb&k=${doubled}2F`, {removeQueryParameters: false}), `https://example.com/?k=${doubled}2F&q=a%2Fb`);
	assert.equal(normalizeUrl(`https://example.com/?${doubled}2F=1&q=a%2Fb`), `https://example.com/?${doubled}2F=1&q=a%2Fb`);

	// Every byte value, since the value has to come back as written for all of them.
	for (let value = 0; value < 256; value++) {
		const suffix = value.toString(16).toUpperCase().padStart(2, '0');
		const output = normalizeUrl(`https://example.com/?q=a%2Fb&k=${doubled}${suffix}`);
		assert.equal(output, `https://example.com/?k=${doubled}${suffix}&q=a%2Fb`, `byte 0x${suffix}`);
		assert.equal(normalizeUrl(output), output, `byte 0x${suffix} is a fixed point`);
	}
});

test('a pair of options only changes what each of them documents', () => {
	/*
	A pair of options must only change the parts they are documented to change. Every pair runs over a fixed corpus, which random sampling does not reach.
	*/
	const PARTS = {
		defaultProtocol: ['protocol', 'host', 'port'],
		normalizeProtocol: ['protocol'],
		forceHttp: ['protocol', 'host', 'port'],
		forceHttps: ['protocol', 'host', 'port'],
		stripProtocol: ['protocol', 'host', 'port', 'path', 'hash', 'query'],
		customProtocols: ['protocol', 'host', 'port', 'path', 'hash', 'query'],
		stripAuthentication: ['host'],
		stripWWW: ['host'],
		removeExplicitPort: ['port', 'host'],
		stripHash: ['hash'],
		stripTextFragment: ['hash'],
		removeTrailingSlash: ['path'],
		removeSingleSlash: ['path'],
		removePath: ['path'],
		transformPath: ['path'],
		removeDirectoryIndex: ['path'],
		removeQueryParameters: ['query'],
		keepQueryParameters: ['query'],
		sortQueryParameters: ['query'],
		emptyQueryValue: ['query'],
	};

	const VALUES = {
		normalizeProtocol: [true, false],
		forceHttp: [true, false],
		forceHttps: [true, false],
		stripAuthentication: [true, false],
		stripHash: [true, false],
		stripProtocol: [true, false],
		stripTextFragment: [true, false],
		stripWWW: [true, false],
		removeTrailingSlash: [true, false],
		removeSingleSlash: [true, false],
		removeExplicitPort: [true, false],
		sortQueryParameters: [true, false],
		removePath: [true, false],
		defaultProtocol: ['http', 'https'],
		emptyQueryValue: ['preserve', 'always', 'never'],
		removeQueryParameters: [false, true, ['a'], [/^utm_/iv]],
		keepQueryParameters: [undefined, ['a'], [/./v]],
		removeDirectoryIndex: [false, true, ['index.html'], [/./v]],
		customProtocols: [undefined, ['sindre'], ['s3']],
		transformPath: [false, components => components, components => components.slice(0, 1), () => []],
	};

	const URLS = [
		'sindresorhus.com',
		'//sindresorhus.com',
		'http://sindresorhus.com',
		'http://www.sindresorhus.com/a/b/',
		'https://www.sindresorhus.com:8080/a/index.html?b=2&a=1#:~:text=x',
		'http://user:pw@sindresorhus.com/a//b/',
		'http://sindresorhus.com/a/../b/',
		'http://sindresorhus.com/?utm_source=x&a',
		'http://sindresorhus.com/a%20b/?a=%2F#a%2Fb',
		'sindresorhus.com:9802/a',
		'file:///a/b/index.html',
		'sindre://www.sindresorhus.com/a/',
		'sindre:a/b',
		's3://x.com/a//b',
		'http://sindresorhus.com/#',
		'http://sindresorhus.com/?',
		'http://159.189.213../a',
		String.raw`http://sindresorhus.com\a`,
	];

	const NAMES = Object.keys(VALUES);
	let checked = 0;

	// Each unordered pair once, since the order of two options does not matter.
	for (const [indexA, nameA] of NAMES.entries()) {
		for (const nameB of NAMES.slice(indexA + 1)) {
			for (const valueA of VALUES[nameA]) {
				for (const valueB of VALUES[nameB]) {
					const options = {[nameA]: valueA, [nameB]: valueB};

					// The two cannot be used together, which the library throws on by design.
					if (options.forceHttp && options.forceHttps) {
						continue;
					}

					const allowed = new Set([...(PARTS[nameA] ?? []), ...(PARTS[nameB] ?? [])]);

					for (const url of URLS) {
						checked++;
						const once = normalizeUrl(url, options);
						const label = `${url} with ${JSON.stringify(options, (key, value) => typeof value === 'function' ? 'fn' : value)}`;

						assert.equal(normalizeUrl(once, options), once, `${label} should be a fixed point`);

						// A URL the parser cannot read on its own, which a protocol-relative one is with `normalizeProtocol: false`, has no components to compare.
						let before;
						let after;
						try {
							before = new URL(normalizeUrl(url));
							after = new URL(once);
						} catch {
							continue;
						}

						if (!allowed.has('protocol')) {
							assert.equal(after.protocol, before.protocol, `the protocol of ${label}`);
						}

						if (!allowed.has('host')) {
							assert.equal(after.host, before.host, `the host of ${label}`);
						}

						if (!allowed.has('port')) {
							assert.equal(after.port, before.port, `the port of ${label}`);
						}

						if (!allowed.has('path')) {
							assert.equal(percentDecode(after.pathname), percentDecode(before.pathname), `the path of ${label}`);
						}

						if (!allowed.has('hash')) {
							assert.equal(percentDecode(after.hash), percentDecode(before.hash), `the hash of ${label}`);
						}

						if (!allowed.has('query')) {
							assert.deepEqual([...after.searchParams].toSorted(comparePairs), [...before.searchParams].toSorted(comparePairs), `the query of ${label}`);
						}
					}
				}
			}
		}
	}

	assert.ok(checked > 20_000, `only ${checked} option-pair and URL combinations were covered`);
});

test('a data URL keeps the bytes it decodes to', async () => {
	/*
	`fetch` runs the browser `data:` URL processor, so it is the oracle. The body must survive byte for byte. The media type is not compared here, since the tests above cover its documented changes.
	*/
	const TYPES = [
		'',
		'text/plain',
		'TEXT/PLAIN',
		'text/html',
		'image/png',
		'application/json',
		'*/*',
		';base64',
		';BASE64',
		';base64=',
		'; base64',
		';base6%34',
		';%42ASE64',
		';base64;base64',
		';charset=UTF-8',
		';charset=us-ascii',
		';charset=',
		';charset=\'us-ascii\'',
		';a=b;base64',
		';a="b;c"',
		';a=\'b;c\'',
		';a=b',
		';a=',
		';=',
		';',
		';;',
		';base64;charset=us-ascii',
		'%2fext/plain',
		'%41ext/plain',
		';a=%41',
		';a=%zz',
		';a=%2%45',
	];
	/*
	A narrow payload and fragment grid keeps the `fetch` comparison quick. The media type grid above is the wide one.
	*/
	const DATA = ['', 'x', 'QUJD', 'a b', 'a,b', 'a;b', 'a#b', 'a=b', '~', 'é', ' Zm9v ', '%41', '%25', '%zz', '%', 'AA=='];
	const FRAGMENTS = ['', '#h', '#a b', '#a#b', '#a%2Fb', '#%zz', '#\u{2028}', '#é', '#:~:text=a', '###:~:text=a', '#%3A~%3Atext=a'];

	let checked = 0;
	for (const type of TYPES) {
		for (const data of DATA) {
			for (const fragment of FRAGMENTS) {
				// A comma is optional, and the data may hold one, so build it both ways round.
				for (const url of [`data:${type},${data}${fragment}`, `data:${type}${data}${fragment}`]) {
					const output = normalizeUrl(url);
					assert.equal(normalizeUrl(output), output, `${url} should be a fixed point`);

					// A URL no browser reads has nothing to preserve.
					// eslint-disable-next-line no-await-in-loop -- One at a time, so a failure names its input.
					const before = await readDataURL(url);
					if (before === undefined) {
						continue;
					}

					checked++;
					/*
					Only the body is compared, since the tests above cover the documented media type changes.
					*/
					// eslint-disable-next-line no-await-in-loop -- As above.
					const after = await readDataURL(output);
					assert.equal(after?.body, before.body, `the bytes of ${url} should survive as ${output}`);
				}
			}
		}
	}

	assert.ok(checked > 1000, `only ${checked} loadable data URLs were compared`);
});

test('the documented examples match what the library does', () => {
	/*
	The readme and the type definitions have many examples, and three had wrong outputs before this.
	*/
	const readme = fs.readFileSync(new URL('readme.md', import.meta.url), 'utf8');
	const typeDefinitions = fs.readFileSync(new URL('index.d.ts', import.meta.url), 'utf8');

	/*
	`normalizeUrl(<arguments>);` then a `//=> '<expected>'` line. The call must start a line, or the first match starts at the readme signature and swallows the first example.
	*/
	const examplePattern = /^[\t ]*normalizeUrl\((?<rawArguments>[\s\S]*?)\);?[\t ]*\n[\t ]*(?:\*\/[\t ]*)?\/\/=> '(?<expected>[^\n']*)'/gmv;

	for (const [name, text] of [['readme.md', readme], ['index.d.ts', typeDefinitions]]) {
		let match;
		let checked = 0;
		/*
		Every `//=>` line is an example, so their count makes a lost example a failure.
		*/
		const documented = text.split('\n').filter(line => line.includes('//=>')).length;
		while ((match = examplePattern.exec(text)) !== null) {
			const {rawArguments, expected} = match.groups;
			// A runaway match, or one that swallowed a block of prose rather than a call.
			if (rawArguments.includes('//=>') || rawArguments.includes('```') || rawArguments.length > 400) {
				continue;
			}

			const arguments_ = rawArguments.replaceAll(/(?<!\s)\s*\n\s*/gv, ' ').replace(/;$/v, '');
			// eslint-disable-next-line no-new-func
			const actual = new Function('normalizeUrl', `"use strict"; return normalizeUrl(${arguments_})`)(normalizeUrl);
			assert.equal(actual, expected, `${name}: normalizeUrl(${arguments_})`);
			checked++;
		}

		assert.equal(checked, documented, `${name} checked ${checked} of its ${documented} examples`);
	}
});

test('a filter is never left in a state that changes the next call', () => {
	/*
	A global or sticky regex carries `lastIndex`, so repeated calls with the same options must agree.
	*/
	const globalFilter = /^utm_/gv;
	const stickyFilter = /utm_/vy;
	stickyFilter.lastIndex = 3;
	const globalIndex = /index\.html/gv;
	globalIndex.lastIndex = 4;
	const options = {
		removeQueryParameters: [globalFilter, stickyFilter],
		removeDirectoryIndex: [globalIndex, /index\.php/vy],
	};

	const input = 'http://sindresorhus.com/index.html?utm_a=1&utm_b=2&c=3';
	const expected = 'http://sindresorhus.com/?c=3';
	assert.equal(normalizeUrl(input, options), expected);
	for (let index = 0; index < 10; index++) {
		assert.equal(normalizeUrl(input, options), expected);
	}

	assert.equal(globalFilter.lastIndex, 0);
	assert.equal(stickyFilter.lastIndex, 3);
	assert.equal(globalIndex.lastIndex, 4);
});

test('stripping the hash of a data URL keeps the data a browser reads', () => {
	/*
	The trailing space of `data:,foo #bar` is a data byte, so it is written as `%20`, which is a fixed point, rather than trimmed.
	*/
	assert.equal(normalizeUrl('data:,foo #bar', {stripHash: true}), 'data:,foo%20');
	assert.equal(normalizeUrl('data:,a #b', {stripHash: true}), 'data:,a%20');
	assert.equal(normalizeUrl('data:text/html,x #y', {stripHash: true}), 'data:text/html,x%20');
	assert.equal(normalizeUrl('data:,foo%20', {stripHash: true}), 'data:,foo%20');
	assert.equal(normalizeUrl('data:,foo%20'), 'data:,foo%20');

	// Base64 data is a different case: a URL processor strips ASCII whitespace from it, so there the whitespace does go.
	assert.equal(normalizeUrl('data:;base64, Zm9v #h', {stripHash: true}), 'data:;base64,Zm9v');
	assert.equal(normalizeUrl('data:;base64, Zm9v '), 'data:;base64,Zm9v');

	for (const url of ['data:,foo #bar', 'data:,a #b', 'data:text/html,x #y']) {
		assert.equal(normalizeUrl(url, {stripHash: true}), normalizeUrl(normalizeUrl(url, {stripHash: true}), {stripHash: true}), `${url} with stripHash`);
	}
});

test('a text fragment strip reaches a line separator inside the fragment', () => {
	/*
	The pattern uses `.`, which does not match line separators, so a directive followed by one was kept. Only a data URL reaches this, as a regular URL escapes them.
	*/
	const lineSeparator = '\u{2028}';
	const paragraphSeparator = '\u{2029}';

	for (const character of [lineSeparator, paragraphSeparator]) {
		assert.equal(normalizeUrl(`data:,a#:~:text=x${character}y`), 'data:,a', 'after the directive');
		assert.equal(normalizeUrl(`data:,a#:~:text=x${character}`), 'data:,a', 'at the end of the fragment');
		assert.equal(normalizeUrl(`data:,a#:~:text=x${character}y${paragraphSeparator}z`), 'data:,a', 'both of them');
		assert.equal(normalizeUrl(`data:text/html;a=${character}b#:~:text=x${character}y`), `data:text/html;a=${character}b`, 'after a media type');
		assert.equal(normalizeUrl(`data:,a#${character}:~:text=x`), `data:,a#${encodeURIComponent(character)}`, 'before the delimiter');
		// The directive reaches the end of the fragment, so a `#` after it goes with it.
		assert.equal(normalizeUrl(`data:,a#:~:text=x${character}y#h`), 'data:,a', 'with a second hash after');
	}

	assert.equal(normalizeUrl('data:,a#:~:text=xy'), 'data:,a', 'for contrast, with no line separator');
	assert.equal(normalizeUrl('data:,a#:~:text=xy', {stripTextFragment: false}), 'data:,a#:~:text=xy', 'and with the option off');
});

test('a quoted MIME parameter value that is a token is written without its quotes', () => {
	/*
	Quotes are transport syntax, so `charset="us-ascii"` is `charset=us-ascii`, which is the form written since it reads back the same.
	*/
	assert.equal(normalizeUrl('data:text/plain;charset="us-ascii",x'), 'data:,x');
	assert.equal(normalizeUrl('data:text/plain;charset="US-ASCII",x'), 'data:,x');
	assert.equal(normalizeUrl('data:text/plain;charset="utf-8",x'), 'data:text/plain;charset=utf-8,x');
	assert.equal(normalizeUrl('data:text/plain;charset="UTF-8",x'), 'data:text/plain;charset=utf-8,x');
	assert.equal(normalizeUrl('data:text/html;charset="us-ascii",x'), 'data:text/html;charset=us-ascii,x');
	assert.equal(normalizeUrl('data:text/plain;a="b",x'), 'data:text/plain;a=b,x');

	// A value that is not a token keeps its quotes, since a `;` or a space written bare would end the parameter or the media type on the next pass.
	assert.equal(normalizeUrl('data:text/plain;a="b;c",x'), 'data:text/plain;a="b;c",x');
	assert.equal(normalizeUrl('data:text/plain;a="b c",x'), 'data:text/plain;a="b c",x');
	assert.equal(normalizeUrl('data:text/plain;a="",x'), 'data:text/plain;a="",x');
	assert.equal(normalizeUrl('data:text/plain;charset="us-ascii;base64",x'), 'data:text/plain;charset="us-ascii;base64",x');

	// A quoted-pair is not a token character once unescaped, so these keep their quotes too.
	assert.equal(normalizeUrl(String.raw`data:text/plain;a="b\"c",x`), String.raw`data:text/plain;a="b\"c",x`);
	assert.equal(normalizeUrl(String.raw`data:text/plain;a="b\;c",x`), String.raw`data:text/plain;a="b\;c",x`);

	// And a browser reports the same media type for the quoted and the bare spelling.
	assert.equal(new URL('data:text/plain;charset="us-ascii",x').search, '');

	for (const url of [
		'data:text/plain;charset="us-ascii",x',
		'data:text/plain;charset="utf-8",x',
		'data:text/plain;a="b;c",x',
		'data:text/plain;a="b c",x',
		'data:text/plain;charset="us-ascii;base64",x',
		String.raw`data:text/plain;a="b\"c",x`,
	]) {
		assert.equal(normalizeUrl(url), normalizeUrl(normalizeUrl(url)), `${url} is a fixed point`);
	}
});

test('every spelling of a percent escape canonicalizes to one', () => {
	/*
	Every escape must be spelled the same way. The scan checks for a lowercase hexadecimal digit, so a digit then a letter, a letter then anything, and an uppercase then a lowercase letter are all covered.
	*/
	const letters = 'ABCDEF';
	for (const first of ['0', '1', '9', 'a', 'f', 'A', 'F', ...letters]) {
		for (const second of ['0', '9', 'a', 'f', 'A', 'F', ...letters]) {
			const escape = `%${first}${second}`;
			const expected = escape.toUpperCase();
			for (const url of [
				`http://example.com/a#b${escape}c`,
				`http://example.com/a${escape}b`,
				`http://example.com/?k=${escape}&v=1`,
				`http://example.com/?${escape}=1`,
				`data:,a${escape}b`,
			]) {
				assert.equal(normalizeUrl(url), normalizeUrl(url.replace(escape, () => expected)), `${escape} in ${url}`);
			}
		}
	}
});

test('an unterminated quoted value does not hide the base64 marker', () => {
	/*
	A browser checks if the whole media type ends in `;base64`, ignoring quotes. A parameter parse called these not base64 and output the base64 text instead of its bytes.
	*/
	for (const [mediaType, expected] of [
		['text/plain;a=";base64', 'text/plain;a=";base64'],
		['text/plain;a="x;base64', 'text/plain;a="x;base64'],
		['text/plain;a=="x;base64', 'text/plain;a=="x;base64'],
		[String.raw`text/plain;a="x\";base64`, String.raw`text/plain;a="x\";base64`],
		// The default charset still goes, and the marker is written back in its canonical case.
		['text/plain;charset=us-ascii;a=";base64', 'text/plain;a=";base64'],
		['text/plain;charset=us-ascii;a="x;BASE64', 'text/plain;a="x;base64'],
	]) {
		assert.equal(normalizeUrl(`data:${mediaType},QUJD`), `data:${expected},QUJD`, mediaType);
	}

	// And a value that really is quoted and closed still hides nothing, so the marker is still found.
	assert.equal(normalizeUrl('data:text/plain;name="a.png";base64,QUJD'), 'data:text/plain;name=a.png;base64,QUJD');
	assert.equal(normalizeUrl('data:text/plain;name="a;base64.png";base64,QUJD'), 'data:text/plain;name="a;base64.png";base64,QUJD');
	assert.equal(normalizeUrl('data:text/plain;a="b;c";base64,QUJD'), 'data:text/plain;a="b;c";base64,QUJD');

	for (const mediaType of ['text/plain;a=";base64', 'text/plain;a="x;base64', 'text/plain;a=="x;base64']) {
		assert.equal(normalizeUrl(`data:${mediaType},QUJD`), normalizeUrl(normalizeUrl(`data:${mediaType},QUJD`)), mediaType);
	}
});

test('an opaque path has its percent escapes canonicalized', () => {
	/*
	The hexadecimal digits of an escape are canonicalized in URL components, including an opaque path written on the string. MIME metadata contains literal percent-looking text instead. The escape stays, as the readme leaves decoding an opaque path to the parser.
	*/
	const options = {customProtocols: ['sindre']};
	for (const [spelling, canonical] of [
		['%7E', '%7E'],
		['%7e', '%7E'],
		['%2F', '%2F'],
		['%2f', '%2F'],
		['%3A', '%3A'],
		['%3a', '%3A'],
		['%c3%a9', '%C3%A9'],
		['%C3%A9', '%C3%A9'],
		['%e2%84%aa', '%E2%84%AA'],
		['%2%45', '%2%45'],
		['%41', '%41'],
	]) {
		assert.equal(normalizeUrl(`sindre:a${spelling}foo`, options), `sindre:a${canonical}foo`, spelling);
		assert.equal(normalizeUrl(`sindre:a/b${spelling}`, options), `sindre:a/b${canonical}`, spelling);
		assert.equal(normalizeUrl(`sindre:a${spelling}/`, options), `sindre:a${canonical}`, spelling);
		assert.equal(normalizeUrl(`sindre:a${spelling}?q=1`, options), `sindre:a${canonical}?q=1`, spelling);
		assert.equal(normalizeUrl(`sindre:a${spelling}#f`, options), `sindre:a${canonical}#f`, spelling);
		assert.equal(normalizeUrl(`sindre:a${spelling}?q=1#f`, options), `sindre:a${canonical}?q=1#f`, spelling);
	}

	// And a path with an authority still decodes its unreserved escapes, which is the difference the readme note draws.
	assert.equal(normalizeUrl('sindre://h/a%7Efoo', options), 'sindre://h/a~foo');
	assert.equal(normalizeUrl('sindre://h/a%2Ffoo', options), 'sindre://h/a%2Ffoo');
	assert.equal(normalizeUrl('sindre:a%7Efoo', options), 'sindre:a%7Efoo');
});

test('a protocol option is read however it is written', () => {
	/*
	Any number of trailing colons is accepted, so one too many does not silently do nothing.
	*/
	for (const entry of ['sindre', 'sindre:', 'sindre::', 'sindre:::', 'SINDRE', ' sindre ']) {
		assert.equal(normalizeUrl('sindre://www.sindresorhus.com/a/', {customProtocols: [entry]}), 'sindre://sindresorhus.com/a', entry);
		assert.equal(normalizeUrl('sindresorhus.com/a', {defaultProtocol: entry}), `${entry.trim().toLowerCase().replace(/(?<!:):+$/v, '')}://sindresorhus.com/a`, entry);
	}

	// A value that is not a scheme at all never matches a protocol, so dropping it changes nothing.
	for (const entry of ['a::b', '123', ':', '', 123, null, undefined, ['nested'], {}]) {
		assert.equal(normalizeUrl('sindre://www.sindresorhus.com/a/', {customProtocols: [entry]}), 'sindre://www.sindresorhus.com/a/', JSON.stringify(entry) ?? 'undefined');
	}
});

test('every documented option changes the output for some input', () => {
	/*
	A documented option that changes nothing is a bug, so every documented value of each option is tried.
	*/
	const probes = {
		defaultProtocol: [
			['//sindresorhus.com/a', 'http', 'https'],
			['//sindresorhus.com/a', 'https:', 'http:'],
			['//sindresorhus.com/a', '  https  ', 'http'],
		],
		customProtocols: [
			['sindre://www.sindresorhus.com/a/', undefined, ['sindre']],
			['sindre://www.sindresorhus.com/a/', ['other'], ['sindre']],
		],
		normalizeProtocol: [['//sindresorhus.com/a', true, false]],
		forceHttp: [['https://sindresorhus.com:8443/a', true, false]],
		forceHttps: [['http://sindresorhus.com:8080/a', true, false]],
		stripAuthentication: [['http://u:p@sindresorhus.com/a', true, false]],
		stripHash: [['http://sindresorhus.com/a#h', true, false]],
		stripProtocol: [['https://sindresorhus.com/a', true, false]],
		stripTextFragment: [['http://sindresorhus.com/a#:~:text=h', true, false]],
		stripWWW: [['http://www.sindresorhus.com/a', true, false]],
		removeQueryParameters: [
			['http://sindresorhus.com/?ref=1&b=2', undefined, ['ref']],
			['http://sindresorhus.com/?ref=1&b=2', undefined, true],
			['http://sindresorhus.com/?ref=1&b=2', true, false],
		],
		keepQueryParameters: [
			['http://sindresorhus.com/?a=1&b=2', undefined, ['b']],
			['http://sindresorhus.com/?a=1&b=2', ['nope'], ['b']],
		],
		removeTrailingSlash: [['http://sindresorhus.com/a/', true, false]],
		removeSingleSlash: [['http://sindresorhus.com/', true, false]],
		removeDirectoryIndex: [
			['http://sindresorhus.com/a/index.html', true, false],
			['http://sindresorhus.com/a/index.html', undefined, ['index.html']],
			['http://sindresorhus.com/a/default.php', undefined, [/^default\.[a-z]+$/v]],
		],
		removeExplicitPort: [['http://sindresorhus.com:8080/a', true, false]],
		sortQueryParameters: [['http://sindresorhus.com/?b=2&a=1', true, false]],
		emptyQueryValue: [
			['http://sindresorhus.com/?a', 'preserve', 'always'],
			['http://sindresorhus.com/?a', 'always', 'never'],
		],
		removePath: [['http://sindresorhus.com/a/b', true, false]],
		transformPath: [
			['http://sindresorhus.com/a/b/c', false, pathComponents => pathComponents.slice(0, 1)],
			['http://sindresorhus.com/a/b/c', undefined, () => undefined],
		],
	};

	/*
	The probes must cover every option the readme and the type definitions declare, or a new one goes unchecked.
	*/
	const readme = fs.readFileSync(new URL('readme.md', import.meta.url), 'utf8');
	const typeDefinitions = fs.readFileSync(new URL('index.d.ts', import.meta.url), 'utf8');
	const readmeOptions = readme.split('\n').filter(line => line.startsWith('##### ')).map(line => line.slice(6).trim());
	const declaredOptions = typeDefinitions.split('\n')
		.map(line => /^\s*readonly (?<name>\w+)\?/v.exec(line)?.groups.name)
		.filter(Boolean);
	const probed = Object.keys(probes).toSorted(compareCodeUnits);

	assert.deepEqual(readmeOptions.toSorted(compareCodeUnits), probed, 'the readme options and the probed ones differ');
	assert.deepEqual(declaredOptions.toSorted(compareCodeUnits), probed, 'the declared options and the probed ones differ');

	for (const [option, entries] of Object.entries(probes)) {
		for (const [url, first, second] of entries) {
			assert.notEqual(
				normalizeUrl(url, {[option]: second}),
				normalizeUrl(url, {[option]: first}),
				`\`${option}\` had no effect on ${url} with ${JSON.stringify(second)}`,
			);
		}
	}
});

test('an unreserved escape is decoded in userinfo, paths and queries', () => {
	/*
	Unreserved escapes are decoded in userinfo, hierarchical paths, queries and data URL payloads. Fragments stay encoded to avoid creating text directives, and MIME metadata contains literal percent-looking text.
	*/
	const characters = [['%7E', '~'], ['%7e', '~'], ['%41', 'A'], ['%61', 'a'], ['%30', '0'], ['%2D', '-'], ['%2E', '.'], ['%5F', '_']];
	const components = [
		['userinfo', piece => `http://u${piece}s@x.com/`, {stripAuthentication: false}],
		['password', piece => `http://u:p${piece}w@x.com/`, {stripAuthentication: false}],
		['path', piece => `http://x.com/a${piece}b`],
		['query value', piece => `http://x.com/?a=v${piece}w`],
		['query key', piece => `http://x.com/?${piece}=1`],
		['data', piece => `data:,a${piece}b`],
	];

	for (const [component, build, options] of components) {
		for (const [escape, literal] of characters) {
			assert.equal(
				normalizeUrl(build(escape), options),
				normalizeUrl(build(literal), options),
				`${component}: ${escape}`,
			);
		}
	}

	/*
	Media type escapes stay, so an escaped `text/plain` is not the default type and an escaped `base64` is not the marker.
	*/
	for (const escape of ['%74', '%7E', '%2f', '%2F', '%7e']) {
		assert.equal(normalizeUrl(`data:${escape}ext/plain,x`), `data:${escape.toLowerCase()}ext/plain,x`, `${escape} in a media type`);
		assert.equal(normalizeUrl(`data:text/html;charset=${escape}utf-8,x`), `data:text/html;charset=${escape.toLowerCase()}utf-8,x`, `${escape} in a parameter value`);
	}
});

test('every percent escape stays encoded in fragments', () => {
	for (let value = 0; value < 256; value++) {
		const escape = `%${value.toString(16).toUpperCase().padStart(2, '0')}`;
		for (const prefix of ['http://x.com/a', 'data:,a']) {
			for (const spelling of [escape, escape.toLowerCase()]) {
				for (const stripTextFragment of [true, false]) {
					assert.equal(normalizeUrl(`${prefix}#b${spelling}c`, {stripTextFragment}), `${prefix}#b${escape}c`);
				}
			}
		}
	}
});

test('percent-looking text stays as spelled in MIME parameter values', () => {
	for (let value = 0; value < 256; value++) {
		const escape = `%${value.toString(16).toUpperCase().padStart(2, '0')}`;
		for (const spelling of [escape, escape.toLowerCase()]) {
			const input = `data:application/octet-stream;name=a${spelling}b,x`;
			assert.equal(normalizeUrl(input), input);
		}
	}
});

test('decoding a percent escape cannot join into a new one', () => {
	/*
	Where unreserved escapes are decoded, a `%` that starts no escape becomes `%25`, so decoding cannot join it into a new escape. Fragments stay encoded and need no such protection.
	*/
	assert.equal(normalizeUrl('http://x.com/p#%2%45'), 'http://x.com/p#%2%45');
	assert.equal(normalizeUrl('http://x.com/p#%2%2E'), 'http://x.com/p#%2%2E');
	assert.equal(normalizeUrl('http://x.com/p#%3%41'), 'http://x.com/p#%3%41');
	assert.equal(normalizeUrl('http://u%2%45s:pw@x.com/p', {stripAuthentication: false}), 'http://u%252Es:pw@x.com/p');
	assert.equal(normalizeUrl('data:,a%2%45b'), 'data:,a%252Eb');
	assert.equal(normalizeUrl('data:,a#b%2%45c'), 'data:,a#b%2%45c');
	assert.equal(normalizeUrl('data:,a%2%45b'), 'data:,a%252Eb');

	// A `%` with nothing that could join to it is left alone, so the common spellings do not change.
	assert.equal(normalizeUrl('http://x.com/p#%'), 'http://x.com/p#%');
	assert.equal(normalizeUrl('http://x.com/p#50%'), 'http://x.com/p#50%');
	assert.equal(normalizeUrl('http://x.com/p#%zz'), 'http://x.com/p#%zz');
	assert.equal(normalizeUrl('data:,%'), 'data:,%');

	/*
	Where unreserved escapes are decoded, a `%` right before an escape also becomes `%25`, since decoding can leave a hexadecimal digit beside it. Fragments keep both the `%` and the escape.
	*/
	assert.equal(normalizeUrl('http://x.com/p#%%41'), 'http://x.com/p#%%41');
	assert.equal(normalizeUrl('http://x.com/p#%%41B'), 'http://x.com/p#%%41B');
	assert.equal(normalizeUrl('http://x.com/p#%%30'), 'http://x.com/p#%%30');
	assert.equal(normalizeUrl('http://x.com/p#%%61'), 'http://x.com/p#%%61');
	assert.equal(normalizeUrl('http://x.com/p#%%4F'), 'http://x.com/p#%%4F');
	assert.equal(normalizeUrl('http://x.com/p#%%7e'), 'http://x.com/p#%%7E');
	assert.equal(normalizeUrl('data:,a%%41b'), 'data:,a%25Ab');
	assert.equal(normalizeUrl('data:,a#b%%41c'), 'data:,a#b%%41c');
	assert.equal(normalizeUrl('http://u%%41:pw@x.com/p', {stripAuthentication: false}), 'http://u%25A:pw@x.com/p');

	/*
	An escape in a fragment is only canonicalized, so a `%` beside it stays regardless of which character the escape represents.
	*/
	assert.equal(normalizeUrl('http://x.com/p#%%3d'), 'http://x.com/p#%%3D');
	assert.equal(normalizeUrl('http://x.com/p#%%2F'), 'http://x.com/p#%%2F');
	assert.equal(normalizeUrl('http://x.com/p#%%zz'), 'http://x.com/p#%%zz');
	assert.equal(normalizeUrl('http://x.com/p#%%'), 'http://x.com/p#%%');

	for (const url of ['http://x.com/p#%%41', 'http://x.com/p#%%41B', 'http://x.com/p#%%4F', 'http://x.com/p#%%3d', 'http://x.com/p#%%2F', 'data:,a%%41b', 'data:,a#b%%41c']) {
		assert.equal(normalizeUrl(normalizeUrl(url)), normalizeUrl(url), `a fixed point: ${url}`);
	}

	/*
	Every byte value, so the edges are pinned: a `%` beside `-`, `.`, `_`, `~`, `@`, `[`, a backtick or `{` is left alone.
	*/
	for (let value = 0; value < 256; value++) {
		const escape = `%${value.toString(16).toUpperCase().padStart(2, '0')}`;
		const isUnreservedHexDigit = (value >= 0x30 && value <= 0x39) || (value >= 0x41 && value <= 0x46) || (value >= 0x61 && value <= 0x66);
		assert.equal(normalizeUrl(`data:,%${escape}`).startsWith('data:,%25'), isUnreservedHexDigit, `0x${value.toString(16).toUpperCase().padStart(2, '0')}`);
	}
});

test('base64 data that ends in a control is written as an escape', () => {
	/*
	A URL processor strips only tab, line feed, form feed, carriage return and space from base64 data, so another C0 control is data and is escaped. Raw, the input trim would take it off on the next pass.
	*/
	for (const [name, character, escape] of [
		['null', '\u{0}', '%00'],
		['start of heading', '\u{1}', '%01'],
		['vertical tab', '\u{B}', '%0B'],
		['unit separator', '\u{1F}', '%1F'],
	]) {
		assert.equal(normalizeUrl(`data:;base64,QUJD${character}#`), `data:;base64,QUJD${escape}`, `a bare media type: ${name}`);
		assert.equal(normalizeUrl(`data:text/plain;base64,QUJD${character}#`), `data:text/plain;base64,QUJD${escape}`, `a named media type: ${name}`);
	}

	/*
	A forgiving decode must leave invalid base64 invalid rather than repair it into something a browser reads.
	*/
	for (const character of ['\u{0}', '\u{1}', '\u{1F}']) {
		const input = `data:;base64,ab${character}#`;
		const output = normalizeUrl(input);
		assert.equal(normalizeUrl(output), output, `a fixed point: ${input}`);
		assert.match(output, /%[\dA-F]{2}$/v, `written as an escape: ${input}`);
	}

	/*
	The non-base64 case already escaped a control. This is the base64 case that missed the rule.
	*/
	assert.equal(normalizeUrl('data:,ab\u{1F}#'), 'data:,ab%1F');
	assert.equal(normalizeUrl('data:;base64,QUJD\u{1F}'), 'data:;base64,QUJD');
});

test('a quoted charset in front of a base64 parameter is not dropped', () => {
	/*
	Dropping the default charset must not leave the bare `base64` marker at the end, so it is kept. The comparison is over parsed parameters, or `charset="us-ascii"` would be missed.
	*/
	for (const [input, output] of [
		['data:text/plain;base64;charset="us-ascii",aGVsbG8=', 'data:text/plain;base64;charset=us-ascii,aGVsbG8='],
		['data:text/plain;base64;charset="US-ASCII",aGVsbG8=', 'data:text/plain;base64;charset=us-ascii,aGVsbG8='],
		['data:text/plain;charset="us-ascii";base64,aGVsbG8=', 'data:text/plain;base64,aGVsbG8='],
		['data:;base64;charset="us-ascii",aGVsbG8=', 'data:;base64;charset=us-ascii,aGVsbG8='],
	]) {
		assert.equal(normalizeUrl(input), output, `the charset is kept: ${input}`);
		assert.equal(normalizeUrl(output), output, `a fixed point: ${input}`);
	}

	/*
	A value that is not the default is left alone. A quoted token loses its quotes, but a quoted value with a leading space is not a token and keeps them.
	*/
	assert.equal(normalizeUrl('data:text/plain;base64;charset="utf-8",aGVsbG8='), 'data:text/plain;base64;charset=utf-8,aGVsbG8=');
	assert.equal(normalizeUrl('data:text/plain;base64;charset=" us-ascii",aGVsbG8='), 'data:text/plain;base64;charset=" us-ascii",aGVsbG8=');

	/*
	A `base64` with a value is an ordinary parameter, so the charset is dropped as usual.
	*/
	assert.equal(normalizeUrl('data:text/plain;base64=,aGVsbG8='), 'data:text/plain;base64=,aGVsbG8=');
	assert.equal(normalizeUrl('data:text/plain;base64=1;charset=us-ascii,aGVsbG8='), 'data:text/plain;base64=1,aGVsbG8=');
	assert.equal(normalizeUrl('data:text/html;base64=1;charset=us-ascii,aGVsbG8='), 'data:text/html;base64=1;charset=us-ascii,aGVsbG8=');
});

test('a repeated query key keeps its order whatever else is in the search', () => {
	/*
	The order of a repeated key can matter, so `?a=1&a=2` and `?a=2&a=1` differ. An encoded reserved character once took another code path, so the order must not depend on it.
	*/
	assert.equal(normalizeUrl('http://x.com/?a=2&a=1'), 'http://x.com/?a=2&a=1');
	assert.equal(normalizeUrl('http://x.com/?b=2&a=2&a=1'), 'http://x.com/?a=2&a=1&b=2');
	assert.equal(normalizeUrl('http://x.com/?a=2&a=1&z=%2F'), 'http://x.com/?a=2&a=1&z=%2F');
	assert.equal(normalizeUrl('http://x.com/?a=2&a=1&z=%3A'), 'http://x.com/?a=2&a=1&z=%3A');
	assert.equal(normalizeUrl('http://x.com/?a=2&a=1&z=1'), 'http://x.com/?a=2&a=1&z=1');

	/*
	The sort reads the decoded key, so an encoded reserved character sorts as itself, and `:` is below `a`.
	*/
	assert.equal(normalizeUrl('http://x.com/?%3A=1&a=2'), 'http://x.com/?%3A=1&a=2');
	assert.equal(normalizeUrl('http://x.com/?%3A=1&a=2&z=%2F'), 'http://x.com/?%3A=1&a=2&z=%2F');

	for (const url of ['http://x.com/?a=2&a=1', 'http://x.com/?a=2&a=1&z=%2F', 'http://x.com/?%3A=1&a=2&z=%2F']) {
		assert.equal(normalizeUrl(normalizeUrl(url)), normalizeUrl(url), `a fixed point: ${url}`);
	}
});

test('a text fragment strip leaves the hashes the fragment has', () => {
	/*
	Only a `#` at the start of the fragment is part of the delimiter, so `#a#:~:text=x` keeps its second `#`.
	*/
	assert.equal(normalizeUrl('http://sindresorhus.com/about#a#:~:text=hello'), 'http://sindresorhus.com/about#a#');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#a#:~:text=hello', {stripTextFragment: false}), 'http://sindresorhus.com/about#a#:~:text=hello');
	assert.equal(normalizeUrl('data:,foo#a#:~:text=x'), 'data:,foo#a#');
	assert.equal(normalizeUrl('http://sindresorhus.com/about#a#'), 'http://sindresorhus.com/about#a#');

	// Two hashes in a row are content too, so the strip leaves both and the result is a fixed point.
	assert.equal(normalizeUrl('http://sindresorhus.com/about##:~:text=hello'), 'http://sindresorhus.com/about##');
	assert.equal(normalizeUrl('http://sindresorhus.com/about/p##:~:text=hello'), 'http://sindresorhus.com/about/p##');
	assert.equal(normalizeUrl('data:,foo##:~:text=x'), 'data:,foo##');

	for (const url of ['http://sindresorhus.com/about##:~:text=hello', 'http://sindresorhus.com/about#a#:~:text=hello', 'data:,foo#a#:~:text=x', 'data:,foo##:~:text=x']) {
		assert.equal(normalizeUrl(url), normalizeUrl(normalizeUrl(url)), url);
	}
});

test('a letter that case-folds to one in a pattern is not that letter', () => {
	// With the `v` or `u` flag, a case-insensitive `s` also matches U+017F, and `\w` also matches U+212A, which a browser and a server do not read as `s` or `k`.
	assert.equal(normalizeUrl('data:;ba\u{17F}e64,QUJD'), 'data:;ba\u{17F}e64,QUJD');
	assert.equal(normalizeUrl('http://sindresorhus.com/?utm_\u{17F}=1&utm_\u{212A}=1'), 'http://sindresorhus.com/?utm_%C5%BF=1&utm_%E2%84%AA=1');
	// A transform can put one before a `://`, which is then not a protocol whose slashes are kept.
	assert.equal(normalizeUrl('http://sindresorhus.com/a', {transformPath: () => ['\u{17F}3://b//c/']}), 'http://sindresorhus.com/%C5%BF3:/b/c');
	assert.throws(() => {
		normalizeUrl('sindresorhus.com', {defaultProtocol: '\u{17F}'});
	}, {name: 'TypeError', message: /defaultProtocol/v});
});

test('the documented limitations hold', () => {
	// The query is written through `URLSearchParams` whatever the options, so an escape that is not valid UTF-8 becomes U+FFFD.
	assert.equal(normalizeUrl('https://example.com/?q=%E9', {sortQueryParameters: false}), 'https://example.com/?q=%EF%BF%BD');

	// A `defaultProtocol` other than `https` and `http` normalizes the URL it creates, while the same URL written with it is passed through.
	assert.equal(normalizeUrl('example.com/a//b', {defaultProtocol: 'ftp'}), 'ftp://example.com/a/b');
	assert.equal(normalizeUrl('ftp://example.com/a//b'), 'ftp://example.com/a//b');
	assert.equal(normalizeUrl('ftp://example.com/a//b', {customProtocols: ['ftp']}), 'ftp://example.com/a/b');
});
