# normalize-url [![Coverage Status](https://codecov.io/gh/sindresorhus/normalize-url/branch/main/graph/badge.svg)](https://codecov.io/gh/sindresorhus/normalize-url)

> [Normalize](https://en.wikipedia.org/wiki/URL_normalization) a URL

Useful when you need to display, store, deduplicate, sort, compare, etc, URLs.

> [!NOTE]
> This package does **not** do URL sanitization. [Garbage in, garbage out.](https://en.wikipedia.org/wiki/Garbage_in,_garbage_out) If you use this in a server context and accept URLs as user input, it's up to you to protect against invalid URLs, [path traversal attacks](https://owasp.org/www-community/attacks/Path_Traversal), etc.

## Install

```sh
npm install normalize-url
```

## Usage

```js
import normalizeUrl from 'normalize-url';

normalizeUrl('sindresorhus.com');
//=> 'http://sindresorhus.com'

normalizeUrl('//www.sindresorhus.com:80/../baz?b=bar&a=foo');
//=> 'http://sindresorhus.com/baz?a=foo&b=bar'
```

## API

### normalizeUrl(url, options?)

URLs with custom protocols are not normalized and just passed through by default. Supported protocols are: `https`, `http`, `file`, and `data`. Use the [`customProtocols`](#customprotocols) option to add support for additional protocols.

Human-friendly URLs with basic auth (for example, `user:password@sindresorhus.com`) are not handled because basic auth conflicts with custom protocols. [Basic auth URLs are also deprecated.](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#access_using_credentials_in_the_url)

__Note:__ a scheme with a dot in it followed by `//` is a custom protocol, so it is passed through as well and nothing in the URL is normalized. `example.com/path` is a host and gets `http:` prepended, but `example.com://host/path` is a scheme named `example.com` and is left alone. Use the [`customProtocols`](#customprotocols) option to normalize one on purpose.

Whatever the options, a normalized URL also gets these changes:

- Tab, carriage return, and line feed are removed from anywhere, as a URL parser does. Whitespace and C0 controls are removed from the ends, including U+00A0 and a byte order mark, which are often left over from copying a URL. Other whitespace inside the URL is kept, and escaped where a URL parser escapes it.
- A URL parser lowercases the protocol. For a built-in protocol, it also lowercases the host, converts an internationalized host to Punycode, resolves `.` and `..` path segments, and removes a default port.
- Trailing dots are removed from a domain host, unless that changes the name: `159.189.213..` keeps them, since `159.189.213` is the IPv4 address `159.189.0.213`. The host of a custom protocol is opaque, so its dots are kept.
- Duplicate slashes in the path are removed, except the two of a protocol-like segment such as `/https://`.
- Percent escapes are uppercased (`%2f` → `%2F`), except in the media type of a data URL, where percent-looking text is literal MIME content. Escapes of unreserved characters (letters, digits, `-`, `.`, `_`, `~`) are decoded (`%7E` → `~`), except in a fragment, the media type of a data URL, the host of a custom protocol, and a path that does not start with `/`. Fragment escapes stay encoded so they cannot become text directives. The path and the query also decode other escapes where the character means the same unescaped, as in `%5B` → `[`. Escapes that would change the structure, like `%2F`, `%3F`, `%23`, and `%26`, stay escaped, so `%2F` and `/` stay different.
- The query is written the way `URLSearchParams` writes it: a space in a value is `+`, a space in a key is `%20`, a `?` is `%3F`, and a `%` that starts no escape is `%25`. Empty parameters, as in `?a=1&&b=2`, are removed.
- A data URL gets its MIME type and `charset` value lowercased. `text/plain` is removed when nothing follows it, and so is `charset=us-ascii` on `text/plain`. Quotes are removed from a parameter value that does not need them, and whitespace is removed from the ends of base64 data.

#### url

Type: `string`

URL to normalize, including [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).

#### options

Type: `object`

##### defaultProtocol

Type: `string`\
Default: `'http'`

Any protocol is accepted, and a trailing colon is stripped however many there are, so `'https:'` and `'https::'` both name it. A value that is not a scheme, such as `'https://'`, throws a `TypeError`.

##### customProtocols

Type: `string[]`\
Default: `undefined`

Protocols to normalize in addition to the built-in ones (`https`, `http`, `file`, `data`).

Useful for HTTP-like custom protocols such as Electron schemes or app-specific protocols.

The protocols should be specified without `:`, though a trailing one is accepted however many there are, and the name is matched without regard to case.

__Note:__ Options that rewrite the path (`removePath`, `transformPath`, `removeDirectoryIndex`, and the percent-decoding of the path) only apply when the path starts with a `/`, as in `sindre://host/a/b` and `sindre:/a/b`. A URL whose path is opaque, such as `sindre:a/b`, has no segments for those options to work on, and a URL parser does not let the library change it, so they are silently ignored for it.

__Note:__ `transformPath` and `removeDirectoryIndex` rebuild the path from its components, which cannot spell the two slashes of a protocol lookalike such as `sindre://host/a/s3://b/index.html`. One of them is dropped for those two options, while the library keeps both everywhere else.

```js
normalizeUrl('sindre://www.sorhus.com', {customProtocols: ['sindre']});
//=> 'sindre://sorhus.com'

normalizeUrl('sindre://www.sorhus.com/foo/', {customProtocols: ['sindre']});
//=> 'sindre://sorhus.com/foo'
```

##### normalizeProtocol

Type: `boolean`\
Default: `true`

Prepend `defaultProtocol` to the URL if it's protocol-relative.

With `false`, a protocol-relative URL stays protocol-relative, even with `defaultProtocol` or `forceHttps` set.

```js
normalizeUrl('//sindresorhus.com');
//=> 'http://sindresorhus.com'

normalizeUrl('//sindresorhus.com', {normalizeProtocol: false});
//=> '//sindresorhus.com'
```

##### forceHttp

Type: `boolean`\
Default: `false`

Normalize HTTPS to HTTP.

__Note:__ changing the scheme drops the port that was the default one for the old scheme, so `forceHttp` turns `https://example.com:443` into `http://example.com` and `forceHttps` turns `http://example.com:80` into `https://example.com`. A port that is not a default for either scheme is kept.

```js
normalizeUrl('https://sindresorhus.com');
//=> 'https://sindresorhus.com'

normalizeUrl('https://sindresorhus.com', {forceHttp: true});
//=> 'http://sindresorhus.com'
```

##### forceHttps

Type: `boolean`\
Default: `false`

Normalize HTTP to HTTPS.

__Note:__ changing the scheme drops the port that was the default one for the old scheme, so `forceHttp` turns `https://example.com:443` into `http://example.com` and `forceHttps` turns `http://example.com:80` into `https://example.com`. A port that is not a default for either scheme is kept.

```js
normalizeUrl('http://sindresorhus.com');
//=> 'http://sindresorhus.com'

normalizeUrl('http://sindresorhus.com', {forceHttps: true});
//=> 'https://sindresorhus.com'
```

This option cannot be used with the `forceHttp` option at the same time.

##### stripAuthentication

Type: `boolean`\
Default: `true`

Strip the [authentication](https://en.wikipedia.org/wiki/Basic_access_authentication) part of the URL.

```js
normalizeUrl('https://user:password@sindresorhus.com');
//=> 'https://sindresorhus.com'

normalizeUrl('https://user:password@sindresorhus.com', {stripAuthentication: false});
//=> 'https://user:password@sindresorhus.com'
```

##### stripHash

Type: `boolean`\
Default: `false`

Strip the hash part of the URL.

```js
normalizeUrl('sindresorhus.com/about.html#contact');
//=> 'http://sindresorhus.com/about.html#contact'

normalizeUrl('sindresorhus.com/about.html#contact', {stripHash: true});
//=> 'http://sindresorhus.com/about.html'
```

##### stripProtocol

Type: `boolean`\
Default: `false`

Remove the protocol from the URL: `http://sindresorhus.com` → `sindresorhus.com`.

It removes an `https://`, an `http://` or a leading `//` from a protocol-relative URL, and nothing else.

__Note:__ The result is not a full URL, so normalizing it again can change it: a port that the removed protocol kept is the default one of the protocol that gets prepended next.

```js
normalizeUrl('https://sindresorhus.com');
//=> 'https://sindresorhus.com'

normalizeUrl('https://sindresorhus.com', {stripProtocol: true});
//=> 'sindresorhus.com'
```

##### stripTextFragment

Type: `boolean`\
Default: `true`

Strip the [text fragment](https://web.dev/text-fragments/) part of the URL.

**Note:** The text fragment will always be removed if the `stripHash` option is set to `true`, as the hash contains the text fragment.

```js
normalizeUrl('http://sindresorhus.com/about.html#:~:text=hello');
//=> 'http://sindresorhus.com/about.html'

normalizeUrl('http://sindresorhus.com/about.html#section:~:text=hello');
//=> 'http://sindresorhus.com/about.html#section'

normalizeUrl('http://sindresorhus.com/about.html#:~:text=hello', {stripTextFragment: false});
//=> 'http://sindresorhus.com/about.html#:~:text=hello'

normalizeUrl('http://sindresorhus.com/about.html#section:~:text=hello', {stripTextFragment: false});
//=> 'http://sindresorhus.com/about.html#section:~:text=hello'
```

##### stripWWW

Type: `boolean`\
Default: `true`

Remove `www.` from the URL.

__Note:__ A `www.` that is not followed by a proper domain is left alone, so `www.com` and `www.a.b` are not changed.

```js
normalizeUrl('http://www.sindresorhus.com');
//=> 'http://sindresorhus.com'

normalizeUrl('http://www.sindresorhus.com', {stripWWW: false});
//=> 'http://www.sindresorhus.com'
```

##### removeQueryParameters

Type: `Array<RegExp | string> | boolean`\
Default: `[/^utm_\w+/i]`

Remove query parameters that matches any of the provided strings or regexes. The match is against the percent-decoded key, the way `URLSearchParams` reads one, so `+` is a space and `%2F` is a slash: write `a/b` rather than `a%2Fb`.

Global and sticky regex flags are stripped.

```js
normalizeUrl('www.sindresorhus.com?foo=bar&ref=test_ref', {
	removeQueryParameters: ['ref']
});
//=> 'http://sindresorhus.com/?foo=bar'
```

If a boolean is provided, `true` will remove all the query parameters.

```js
normalizeUrl('www.sindresorhus.com?foo=bar', {
	removeQueryParameters: true
});
//=> 'http://sindresorhus.com'
```

`false` will not remove any query parameter.

```js
normalizeUrl('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', {
	removeQueryParameters: false
});
//=> 'http://sindresorhus.com/?foo=bar&ref=test_ref&utm_medium=test'
```

##### keepQueryParameters

Type: `Array<RegExp | string>`\
Default: `undefined`

Keeps only query parameters that matches any of the provided strings or regexes. The match is against the percent-decoded key, the same as `removeQueryParameters`. An empty array matches nothing, so it removes every parameter, the same as the `true` of `removeQueryParameters`.

**Note:** It overrides the `removeQueryParameters` option.

Global and sticky regex flags are stripped.

```js
normalizeUrl('https://sindresorhus.com?foo=bar&ref=unicorn', {
	keepQueryParameters: ['ref']
});
//=> 'https://sindresorhus.com/?ref=unicorn'
```

##### removeTrailingSlash

Type: `boolean`\
Default: `true`

Remove trailing slash.

**Note:** the sole `/` of a root path is removed too, unless the `removeSingleSlash` option is set to `false` **and** the input wrote that slash itself.

__Note:__ `removeSingleSlash: false` reads the trailing slash off the input as it was written, so a slash that belongs to a dot segment a URL parser resolves away still counts. `https://example.com/a/../` and `https://example.com/a/..` are the same URL, but only the first keeps the root slash.

```js
normalizeUrl('http://sindresorhus.com/redirect/');
//=> 'http://sindresorhus.com/redirect'

normalizeUrl('http://sindresorhus.com/redirect/', {removeTrailingSlash: false});
//=> 'http://sindresorhus.com/redirect/'

normalizeUrl('http://sindresorhus.com/', {removeTrailingSlash: false});
//=> 'http://sindresorhus.com'
```

##### removeSingleSlash

Type: `boolean`\
Default: `true`

Remove a sole `/` pathname in the output. This option is independent of `removeTrailingSlash`.

The `/` is kept when a query or a hash follows it, as in `https://sindresorhus.com/?a=1`.

```js
normalizeUrl('https://sindresorhus.com/');
//=> 'https://sindresorhus.com'

normalizeUrl('https://sindresorhus.com/', {removeSingleSlash: false});
//=> 'https://sindresorhus.com/'
```

##### removeDirectoryIndex

Type: `boolean | Array<RegExp | string>`\
Default: `false`

Removes the default directory index file from path that matches any of the provided strings or regexes. The match is against the percent-decoded component, the same as `transformPath` is given, so `index.html` matches a path spelled `index%2Ehtml`. It runs after `transformPath`, so it also removes an index file the function leaves at the end.

When `true`, the regex `/^index\.[a-z]+$/` is used.

__Note:__ removing the index leaves a trailing slash on what is left, whether or not the input wrote one, so `http://example.com/foo/index.html` becomes `http://example.com/foo/` and then `http://example.com/foo`. The `removeTrailingSlash` option decides whether that slash stays.

Global and sticky regex flags are stripped.

```js
normalizeUrl('www.sindresorhus.com/foo/default.php', {
	removeDirectoryIndex: [/^default\.[a-z]+$/]
});
//=> 'http://sindresorhus.com/foo'
```

##### removeExplicitPort

Type: `boolean`\
Default: `false`

Removes an explicit port number from the URL.

Port 443 is always removed from HTTPS URLs and 80 is always removed from HTTP URLs regardless of this option.

```js
normalizeUrl('sindresorhus.com:123', {
	removeExplicitPort: true
});
//=> 'http://sindresorhus.com'
```

##### sortQueryParameters

Type: `boolean`\
Default: `true`

Sorts the query parameters by key, in code unit order, so an uppercase letter sorts before a lowercase one and a digit before a letter. Parameters that share a key keep the order they were written in, since for a repeated key the order can be what the server reads. The library does that sort itself rather than through `URLSearchParams#sort`, which the URL standard has order by name alone without saying what happens to two names that are equal.

__Note:__ The option only changes the order. The query is written the same way either way (see [`normalizeUrl`](#normalizeurlurl-options)).

```js
normalizeUrl('www.sindresorhus.com?b=two&a=one&c=three', {
	sortQueryParameters: false
});
//=> 'http://sindresorhus.com/?b=two&a=one&c=three'
```

##### emptyQueryValue

Type: `string`\
Default: `'preserve'`\
Values: `'preserve' | 'always' | 'never'`

Controls how query parameters with empty values are formatted.

- `'preserve'` - Keep the original format (`?key` stays `?key`, `?key=` stays `?key=`). If the same key appears with both formats (`?a&a=`), all instances will use the format without `=`.
- `'always'` - Always include `=` for empty values (`?key` becomes `?key=`)
- `'never'` - Never include `=` for empty values (`?key=` becomes `?key`)

A value outside the three behaves as `'preserve'`.

```js
normalizeUrl('www.sindresorhus.com?a&b=', {emptyQueryValue: 'always'});
//=> 'http://sindresorhus.com/?a=&b='

normalizeUrl('www.sindresorhus.com?a&b=', {emptyQueryValue: 'never'});
//=> 'http://sindresorhus.com/?a&b'
```

##### removePath

Type: `boolean`\
Default: `false`

Removes the entire URL path, leaving the host with no path. The query and the hash stay. It takes precedence over the `transformPath` option.

```js
normalizeUrl('https://example.com/path/to/page', {
	removePath: true
});
//=> 'https://example.com'
```

##### transformPath

Type: `Function | false`\
Default: `false`

Custom function to transform the URL path components. The function receives an array of non-empty path components and should return a modified array. Returning nothing removes the path. The array it returns is only read, so a frozen one is as good as a mutable one. The components are percent-decoded, so an unreserved escape has become the character it stands for by the time the function sees it, and one it returns is not decoded again. It runs before `removeDirectoryIndex`, so the function still sees the index file, and it is skipped when `removePath` is set.

```js
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

## Related

- [compare-urls](https://github.com/sindresorhus/compare-urls) - Compare URLs by first normalizing them
