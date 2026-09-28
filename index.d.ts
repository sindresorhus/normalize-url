export type Options = {
	/**
	Any protocol, though `'https'` and `'http'` are the ones to use. A value that is not a scheme is ignored
	and the default applies, and the legacy trailing colon is accepted too.

	@default 'http'
	*/
	readonly defaultProtocol?: string;

	/**
	Protocols to normalize in addition to the built-in ones (`https`, `http`, `file`, `data`).

	Useful for HTTP-like custom protocols such as Electron schemes or app-specific protocols.

	The protocols should be specified without `:`, though a trailing one is accepted however many there are, and the name is matched without regard to case.

	__Note:__ Options that rewrite the path (`removePath`, `transformPath`, `removeDirectoryIndex`, and the percent-decoding of the path) only apply when the path starts with a `/`, as in `sindre://host/a/b` and `sindre:/a/b`. A URL whose path is opaque, such as `sindre:a/b`, has no segments for those options to work on, and a URL parser does not let the library change it, so they are silently ignored for it.

	__Note:__ `transformPath` and `removeDirectoryIndex` rebuild the path from its components, which cannot spell the two slashes of a protocol lookalike such as `sindre://host/a/s3://b/index.html`. One of them is dropped for those two options, while the library keeps both everywhere else.

	__Note:__ a duplicate slash in a path is removed whatever `removeTrailingSlash` says, since that option is about a slash at the end of the path and not about the ones in the middle of it.

	@default undefined

	@example
	```
		normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre']});
		//=> 'sindre://sorhus.com'

		normalizeUrl('sindre://www.sorhus.com/foo/', {customProtocols: ['sindre']});
		//=> 'sindre://sorhus.com/foo'
	```
	*/
	readonly customProtocols?: readonly string[];

	/**
	Prepends `defaultProtocol` to the URL if it's protocol-relative.

	@default true

	@example
	```
		normalizeUrl('//sindresorhus.com');
		//=> 'http://sindresorhus.com'

		normalizeUrl('//sindresorhus.com', {normalizeProtocol: false});
		//=> '//sindresorhus.com'
	```
	*/
	readonly normalizeProtocol?: boolean;

	/**
	Normalizes HTTPS URLs to HTTP.

	@default false

	__Note:__ changing the scheme drops the port that was the default one for the old scheme, so `forceHttp` turns `https://example.com:443` into `http://example.com` and `forceHttps` turns `http://example.com:80` into `https://example.com`. A port that is not a default for either scheme is kept.

	@example
	```
		normalizeUrl('https://sindresorhus.com');
		//=> 'https://sindresorhus.com'

		normalizeUrl('https://sindresorhus.com', {forceHttp: true});
		//=> 'http://sindresorhus.com'
	```
	*/
	readonly forceHttp?: boolean;

	/**
	Normalizes HTTP URLs to HTTPS.

	This option cannot be used with the `forceHttp` option at the same time.

	@default false

	__Note:__ changing the scheme drops the port that was the default one for the old scheme, so `forceHttp` turns `https://example.com:443` into `http://example.com` and `forceHttps` turns `http://example.com:80` into `https://example.com`. A port that is not a default for either scheme is kept.

	@example
	```
		normalizeUrl('http://sindresorhus.com');
		//=> 'http://sindresorhus.com'

		normalizeUrl('http://sindresorhus.com', {forceHttps: true});
		//=> 'https://sindresorhus.com'
	```
	*/
	readonly forceHttps?: boolean;

	/**
	Strip the [authentication](https://en.wikipedia.org/wiki/Basic_access_authentication) part of a URL.

	@default true

	@example
	```
		normalizeUrl('https://user:password@sindresorhus.com');
		//=> 'https://sindresorhus.com'

		normalizeUrl('https://user:password@sindresorhus.com', {stripAuthentication: false});
		//=> 'https://user:password@sindresorhus.com'
	```
	*/
	readonly stripAuthentication?: boolean;

	/**
	Removes hash from the URL.

	@default false

	@example
	```
		normalizeUrl('sindresorhus.com/about.html#contact');
		//=> 'http://sindresorhus.com/about.html#contact'

		normalizeUrl('sindresorhus.com/about.html#contact', {stripHash: true});
		//=> 'http://sindresorhus.com/about.html'
	```
	*/
	readonly stripHash?: boolean;

	/**
	Remove the protocol from the URL: `http://sindresorhus.com` → `sindresorhus.com`.

	It will only remove `https://` and `http://` protocols.

	__Note:__ The result is not a full URL, so normalizing it again can change it: a port that the removed protocol kept is the default one of the protocol that gets prepended next.

	@default false

	@example
	```
		normalizeUrl('https://sindresorhus.com');
		//=> 'https://sindresorhus.com'

		normalizeUrl('https://sindresorhus.com', {stripProtocol: true});
		//=> 'sindresorhus.com'
	```
	*/
	readonly stripProtocol?: boolean;

	/**
	Strip the [text fragment](https://web.dev/text-fragments/) part of the URL

	__Note:__ The text fragment will always be removed if the `stripHash` option is set to `true`, as the hash contains the text fragment.

	@default true

	@example
	```
		normalizeUrl('http://sindresorhus.com/about.html#:~:text=hello');
		//=> 'http://sindresorhus.com/about.html'

		normalizeUrl('http://sindresorhus.com/about.html#section:~:text=hello');
		//=> 'http://sindresorhus.com/about.html#section'

		normalizeUrl('http://sindresorhus.com/about.html#:~:text=hello', {stripTextFragment: false});
		//=> 'http://sindresorhus.com/about.html#:~:text=hello'

		normalizeUrl('http://sindresorhus.com/about.html#section:~:text=hello', {stripTextFragment: false});
		//=> 'http://sindresorhus.com/about.html#section:~:text=hello'
	```
	*/
	readonly stripTextFragment?: boolean;

	/**
	Removes `www.` from the URL. A trailing dot on a domain hostname is removed as well, since the name and
	the one it spells are the same, unless doing so would change the name, as it would for `159.189.213..`,
	which a URL parser reads as the address `159.189.0.213`. The host of a custom protocol is opaque
	rather than a domain, so a dot there is a character of the name and is left alone.

	__Note:__ A `www.` that is not followed by a proper domain is left alone, so `www.com` and `www.a.b` are not changed.

	@default true

	@example
	```
		normalizeUrl('http://www.sindresorhus.com');
		//=> 'http://sindresorhus.com'

		normalizeUrl('http://www.sindresorhus.com', {stripWWW: false});
		//=> 'http://www.sindresorhus.com'
	```
	*/
	readonly stripWWW?: boolean;

	/**
	Removes query parameters that matches any of the provided strings or regexes. The match is against the percent-decoded key, the way `URLSearchParams` reads one, so `+` is a space and `%2F` is a slash: write `a/b` rather than `a%2Fb`.

	Global and sticky regex flags are stripped.

	@default [/^utm_\w+/i]

	@example
	```
		normalizeUrl('www.sindresorhus.com?foo=bar&ref=test_ref', {
			removeQueryParameters: ['ref']
		});
		//=> 'http://sindresorhus.com/?foo=bar'
	```

	If a boolean is provided, `true` will remove all the query parameters.

	```
		normalizeUrl('www.sindresorhus.com?foo=bar', {
			removeQueryParameters: true
		});
		//=> 'http://sindresorhus.com'
	```

	`false` will not remove any query parameter.

	```
		normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', {
			removeQueryParameters: false
		});
		//=> 'http://sindresorhus.com/?foo=bar&ref=test_ref&utm_medium=test'
	```
	*/
	readonly removeQueryParameters?: ReadonlyArray<RegExp | string> | boolean;

	/**
	Keeps only query parameters that matches any of the provided strings or regexes. The match is against the percent-decoded key, the same as `removeQueryParameters`.

	__Note__: It overrides the `removeQueryParameters` option.

	Global and sticky regex flags are stripped.

	@default undefined

	@example
	```
		normalizeUrl('https://sindresorhus.com?foo=bar&ref=unicorn', {
			keepQueryParameters: ['ref']
		});
		//=> 'https://sindresorhus.com/?ref=unicorn'
	```
	*/
	readonly keepQueryParameters?: ReadonlyArray<RegExp | string>;

	/**
	Removes trailing slash.

	__Note__: Trailing slash is always removed if the URL doesn't have a pathname unless the `removeSingleSlash` option is set to `false`.

	@default true

	@example
	```
		normalizeUrl('http://sindresorhus.com/redirect/');
		//=> 'http://sindresorhus.com/redirect'

		normalizeUrl('http://sindresorhus.com/redirect/', {removeTrailingSlash: false});
		//=> 'http://sindresorhus.com/redirect/'

		normalizeUrl('http://sindresorhus.com/', {removeTrailingSlash: false});
		//=> 'http://sindresorhus.com'
	```
	*/
	readonly removeTrailingSlash?: boolean;

	/**
	Remove a sole `/` pathname in the output. This option is independent of `removeTrailingSlash`.

	@default true

	@example
	```
		normalizeUrl('https://sindresorhus.com/');
		//=> 'https://sindresorhus.com'

		normalizeUrl('https://sindresorhus.com/', {removeSingleSlash: false});
		//=> 'https://sindresorhus.com/'
	```
	*/
	readonly removeSingleSlash?: boolean;

	/**
	Removes the default directory index file from path that matches any of the provided strings or regexes. The match is against the percent-decoded component, the same as `transformPath` is given, so `index.html` matches a path spelled `index%2Ehtml`.

	When `true`, the regex `/^index\.[a-z]+$/` is used.

	Global and sticky regex flags are stripped.

	@default false

	@example
	```
		normalizeUrl('www.sindresorhus.com/foo/default.php', {
			removeDirectoryIndex: [/^default\.[a-z]+$/]
		});
		//=> 'http://sindresorhus.com/foo'
	```
	*/
	readonly removeDirectoryIndex?: boolean | ReadonlyArray<RegExp | string>;

	/**
	Removes an explicit port number from the URL.

	Port 443 is always removed from HTTPS URLs and 80 is always removed from HTTP URLs regardless of this option.

	@default false

	@example
	```
		normalizeUrl('sindresorhus.com:123', {
			removeExplicitPort: true
		});
		//=> 'http://sindresorhus.com'
	```
	*/
	readonly removeExplicitPort?: boolean;

	/**
	Sorts the query parameters by key, in code unit order, so an uppercase letter sorts before a lowercase
	one and a digit before a letter. Parameters that share a key keep the order they were written in, since
	for a repeated key the order can be what the server reads.

	__Note:__ The option only changes the order. The parameters are still normalized, the same as when the option is on, so a space in a value is written as `+`, a space in a key as `%20`, and a lone `%` as `%25`.

	@default true

	@example
	```
		normalizeUrl('www.sindresorhus.com?b=two&a=one&c=three', {
			sortQueryParameters: false
		});
		//=> 'http://sindresorhus.com/?b=two&a=one&c=three'
	```
	*/
	readonly sortQueryParameters?: boolean;

	/**
	Controls how query parameters with empty values are formatted.

	- `'preserve'` - Keep the original format (`?key` stays `?key`, `?key=` stays `?key=`). If the same key appears with both formats (`?a&a=`), all instances will use the format without `=`. - `'always'` - Always include `=` for empty values (`?key` becomes `?key=`) - `'never'` - Never include `=` for empty values (`?key=` becomes `?key`)

	A value outside the three behaves as `'preserve'`.

	@default 'preserve'

	@example
	```
		normalizeUrl('www.sindresorhus.com?a&b=', {emptyQueryValue: 'always'});
		//=> 'http://sindresorhus.com/?a=&b='

		normalizeUrl('www.sindresorhus.com?a&b=', {emptyQueryValue: 'never'});
		//=> 'http://sindresorhus.com/?a&b'
	```
	*/
	readonly emptyQueryValue?: 'preserve' | 'always' | 'never';

	/**
	Removes the entire URL path, leaving the host with no path. The query and the hash stay. It takes precedence over the `transformPath` option.

	@default false

	@example
	```
		normalizeUrl('https://example.com/path/to/page', {
			removePath: true
		});
		//=> 'https://example.com'
	```
	*/
	readonly removePath?: boolean;

	/**
	Custom function to transform the URL path components.

	The function receives an array of non-empty path components and should return a modified array. Returning nothing removes the path. The array it returns is only read, so a frozen one is as good as a mutable one. The components are percent-decoded, so an unreserved escape has become the character it stands for by the time the function sees it, and one it returns is not decoded again.

	@default false

	@example
	```
		// Keep only the first path component
		normalizeUrl('https://example.com/api/v1/users', {
			transformPath: (pathComponents) => pathComponents.slice(0, 1)
		});
		//=> 'https://example.com/api'

		// Remove specific components
		normalizeUrl('https://example.com/admin/users', {
			transformPath: (pathComponents) => pathComponents.filter(c => c !== 'admin')
		});
		//=> 'https://example.com/users'
	```
	*/
	readonly transformPath?: ((pathComponents: string[]) => readonly string[] | undefined) | false;
};

/**
[Normalize](https://en.wikipedia.org/wiki/URL_normalization) a URL.

URLs with custom protocols are not normalized and just passed through by default. Supported protocols are: `https`, `http`, `file`, and `data`. Use the `customProtocols` option to add support for additional protocols.

Human-friendly URLs with basic auth (for example, `user:password@sindresorhus.com`) are not handled because basic auth conflicts with custom protocols. [Basic auth URLs are also deprecated.](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#access_using_credentials_in_the_url)

@param url - URL to normalize, including [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).

@example
```
import normalizeUrl from 'normalize-url';

normalizeUrl('sindresorhus.com');
//=> 'http://sindresorhus.com'

normalizeUrl('//www.sindresorhus.com:80/../baz?b=bar&a=foo');
//=> 'http://sindresorhus.com/baz?a=foo&b=bar'
```
*/
export default function normalizeUrl(url: string, options?: Options): string;
