function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _wrapRegExp() { _wrapRegExp = function _wrapRegExp(re, groups) { return new BabelRegExp(re, undefined, groups); }; var _super = RegExp.prototype; var _groups = new WeakMap(); function BabelRegExp(re, flags, groups) { var _this = new RegExp(re, flags); _groups.set(_this, groups || _groups.get(re)); return _setPrototypeOf(_this, BabelRegExp.prototype); } _inherits(BabelRegExp, RegExp); BabelRegExp.prototype.exec = function (str) { var result = _super.exec.call(this, str); if (result) result.groups = buildGroups(result, this); return result; }; BabelRegExp.prototype[Symbol.replace] = function (str, substitution) { if (typeof substitution === "string") { var groups = _groups.get(this); return _super[Symbol.replace].call(this, str, substitution.replace(/\$<([^>]+)>/g, function (_, name) { return "$" + groups[name]; })); } else if (typeof substitution === "function") { var _this = this; return _super[Symbol.replace].call(this, str, function () { var args = arguments; if (_typeof(args[args.length - 1]) !== "object") { args = [].slice.call(args); args.push(buildGroups(args, _this)); } return substitution.apply(this, args); }); } else { return _super[Symbol.replace].call(this, str, substitution); } }; function buildGroups(result, re) { var g = _groups.get(re); return Object.keys(g).reduce(function (groups, name) { groups[name] = result[g[name]]; return groups; }, Object.create(null)); } return _wrapRegExp.apply(this, arguments); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
var DATA_URL_DEFAULT_MIME_TYPE = 'text/plain';
var DATA_URL_DEFAULT_CHARSET = 'us-ascii'; // https://nodejs.org/api/url.html#url_special_schemes

var URL_SPECIAL_PROTOCOL = /^(ftp:|file:|http:|https:|ws:|wss:)\/\//i;

var testParameter = function testParameter(name, filters) {
  return filters.some(function (filter) {
    return filter instanceof RegExp ? filter.test(name) : filter === name;
  });
};

var reverseString = function reverseString(s) {
  return s.split('').reverse().join('');
};

var pony$URLSearchParameters$sort = function pony$URLSearchParameters$sort(searchParameters) {
  var ent = _toConsumableArray(searchParameters.entries());

  if (ent.length === 0) {
    var rnd = String(Math.random());
    searchParameters.set(rnd, '');
    searchParameters["delete"](rnd);
  } else {
    var _iterator = _createForOfIteratorHelper(ent.sort()),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var _step$value = _slicedToArray(_step.value, 2),
            k = _step$value[0],
            v = _step$value[1];

        searchParameters["delete"](k);
        searchParameters.set(k, v);
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
  }
};

var normalizeDataURL = function normalizeDataURL(urlString, _ref) {
  var stripHash = _ref.stripHash;

  var match = /*#__PURE__*/_wrapRegExp(/^data:((?:(?!,)[\s\S])*?),((?:(?!#)[\s\S])*?)(?:#(.*))?$/, {
    type: 1,
    data: 2,
    hash: 3
  }).exec(urlString);

  if (!match) {
    throw new Error("Invalid URL: ".concat(urlString));
  }

  var _match$groups = match.groups,
      type = _match$groups.type,
      data = _match$groups.data,
      hash = _match$groups.hash;
  var mediaType = type.split(';');
  hash = stripHash ? '' : hash;
  var isBase64 = false;

  if (mediaType[mediaType.length - 1] === 'base64') {
    mediaType.pop();
    isBase64 = true;
  } // Lowercase MIME type


  var mimeType = (mediaType.shift() || '').toLowerCase();
  var attributes = mediaType.map(function (attribute) {
    var _attribute$split$map = attribute.split('=').map(function (string) {
      return string.trim();
    }),
        _attribute$split$map2 = _slicedToArray(_attribute$split$map, 2),
        key = _attribute$split$map2[0],
        _attribute$split$map3 = _attribute$split$map2[1],
        value = _attribute$split$map3 === void 0 ? '' : _attribute$split$map3; // Lowercase `charset`


    if (key === 'charset') {
      value = value.toLowerCase();

      if (value === DATA_URL_DEFAULT_CHARSET) {
        return '';
      }
    }

    return "".concat(key).concat(value ? "=".concat(value) : '');
  }).filter(Boolean);

  var normalizedMediaType = _toConsumableArray(attributes);

  if (isBase64) {
    normalizedMediaType.push('base64');
  }

  if (normalizedMediaType.length > 0 || mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE) {
    normalizedMediaType.unshift(mimeType);
  }

  return "data:".concat(normalizedMediaType.join(';'), ",").concat(isBase64 ? data.trim() : data).concat(hash ? "#".concat(hash) : '');
};

function normalizeUrl(urlString, options) {
  options = _objectSpread({
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
    preferURLSearchParamsSort: true
  }, options);

  if (options.forceHttp && options.forceHttps) {
    throw new Error('The `forceHttp` and `forceHttps` options cannot be used together');
  }

  urlString = urlString.trim(); // Data URL

  if (/^data:/i.test(urlString)) {
    return normalizeDataURL(urlString, options);
  }

  if (/^view-source:/i.test(urlString)) {
    throw new Error('`view-source:` is not supported as it is a non-standard protocol');
  }

  var hasRelativeProtocol = urlString.startsWith('//');
  var isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString); // Prepend protocol

  if (!isRelativeUrl) {
    urlString = urlString.replace(/^(?!(?:\w+:)?\/\/)|^\/\//, options.defaultProtocol);
  }

  var isCustomProtocol = !URL_SPECIAL_PROTOCOL.test(urlString);
  var customProtocol;

  if (isCustomProtocol) {
    customProtocol = urlString.split(':', 1)[0] + ':';

    if (customProtocol) {
      urlString = urlString.replace(customProtocol, options.defaultProtocol);
    }
  }

  var urlObject = new URL(urlString);

  if (options.forceHttp && urlObject.protocol === 'https:') {
    urlObject.protocol = 'http:';
    isCustomProtocol = false;
  }

  if (options.forceHttps && urlObject.protocol === 'http:') {
    urlObject.protocol = 'https:';
    isCustomProtocol = false;
  } // Remove auth


  if (options.stripAuthentication) {
    urlObject.username = '';
    urlObject.password = '';
  } // Remove hash


  if (options.stripHash) {
    urlObject.hash = '';
  } else if (options.stripTextFragment) {
    urlObject.hash = urlObject.hash.replace(/#?:~:text.*?$/i, '');
  } // Remove duplicate slashes if not preceded by a protocol


  if (urlObject.pathname) {
    // https://caniuse.com/js-regexp-lookbehind
    // prevent SyntaxError which can not be try-catch
    // DO NOT USE
    // const REGEXP_DUPLICATE_SLASHES = /(?<!\b[a-z][a-z\d+\-.]{1,50}:)\/{2,}/g;
    // TODO: use babel plugin to auto generate
    // REGEXP_DUPLICATE_SLASHES.source
    var SREGEXP_DUPLICATE_SLASHES = '(?<!\\b[a-z][a-z\\d+\\-.]{1,50}:)\\/{2,}';
    var REVERSE_REGEXP_DUPLICATE_SLASHES = /\/{2,}(?!:[a-z\d+\-.]{1,50}[a-z]\b)/g;
    var needFallback = true;

    if (options.preferJsRegexpLookbehind) {
      try {
        urlObject.pathname = urlObject.pathname.replace(new RegExp(SREGEXP_DUPLICATE_SLASHES, 'g'), '/');
        needFallback = false;
      } catch (_unused) {}
    }

    if (needFallback) {
      urlObject.pathname = reverseString(reverseString(urlObject.pathname).replace(REVERSE_REGEXP_DUPLICATE_SLASHES, '/'));
    }
  } // Decode URI octets


  if (urlObject.pathname) {
    try {
      urlObject.pathname = decodeURI(urlObject.pathname);
    } catch (_unused2) {}
  } // Remove directory index


  if (options.removeDirectoryIndex === true) {
    options.removeDirectoryIndex = [/^index\.[a-z]+$/];
  }

  if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
    var pathComponents = urlObject.pathname.split('/');
    var lastComponent = pathComponents[pathComponents.length - 1];

    if (testParameter(lastComponent, options.removeDirectoryIndex)) {
      pathComponents = pathComponents.slice(0, -1);
      urlObject.pathname = pathComponents.slice(1).join('/') + '/';
    }
  }

  if (urlObject.hostname) {
    // Remove trailing dot
    urlObject.hostname = urlObject.hostname.replace(/\.$/, ''); // Remove `www.`

    if (options.stripWWW && /^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(urlObject.hostname)) {
      // Each label should be max 63 at length (min: 1).
      // Source: https://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names
      // Each TLD should be up to 63 characters long (min: 2).
      // It is technically possible to have a single character TLD, but none currently exist.
      urlObject.hostname = urlObject.hostname.replace(/^www\./, '');
    }
  } // Remove query unwanted parameters


  if (Array.isArray(options.removeQueryParameters)) {
    for (var _i2 = 0, _arr2 = _toConsumableArray(urlObject.searchParams.keys()); _i2 < _arr2.length; _i2++) {
      var key = _arr2[_i2];

      if (testParameter(key, options.removeQueryParameters)) {
        urlObject.searchParams["delete"](key);
      }
    }
  }

  if (options.removeQueryParameters === true) {
    urlObject.search = '';
  } // Sort query parameters


  if (options.sortQueryParameters) {
    var _needFallback = true;

    if (options.preferURLSearchParamsSort) {
      try {
        urlObject.searchParams.sort();
        _needFallback = false;
      }
      /* istanbul ignore next */
      catch (_unused3) {}
    }

    if (_needFallback) {
      pony$URLSearchParameters$sort(urlObject.searchParams);
    }
  }

  if (options.removeTrailingSlash) {
    urlObject.pathname = urlObject.pathname.replace(/\/$/, '');
  }

  var oldUrlString = urlString; // Take advantage of many of the Node `url` normalizations

  urlString = urlObject.toString(); // Changing protocol AFTER stringify prevent pathname got changed

  if (isCustomProtocol && customProtocol) {
    urlString = urlString.replace(urlObject.protocol, customProtocol);
  }

  if (!options.removeSingleSlash && urlObject.pathname === '/' && !oldUrlString.endsWith('/') && urlObject.hash === '') {
    urlString = urlString.replace(/\/$/, '');
  } // Remove ending `/` unless removeSingleSlash is false


  if ((options.removeTrailingSlash || urlObject.pathname === '/') && urlObject.hash === '' && options.removeSingleSlash) {
    urlString = urlString.replace(/\/$/, '');
  } // Restore relative protocol, if applicable


  if (hasRelativeProtocol && !options.normalizeProtocol) {
    urlString = urlString.replace(/^http:\/\//, '//');
  } // Remove http/https


  if (options.stripProtocol) {
    urlString = urlString.replace(/^(?:https?:)?\/\//, '');
  }

  return urlString;
}

export { normalizeUrl as default };
