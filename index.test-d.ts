import {expectType} from 'tsd';
import normalizeUrl from './index.js';

expectType<string>(normalizeUrl('sindresorhus.com'));
expectType<string>(normalizeUrl('HTTP://xn--xample-hva.com:80/?b=bar&a=foo'));

normalizeUrl('//sindresorhus.com:80/', {defaultProtocol: 'https'});
normalizeUrl('//sindresorhus.com:80/', {defaultProtocol: 'https:'});
normalizeUrl('//sindresorhus.com:80/', {normalizeProtocol: false});
normalizeUrl('https://sindresorhus.com:80/', {forceHttp: true});
normalizeUrl('http://sindresorhus.com:80/', {forceHttps: true});
normalizeUrl('user:password@sindresorhus.com', {stripAuthentication: false});
normalizeUrl('sindresorhus.com/about.html#contact', {stripHash: true});
normalizeUrl('https://sindresorhus.com', {stripProtocol: true});
normalizeUrl('http://www.sindresorhus.com', {stripWWW: false}); // eslint-disable-line @typescript-eslint/naming-convention
normalizeUrl('www.sindresorhus.com?foo=bar&ref=test_ref', {
	removeQueryParameters: ['ref', /test/],
});
normalizeUrl('www.sindresorhus.com?foo=bar', {
	removeQueryParameters: true,
});
normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', {
	removeQueryParameters: false,
});
normalizeUrl('www.sindresorhus.com?foo=bar&ref=test_ref', {
	keepQueryParameters: ['ref', /test/],
});
normalizeUrl('http://sindresorhus.com/', {removeTrailingSlash: false});
normalizeUrl('http://sindresorhus.com/', {removeSingleSlash: false});
normalizeUrl('www.sindresorhus.com/foo/default.php', {
	removeDirectoryIndex: [/^default\.[a-z]+$/, 'foo'],
});
normalizeUrl('www.sindresorhus.com/', {removeExplicitPort: false});
normalizeUrl('www.sindresorhus.com?b=two&a=one&c=three', {
	sortQueryParameters: false,
});
normalizeUrl('www.sindresorhus.com/about#:~:text=hello', {
	stripTextFragment: false,
});
normalizeUrl('https://sindresorhus.com/api/v1', {transformPath: pathComponents => pathComponents.slice(0, 1)});
normalizeUrl('https://sindresorhus.com/api/v1', {transformPath: () => undefined});
// The documented default of `transformPath` is `false`, so it has to be assignable.
normalizeUrl('https://sindresorhus.com/api/v1', {transformPath: false});

// The runtime accepts any scheme as `defaultProtocol`.
normalizeUrl('//sindresorhus.com', {defaultProtocol: 'ws'});
normalizeUrl('//sindresorhus.com', {defaultProtocol: 'ftp'});
normalizeUrl('//sindresorhus.com', {defaultProtocol: 'git+ssh'});

// The components the transform returns are only read, so a frozen array is as good as a mutable one.
normalizeUrl('https://sindresorhus.com/a/b', {transformPath: pathComponents => Object.freeze(pathComponents.slice(0, 1))});
normalizeUrl('https://sindresorhus.com/a/b', {transformPath: () => Object.freeze([])});
