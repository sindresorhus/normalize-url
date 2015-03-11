# normalize-url [![Build Status](https://travis-ci.org/sindresorhus/normalize-url.svg?branch=master)](https://travis-ci.org/sindresorhus/normalize-url)

> [Normalize](http://en.wikipedia.org/wiki/URL_normalization) a URL

Useful when you need to display, store, deduplicate, sort, compare, etc, URLs.


## Install

```
$ npm install --save normalize-url
```


## Usage

```js
var normalizeUrl = require('normalize-url');

normalizeUrl('sindresorhus.com');
//=> http://sindresorhus.com

normalizeUrl('HTTP://xn--xample-hva.com:80/?b=bar&a=foo');
//=> http://êxample.com/?a=foo&b=bar
```


## API

### normalizeUrl(url, [options])

#### url

*Required*  
Type: `string`

URL to normalize.

#### options

##### normalizeProtocol

Type: `boolean`  
Default: `true`

Prepend `http:` to protocol-relative URLs.

```js
normalizeUrl('//sindresorhus.com:80/', {normalizeProtocol: false});
//=> //sindresorhus.com
```

##### stripFragment

Type: `boolean`  
Default: `true`

Remove the fragment at the end of the URL.

```js
normalizeUrl('sindresorhus.com/about.html#contact', {stripFragment: false});
//=> http://sindresorhus.com/about.html#contact
```

## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
