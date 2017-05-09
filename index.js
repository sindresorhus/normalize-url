'use strict';
const minURL = require('minurl');
const prependHttp = require('prepend-http');
const {URL} = require('universal-url');

module.exports = (str, opts) => {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	// Remove any whitespace (likely from HTML)
	str = str.trim();

	const hasRelativeProtocol = str.startsWith('//');

	// Prepend protocol
	str = prependHttp(str).replace(/^\/\//, 'http://');

	const url = new URL(str);

	opts = Object.assign({
		normalizeProtocol: true,
		normalizeHttps: false,
		stripFragment: true,
		stripWWW: true,
		removeQueryParameters: [/^utm_\w+/i],
		removeTrailingSlash: true,
		removeDirectoryIndex: false
	}, opts);

	if (opts.normalizeHttps && url.protocol === 'https:') {
		url.protocol = 'http:';
	}

	// Remove trailing dot
	url.hostname = url.hostname.replace(/\.$/, '');

	if (opts.removeDirectoryIndex === true) {
		opts.removeDirectoryIndex = [/^index\.[a-z]+$/];
	}

	const profile = minURL.COMMON_PROFILE;

	str = minURL(url, {
		clone: false,
		defaultPorts: profile.defaultPorts,
		directoryIndexes: opts.removeDirectoryIndex || profile.directoryIndexes,
		queryNames: opts.removeQueryParameters || profile.queryNames,
		plusQueries: true,
		removeDefaultPort: true,
		removeDirectoryIndex: opts.removeDirectoryIndex !== false,
		removeEmptyDirectoryNames: true,  // Remove duplicate slashes
		removeEmptyHash: true,
		removeEmptyQueries: false,
		removeEmptyQueryNames: true,  // ?
		removeEmptyQueryValues: true,  // ?
		removeHash: opts.stripFragment,
		removeQueryNames: opts.removeQueryParameters.length > 0,
		removeQueryOddities: true,
		removeRootTrailingSlash: true,
		removeTrailingSlash: opts.removeTrailingSlash,
		removeWWW: opts.stripWWW,
		sortQueries: true,
		stringify: true
	});

	// Restore relative protocol, if applicable
	if (hasRelativeProtocol && !opts.normalizeProtocol) {
		str = str.replace(/^http:\/\//, '//');
	}

	return str;
};
