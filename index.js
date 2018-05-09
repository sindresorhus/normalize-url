'use strict';
const {URL} = require('url');
const prependHttp = require('prepend-http');

function testParameter(name, filters) {
	return filters.some(filter => filter instanceof RegExp ? filter.test(name) : filter === name);
}

module.exports = (str, opts) => {
	opts = Object.assign({
		normalizeProtocol: true,
		normalizeHttps: false,
		stripFragment: true,
		stripWWW: true,
		removeQueryParameters: [/^utm_\w+/i],
		removeTrailingSlash: true,
		removeDirectoryIndex: false,
		sortQueryParameters: true
	}, opts);

	const hasRelativeProtocol = str.startsWith('//');

	// Prepend protocol
	str = prependHttp(str.trim()).replace(/^\/\//, 'http://');

	const urlObj = new URL(str);

	if (opts.normalizeHttps && urlObj.protocol === 'https:') {
		urlObj.protocol = 'http:';
	}

	// Remove fragment
	if (opts.stripFragment) {
		urlObj.hash = '';
	}

	// Remove duplicate slashes
	if (urlObj.pathname) {
		urlObj.pathname = urlObj.pathname.replace(/\/{2,}/g, '/');
	}

	// Decode URI octets
	if (urlObj.pathname) {
		urlObj.pathname = decodeURI(urlObj.pathname);
	}

	// Remove directory index
	if (opts.removeDirectoryIndex === true) {
		opts.removeDirectoryIndex = [/^index\.[a-z]+$/];
	}

	if (Array.isArray(opts.removeDirectoryIndex) && opts.removeDirectoryIndex.length > 0) {
		let pathComponents = urlObj.pathname.split('/');
		const lastComponent = pathComponents[pathComponents.length - 1];

		if (testParameter(lastComponent, opts.removeDirectoryIndex)) {
			pathComponents = pathComponents.slice(0, pathComponents.length - 1);
			urlObj.pathname = pathComponents.slice(1).join('/') + '/';
		}
	}

	if (urlObj.hostname) {
		// Remove trailing dot
		urlObj.hostname = urlObj.hostname.replace(/\.$/, '');

		// Remove `www.`
		if (opts.stripWWW) {
			urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
		}
	}

	// Remove query unwanted parameters
	if (Array.isArray(opts.removeQueryParameters)) {
		[...urlObj.searchParams.keys()]
			.reduce((acc, key) => {
				if (testParameter(key, opts.removeQueryParameters)) {
					acc.push(key);
				}
				return acc;
			}, [])
			.forEach(key => urlObj.searchParams.delete(key));
	}

	// Sort query parameters
	if (opts.sortQueryParameters) {
		urlObj.searchParams.sort();
	}

	// Take advantage of many of the Node `url` normalizations
	str = urlObj.toString();

	// Remove ending `/`
	if (opts.removeTrailingSlash || urlObj.pathname === '/') {
		str = str.replace(/\/$/, '');
	}

	// Restore relative protocol, if applicable
	if (hasRelativeProtocol && !opts.normalizeProtocol) {
		str = str.replace(/^http:\/\//, '//');
	}

	return str;
};
