// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
const DATA_URL_DEFAULT_MIME_TYPE = 'text/plain';
const DATA_URL_DEFAULT_CHARSET = 'us-ascii';

// https://nodejs.org/api/url.html#url_special_schemes
const URL_SPECIAL_PROTOCOL = /^(ftp:|file:|http:|https:|ws:|wss:)\/\//i;

const testParameter = (name, filters) => filters.some(filter => filter instanceof RegExp ? filter.test(name) : filter === name);

const reverseString = s => s.split('').reverse().join('');

const pony$URLSearchParameters$sort = searchParameters => {
	const ent = [...searchParameters.entries()];
	if (ent.length === 0) {
		const rnd = String(Math.random());
		searchParameters.set(rnd, '');
		searchParameters.delete(rnd);
	} else {
		for (const [k, v] of ent.sort()) {
			searchParameters.delete(k);
			searchParameters.set(k, v);
		}
	}
};

const normalizeDataURL = (urlString, {stripHash}) => {
	const match = /^data:(?<type>[^,]*?),(?<data>[^#]*?)(?:#(?<hash>.*))?$/.exec(urlString);

	if (!match) {
		throw new Error(`Invalid URL: ${urlString}`);
	}

	let {type, data, hash} = match.groups;
	const mediaType = type.split(';');
	hash = stripHash ? '' : hash;

	let isBase64 = false;
	if (mediaType[mediaType.length - 1] === 'base64') {
		mediaType.pop();
		isBase64 = true;
	}

	// Lowercase MIME type
	const mimeType = (mediaType.shift() || '').toLowerCase();
	const attributes = mediaType
		.map(attribute => {
			let [key, value = ''] = attribute.split('=').map(string => string.trim());

			// Lowercase `charset`
			if (key === 'charset') {
				value = value.toLowerCase();

				if (value === DATA_URL_DEFAULT_CHARSET) {
					return '';
				}
			}

			return `${key}${value ? `=${value}` : ''}`;
		})
		.filter(Boolean);

	const normalizedMediaType = [
		...attributes,
	];

	if (isBase64) {
		normalizedMediaType.push('base64');
	}

	if (normalizedMediaType.length > 0 || (mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE)) {
		normalizedMediaType.unshift(mimeType);
	}

	return `data:${normalizedMediaType.join(';')},${isBase64 ? data.trim() : data}${hash ? `#${hash}` : ''}`;
};

export default function normalizeUrl(urlString, options) {
	options = {
		defaultProtocol: 'http:',
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
		sortQueryParameters: true,
		preferJsRegexpLookbehind: true,
		preferURLSearchParamsSort: true,
		...options,
	};

	if (options.forceHttp && options.forceHttps) {
		throw new Error('The `forceHttp` and `forceHttps` options cannot be used together');
	}

	urlString = urlString.trim();

	// Data URL
	if (/^data:/i.test(urlString)) {
		return normalizeDataURL(urlString, options);
	}

	if (/^view-source:/i.test(urlString)) {
		throw new Error('`view-source:` is not supported as it is a non-standard protocol');
	}

	const hasRelativeProtocol = urlString.startsWith('//');
	const isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString);

	// Prepend protocol
	if (!isRelativeUrl) {
		urlString = urlString.replace(/^(?!(?:\w+:)?\/\/)|^\/\//, options.defaultProtocol);
	}

	let isCustomProtocol = !URL_SPECIAL_PROTOCOL.test(urlString);
	let customProtocol;
	if (isCustomProtocol) {
		customProtocol = urlString.split(':', 1)[0] + ':';
		if (customProtocol) {
			urlString = urlString.replace(customProtocol, options.defaultProtocol);
		}
	}

	const urlObject = new URL(urlString);

	if (options.forceHttp && urlObject.protocol === 'https:') {
		urlObject.protocol = 'http:';
		isCustomProtocol = false;
	}

	if (options.forceHttps && urlObject.protocol === 'http:') {
		urlObject.protocol = 'https:';
		isCustomProtocol = false;
	}

	// Remove auth
	if (options.stripAuthentication) {
		urlObject.username = '';
		urlObject.password = '';
	}

	// Remove hash
	if (options.stripHash) {
		urlObject.hash = '';
	} else if (options.stripTextFragment) {
		urlObject.hash = urlObject.hash.replace(/#?:~:text.*?$/i, '');
	}

	// Remove duplicate slashes if not preceded by a protocol
	if (urlObject.pathname) {
		// https://caniuse.com/js-regexp-lookbehind
		// prevent SyntaxError which can not be try-catch

		// DO NOT USE
		// const REGEXP_DUPLICATE_SLASHES = /(?<!\b[a-z][a-z\d+\-.]{1,50}:)\/{2,}/g;

		// TODO: use babel plugin to auto generate
		// REGEXP_DUPLICATE_SLASHES.source
		const SREGEXP_DUPLICATE_SLASHES = '(?<!\\b[a-z][a-z\\d+\\-.]{1,50}:)\\/{2,}';

		const REVERSE_REGEXP_DUPLICATE_SLASHES = /\/{2,}(?!:[a-z\d+\-.]{1,50}[a-z]\b)/g;

		let needFallback = true;
		if (options.preferJsRegexpLookbehind) {
			try {
				urlObject.pathname = urlObject.pathname.replace(
					new RegExp(SREGEXP_DUPLICATE_SLASHES, 'g'),
					'/',
				);
				needFallback = false;
			} /* istanbul ignore next */ catch {}
		}

		if (needFallback) {
			urlObject.pathname = reverseString(reverseString(urlObject.pathname).replace(
				REVERSE_REGEXP_DUPLICATE_SLASHES,
				'/',
			));
		}
	}

	// Decode URI octets
	if (urlObject.pathname) {
		try {
			urlObject.pathname = decodeURI(urlObject.pathname);
		} catch {}
	}

	// Remove directory index
	if (options.removeDirectoryIndex === true) {
		options.removeDirectoryIndex = [/^index\.[a-z]+$/];
	}

	if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
		let pathComponents = urlObject.pathname.split('/');
		const lastComponent = pathComponents[pathComponents.length - 1];

		if (testParameter(lastComponent, options.removeDirectoryIndex)) {
			pathComponents = pathComponents.slice(0, -1);
			urlObject.pathname = pathComponents.slice(1).join('/') + '/';
		}
	}

	if (urlObject.hostname) {
		// Remove trailing dot
		urlObject.hostname = urlObject.hostname.replace(/\.$/, '');

		// Remove `www.`
		if (options.stripWWW && /^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(urlObject.hostname)) {
			// Each label should be max 63 at length (min: 1).
			// Source: https://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names
			// Each TLD should be up to 63 characters long (min: 2).
			// It is technically possible to have a single character TLD, but none currently exist.
			urlObject.hostname = urlObject.hostname.replace(/^www\./, '');
		}
	}

	// Remove query unwanted parameters
	if (Array.isArray(options.removeQueryParameters)) {
		for (const key of [...urlObject.searchParams.keys()]) {
			if (testParameter(key, options.removeQueryParameters)) {
				urlObject.searchParams.delete(key);
			}
		}
	}

	if (options.removeQueryParameters === true) {
		urlObject.search = '';
	}

	// Sort query parameters
	if (options.sortQueryParameters) {
		let needFallback = true;

		if (options.preferURLSearchParamsSort) {
			try {
				urlObject.searchParams.sort();
				needFallback = false;
			} /* istanbul ignore next */ catch {}
		}

		if (needFallback) {
			pony$URLSearchParameters$sort(urlObject.searchParams);
		}
	}

	if (options.removeTrailingSlash) {
		urlObject.pathname = urlObject.pathname.replace(/\/$/, '');
	}

	const oldUrlString = urlString;

	// Take advantage of many of the Node `url` normalizations
	urlString = urlObject.toString();

	// Changing protocol AFTER stringify prevent pathname got changed
	if (isCustomProtocol && customProtocol) {
		urlString = urlString.replace(urlObject.protocol, customProtocol);
	}

	if (!options.removeSingleSlash && urlObject.pathname === '/' && !oldUrlString.endsWith('/') && urlObject.hash === '') {
		urlString = urlString.replace(/\/$/, '');
	}

	// Remove ending `/` unless removeSingleSlash is false
	if ((options.removeTrailingSlash || urlObject.pathname === '/') && urlObject.hash === '' && options.removeSingleSlash) {
		urlString = urlString.replace(/\/$/, '');
	}

	// Restore relative protocol, if applicable
	if (hasRelativeProtocol && !options.normalizeProtocol) {
		urlString = urlString.replace(/^http:\/\//, '//');
	}

	// Remove http/https
	if (options.stripProtocol) {
		urlString = urlString.replace(/^(?:https?:)?\/\//, '');
	}

	return urlString;
}
