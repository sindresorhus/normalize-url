// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
const DATA_URL_DEFAULT_MIME_TYPE = 'text/plain';
const DATA_URL_DEFAULT_CHARSET = 'us-ascii';
// A browser reads a media type ending in `;base64` as the base64 marker, with any number of spaces after the `;`. A bare `base64` is not the marker.
// eslint-disable-next-line require-unicode-regexp -- The `v` flag case-folds `s` to U+017F, so `;baſe64` would be a marker a browser does not see.
const base64MarkerAtEndPattern = /; *base64$/i;

// The hexadecimal digits are written in lowercase, since both users of the pattern add the `i` flag.
const encodedReservedCharactersPattern = '%(?:3a|2f|3f|23|5b|5d|40|21|24|26|27|28|29|2a|2b|2c|3b|3d)';
const temporaryEncodedReservedTokenBase = '__normalize_url_encoded_reserved__';
// The closing `__` is a lookahead, so two tokens written back to back are both found.
const temporaryEncodedReservedTokenPattern = /__normalize_url_encoded_reserved__(?<index>\d+)(?=__)/gv;
const encodedReservedCharactersTest = new RegExp(encodedReservedCharactersPattern, 'iv');
const encodedReservedCharactersRegex = new RegExp(encodedReservedCharactersPattern, 'giv');
/*
A browser matches the text fragment directive before percent-decoding, so only a literal `:~:text=` is recognized. The `=` is required, so `#see:~:textbook` is left alone.

The caller removes the structural `#`, so any `#` in the fragment is content and stays. `[\s\S]` is used rather than `.`, since a data URL fragment can contain line separators.
*/
const textFragmentPattern = /:~:text=[\s\S]*$/iv;

/*
Uppercases the hexadecimal digits of percent escapes, as RFC 3986 recommends. The scan first keeps an already canonical URL cheap. It finds a lowercase letter in either digit position, including `%Af`.
*/
const lowercasePercentEscapeRegex = /%(?:\d[a-f]|[a-f][\dA-Fa-f]|[A-F][a-f])/v;
const percentEscapeRegex = /%[\da-f]{2}/giv;

const canonicalizePercentEscapes = text => lowercasePercentEscapeRegex.test(text) ? text.replaceAll(percentEscapeRegex, percentEscape => percentEscape.toUpperCase()) : text;

// A URL parser strips C0 controls and spaces from the ends. Other whitespace, like U+00A0 or a byte order mark, is stripped too, since at the ends of a URL it is almost always left over from copying it.
const isC0ControlOrWhitespace = characterCode => characterCode <= 0x20 || /\s/v.test(String.fromCodePoint(characterCode));

/*
A MIME type is trimmed of HTTP whitespace, but a URL parser has already removed tab, CR, and LF and escaped the other C0 controls, so a space is the only one left. Trimming anything else would rename a parameter or expose a bare `base64` marker.
*/
const isSpace = characterCode => characterCode === 0x20;

/*
The ASCII whitespace a forgiving base64 decode removes: tab, LF, FF, CR, and space. It is not a range, since the vertical tab is not one of them, and stripping it would turn a URL a browser refuses into one it reads.
*/
const ASCII_WHITESPACE = new Set([0x09, 0x0A, 0x0C, 0x0D, 0x20]);

const isAsciiWhitespace = characterCode => ASCII_WHITESPACE.has(characterCode);

// The run is walked rather than matched, since a regex `+` over it is quadratic on untrusted input.
const stripTrailing = (text, shouldStrip) => {
	let end = text.length;
	while (end > 0 && shouldStrip(text.codePointAt(end - 1))) {
		end--;
	}

	return text.slice(0, end);
};

const stripLeading = (text, shouldStrip) => {
	let start = 0;
	while (start < text.length && shouldStrip(text.codePointAt(start))) {
		start++;
	}

	return text.slice(start);
};

const stripSurrounding = (text, shouldStrip) => stripTrailing(stripLeading(text, shouldStrip), shouldStrip);

// A scheme has no colon in it, so however many the caller wrote at the end name the same protocol as none.
const isColon = characterCode => characterCode === 0x3A;

// A run of them is walked off rather than matched, since a regex `+` over it is quadratic.
const isDot = characterCode => characterCode === 0x2E;

// The input is stripped of trailing C0 controls and whitespace, so text that ends a URL has them escaped to survive the next pass.
const escapeTrailingC0ControlOrWhitespace = text => {
	const unescaped = stripTrailing(text, isC0ControlOrWhitespace);
	return unescaped + encodeURIComponent(text.slice(unescaped.length));
};

/*
A protocol lookalike in a pathname, whose two slashes the duplicate-slash removal keeps. A single letter is a scheme too. The URL standard has no length limit on a scheme, so the one here only guards against reading a long run of path text as one.
*/
// eslint-disable-next-line require-unicode-regexp -- The `v` flag case-folds `[a-z]` to U+017F, which is not a letter the URL standard allows in a scheme.
const pathnameProtocolRegex = /(?<protocol>\b[a-z][\d+\-.a-z]{0,50}:\/\/)/i;

// The same, at the end of a pathname, where a trailing slash must not be one of its two.
// eslint-disable-next-line require-unicode-regexp -- The `v` flag case-folds `[a-z]` to U+017F, which is not a letter the URL standard allows in a scheme.
const pathnameEndsWithProtocolRegex = /\b[a-z][\d+\-.a-z]{0,50}:\/\/$/i;

// Removes duplicate slashes in a pathname, unless they are preceded by a protocol.
// NOTE: A single negative lookbehind regex, `pathname.replace(/(?<!\b[a-z][a-z\d+\-.]{0,50}:)\/{2,}/g, '/')`, is not the same: it can start one slash later, so `a:///b` would become `a://b` where the split keeps the slashes after a protocol as they are.
const removeDuplicatePathSlashes = pathname => pathname
	.split(pathnameProtocolRegex)
	// The split captures the protocols, so they are at the odd indexes and are kept as they are.
	.map((part, index) => index % 2 === 0 ? part.replaceAll(/\/{2,}/gv, '/') : part)
	.join('');

/*
A quoted MIME parameter value that is a token is the same value without the quotes, so it is written without them. A value that is not a token keeps them, since a bare `;` or space would end it.
*/
// The `|` is escaped, since a `v`-flag character class treats it as a class operator.
const mimeTokenRegex = /^[\w!#$%&'*+\-.^`\|~]+$/v;
const quotedPairRegex = /\\(?<character>.)/gv;

const unquoteToken = value => {
	if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
		return value;
	}

	const unquoted = value.slice(1, -1).replaceAll(quotedPairRegex, '$<character>');
	return mimeTokenRegex.test(unquoted) ? unquoted : value;
};

// Splits on a delimiter outside quoted strings, since a quoted parameter value may contain a `;` or a `,`.
const splitOutsideQuotes = (text, delimiter) => {
	const parts = [];
	let current = '';
	let isAfterEquals = false;
	let quote;
	let isEscaped = false;

	for (const character of text) {
		if (quote) {
			// A quote can be escaped inside a quoted string, so a `\"` does not close it.
			if (character === '\\') {
				isEscaped = !isEscaped;
			} else {
				if (character === quote && !isEscaped) {
					quote = undefined;
				}

				isEscaped = false;
			}
		} else if (character === '"' && isAfterEquals) {
			// Only a double quote right after the `=` opens a quoted string, as in a browser, so the apostrophe in `title=It's` does not.
			quote = character;
			isAfterEquals = false;
		} else if (character === delimiter) {
			parts.push(current);
			current = '';
			isAfterEquals = false;
			continue;
		} else {
			isAfterEquals = character === '=';
		}

		current += character;
	}

	parts.push(current);
	return parts;
};

/*
Decodes the percent escapes of unreserved characters. A `%` that starts no escape is written as `%25` when a hexadecimal digit, or an escape that decodes to one, follows it. Without that, decoding would join the two into a new escape, so `%%41` would come out as `%A`. Any other lone `%`, like `%zz` or a trailing one, is left as a URL parser writes it.

Only what changes is matched, which keeps a long run of escapes linear. The scan resumes after each replacement, so `%2%45` becomes `%252E`, which decodes to the same `%2E` as the input.
*/
const unreservedPercentEscapeOrLonePercentRegex = /%(?:2d|2e|5f|7e|3\d|4[1-9a-f]|5[\da]|6[1-9a-f]|7[\da])|%(?![\da-f]{2})(?=[\da-f]|%(?:3\d|4[1-6]|6[1-6]))/giv;

const decodeUnreservedPercentEscapes = text => text.replaceAll(unreservedPercentEscapeOrLonePercentRegex, match =>
	// A reserved character is not matched, so it stays encoded and the meaning of the URL cannot change.
	match.length === 3 ? String.fromCodePoint(Number.parseInt(match.slice(1), 16)) : '%25');

// Doubles a percent sign so that decoding leaves the escape it belongs to untouched.
const doubleEncodePercentSign = match => `%25${match.slice(1)}`;

// A URL parser domain-parses the host of a special scheme, where a trailing dot names the same domain. The host of any other scheme is opaque, and a dot there is a character of the name.
const specialProtocols = new Set(['ftp:', 'file:', 'http:', 'https:', 'ws:', 'wss:']);

/*
Whether a URL parser reads a hostname back as itself under the URL's own protocol. A name of numbers comes back as an IPv4 address, and an invalid one does not come back at all. The protocol matters, since an opaque host gets no IDNA and no lowercasing.
*/
const isReadBackAsItself = (protocol, hostname) => {
	try {
		return new URL(`${protocol}//${hostname}/`).hostname === hostname;
	} catch {
		return false;
	}
};

// Escapes that must survive decoding the pathname: `%25`, since a `%` only starts an escape, and tab, CR, and LF, which a URL parser removes.
const protectedPathPercentEncodingsPattern = /%(?:09|0a|0d|25)/giv;

/*
Escapes that must survive decoding the search: the pathname ones, plus the ones whose decoding would change the structure of the query. Other reserved characters are protected by the temporary token instead, which keeps them apart from the same character written literally.
*/
const protectedSearchPercentEncodingsPattern = /%(?:09|0a|0d|23|25|26|2b|3f)/giv;

const testParameter = (name, filters) => Array.isArray(filters) && filters.some(filter => {
	if (filter instanceof RegExp) {
		return filter.flags.includes('g') || filter.flags.includes('y') ? new RegExp(filter.source, filter.flags.replaceAll(/[gy]/gv, '')).test(name) : filter.test(name);
	}

	return filter === name;
});

const supportedProtocolNames = ['https', 'http', 'file'];
const supportedProtocols = new Set(supportedProtocolNames.map(name => `${name}:`));

/*
Matches a protocol-relative URL, or a URL without a scheme. A URL parser accepts `http:/example.com`, so a scheme is only missing when there is none, or when the scheme-shaped prefix is really a host followed by a port, as in `example.com:80`. A supported protocol is always a scheme, so `http:80` is not a host.
*/
// eslint-disable-next-line require-unicode-regexp -- The `v` flag case-folds `[a-z]` to U+017F, which is not a letter the URL standard allows in a scheme.
const missingProtocolPattern = new RegExp(String.raw`^\/\/|^(?!(?:${supportedProtocolNames.join('|')}):)(?![a-z][\d+\-.a-z]*:(?!\d+(?:[#/?]|$)))`, 'i');

// A scheme is a letter followed by letters, digits, `+`, `-`, and `.`. The URL standard puts no length limit on one.
// eslint-disable-next-line require-unicode-regexp -- The `v` flag case-folds `[a-z]` to U+017F, which is not a letter the URL standard allows in a scheme.
const schemeRegex = /^[a-z][\d+\-.a-z]*$/i;

/*
The protocol a `customProtocols` entry or `defaultProtocol` names, with a `:` appended, or `undefined` for a value that is not a scheme. An invalid `customProtocols` entry is dropped, since it would match nothing, and an invalid `defaultProtocol` throws.
*/
const normalizeProtocolOption = protocol => {
	if (typeof protocol !== 'string') {
		return undefined;
	}

	// A trailing colon is accepted however many there are, so `sindre:` and `sindre::` both name the protocol.
	const normalizedProtocol = stripTrailing(protocol.trim().toLowerCase(), isColon);
	return schemeRegex.test(normalizedProtocol) ? `${normalizedProtocol}:` : undefined;
};

const getCustomProtocol = (urlString, customProtocols) => {
	try {
		const {protocol} = new URL(urlString);
		const hasAuthority = urlString.slice(0, protocol.length + 2).toLowerCase() === `${protocol}//`;

		// A protocol the user opted into always wins, so a scheme with a dot in it is not read as a host.
		if (customProtocols.has(protocol)) {
			return protocol;
		}

		// Avoid treating "localhost:port" (e.g. "localhost:9802") as a custom protocol.
		if (protocol === 'localhost:' && !hasAuthority && /^\d+(?:[#\/?]|$)/v.test(urlString.slice(protocol.length))) {
			return undefined;
		}

		if (!supportedProtocols.has(protocol) && (hasAuthority || !protocol.includes('.'))) {
			return protocol;
		}
	} catch {}

	return undefined;
};

const decodeQueryKey = value => {
	try {
		return decodeURIComponent(value.replaceAll('+', '%20'));
	} catch {
		// Match URLSearchParams behavior for malformed percent-encoding.
		return new URLSearchParams(`${value}=`).keys().next().value;
	}
};

const getKeysWithoutEquals = search => {
	const keys = new Set();
	if (!search) {
		return keys;
	}

	for (const part of search.slice(1).split('&')) {
		if (part && !part.includes('=')) {
			keys.add(decodeQueryKey(part));
		}
	}

	return keys;
};

const getTemporaryEncodedReservedTokenPrefix = search => {
	let decodedSearch = search;

	try {
		decodedSearch = decodeURIComponent(search);
	} catch {
		decodedSearch = new URLSearchParams(search).toString();
	}

	const getUsedTokenIndexes = value => {
		const indexes = new Set();

		for (const match of value.matchAll(temporaryEncodedReservedTokenPattern)) {
			indexes.add(Number(match.groups.index));
		}

		return indexes;
	};

	const usedTokenIndexes = getUsedTokenIndexes(search);
	for (const tokenIndex of getUsedTokenIndexes(decodedSearch)) {
		usedTokenIndexes.add(tokenIndex);
	}

	let tokenIndex = 0;
	while (usedTokenIndexes.has(tokenIndex)) {
		tokenIndex++;
	}

	return `${temporaryEncodedReservedTokenBase}${tokenIndex}__`;
};

const decodeReservedTokens = (value, encodedReservedTokenRegex) => encodedReservedTokenRegex
	? value.replace(encodedReservedTokenRegex, (_, hexCode) => String.fromCodePoint(Number.parseInt(hexCode, 16)))
	: value;

const normalizeEmptyQueryParameters = (search, emptyQueryValue, originalSearch) => {
	const isAlways = emptyQueryValue === 'always';
	const isNever = emptyQueryValue === 'never';
	const keysWithoutEquals = (isAlways || isNever) ? undefined : getKeysWithoutEquals(originalSearch);

	const formatEmptyValue = normalizedKey => {
		if (isAlways) {
			return `${normalizedKey}=`;
		}

		if (isNever) {
			return normalizedKey;
		}

		return keysWithoutEquals.has(decodeQueryKey(normalizedKey)) ? normalizedKey : `${normalizedKey}=`;
	};

	// The search was written back through `URLSearchParams`, which gives every parameter an `=`.
	const normalizeParameter = parameter => {
		const equalIndex = parameter.indexOf('=');
		// Normalize + to %20 in key (+ means space in query strings).
		const key = parameter.slice(0, equalIndex).replaceAll('+', '%20');
		const value = parameter.slice(equalIndex + 1);

		if (value === '') {
			// An empty key with an empty value keeps its `=`, since `?` on its own would drop it.
			return key === '' ? '=' : formatEmptyValue(key);
		}

		return `${key}=${value}`;
	};

	const parameters = search.slice(1).split('&').filter(Boolean);
	return parameters.length === 0 ? '' : `?${parameters.map(x => normalizeParameter(x)).join('&')}`;
};

const normalizeDataURL = (urlString, {stripHash, stripTextFragment}) => {
	// Matches every `data:` URL. The comma is optional, since a URL parser accepts a data URL without one, and `[\s\S]` takes line separators, which a parser keeps.
	const {typeAndData, hash} = /^data:(?<typeAndData>[^#]*)(?:#(?<hash>[\s\S]*))?$/iv.exec(urlString).groups;

	/*
	The data ends at the first comma, even one inside a quoted value, as in a browser. Both parts come from the raw input: a URL parser reads `data://host,` as an authority, and its spelling of the data is not what a browser decodes.
	*/
	const separatorIndex = typeAndData.indexOf(',');
	const data = separatorIndex === -1 ? '' : typeAndData.slice(separatorIndex + 1);
	const type = separatorIndex === -1 ? typeAndData : typeAndData.slice(0, separatorIndex);

	/*
	The media type is not percent-decoded, since a browser does not decode it either, and decoding could turn a parameter into the marker, as in `;%62ase64`. Percent-looking text stays as spelled, apart from the lowercasing below. Only spaces are trimmed (see `isSpace`).

	The marker is a plain suffix test that ignores quoting, as in a browser, so a value with an unterminated quote can still end in it. It is therefore taken off before the parameters are parsed.
	*/
	const trimmedType = stripSurrounding(type, isSpace);
	const isBase64 = base64MarkerAtEndPattern.test(trimmedType);
	const typeWithoutMarker = isBase64 ? trimmedType.replace(base64MarkerAtEndPattern, '') : trimmedType;
	const mediaType = splitOutsideQuotes(typeWithoutMarker, ';').map(part => stripSurrounding(part, isSpace));

	// Lowercase MIME type
	const mimeType = mediaType[0].toLowerCase();

	// An empty part or an empty name, which a trailing `;` or `=` leaves, is dropped.
	const attributes = mediaType.slice(1)
		.filter(Boolean)
		.map(attribute => {
			// Only the first `=` separates the parameter name from its value; the value may contain more.
			const equalsIndex = attribute.indexOf('=');
			// Parameter names are case-insensitive. Only leading spaces are stripped, since a trailing one is part of the name: `charset ` is not the `charset` parameter.
			const key = stripLeading(equalsIndex === -1 ? attribute : attribute.slice(0, equalsIndex), isSpace).toLowerCase();
			/*
			A parameter without `=` has the value `null`, which is not the same as an empty value: `base64` is the marker and `base64=` is not. The value is not trimmed, since a leading space is part of it.
			*/
			let value = equalsIndex === -1 ? null : unquoteToken(attribute.slice(equalsIndex + 1));

			// Lowercase `charset`
			if (key === 'charset' && value !== null) {
				value = value.toLowerCase();
			}

			return [key, value];
		})
		.filter(([key]) => key !== '');

	/*
	The default charset is dropped only when it is redundant:
	- The MIME type is `text/plain` (or empty, which means the same). A body of any other type is sniffed rather than read as US-ASCII.
	- It is the only `charset`. The first one applies, so dropping it would promote the next.
	- It does not leave a bare `base64` as the last parameter, which a browser reads as the marker: `;base64;charset=us-ascii`.

	The parsed values are compared, so a quoted `charset="us-ascii"` is the same parameter.
	*/
	const isDefaultCharset = attribute => attribute?.[0] === 'charset' && attribute[1] === DATA_URL_DEFAULT_CHARSET;
	const isExposingBase64Marker = !isBase64 && isDefaultCharset(attributes.at(-1)) && attributes.at(-2)?.[0] === 'base64' && attributes.at(-2)[1] === null;
	const isDefaultCharsetKept = (mimeType !== '' && mimeType !== DATA_URL_DEFAULT_MIME_TYPE)
		|| attributes.filter(([key]) => key === 'charset').length > 1
		|| isExposingBase64Marker;

	const normalizedMediaType = attributes
		.filter(attribute => isDefaultCharsetKept || !isDefaultCharset(attribute))
		// A parameter written with an `=` keeps it (see `null` above).
		.map(([key, value]) => value === null ? key : `${key}=${value}`);

	if (isBase64) {
		normalizedMediaType.push('base64');
	}

	if (normalizedMediaType.length > 0 || (mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE)) {
		normalizedMediaType.unshift(mimeType);
	}

	// A text fragment is stripped the same way as for a regular URL, before percent-decoding, so an escaped delimiter is content.
	const hashContent = stripHash ? '' : (hash ?? '');
	const normalizedHash = stripTextFragment ? hashContent.replace(textFragmentPattern, '') : hashContent;

	/*
	The fragment ends the URL, so its trailing whitespace is escaped, or the input trim of the next pass would remove it. An empty fragment drops the `#`, since a bare `#` is not a fixed point either.
	*/
	const escapedHash = escapeTrailingC0ControlOrWhitespace(canonicalizePercentEscapes(normalizedHash));
	const hashPart = escapedHash ? `#${escapedHash}` : '';

	/*
	The data is the path of the data URL, so its unreserved escapes are decoded the same way. Base64 data is stripped at its ends of the ASCII whitespace a decoder ignores, and whitespace inside it is kept. Any other C0 control left at its end, like U+001F, is data, so it is escaped. Other data is not stripped, since its whitespace is part of the payload, but it is escaped at the end of the URL.
	*/
	const dataText = isBase64
		? escapeTrailingC0ControlOrWhitespace(stripSurrounding(data, isAsciiWhitespace))
		: (hashPart ? data : escapeTrailingC0ControlOrWhitespace(data));
	const normalizedData = canonicalizePercentEscapes(decodeUnreservedPercentEscapes(dataText));

	// The media type ends the URL when there is no comma, so only then are its trailing C0 controls and whitespace escaped. Before a comma they are part of a parameter value.
	const joinedType = normalizedMediaType.join(';');
	const normalizedType = separatorIndex === -1 ? escapeTrailingC0ControlOrWhitespace(joinedType) : joinedType;

	/*
	Trimming a trailing space or dropping an empty part can leave a media type that ends in `;base64` when the input did not, which a browser reads as the marker. A trailing `;` keeps it from being one.
	*/
	const joinedMediaType = !isBase64 && base64MarkerAtEndPattern.test(normalizedType) ? `${normalizedType};` : normalizedType;

	/*
	The separator is written when the input had one, even with no data after it, since a URL parser reads a data URL without a comma as a failure. A URL without one does not gain one, or it would change on every pass, unless the media type normalizes away entirely, as in `data:`.
	*/
	const separator = separatorIndex === -1 && joinedMediaType !== '' ? '' : ',';
	return `data:${joinedMediaType}${separator}${normalizedData}${hashPart}`;
};

export default function normalizeUrl(urlString, options) {
	options = {
		defaultProtocol: 'http',
		normalizeProtocol: true,
		forceHttp: false,
		forceHttps: false,
		stripAuthentication: true,
		stripHash: false,
		stripTextFragment: true,
		stripWWW: true,
		// eslint-disable-next-line require-unicode-regexp -- The `v` flag case-folds `\w` to U+017F and U+212A, which are not in a parameter name this matches.
		removeQueryParameters: [/^utm_\w+/i],
		removeTrailingSlash: true,
		removeSingleSlash: true,
		removeDirectoryIndex: false,
		removeExplicitPort: false,
		sortQueryParameters: true,
		removePath: false,
		transformPath: false,
		emptyQueryValue: 'preserve',
		// An option set to `undefined` falls back to its default, the same as leaving it out.
		...Object.fromEntries(Object.entries(options ?? {}).filter(([, value]) => value !== undefined)),
	};

	const defaultProtocol = normalizeProtocolOption(options.defaultProtocol);

	// Checked before anything else, so the errors do not depend on the URL or its protocol.
	if (!defaultProtocol) {
		throw new TypeError(`Expected \`defaultProtocol\` to be a protocol like \`https\`, got \`${String(options.defaultProtocol)}\``);
	}

	if (options.forceHttp && options.forceHttps) {
		throw new Error('The `forceHttp` and `forceHttps` options cannot be used together');
	}

	// A URL parser removes tab, CR, and LF from anywhere, and C0 controls and spaces from the ends. Doing it up front, together with other whitespace at the ends (see `isC0ControlOrWhitespace`), keeps the detection below in sync with it.
	urlString = stripSurrounding(urlString.replaceAll(/[\t\n\r]/gv, ''), isC0ControlOrWhitespace);

	// Data URL
	if (/^data:/iv.test(urlString)) {
		return normalizeDataURL(urlString, options);
	}

	// An entry that is not a protocol normalizes to `undefined` and is dropped from the set.
	const customProtocols = new Set((Array.isArray(options.customProtocols) ? options.customProtocols : [])
		.map(protocol => normalizeProtocolOption(protocol))
		.filter(Boolean));

	const customProtocol = getCustomProtocol(urlString, customProtocols);
	if (customProtocol && !customProtocols.has(customProtocol)) {
		return urlString;
	}

	const hasRelativeProtocol = urlString.startsWith('//');
	const isRelativeUrl = !hasRelativeProtocol && /^\.*\//v.test(urlString);

	// Prepend protocol. The `//` is written out, since a non-special scheme would otherwise read the host as a path. The replacement is a function, as the lint rule asks, though a validated scheme has no `$` to be read as a substitution pattern.
	if (!isRelativeUrl && !customProtocol) {
		urlString = urlString.replace(missingProtocolPattern, () => `${defaultProtocol}//`);
	}

	// The path as the input wrote it, for `removeSingleSlash` below.
	const inputPath = urlString.split(/[#?]/v, 1)[0];

	const urlObject = new URL(urlString);

	if (options.forceHttp && urlObject.protocol === 'https:') {
		urlObject.protocol = 'http:';
	}

	if (options.forceHttps && urlObject.protocol === 'http:') {
		urlObject.protocol = 'https:';
	}

	// Remove auth
	if (options.stripAuthentication) {
		urlObject.username = '';
		urlObject.password = '';
	} else {
		// The userinfo is a component too, so its escapes are decoded and canonicalized the same way.
		urlObject.username &&= canonicalizePercentEscapes(decodeUnreservedPercentEscapes(urlObject.username));
		urlObject.password &&= canonicalizePercentEscapes(decodeUnreservedPercentEscapes(urlObject.password));
	}

	// Remove hash
	if (options.stripHash) {
		urlObject.hash = '';
	} else if (options.stripTextFragment) {
		// The fragment stays encoded, so normalizing it cannot create a directive. An empty fragment is cleared when text fragments are stripped.
		const hash = urlObject.hash.slice(1).replace(textFragmentPattern, '');
		// The structural `#` is removed before matching, then restored only when content remains.
		urlObject.hash = hash ? `#${hash}` : '';
	}

	// Canonicalize the percent escapes in the hash, leaving an empty one as it is.
	urlObject.hash &&= canonicalizePercentEscapes(urlObject.hash);

	// Decode URI octets one path segment at a time, so a malformed escape in one segment does not stop the others from being decoded.
	if (urlObject.pathname) {
		urlObject.pathname = urlObject.pathname
			.split('/')
			.map(segment => {
				try {
					// eslint-disable-next-line unicorn/no-unsafe-string-replacement -- The replacement is a function, so a `$` in the matched escape is literal.
					return decodeURI(segment.replaceAll(protectedPathPercentEncodingsPattern, doubleEncodePercentSign)).replaceAll('\\', '%5C');
				} catch {
					return segment;
				}
			})
			.join('/');

		// `decodeURI` leaves the escapes of `;/?:@&=+$,#` alone, so their hexadecimal digits are canonicalized here. Other reserved escapes, like `%5B`, are decoded, since the path reads them the same.
		urlObject.pathname = canonicalizePercentEscapes(urlObject.pathname);
	}

	/*
	Remove duplicate slashes if not preceded by a protocol. The decoded path is read, so an escape that spells a protocol lookalike is one. A segment that failed to decode keeps its escapes, whose letters can read as a scheme, but that only keeps two slashes that could have gone.
	*/
	urlObject.pathname &&= removeDuplicatePathSlashes(urlObject.pathname);

	// Remove directory index
	if (options.removeDirectoryIndex === true) {
		options.removeDirectoryIndex = [/^index\.[a-z]+$/v];
	}

	// Remove path. It takes precedence over `transformPath`. A transform is only called for a path that starts with `/`, which is where its components come from.
	if (options.removePath) {
		urlObject.pathname = '/';
	} else if (typeof options.transformPath === 'function' && urlObject.pathname.startsWith('/')) {
		// Transform path components
		const pathComponents = urlObject.pathname.split('/').filter(Boolean);
		const newComponents = options.transformPath(pathComponents);
		// Empty components are dropped on the way out too, or a trailing one would become a trailing slash the next pass removes.
		const keptComponents = newComponents?.filter(Boolean) ?? [];
		// A trailing slash the input wrote is put back when `removeTrailingSlash` keeps it.
		const trailingSlash = !options.removeTrailingSlash && urlObject.pathname.endsWith('/') ? '/' : '';
		// The new components get the same duplicate-slash removal as the rest of the pathname.
		const newPathname = keptComponents.length > 0 ? `/${keptComponents.join('/')}${trailingSlash}` : '/';
		urlObject.pathname = canonicalizePercentEscapes(removeDuplicatePathSlashes(newPathname));
	}

	// Remove directory index after the transform, so an index file the transform leaves at the end is removed now rather than on the next pass.
	if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
		const pathComponents = urlObject.pathname.split('/').filter(Boolean);
		const {length} = pathComponents;

		// A path can end in more than one index file, and removing them all keeps the result a fixed point.
		while (pathComponents.length > 0 && testParameter(pathComponents.at(-1), options.removeDirectoryIndex)) {
			pathComponents.pop();
		}

		if (pathComponents.length < length) {
			urlObject.pathname = pathComponents.length > 0 ? `/${pathComponents.join('/')}/` : '/';
		}
	}

	if (urlObject.hostname) {
		/*
		Remove `www.` before the trailing dots, since whether a parser reads a host as an IPv4 address depends on its other labels. Each label should be max 63 at length (min: 1). Source: https://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names Each TLD should be up to 63 characters long (min: 2). It is technically possible to have a single character TLD, but none currently exist. The name left is never one a parser reads differently, since a parser rejects a host like `www.1.23` in the first place.
		*/
		if (options.stripWWW && /^www\.(?!www\.)[\d\-a-z]{1,63}\.[\d\-.a-z]{2,63}$/v.test(urlObject.hostname)) {
			urlObject.hostname = urlObject.hostname.replace(/^www\./v, '');
		}

		/*
		Remove trailing dots, which all name the same domain. A host of only dots keeps one, since an empty hostname cannot be set. A name a parser would read differently without them is left alone: `159.189.213..` would become an IPv4 address.
		*/
		const withoutTrailingDots = stripTrailing(urlObject.hostname, isDot) || '.';
		if (withoutTrailingDots !== urlObject.hostname
			&& specialProtocols.has(urlObject.protocol)
			&& isReadBackAsItself(urlObject.protocol, withoutTrailingDots)) {
			urlObject.hostname = withoutTrailingDots;
		}

		// The host of a special scheme never has escapes, but an opaque host keeps them as written, so their hexadecimal digits are canonicalized.
		urlObject.hostname &&= canonicalizePercentEscapes(urlObject.hostname);
	}

	// Capture original query params format before any searchParams modifications
	const originalSearch = urlObject.search;
	let encodedReservedTokenRegex;

	// Encoded reserved characters are swapped for a temporary token, so the round trip below keeps them encoded instead of reading them as the character they escape.
	if (encodedReservedCharactersTest.test(originalSearch)) {
		const encodedReservedTokenPrefix = getTemporaryEncodedReservedTokenPrefix(originalSearch);
		urlObject.search = originalSearch.replaceAll(encodedReservedCharactersRegex, match => `${encodedReservedTokenPrefix}${match.slice(1).toUpperCase()}`);
		encodedReservedTokenRegex = new RegExp(`${encodedReservedTokenPrefix}([0-9A-F]{2})`, 'gv');
	}

	// The filters and the sort see a key as its encoded reserved characters decoded.
	const getKey = ([key]) => decodeReservedTokens(key, encodedReservedTokenRegex);
	let searchParameters = [...urlObject.searchParams];

	if (Array.isArray(options.keepQueryParameters)) {
		// Keep wanted query parameters. It overrides `removeQueryParameters`.
		searchParameters = searchParameters.filter(parameter => testParameter(getKey(parameter), options.keepQueryParameters));
	} else if (options.removeQueryParameters === true) {
		searchParameters = [];
	} else {
		// Remove unwanted query parameters
		searchParameters = searchParameters.filter(parameter => !testParameter(getKey(parameter), options.removeQueryParameters));
	}

	/*
	Sort by key in code unit order, as `URLSearchParams#sort` does. The sort is done here so that a key is compared with its encoded reserved characters decoded. `Array#sort` is stable, so a repeated key keeps its input order, which a server may depend on.
	*/
	if (options.sortQueryParameters) {
		searchParameters.sort((left, right) => {
			const leftKey = getKey(left);
			const rightKey = getKey(right);
			return leftKey < rightKey ? -1 : (leftKey > rightKey ? 1 : 0);
		});
	}

	// The parameters are always written back through `URLSearchParams`, so the spelling of the query does not depend on whether it was sorted or a parameter was removed. That encodes them, so they are decoded again, leaving the protected escapes alone.
	urlObject.search = new URLSearchParams(searchParameters).toString();
	// eslint-disable-next-line unicorn/no-unsafe-string-replacement -- The replacement is a function, so a `$` in the matched escape is literal.
	urlObject.search = decodeURIComponent(urlObject.search.replaceAll(protectedSearchPercentEncodingsPattern, doubleEncodePercentSign));

	if (encodedReservedTokenRegex) {
		urlObject.search = urlObject.search.replace(encodedReservedTokenRegex, '%$1');
	}

	// Normalize empty query parameter values
	urlObject.search = canonicalizePercentEscapes(normalizeEmptyQueryParameters(urlObject.search, options.emptyQueryValue, originalSearch));

	/*
	A trailing slash that belongs to a protocol lookalike is kept, or the next pass would remove its other slash. The root path is left to `removeSingleSlash` below, since a non-special scheme accepts an empty pathname.
	*/
	if (options.removeTrailingSlash && urlObject.pathname !== '/' && !pathnameEndsWithProtocolRegex.test(urlObject.pathname)) {
		urlObject.pathname = urlObject.pathname.replace(/\/$/v, '');
	}

	// Remove an explicit port number, excluding a default port number, if applicable
	if (options.removeExplicitPort && urlObject.port) {
		urlObject.port = '';
	}

	// Whether the input wrote a trailing slash on its path. A `\` counts only where a URL parser reads it as `/`, which the parsed path shows.
	const inputPathEndsWithSlash = inputPath.endsWith('/') || (inputPath.endsWith('\\') && urlObject.pathname.endsWith('/'));

	// Take advantage of many of the Node `url` normalizations
	urlString = urlObject.href;

	// Without a host there is no authority, so the `/` is the path itself and there are no slashes of a relative protocol to restore.
	const hasHost = urlObject.host !== '';

	/*
	Remove the `/` of a root path, which the serializer writes even for an empty pathname. With `removeSingleSlash: false`, a `/` the input wrote is kept. A search ending in `/` keeps its own, and an empty `#` is left as it is.
	*/
	if (hasHost
		&& urlObject.pathname === '/'
		&& urlObject.search === ''
		&& urlObject.hash === ''
		&& (!inputPathEndsWithSlash || options.removeSingleSlash)) {
		urlString = urlString.replace(/\/$/v, '');
	}

	/*
	A URL parser does not let the opaque path of a URL without an authority be changed, so it is normalized as a string and the URL is rebuilt, which loses nothing. Duplicate slashes go whatever `removeTrailingSlash` says. The rebuilt URL is read back through a parser, so the path is encoded the same way, and its trailing whitespace is escaped so the next pass does not strip it. Its escapes are canonicalized but not decoded.
	*/
	if (!urlObject.pathname.startsWith('/') && urlObject.pathname !== '') {
		const path = removeDuplicatePathSlashes(urlObject.pathname);
		const normalizedPath = options.removeTrailingSlash && !pathnameEndsWithProtocolRegex.test(path) ? path.replace(/\/$/v, '') : path;
		const encodedPath = escapeTrailingC0ControlOrWhitespace(canonicalizePercentEscapes(normalizedPath));
		urlString = new URL(`${urlObject.protocol}${encodedPath}${urlObject.search}${urlObject.hash}`).href;
	}

	// Restore relative protocol, if applicable. The protocol can differ from the prepended one, for example with `forceHttps`.
	if (hasHost && hasRelativeProtocol && !options.normalizeProtocol) {
		urlString = urlString.slice(urlObject.protocol.length);
	}

	// Remove http/https
	if (options.stripProtocol) {
		urlString = urlString.replace(/^(?:https?:)?\/\//v, '');
	}

	return urlString;
}
