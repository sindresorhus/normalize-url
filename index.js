// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
const DATA_URL_DEFAULT_MIME_TYPE = 'text/plain';
const DATA_URL_DEFAULT_CHARSET = 'us-ascii';
// A browser reads a media type that ends in `;base64` as the base64 marker, with zero or more spaces between the `;` and the word. The `;` is what makes it a parameter rather than a MIME type, so a media type of just `base64` is not the marker.
const base64MarkerAtEndPattern = /; *base64$/i;

const encodedReservedCharactersPattern = '%(?:3A|2F|3F|23|5B|5D|40|21|24|26|27|28|29|2A|2B|2C|3B|3D)';
const temporaryEncodedReservedTokenBase = '__normalize_url_encoded_reserved__';
// The closing `__` is a lookahead rather than part of the match, so that a search which spells the base twice in a row still has both indexes found. Consuming it would take the opening `__` of the second one, and the index after it would look free when the search already contains it.
const temporaryEncodedReservedTokenPattern = /__normalize_url_encoded_reserved__(\d+)(?=__)/g;
const hasEncodedReservedCharactersRegex = new RegExp(encodedReservedCharactersPattern, 'i');
const encodedReservedCharactersRegex = new RegExp(encodedReservedCharactersPattern, 'gi');
/*
A browser matches the text fragment directive before percent-decoding, so only a literal `:~:text=` is recognized. The `=` is required, so `#see:~:textbook` is left alone.

The caller removes the structural `#`, so any `#` in the fragment is content and stays. `[^]` is used rather than `.`, since a data URL fragment can contain line separators.
*/
const textFragmentPattern = /:~:text=[^]*$/i;

// Canonicalizes the hexadecimal digits of the percent escapes, as RFC 3986 asks a normalizer to do, so that both spellings of an escape normalize to one. Scanning for something to rewrite first is what keeps an already canonical URL cheap, since the rewrite itself is costly when there are many escapes. The scan looks for a lowercase letter in either digit position, and all three ways that can happen are covered: a digit then a lowercase letter, a lowercase letter then anything, and an uppercase letter then a lowercase one, which is what `%Af` is.
const lowercasePercentEscapeRegex = /%(?:\d[a-f]|[a-f][\dA-Fa-f]|[A-F][a-f])/;
const percentEscapeRegex = /%[a-f\d]{2}/gi;

const canonicalizePercentEscapes = text => lowercasePercentEscapeRegex.test(text) ? text.replaceAll(percentEscapeRegex, percentEscape => percentEscape.toUpperCase()) : text;

// A URL parser strips leading and trailing C0 controls and spaces, and percent-encodes every other whitespace character rather than dropping it. `String.prototype.trim` strips the whole Unicode whitespace set, so a character like U+00A0 would go and the URL would address a different resource.
const isC0ControlOrSpace = characterCode => characterCode <= 0x20;

// A MIME type is trimmed of HTTP whitespace, but a URL parser has already removed the tab, the carriage return and the line feed from anywhere in the input, and it writes the C0 controls that are left as escapes, so a space is the only one of the set that can still be there. Trimming one that is not would name a different parameter, and can leave a media type ending in the bare word `base64` that a browser reads as the marker, which changes what the data decodes to.
const isSpace = characterCode => characterCode === 0x20;

// The ASCII whitespace of the infrastructure standard, which is what a forgiving base64 decode removes from its input: tab, line feed, form feed, carriage return and space. Spelled out one at a time, since the vertical tab sits between the line feed and the form feed and is a C0 control that is not one of them. Stripping it from base64 data would turn a URL a browser refuses into one it reads.
const ASCII_WHITESPACE = new Set([0x09, 0x0A, 0x0C, 0x0D, 0x20]);

const isAsciiWhitespace = characterCode => ASCII_WHITESPACE.has(characterCode);

// The runs are walked rather than matched, because a `+` over a set of them in a regex is quadratic: the engine tries every start position inside a run, and this runs on untrusted input. A 16 KB run of spaces is a fraction of a second this way and over a second with the regex.
const stripTrailingWhitespace = (text, isWhitespace) => {
	let end = text.length;
	while (end > 0 && isWhitespace(text.codePointAt(end - 1))) {
		end--;
	}

	return text.slice(0, end);
};

const stripLeadingWhitespace = (text, isWhitespace) => {
	let start = 0;
	while (start < text.length && isWhitespace(text.codePointAt(start))) {
		start++;
	}

	return text.slice(start);
};

const stripSurrounding = (text, isWhitespace) => stripTrailingWhitespace(stripLeadingWhitespace(text, isWhitespace), isWhitespace);

// The other half of the URL parser's rule, for text that has to go back through a parser: a parser strips this whitespace from the end of what it reads, so a run of it written out has to be escaped to survive. The run is walked back rather than matched, for the same reason.
const escapeTrailingAsciiWhitespace = text => {
	const unescaped = stripTrailingWhitespace(text, isC0ControlOrSpace);
	if (unescaped === text) {
		return text;
	}

	let escaped = unescaped;
	for (let index = unescaped.length; index < text.length; index++) {
		escaped += encodeURIComponent(text[index]);
	}

	return escaped;
};

// A protocol lookalike in a pathname, whose two slashes the duplicate-slash removal deliberately keeps. A scheme is one letter followed by any number of them, so a single letter is a scheme too. The URL standard puts no length limit on a scheme, so the one here is only a guard against a long run of ordinary path text being read as one.
const pathnameProtocolRegex = /\b[a-z][a-z\d+\-.]{0,50}:\/\//i;

// The same, at the very end of a pathname, where a trailing slash must not be one of its two.
const pathnameEndsWithProtocolRegex = /\b[a-z][a-z\d+\-.]{0,50}:\/\/$/i;

// Removes duplicate slashes in a pathname, unless they are preceded by a protocol.
// NOTE: This could be implemented using a single negative lookbehind regex, but we avoid that to maintain compatibility with older JS engines which do not have support for that feature.
// TODO: Replace everything below with `pathname.replace(/(?<!\b[a-z][a-z\d+\-.]{0,50}:)\/{2,}/g, '/');` when Safari supports negative lookbehind.
const removeDuplicatePathSlashes = pathname => {
	// Split the string by occurrences of the protocol regex, and perform duplicate-slash replacement on the strings between those occurrences (if any). Scheme names are case-insensitive, so `HTTPS://` is a protocol just like `https://`.
	const protocolRegex = new RegExp(pathnameProtocolRegex.source, 'gi');

	let lastIndex = 0;
	let result = '';
	for (;;) {
		const match = protocolRegex.exec(pathname);
		if (!match) {
			break;
		}

		const protocol = match[0];
		const protocolAtIndex = match.index;
		result += pathname.slice(lastIndex, protocolAtIndex).replaceAll(/\/{2,}/g, '/');
		result += protocol;
		lastIndex = protocolAtIndex + protocol.length;
	}

	return result + pathname.slice(lastIndex).replaceAll(/\/{2,}/g, '/');
};

// Splits on a delimiter, ignoring the ones inside a quoted string, since a quoted parameter value may contain either a `;` or a `,` and treating one as a delimiter would change the value. A MIME parameter value is a token or a quoted string, and the quotes are only transport syntax, so a value that is a token spelled inside them is the same value. It is written without them, since that is the shorter form and the one a parser reads back the same. A value that is not a token keeps them, since a `;` or a space written bare would end the parameter or the media type.
const mimeTokenRegex = /^[!#$%&'*+.^`|~\w-]+$/;
const quotedPairRegex = /\\(.)/g;

const unquoteToken = value => {
	if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
		return value;
	}

	const unquoted = value.slice(1, -1).replaceAll(quotedPairRegex, '$1');
	return mimeTokenRegex.test(unquoted) ? unquoted : value;
};

const splitOutsideQuotes = (text, delimiter) => {
	const parts = [];
	let current = '';
	let afterEquals = false;
	let quote;
	let escaped = false;

	for (const character of text) {
		if (quote) {
			// A quote can be escaped inside a quoted string, so a `\"` does not close it.
			if (character === '\\') {
				escaped = !escaped;
			} else {
				if (character === quote && !escaped) {
					quote = undefined;
				}

				escaped = false;
			}
		} else if (character === '"' && afterEquals) {
			// A quoted string is only recognised right after the parameter's `=`, and only a double quote, which is what a browser recognises. So an apostrophe in a bare value such as `title=It's` does not open one, and the `;` after it does separate.
			quote = character;
			afterEquals = false;
		} else if (character === delimiter) {
			parts.push(current);
			current = '';
			afterEquals = false;
			continue;
		} else {
			afterEquals = character === '=';
		}

		current += character;
	}

	parts.push(current);
	return parts;
};

// Decodes the percent escapes of unreserved characters, and writes a `%` that starts no escape but is
// followed by a hexadecimal digit as `%25`. Without that, decoding the escape after such a `%` joins the
// two into an escape the input never had, so the text comes out spelled one way on this pass and another
// on the next. The second alternative is the lone digit that follows it, so the two never overlap.
// Only what has to change is matched, so the replacement runs once per escape that moves rather than
// once per escape of any kind, which is what keeps a long run of them linear.
// The scan continues after each replacement, so the `%25` just written is not read again. That is what
// makes `%2%45` come out as `%252E`, which the URL standard decodes to the `%2E` the input decodes to.
const unreservedPercentEscapeOrLonePercentRegex = /%(?:2d|2e|5f|7e|3\d|4[1-9a-f]|5[\da]|6[1-9a-f]|7[\da])|%([\da-f])(?![\da-f])/gi;

const decodeUnreservedPercentEscapes = text => text.replaceAll(unreservedPercentEscapeOrLonePercentRegex, (match, digit) =>
	// A reserved character is not matched at all, so it stays encoded and decoding it cannot change what
	// the URL means.
	digit === undefined ? String.fromCodePoint(Number.parseInt(match.slice(1), 16)) : `%25${digit}`);

// Doubles a percent sign so that decoding leaves the escape it belongs to untouched.
const doubleEncodePercentSign = match => `%25${match.slice(1)}`;

// Whether a URL parser domain-parses a host, which it does for a special scheme and not for the opaque host of any other one. A domain has its escapes read as the characters they stand for; an opaque host is left as it stands, with its case and its dots. The dot is the only difference the library relies on: a trailing one is the same name on a domain and a character of the name on an opaque host.
const isDomainHost = (protocol, hostname) => {
	try {
		return new URL(`${protocol}//%7E${hostname}/`).hostname === `~${hostname}`;
	} catch {
		return false;
	}
};

// Whether a URL parser reads a hostname back as the name it was given, under the URL's own protocol. A name of numbers comes back as the IPv4 address it spells, and a name that does not parse comes back as something else, or not at all. Only a name that reads back as itself can be written to a URL without changing the host. The protocol matters: an opaque host is read as it stands, with no IDNA and no lowercasing, so probing one with `http://` would ask a question the URL never does.
const isReadBackAsItself = (protocol, hostname) => {
	try {
		return new URL(`${protocol}//${hostname}/`).hostname === hostname;
	} catch {
		return false;
	}
};

// Percent-encodings that must survive decoding the pathname. `%` is only valid as part of an escape, and a URL parser removes tab, carriage return, and line feed from the path it reads back.
const protectedPathPercentEncodingsPattern = /%(?:09|0a|0d|25)/gi;

// Percent-encodings that must survive decoding the search. On top of the pathname ones, these are the ones the serializer introduces, so decoding them would change the structure of the query. A reserved character that the serializer also encodes is left to the temporary token instead, which distinguishes it from the same character written literally.
const protectedSearchPercentEncodingsPattern = /%(?:09|0a|0d|23|25|26|2b|3f)/gi;

const testParameter = (name, filters) => Array.isArray(filters) && filters.some(filter => {
	if (filter instanceof RegExp) {
		if (filter.flags.includes('g') || filter.flags.includes('y')) {
			return new RegExp(filter.source, filter.flags.replaceAll(/[gy]/g, '')).test(name);
		}

		return filter.test(name);
	}

	return filter === name;
});

const supportedProtocolNames = ['https', 'http', 'file'];
const supportedProtocols = new Set(supportedProtocolNames.map(name => `${name}:`));

// Matches a protocol-relative URL, or a URL that has no scheme. The URL parser accepts any number of slashes after a scheme, as in `http:/example.com`, so a scheme is only absent when there is none at all, or when the scheme-shaped prefix is followed by a port number and is really a host, as in `example.com:80`. A supported protocol is always a scheme, so `http:80` is a scheme and a host rather than a host called `http` and a port.
const missingProtocolPattern = new RegExp(String.raw`^\/\/|^(?!(?:${supportedProtocolNames.join('|')}):)(?![a-z][a-z\d+\-.]*:(?!\d+(?:[/?#]|$)))`, 'i');

// A scheme is a letter followed by letters, digits, `+`, `-` and `.`, and nothing else. The URL standard puts no length limit on one.
const schemeRegex = /^[a-z][\da-z+\-.]*$/i;

// The protocol a `customProtocols` entry or a `defaultProtocol` names, with the trailing `:` appended. A value that is not a scheme is not a protocol, so it is dropped: registered under a name no URL can have it would match nothing, and prepended as text the URL parser would reject the result. A value that is not a string is not one either, which is what makes `defaultProtocol: undefined` fall back to the documented default, since spreading the options replaces it when the key is present but unset.
const normalizeProtocolOption = protocol => {
	if (typeof protocol !== 'string') {
		return undefined;
	}

	// Trimmed and lowercased. A trailing colon is accepted however many there are, so that a value written `sindre:` or `sindre::` both name the protocol instead of quietly doing nothing.
	const normalizedProtocol = protocol.trim().toLowerCase().replace(/:+$/, '');
	return schemeRegex.test(normalizedProtocol) ? `${normalizedProtocol}:` : undefined;
};

// The protocol to prepend, with the documented default for a value that is not one.
const normalizeDefaultProtocolOption = protocol => normalizeProtocolOption(protocol) ?? 'http:';

const getCustomProtocol = (urlString, customProtocols) => {
	try {
		const {protocol} = new URL(urlString);
		const hasAuthority = urlString.slice(0, protocol.length + 2).toLowerCase() === `${protocol}//`;

		// A protocol the user opted into always wins, so a scheme with a dot in it is not read as a host.
		if (customProtocols.has(protocol)) {
			return protocol;
		}

		// Avoid treating "localhost:port" (e.g. "localhost:9802") as a custom protocol.
		if (protocol === 'localhost:' && !hasAuthority && /^\d+(?:[/?#]|$)/.test(urlString.slice(protocol.length))) {
			return undefined;
		}

		if (protocol.endsWith(':')
			&& (!protocol.includes('.') || hasAuthority)
			&& !supportedProtocols.has(protocol)) {
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
			indexes.add(Number.parseInt(match[1], 10));
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

const sortSearchParameters = (searchParameters, encodedReservedTokenRegex) => {
	if (!encodedReservedTokenRegex) {
		searchParameters.sort();
		return searchParameters.toString();
	}

	const getSortableKey = key => key.replace(encodedReservedTokenRegex, (_, hexCode) => String.fromCodePoint(Number.parseInt(hexCode, 16)));
	const entries = [...searchParameters.entries()];
	entries.sort(([leftKey], [rightKey]) => {
		const left = getSortableKey(leftKey);
		const right = getSortableKey(rightKey);
		return left < right ? -1 : (left > right ? 1 : 0);
	});

	return new URLSearchParams(entries).toString();
};

// Drops the query parameters the filter matches and writes the rest back in one go. Deleting a key at a time re-serialises the whole query into the URL on every call, so a URL with many parameters takes quadratic time, and the search is written back through a parser below either way. Nothing is written when no parameter matches, since a rewrite would be a second one for nothing.
const dropSearchParameters = (url, searchParameters, encodedReservedTokenRegex, isDropped) => {
	if (![...searchParameters.keys()].some(key => isDropped(decodeReservedTokens(key, encodedReservedTokenRegex)))) {
		return;
	}

	const kept = new URLSearchParams();
	for (const [key, value] of searchParameters) {
		if (!isDropped(decodeReservedTokens(key, encodedReservedTokenRegex))) {
			kept.append(key, value);
		}
	}

	url.search = kept.toString();
};

const decodeReservedTokens = (value, encodedReservedTokenRegex) => {
	if (!encodedReservedTokenRegex) {
		return value;
	}

	return value.replace(encodedReservedTokenRegex, (_, hexCode) => String.fromCodePoint(Number.parseInt(hexCode, 16)));
};

// The URL serializer always emits at least a `/` for the path, so a trailing slash sometimes has to be removed from the serialized string. Only the path may be touched: a `/` at the end of the search is part of the query and must be kept.
const removeTrailingPathSlash = (urlString, search) => {
	if (search.endsWith('/')) {
		return urlString;
	}

	return urlString.replace(/\/$/, '');
};

const normalizeEmptyQueryParameters = (search, emptyQueryValue, originalSearch) => {
	const isAlways = emptyQueryValue === 'always';
	const isNever = emptyQueryValue === 'never';
	const keysWithoutEquals = (isAlways || isNever) ? undefined : getKeysWithoutEquals(originalSearch);

	const normalizeKey = key => key.replaceAll('+', '%20');
	const formatEmptyValue = normalizedKey => {
		if (isAlways) {
			return `${normalizedKey}=`;
		}

		if (isNever) {
			return normalizedKey;
		}

		return keysWithoutEquals.has(decodeQueryKey(normalizedKey)) ? normalizedKey : `${normalizedKey}=`;
	};

	const normalizeParameter = parameter => {
		const equalIndex = parameter.indexOf('=');

		if (equalIndex === -1) {
			// Normalize + to %20 (+ means space in query strings). The search is written back through `URLSearchParams` first, which gives every key an `=`, so this is a guard rather than a case.
			return formatEmptyValue(normalizeKey(parameter));
		}

		const key = parameter.slice(0, equalIndex);
		const value = parameter.slice(equalIndex + 1);

		if (value === '') {
			// An empty key with an empty value keeps its `=`, since `?` on its own would drop it.
			if (key === '') {
				return '=';
			}

			// Normalize + to %20 (+ means space in query strings)
			return formatEmptyValue(normalizeKey(key));
		}

		// Normalize + to %20 in key.
		return `${normalizeKey(key)}=${value}`;
	};

	const parameters = search.slice(1).split('&').filter(Boolean);
	return parameters.length === 0 ? '' : `?${parameters.map(x => normalizeParameter(x)).join('&')}`;
};

const normalizeDataURL = (urlString, {stripHash, stripTextFragment}) => {
	// The `data:` scheme is case-insensitive, so the prefix must be matched case-insensitively too.
	// The comma is optional: a URL parser accepts a `data:` URL without one and reads the whole thing as
	// the media type with empty data, and this library takes URLs from a URL parser.
	// The fragment is matched with `[^]` rather than `.`, since a dot leaves out the line separators,
	// which a URL parser keeps. With that the pattern matches every string, so the guard below is a
	// guard rather than a case: no input reaches it.
	const match = /^data:(?<typeAndData>[^#]*)(?:#(?<hash>[^]*))?$/i.exec(urlString);

	if (!match) {
		throw new Error(`Invalid URL: ${urlString}`);
	}

	const {typeAndData, hash} = match.groups;

	// The data ends at the first comma, which a quoted value does not hide: that is what a browser reads, and it keeps a parameter written after a quoted comma in the data where it belongs. The data itself comes from the raw input, since it is the payload and a parser's spelling of it is not what a browser decodes.
	const separatorIndex = typeAndData.indexOf(',');
	const data = separatorIndex === -1 ? '' : typeAndData.slice(separatorIndex + 1);
	// The media type comes from the raw input, since a parser reads `data://host,` as an authority and would hand back the wrong one. What a parser does first is remove a tab, a carriage return and a line feed from anywhere in the input, and write anything else that is not a URL code point as an escape, so by the time a browser reads the media type the only whitespace left in it is a space. That is what the trim below and the marker test may treat as whitespace, and taking a form feed or any other control for it would spell a marker a browser does not see there, and the data would come out decoded when it was not.
	const type = separatorIndex === -1 ? typeAndData : typeAndData.slice(0, separatorIndex);
	// A `#` in the media type would be read as the fragment again on the next pass, so it is encoded here,
	// where it belongs. The fragment takes every `#` that is left, so this is a guard that no input reaches
	// now that the fragment is matched over the line separators too.
	const encodedType = type.replaceAll('#', '%23');
	/*
	The media type is not percent-decoded, since a browser does not decode it either, and decoding could turn a parameter into the marker, as in `;%62ase64`. Percent-looking text stays as spelled, apart from the lowercasing below. Only spaces are trimmed (see `isSpace`).

	The marker is a plain suffix test that ignores quoting, as in a browser, so a value with an unterminated quote can still end in it. It is therefore taken off before the parameters are parsed.
	*/
	const trimmedType = stripSurrounding(encodedType, isSpace);
	const isBase64 = base64MarkerAtEndPattern.test(trimmedType);
	const typeWithoutMarker = isBase64 ? trimmedType.replace(base64MarkerAtEndPattern, '') : trimmedType;
	const mediaType = splitOutsideQuotes(typeWithoutMarker, ';').map(part => stripSurrounding(part, isSpace));

	// Lowercase MIME type
	const mimeType = mediaType[0].toLowerCase();

	// The parameters are parsed before the marker is looked for, so that the marker is only recognised when it is the last parameter that will actually be written out. An empty part or an empty name, which a trailing `;` or `=` leaves, is dropped below, and must not hide the marker, or the result would come out differently on the next pass.
	const attributes = mediaType.slice(1)
		.filter(Boolean)
		.map(attribute => {
			// Only the first `=` separates the parameter name from its value; the value may contain more.
			const equalsIndex = attribute.indexOf('=');
			// Parameter names are case-insensitive, so lowercase them to normalize them. Only the leading whitespace of a name is stripped, since that is the separator whitespace a MIME parser skips over: a trailing one is part of the name, and trimming it would turn `charset ` into the `charset` parameter and then drop it as the redundant default.
			const key = stripLeadingWhitespace(equalsIndex === -1 ? attribute : attribute.slice(0, equalsIndex), isSpace).toLowerCase();
			// A parameter with no `=` has no value at all, which is not the same as one with an empty value, so the two are kept apart with `null` for the first. Nothing is stripped from the value here: a MIME parser removes only trailing whitespace from one, and the part was trimmed above so there is none left, while a leading space is a character of the value that reading as whitespace would turn into a parameter that is not the default it looks like.
			let value = equalsIndex === -1 ? null : unquoteToken(attribute.slice(equalsIndex + 1));

			// Lowercase `charset`
			if (key === 'charset' && value !== null) {
				value = value.toLowerCase();
			}

			return [key, value];
		})
		.filter(([key]) => key !== '');

	// A duplicate `charset` is not redundant, because the first one is the one that applies. Dropping the default charset there would silently promote the next one and change what the URL means.
	const hasDuplicateCharset = attributes.filter(([key]) => key === 'charset').length > 1;
	// Dropping the default charset must not leave the media type ending in the bare word `base64` either,
	// which a browser reads as the marker: `;base64;charset=us-ascii` is not a marker and the same media
	// type without the charset is, so that would change what the data decodes to. The last part that is
	// not empty is the one the charset is, since a trailing `;` is dropped as an empty part.
	const nonEmptyParts = mediaType.filter(Boolean);
	const exposesBase64Marker = !isBase64
		&& nonEmptyParts.at(-1)?.toLowerCase() === `charset=${DATA_URL_DEFAULT_CHARSET}`
		&& nonEmptyParts.at(-2)?.toLowerCase() === 'base64';

	// The default charset is only the default for `text/plain` and nothing else, since a body of any other type is decoded by sniffing rather than as US-ASCII. Dropping it from another media type changes the encoding a consumer applies, so it is kept there. An empty media type is `text/plain`.
	const isRedundantCharset = mimeType === '' || mimeType === DATA_URL_DEFAULT_MIME_TYPE;

	const normalizedAttributes = attributes
		.map(([key, value]) => (
			!hasDuplicateCharset && !exposesBase64Marker && isRedundantCharset && key === 'charset' && value === DATA_URL_DEFAULT_CHARSET
				? ''
				// A parameter written with an `=` keeps it, since dropping it turns an empty value into no value, and for `base64` that is the difference between a parameter and the marker.
				: (value === null ? key : `${key}=${value}`)
		))
		.filter(Boolean);

	const normalizedMediaType = [...normalizedAttributes];

	if (isBase64) {
		normalizedMediaType.push('base64');
	}

	if (normalizedMediaType.length > 0 || (mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE)) {
		normalizedMediaType.unshift(mimeType);
	}

	// A text fragment is stripped the same way as for a regular URL, before percent-decoding, so an escaped delimiter is content.
	const hashContent = stripHash ? '' : (hash ?? '');
	const normalizedHash = stripTextFragment ? hashContent.replace(textFragmentPattern, '') : hashContent;

	// The input is trimmed above, so whitespace at the end of the fragment would be put back here and taken away again on the next pass. It is escaped rather than trimmed, the same way as the data below, since a URL parser writes a space in a fragment as `%20` and it is a character the fragment has: dropping it would lose one, and the escape is a fixed point where a raw trailing space would be taken away again. A fragment left with nothing takes the hash with it, since a bare `#` is not a fixed point either.
	const escapedHash = escapeTrailingAsciiWhitespace(canonicalizePercentEscapes(normalizedHash));
	const hashPart = escapedHash ? `#${escapedHash}` : '';

	// The data is the path of the data URL, so an unreserved escape in it is decoded the same way.
	// Whitespace is stripped from around base64 data, which a URL processor does. Whitespace at the end
	// of the rest is escaped rather than stripped, since a URL parser writes a space in a path as `%20`
	// and it is a byte of the data: dropping a hash must not take one with it, and an escape is a fixed
	// point where a trailing space would be taken away again on the next pass.
	const normalizedData = canonicalizePercentEscapes(decodeUnreservedPercentEscapes(isBase64 ? stripSurrounding(data, isAsciiWhitespace) : (hashPart ? data : escapeTrailingAsciiWhitespace(data))));
	// The separator is written when the input had one, even with nothing after it to separate, since a
	// URL parser reads a data URL with no comma as a failure and one with an empty data after it as a
	// load. A data URL that came without a comma does not gain one, so that it does not change on every
	// pass.
	// A C0 control or a space at the end of the media type is written as an escape, the same as in the
	// data below. The input trim takes one off either end of the URL, and a media type with no comma after
	// it ends the URL, so written raw it would be taken by the next pass and the result would change. Only
	// a space is gone by the time the media type is read, so this is the step that writes the rest.
	const joinedType = normalizedMediaType.join(';');
	const normalizedType = separatorIndex === -1 ? escapeTrailingAsciiWhitespace(joinedType) : joinedType;

	// A media type that ends in `;base64` is the marker to a browser, so a normalization that leaves it that way when the input did not is one that changes what the data decodes to. Trimming a space off the end or dropping the empty part a trailing `;` leaves can do that, and the `charset` drop above handles the case where it would expose a `base64` part, so this is the last repair.
	const joinedMediaType = !isBase64 && base64MarkerAtEndPattern.test(normalizedType) ? `${normalizedType};` : normalizedType;
	// The separator is written when the input had one, even with nothing after it to separate, since a URL parser reads a data URL with no comma as a failure and one with an empty data after it as a load. A data URL that came without one does not gain one, so that it does not change on every pass; a media type that normalizes away entirely leaves nothing for one to separate, and then there is one to write, which `data:` on its own shows.
	const separator = separatorIndex === -1 && normalizedData === '' && joinedMediaType !== '' ? '' : ',';
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
		removeQueryParameters: [/^utm_\w+/i],
		removeTrailingSlash: true,
		removeSingleSlash: true,
		removeDirectoryIndex: false,
		removeExplicitPort: false,
		sortQueryParameters: true,
		removePath: false,
		transformPath: false,
		emptyQueryValue: 'preserve',
		// An option explicitly set to `undefined` falls back to its default, so it behaves the same as not passing it at all. TypeScript allows that for an optional property, and spreading `options` as-is would otherwise let it silently switch off everything that is on by default.
		...Object.fromEntries(Object.entries(options ?? {}).filter(([, value]) => value !== undefined)),
	};

	const defaultProtocol = normalizeDefaultProtocolOption(options.defaultProtocol);

	// Checked before anything else, so the error does not depend on the URL or its protocol.
	if (options.forceHttp && options.forceHttps) {
		throw new Error('The `forceHttp` and `forceHttps` options cannot be used together');
	}

	// The URL parser removes ASCII tab, carriage return, and line feed from the input before parsing it, and strips leading and trailing C0 controls and spaces. Doing it up front keeps the protocol and data URL detection below in sync with the parser.
	urlString = stripSurrounding(urlString.replaceAll(/[\t\r\n]/g, ''), isC0ControlOrSpace);

	// Data URL
	if (/^data:/i.test(urlString)) {
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
	const isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString);

	// Prepend protocol
	if (!isRelativeUrl && !customProtocol) {
		urlString = urlString.replace(missingProtocolPattern, defaultProtocol);
	}

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

	// Canonicalize the percent escapes in the hash. Assigning an empty string to it clears the fragment, so an empty one is left as it is.
	urlObject.hash &&= canonicalizePercentEscapes(urlObject.hash);

	// Decode URI octets, one path segment at a time, so that a malformed escape in one segment does not stop the others from being decoded. Otherwise the path decodes on one pass and not the next.
	if (urlObject.pathname) {
		urlObject.pathname = urlObject.pathname
			.split('/')
			.map(segment => {
				try {
					return decodeURI(segment.replaceAll(protectedPathPercentEncodingsPattern, doubleEncodePercentSign)).replaceAll('\\', '%5C');
				} catch {
					return segment;
				}
			})
			.join('/');

		// Decoding leaves the escapes for reserved characters alone, so their hexadecimal digits are canonicalized here, the same way as in the hash and the search.
		urlObject.pathname = canonicalizePercentEscapes(urlObject.pathname);
	}

	// Remove duplicate slashes if not preceded by a protocol. The decoded path is the one that is read, so an escape that spells a lookalike is one, and the letters inside a percent escape are not. A segment that failed to decode keeps its escapes, and a URL parser hands the path back encoded, so the letters of a non-ASCII escape are read as a scheme all the same. That only ever keeps two slashes that could have gone.
	urlObject.pathname &&= removeDuplicatePathSlashes(urlObject.pathname);

	// Remove directory index
	if (options.removeDirectoryIndex === true) {
		options.removeDirectoryIndex = [/^index\.[a-z]+$/];
	}

	// Remove path. It takes precedence over `transformPath`, so a transform cannot bring the path back. A transform is only called when the path starts with a `/`, which is where the segments a transform works on come from. It is the only one of the options that write the path which calls into caller code, so it is the only one where being ignored for the rest has to show.
	if (options.removePath) {
		urlObject.pathname = '/';
	} else if (typeof options.transformPath === 'function' && urlObject.pathname.startsWith('/')) {
		// Transform path components
		const pathComponents = urlObject.pathname.split('/').filter(Boolean);
		const newComponents = options.transformPath(pathComponents);
		// Empty components are dropped on the way in, so they are dropped on the way out too. Otherwise a trailing one becomes a trailing slash that the next pass would remove.
		const keptComponents = newComponents?.filter(Boolean) ?? [];
		// A trailing slash the input wrote is one that `removeTrailingSlash` is what keeps, so it is put back. Without that the transform would drop it even with the option off, and what the result is would depend on whether `removeDirectoryIndex` ran before it and left a slash of its own.
		const trailingSlash = !options.removeTrailingSlash && urlObject.pathname.endsWith('/') ? '/' : '';
		// The new components get the same duplicate-slash removal as the rest of the pathname.
		const newPathname = keptComponents.length > 0 ? `/${keptComponents.join('/')}${trailingSlash}` : '/';
		urlObject.pathname = canonicalizePercentEscapes(removeDuplicatePathSlashes(newPathname));
	}

	// Remove directory index, after the transform, so that an index file the transform leaves as the last component is removed here rather than on the next pass.
	if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
		const pathComponents = urlObject.pathname.split('/').filter(Boolean);
		let removedCount = 0;

		// A path can end in more than one index file, and removing them all keeps the result a fixed point.
		while (pathComponents.length > 0 && testParameter(pathComponents.at(-1), options.removeDirectoryIndex)) {
			pathComponents.pop();
			removedCount++;
		}

		if (removedCount > 0) {
			urlObject.pathname = pathComponents.length > 0 ? `/${pathComponents.join('/')}/` : '/';
		}
	}

	if (urlObject.hostname) {
		// Remove `www.` first, since a parser reads a host of numbers as an IPv4 address and the other labels decide whether it does, so the dots below depend on what is left here. Each label should be max 63 at length (min: 1). Source: https://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names Each TLD should be up to 63 characters long (min: 2). It is technically possible to have a single character TLD, but none currently exist.
		if (options.stripWWW && /^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(urlObject.hostname)) {
			const withoutWww = urlObject.hostname.replace(/^www\./, '');
			// A name a parser would read as something other than itself is not written, since that is the one thing a host must never do.
			if (isReadBackAsItself(urlObject.protocol, withoutWww)) {
				urlObject.hostname = withoutWww;
			}
		}

		// Remove trailing dots. A hostname can end in several dots and they all mean the same name. A hostname of only dots is the root, so one dot is kept, since an empty hostname is not settable. Only a domain treats a trailing dot as the same name: the host of any other scheme is opaque, and there a dot is a character of the name, the way its case is.
		const withoutTrailingDots = urlObject.hostname.replace(/\.+$/, '') || '.';
		if (withoutTrailingDots === urlObject.hostname
			|| (isDomainHost(urlObject.protocol, urlObject.hostname) && isReadBackAsItself(urlObject.protocol, withoutTrailingDots))) {
			urlObject.hostname = withoutTrailingDots;
		}

		// The hexadecimal digits of a percent escape are canonicalized here as they are everywhere else. A host of a special scheme has been decoded and punycoded by the parser already, so there is never an escape in one; a host of a non-special scheme is an opaque host, which the parser leaves as it stands, so its escapes would otherwise reach the output as they were written. Writing the name back is what canonicalizes it, and a parser reads a name it just wrote the same way, so this is a fixed point. A custom protocol the caller did not name is returned untouched long before here, so this is for the ones they did.
		urlObject.hostname &&= canonicalizePercentEscapes(urlObject.hostname);
	}

	// Capture original query params format before any searchParams modifications
	const originalSearch = urlObject.search;
	let encodedReservedTokenRegex;

	// Encoded reserved characters are swapped for a temporary token so that the round trip below keeps them encoded instead of reading them as the character they escape. This is about preserving them, not about order, so it happens whether or not the parameters are sorted.
	if (hasEncodedReservedCharactersRegex.test(originalSearch)) {
		const encodedReservedTokenPrefix = getTemporaryEncodedReservedTokenPrefix(originalSearch);
		urlObject.search = originalSearch.replaceAll(encodedReservedCharactersRegex, match => `${encodedReservedTokenPrefix}${match.slice(1).toUpperCase()}`);
		encodedReservedTokenRegex = new RegExp(`${encodedReservedTokenPrefix}([0-9A-F]{2})`, 'g');
	}

	const hasKeepQueryParameters = Array.isArray(options.keepQueryParameters);
	const {searchParams} = urlObject;

	// Remove query unwanted parameters
	if (!hasKeepQueryParameters && Array.isArray(options.removeQueryParameters) && options.removeQueryParameters.length > 0) {
		dropSearchParameters(urlObject, searchParams, encodedReservedTokenRegex, key => testParameter(key, options.removeQueryParameters));
	}

	if (!hasKeepQueryParameters && options.removeQueryParameters === true) {
		urlObject.search = '';
	}

	// Keep wanted query parameters
	if (hasKeepQueryParameters && options.keepQueryParameters.length > 0) {
		dropSearchParameters(urlObject, searchParams, encodedReservedTokenRegex, key => !testParameter(key, options.keepQueryParameters));
	} else if (hasKeepQueryParameters) {
		urlObject.search = '';
	}

	// The search parameters are round-tripped through URLSearchParams, which encodes them, so they are decoded again below. The round trip happens whether or not they are sorted, since the option is about their order, not their encoding.
	urlObject.search = options.sortQueryParameters
		? sortSearchParameters(urlObject.searchParams, encodedReservedTokenRegex)
		: new URLSearchParams(urlObject.searchParams).toString();

	// Undo the encoding the round trip introduced, leaving the protected escapes alone.
	urlObject.search = decodeURIComponent(urlObject.search.replaceAll(protectedSearchPercentEncodingsPattern, doubleEncodePercentSign));

	if (encodedReservedTokenRegex) {
		urlObject.search = urlObject.search.replace(encodedReservedTokenRegex, '%$1');
	}

	// Normalize empty query parameter values
	urlObject.search = canonicalizePercentEscapes(normalizeEmptyQueryParameters(urlObject.search, options.emptyQueryValue, originalSearch));

	// A trailing slash that is one of a protocol lookalike's two slashes is kept, since removing it would take one away on this pass and the other on the next. A root path is left alone as well. It is the sole `/`, which the `removeSingleSlash` option decides on below, and a pathname setter for a non-special scheme, such as a custom protocol, accepts an empty one, so removing the slash here would take that decision away from it.
	if (options.removeTrailingSlash && urlObject.pathname !== '/' && !pathnameEndsWithProtocolRegex.test(urlObject.pathname)) {
		urlObject.pathname = urlObject.pathname.replace(/\/$/, '');
	}

	// Remove an explicit port number, excluding a default port number, if applicable
	if (options.removeExplicitPort && urlObject.port) {
		urlObject.port = '';
	}

	const oldUrlString = urlString;

	// Whether the input itself wrote a trailing slash on the path, ignoring any query or hash after it. A `\` is a `/` to a parser in the path of a special scheme, so an input ending in one wrote a trailing slash even though the character is not one, and the parser's own path is what says so.
	const inputPath = oldUrlString.split(/[?#]/)[0];
	const oldPathEndsWithSlash = inputPath.endsWith('/') || (inputPath.endsWith('\\') && urlObject.pathname.endsWith('/'));

	// Take advantage of many of the Node `url` normalizations
	urlString = urlObject.toString();

	// A root path is its own `/` when there is no host, since there is then no authority to restore the slashes of a relative protocol around, and the parser writes a `/` for it either way.
	const hasHost = urlObject.host !== '';

	// Remove the sole `/` of a root path. A path other than the root one has already been handled above, on the pathname itself, so this is only for the root `/` that the serializer emits whether or not the pathname is empty. With `removeSingleSlash: false`, a `/` that the input wrote is kept, so only an implicit one goes.
	if (urlObject.pathname === '/' && hasHost && urlObject.hash === '' && (options.removeSingleSlash || !oldPathEndsWithSlash)) {
		urlString = removeTrailingPathSlash(urlString, urlObject.search);
	}

	// A URL parser will not let the path of a URL without an authority be changed, so the parts that the pathname setter and the duplicate slash removal would have handled are done on the path itself. Such a URL is only the protocol, the path, the search and the hash, so rebuilding it loses nothing. An empty path or one that starts with `/` went through the pathname above and is left alone, and `removeSingleSlash` does not apply, since this path is not the root.
	if (urlObject.pathname !== '' && !urlObject.pathname.startsWith('/')) {
		// The duplicate slashes go whatever `removeTrailingSlash` says, since that option is about a slash at the end of the path and not about the ones in the middle of it.
		const path = removeDuplicatePathSlashes(urlObject.pathname);
		// A trailing slash that is one of a protocol lookalike's two is kept, as it is for a normal path. The search is not consulted here: it is not part of what is being stripped, and the search keeps a `/` of its own either way.
		const normalizedPath = options.removeTrailingSlash && !pathnameEndsWithProtocolRegex.test(path) ? path.replace(/\/$/, '') : path;
		// Read back through a parser, which encodes the path the same way it would have encoded it in place, so a character like a space does not come out spelled two different ways. A parser also strips the ASCII whitespace at the end of what it reads, so whitespace the path is left with, which removing a trailing slash can do, is written as an escape or the next pass takes it away and what comes out is a different URL. The fragment goes along, since a fragment does not stop a path from being normalized. The hexadecimal digits are canonicalized here as they are everywhere else, since the rebuild writes the path out itself and a URL parser leaves an opaque one as it stands. The escape is not decoded, which the readme documents as left to the parser, and the parser does not decode it. A custom protocol the caller did not name is returned untouched long before here, so this is for the ones they did.
		const encodedPath = escapeTrailingAsciiWhitespace(canonicalizePercentEscapes(normalizedPath));
		urlString = new URL(`${urlObject.protocol}${encodedPath}${urlObject.search}${urlObject.hash}`).href;
	}

	// Restore relative protocol, if applicable. The protocol can differ from the prepended one, for example with `forceHttps`. The string is the serialization of the same object, so it starts with the authority, and the guard on the slice is there for a protocol the parser spelled differently rather than for a case.
	if (hasRelativeProtocol && !options.normalizeProtocol && hasHost) {
		const authorityPrefix = `${urlObject.protocol}//`;
		urlString = urlString.startsWith(authorityPrefix) ? `//${urlString.slice(authorityPrefix.length)}` : urlString;
	}

	// Remove http/https
	if (options.stripProtocol) {
		urlString = urlString.replace(/^(?:https?:)?\/\//, '');
	}

	return urlString;
}
