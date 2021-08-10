function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

(function (chai, normalizeUrl) {
  'use strict';

  function _interopDefaultLegacy(e) {
    return e && _typeof(e) === 'object' && 'default' in e ? e : {
      'default': e
    };
  }

  var normalizeUrl__default = /*#__PURE__*/_interopDefaultLegacy(normalizeUrl);
  /* global it */


  it('main', function () {
    chai.expect(normalizeUrl__default['default']('sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('sindresorhus.com ')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('sindresorhus.com.')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('SindreSorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('sindresorhus.com', {
      defaultProtocol: 'https:'
    })).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('HTTP://sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:80')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com:443')).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('ftp://sindresorhus.com:21')).to.deep.equal('ftp://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://www.sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.com')).to.deep.equal('http://www.com');
    chai.expect(normalizeUrl__default['default']('http://www.www.sindresorhus.com')).to.deep.equal('http://www.www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo/')).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('sindresorhus.com/?foo=bar baz')).to.deep.equal('http://sindresorhus.com/?foo=bar+baz');
    chai.expect(normalizeUrl__default['default']('https://foo.com/https://bar.com')).to.deep.equal('https://foo.com/https://bar.com');
    chai.expect(normalizeUrl__default['default']('https://foo.com/https://bar.com/foo//bar')).to.deep.equal('https://foo.com/https://bar.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('https://foo.com/http://bar.com')).to.deep.equal('https://foo.com/http://bar.com');
    chai.expect(normalizeUrl__default['default']('https://foo.com/http://bar.com/foo//bar')).to.deep.equal('https://foo.com/http://bar.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/%7Efoo/')).to.deep.equal('http://sindresorhus.com/~foo', 'decode URI octets');
    chai.expect(normalizeUrl__default['default']('https://foo.com/%FAIL%/07/94/ca/55.jpg')).to.deep.equal('https://foo.com/%FAIL%/07/94/ca/55.jpg');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('êxample.com')).to.deep.equal('http://xn--xample-hva.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?b=bar&a=foo')).to.deep.equal('http://sindresorhus.com/?a=foo&b=bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?foo=bar*|<>:"')).to.deep.equal('http://sindresorhus.com/?foo=bar*%7C%3C%3E%3A%22');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000')).to.deep.equal('http://sindresorhus.com:5000');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com/', {
      normalizeProtocol: false
    })).to.deep.equal('//sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com:80/', {
      normalizeProtocol: false
    })).to.deep.equal('//sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo#bar')).to.deep.equal('http://sindresorhus.com/foo#bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo#bar', {
      stripHash: true
    })).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo#bar:~:text=hello%20world', {
      stripHash: true
    })).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo/bar/../baz')).to.deep.equal('http://sindresorhus.com/foo/baz');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo/bar/./baz')).to.deep.equal('http://sindresorhus.com/foo/bar/baz');
    chai.expect(normalizeUrl__default['default']('https://i.vimeocdn.com/filter/overlay?src0=https://i.vimeocdn.com/video/598160082_1280x720.jpg&src1=https://f.vimeocdn.com/images_v6/share/play_icon_overlay.png')).to.deep.equal('https://i.vimeocdn.com/filter/overlay?src0=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F598160082_1280x720.jpg&src1=https%3A%2F%2Ff.vimeocdn.com%2Fimages_v6%2Fshare%2Fplay_icon_overlay.png');
  }); // https://nodejs.org/api/url.html#url_special_schemes

  it('main: non-special-protocol-schemes', function () {
    chai.expect(normalizeUrl__default['default']('sindre://www.sorhus.com')).to.deep.equal('sindre://sorhus.com');
    chai.expect(normalizeUrl__default['default']('sindre://www.sorhus.com/')).to.deep.equal('sindre://sorhus.com');
    chai.expect(normalizeUrl__default['default']('sindre://www.sorhus.com/foo/bar')).to.deep.equal('sindre://sorhus.com/foo/bar');
  });
  it('stripAuthentication option', function () {
    chai.expect(normalizeUrl__default['default']('http://user:password@www.sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://user:password@www.sindresorhus.com')).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://user:password@www.sindresorhus.com/@user')).to.deep.equal('https://sindresorhus.com/@user');
    chai.expect(normalizeUrl__default['default']('user:password@sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://user:password@www.êxample.com')).to.deep.equal('http://xn--xample-hva.com');
    var options = {
      stripAuthentication: false
    };
    chai.expect(normalizeUrl__default['default']('http://user:password@www.sindresorhus.com', options)).to.deep.equal('http://user:password@sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://user:password@www.sindresorhus.com', options)).to.deep.equal('https://user:password@sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://user:password@www.sindresorhus.com/@user', options)).to.deep.equal('https://user:password@sindresorhus.com/@user');
    chai.expect(normalizeUrl__default['default']('user:password@sindresorhus.com', options)).to.deep.equal('http://user:password@sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://user:password@www.êxample.com', options)).to.deep.equal('http://user:password@xn--xample-hva.com');
  });
  it('stripAuthentication option: non-special-protocol-schemes', function () {
    chai.expect(normalizeUrl__default['default']('sindre://user:password@www.sorhus.com')).to.deep.equal('sindre://sorhus.com');
    var options = {
      stripAuthentication: false
    };
    chai.expect(normalizeUrl__default['default']('sindre://user:password@www.sorhus.com', options)).to.deep.equal('sindre://user:password@sorhus.com');
  });
  it('stripProtocol option', function () {
    var options = {
      stripProtocol: true
    };
    chai.expect(normalizeUrl__default['default']('http://www.sindresorhus.com', options)).to.deep.equal('sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com', options)).to.deep.equal('sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://www.sindresorhus.com', options)).to.deep.equal('sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('//www.sindresorhus.com', options)).to.deep.equal('sindresorhus.com');
  });
  it('stripProtocol option: non-special-protocol-schemes', function () {
    var options = {
      stripProtocol: true
    };
    chai.expect(normalizeUrl__default['default']('sindre://user:password@www.sorhus.com', options)).to.deep.equal('sindre://sorhus.com');
    chai.expect(normalizeUrl__default['default']('sindre://www.sorhus.com', options)).to.deep.equal('sindre://sorhus.com');
  });
  it('stripTextFragment option', function () {
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#')).to.deep.equal('http://sindresorhus.com/about');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#:~:text=hello')).to.deep.equal('http://sindresorhus.com/about');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main')).to.deep.equal('http://sindresorhus.com/about#main');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main:~:text=hello')).to.deep.equal('http://sindresorhus.com/about#main');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main:~:text=hello%20world')).to.deep.equal('http://sindresorhus.com/about#main');
    var options = {
      stripTextFragment: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#:~:text=hello', options)).to.deep.equal('http://sindresorhus.com/about#:~:text=hello');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main', options)).to.deep.equal('http://sindresorhus.com/about#main');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main:~:text=hello', options)).to.deep.equal('http://sindresorhus.com/about#main:~:text=hello');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main:~:text=hello%20world', options)).to.deep.equal('http://sindresorhus.com/about#main:~:text=hello%20world');
    var options2 = {
      stripHash: true,
      stripTextFragment: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com', options2)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#:~:text=hello', options2)).to.deep.equal('http://sindresorhus.com/about');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main', options2)).to.deep.equal('http://sindresorhus.com/about');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main:~:text=hello', options2)).to.deep.equal('http://sindresorhus.com/about');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/about#main:~:text=hello%20world', options2)).to.deep.equal('http://sindresorhus.com/about');
  });
  it('stripWWW option', function () {
    var options = {
      stripWWW: false
    };
    chai.expect(normalizeUrl__default['default']('http://www.sindresorhus.com', options)).to.deep.equal('http://www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com', options)).to.deep.equal('http://www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://www.êxample.com', options)).to.deep.equal('http://www.xn--xample-hva.com');
    var options2 = {
      stripWWW: true
    };
    chai.expect(normalizeUrl__default['default']('http://www.vue.amsterdam', options2)).to.deep.equal('http://vue.amsterdam');
    chai.expect(normalizeUrl__default['default']('http://www.sorhus.xx--bck1b9a5dre4c', options2)).to.deep.equal('http://sorhus.xx--bck1b9a5dre4c');
    var tooLongTLDURL = 'http://www.sorhus.' + 'a'.repeat(64);
    chai.expect(normalizeUrl__default['default'](tooLongTLDURL, options2)).to.deep.equal(tooLongTLDURL);
  });
  it('stripWWW option: non-special-protocol-schemes', function () {
    var options = {
      stripWWW: false
    };
    chai.expect(normalizeUrl__default['default']('sindre://www.sorhus.com', options)).to.deep.equal('sindre://www.sorhus.com');
  });
  it('removeQueryParameters option', function () {
    var options = {
      stripWWW: false,
      removeQueryParameters: [/^utm_\w+/i, 'ref']
    };
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar&utm_medium=test')).to.deep.equal('http://sindresorhus.com/?foo=bar');
    chai.expect(normalizeUrl__default['default']('http://www.sindresorhus.com', options)).to.deep.equal('http://www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar', options)).to.deep.equal('http://www.sindresorhus.com/?foo=bar');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options)).to.deep.equal('http://www.sindresorhus.com/?foo=bar');
  });
  it('removeQueryParameters boolean `true` option', function () {
    var options = {
      stripWWW: false,
      removeQueryParameters: true
    };
    chai.expect(normalizeUrl__default['default']('http://www.sindresorhus.com', options)).to.deep.equal('http://www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar', options)).to.deep.equal('http://www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options)).to.deep.equal('http://www.sindresorhus.com');
  });
  it('removeQueryParameters boolean `false` option', function () {
    var options = {
      stripWWW: false,
      removeQueryParameters: false
    };
    chai.expect(normalizeUrl__default['default']('http://www.sindresorhus.com', options)).to.deep.equal('http://www.sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar', options)).to.deep.equal('http://www.sindresorhus.com/?foo=bar');
    chai.expect(normalizeUrl__default['default']('www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref', options)).to.deep.equal('http://www.sindresorhus.com/?foo=bar&ref=test_ref&utm_medium=test');
  });
  it('forceHttp option', function () {
    var options = {
      forceHttp: true
    };
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com')).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://www.sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com');
  });
  it('forceHttp option with forceHttps', function () {
    chai.expect(function () {
      normalizeUrl__default['default']('https://www.sindresorhus.com', {
        forceHttp: true,
        forceHttps: true
      });
    }).to["throw"]('The `forceHttp` and `forceHttps` options cannot be used together');
  });
  it('forceHttps option', function () {
    var options = {
      forceHttps: true
    };
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com')).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com', options)).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://www.sindresorhus.com', options)).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com', options)).to.deep.equal('https://sindresorhus.com');
  });
  it('removeTrailingSlash option', function () {
    var options = {
      removeTrailingSlash: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/')).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/', options)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/redirect')).to.deep.equal('http://sindresorhus.com/redirect');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/redirect/')).to.deep.equal('http://sindresorhus.com/redirect');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/redirect/', options)).to.deep.equal('http://sindresorhus.com/redirect/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/redirect/', options)).to.deep.equal('http://sindresorhus.com/redirect/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/#/')).to.deep.equal('http://sindresorhus.com/#/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/#/', options)).to.deep.equal('http://sindresorhus.com/#/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?unicorns=true')).to.deep.equal('http://sindresorhus.com/?unicorns=true');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?unicorns=true', options)).to.deep.equal('http://sindresorhus.com/?unicorns=true');
  });
  it('removeSingleSlash option', function () {
    var options = {
      removeSingleSlash: false
    };
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com', options)).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/', options)).to.deep.equal('https://sindresorhus.com/');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/redirect', options)).to.deep.equal('https://sindresorhus.com/redirect');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/redirect/', options)).to.deep.equal('https://sindresorhus.com/redirect');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/#/', options)).to.deep.equal('https://sindresorhus.com/#/');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/?unicorns=true', options)).to.deep.equal('https://sindresorhus.com/?unicorns=true');
  });
  it('removeSingleSlash option combined with removeTrailingSlash option', function () {
    var options = {
      removeTrailingSlash: false,
      removeSingleSlash: false
    };
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com', options)).to.deep.equal('https://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/', options)).to.deep.equal('https://sindresorhus.com/');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/redirect', options)).to.deep.equal('https://sindresorhus.com/redirect');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/redirect/', options)).to.deep.equal('https://sindresorhus.com/redirect/');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/#/', options)).to.deep.equal('https://sindresorhus.com/#/');
    chai.expect(normalizeUrl__default['default']('https://sindresorhus.com/?unicorns=true', options)).to.deep.equal('https://sindresorhus.com/?unicorns=true');
  });
  it('removeDirectoryIndex option', function () {
    var options1 = {
      removeDirectoryIndex: ['index.html', 'index.php']
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.html')).to.deep.equal('http://sindresorhus.com/index.html');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.html', options1)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.htm', options1)).to.deep.equal('http://sindresorhus.com/index.htm');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.php', options1)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/index.html')).to.deep.equal('http://sindresorhus.com/path/index.html');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/index.html', options1)).to.deep.equal('http://sindresorhus.com/path');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/index.htm', options1)).to.deep.equal('http://sindresorhus.com/path/index.htm');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/index.php', options1)).to.deep.equal('http://sindresorhus.com/path');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo/bar/index.html', options1)).to.deep.equal('http://sindresorhus.com/foo/bar');
    var options2 = {
      removeDirectoryIndex: [/^index\.[a-z]+$/, 'remove.html']
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.html')).to.deep.equal('http://sindresorhus.com/index.html');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.html', options2)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index/index.html', options2)).to.deep.equal('http://sindresorhus.com/index');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/remove.html', options2)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/default.htm', options2)).to.deep.equal('http://sindresorhus.com/default.htm');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.php', options2)).to.deep.equal('http://sindresorhus.com');
    var options3 = {
      removeDirectoryIndex: true
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.html')).to.deep.equal('http://sindresorhus.com/index.html');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.html', options3)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.htm', options3)).to.deep.equal('http://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/index.php', options3)).to.deep.equal('http://sindresorhus.com');
  });
  it('removeTrailingSlash and removeDirectoryIndex options)', function () {
    var options1 = {
      removeTrailingSlash: true,
      removeDirectoryIndex: true
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/', options1)).to.deep.equal('http://sindresorhus.com/path');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/index.html', options1)).to.deep.equal('http://sindresorhus.com/path');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/#/path/', options1)).to.deep.equal('http://sindresorhus.com/#/path/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/foo/#/bar/', options1)).to.deep.equal('http://sindresorhus.com/foo#/bar/');
    var options2 = {
      removeTrailingSlash: false,
      removeDirectoryIndex: true
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/', options2)).to.deep.equal('http://sindresorhus.com/path/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/path/index.html', options2)).to.deep.equal('http://sindresorhus.com/path/');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/#/path/', options2)).to.deep.equal('http://sindresorhus.com/#/path/');
  });
  it('sortQueryParameters option', function () {
    var options1 = {
      sortQueryParameters: true
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options1)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options1)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options1)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/', options1)).to.deep.equal('http://sindresorhus.com');
    var options2 = {
      sortQueryParameters: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options2)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options2)).to.deep.equal('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options2)).to.deep.equal('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/', options2)).to.deep.equal('http://sindresorhus.com');
  });
  it('sortQueryParameters option (old browser)', function () {
    var options1 = {
      sortQueryParameters: true,
      preferURLSearchParamsSort: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options1)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options1)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options1)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/', options1)).to.deep.equal('http://sindresorhus.com');
    var options2 = {
      sortQueryParameters: false,
      preferURLSearchParamsSort: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W', options2)).to.deep.equal('http://sindresorhus.com/?a=Z&b=Y&c=X&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W', options2)).to.deep.equal('http://sindresorhus.com/?b=Y&c=X&a=Z&d=W');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X', options2)).to.deep.equal('http://sindresorhus.com/?a=Z&d=W&b=Y&c=X');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/', options2)).to.deep.equal('http://sindresorhus.com');
  });
  it('invalid urls loose', function () {
    chai.expect(function () {
      normalizeUrl__default['default']('http://');
    }).to["throw"]();
    chai.expect(function () {
      normalizeUrl__default['default']('/');
    }).to["throw"]();
    chai.expect(function () {
      normalizeUrl__default['default']('/relative/path/');
    }).to["throw"]();
  });
  it('invalid urls strict', function () {
    /**
     *
     * Node.js: ^Invalid URL: .*$
     * Chrome: ^Failed to construct 'URL': Invalid URL$
     * Firefox: ^URL constructor: .* is not a valid URL\.$
     */
    // const INVALID_URL_REGEXP = /^Invalid URL: .*$|^Failed to construct 'URL': Invalid URL$|^URL constructor: .* is not a valid URL\.$/;
    var INVALID_URL_REGEXP = /not\s+.*\s+valid\s+url|invalid\s+url/i;

    try {
      normalizeUrl__default['default']('http://');
    } catch (error) {
      // Provide helpeful output message on the left,
      // so can update regexp from user feedback.
      chai.expect(error.message).to.match(INVALID_URL_REGEXP);
    }

    try {
      normalizeUrl__default['default']('/');
    } catch (error) {
      chai.expect(error.message).to.match(INVALID_URL_REGEXP);
    }

    try {
      normalizeUrl__default['default']('/relative/path/');
    } catch (error) {
      chai.expect(error.message).to.match(INVALID_URL_REGEXP);
    }
  });
  it('remove duplicate pathname slashes v4 with JsRegexpLookbehind', function () {
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo/bar')).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo////bar')).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com//foo', {
      normalizeProtocol: false
    })).to.deep.equal('//sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000///foo')).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com///foo')).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000//foo')).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/foo');
  });
  it('remove duplicate pathname slashes v4 without JsRegexpLookbehind', function () {
    var options = {
      preferJsRegexpLookbehind: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo/bar', options)).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo////bar', options)).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com//foo', {
      normalizeProtocol: false,
      preferJsRegexpLookbehind: false
    })).to.deep.equal('//sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000///foo', options)).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com///foo', options)).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000//foo', options)).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/foo');
  });
  it('remove duplicate pathname slashes v7 with JsRegexpLookbehind', function () {
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo/bar')).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo////bar')).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com//foo', {
      normalizeProtocol: false
    })).to.deep.equal('//sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000///foo')).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com///foo')).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000//foo')).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/s3://sindresorhus.com')).to.deep.equal('http://sindresorhus.com/s3://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/s3://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/s3://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo/s3://sindresorhus.com')).to.deep.equal('http://sindresorhus.com/foo/s3://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/git://sindresorhus.com')).to.deep.equal('http://sindresorhus.com/git://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/git://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/git://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo/git://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/foo/git://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/a://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/a:/sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo')).to.deep.equal('http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx:/sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/a2-.+://sindresorhus.com')).to.deep.equal('http://sindresorhus.com/a2-.+://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/a2-.+_://sindresorhus.com')).to.deep.equal('http://sindresorhus.com/a2-.+_:/sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/2abc://sindresorhus.com')).to.deep.equal('http://sindresorhus.com/2abc:/sindresorhus.com');
  });
  it('remove duplicate pathname slashes v7 without JsRegexpLookbehind', function () {
    var options = {
      preferJsRegexpLookbehind: false
    };
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo/bar', options)).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com////foo////bar', options)).to.deep.equal('http://sindresorhus.com/foo/bar');
    chai.expect(normalizeUrl__default['default']('//sindresorhus.com//foo', {
      normalizeProtocol: false,
      preferJsRegexpLookbehind: false
    })).to.deep.equal('//sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000///foo', options)).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com///foo', options)).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com:5000//foo', options)).to.deep.equal('http://sindresorhus.com:5000/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/s3://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com/s3://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/s3://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/s3://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo/s3://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com/foo/s3://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/git://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com/git://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/git://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/git://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com//foo/git://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/foo/git://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/a://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/a:/sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo', options)).to.deep.equal('http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx:/sindresorhus.com/foo');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/a2-.+://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com/a2-.+://sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/a2-.+_://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com/a2-.+_:/sindresorhus.com');
    chai.expect(normalizeUrl__default['default']('http://sindresorhus.com/2abc://sindresorhus.com', options)).to.deep.equal('http://sindresorhus.com/2abc:/sindresorhus.com');
  });
  it('data URL', function () {
    // Invalid URL.
    chai.expect(function () {
      normalizeUrl__default['default']('data:');
    }).to["throw"]('Invalid URL: data:'); // Strip default MIME type

    chai.expect(normalizeUrl__default['default']('data:text/plain,foo')).to.deep.equal('data:,foo'); // Strip default charset

    chai.expect(normalizeUrl__default['default']('data:;charset=us-ascii,foo')).to.deep.equal('data:,foo'); // Normalize away trailing semicolon.

    chai.expect(normalizeUrl__default['default']('data:;charset=UTF-8;,foo')).to.deep.equal('data:;charset=utf-8,foo'); // Empty MIME type.

    chai.expect(normalizeUrl__default['default']('data:,')).to.deep.equal('data:,'); // Empty MIME type with charset.

    chai.expect(normalizeUrl__default['default']('data:;charset=utf-8,foo')).to.deep.equal('data:;charset=utf-8,foo'); // Lowercase the MIME type.

    chai.expect(normalizeUrl__default['default']('data:TEXT/HTML,foo')).to.deep.equal('data:text/html,foo'); // Strip empty hash.

    chai.expect(normalizeUrl__default['default']('data:,foo# ')).to.deep.equal('data:,foo'); // Key only mediaType attribute.

    chai.expect(normalizeUrl__default['default']('data:;foo=;bar,')).to.deep.equal('data:;foo;bar,'); // Lowercase the charset.

    chai.expect(normalizeUrl__default['default']('data:;charset=UTF-8,foo')).to.deep.equal('data:;charset=utf-8,foo'); // Remove spaces after the comma when it's base64.

    chai.expect(normalizeUrl__default['default']('data:;base64, Zm9v #foo #bar')).to.deep.equal('data:;base64,Zm9v#foo #bar'); // Keep spaces when it's not base64.

    chai.expect(normalizeUrl__default['default']('data:, foo #bar')).to.deep.equal('data:, foo #bar'); // Options.

    var options = {
      defaultProtocol: 'http:',
      normalizeProtocol: true,
      forceHttp: true,
      stripHash: true,
      stripWWW: true,
      stripProtocol: true,
      removeQueryParameters: [/^utm_\w+/i, 'ref'],
      sortQueryParameters: true,
      removeTrailingSlash: true,
      removeDirectoryIndex: true
    };
    chai.expect(normalizeUrl__default['default']('data:,sindresorhus.com/', options)).to.deep.equal('data:,sindresorhus.com/');
    chai.expect(normalizeUrl__default['default']('data:,sindresorhus.com/index.html', options)).to.deep.equal('data:,sindresorhus.com/index.html');
    chai.expect(normalizeUrl__default['default']('data:,sindresorhus.com?foo=bar&a=a&utm_medium=test', options)).to.deep.equal('data:,sindresorhus.com?foo=bar&a=a&utm_medium=test');
    chai.expect(normalizeUrl__default['default']('data:,foo#bar', options)).to.deep.equal('data:,foo');
    chai.expect(normalizeUrl__default['default']('data:,www.sindresorhus.com', options)).to.deep.equal('data:,www.sindresorhus.com');
  });
  it('prevents homograph attack', function () {
    // The input string uses Unicode to make it look like a valid `ebay.com` URL.
    chai.expect(normalizeUrl__default['default']('https://ebаy.com')).to.deep.equal('https://xn--eby-7cd.com');
  });
  it('view-source URL', function () {
    chai.expect(function () {
      normalizeUrl__default['default']('view-source:https://www.sindresorhus.com');
    }).to["throw"]('`view-source:` is not supported as it is a non-standard protocol');
  });
  it('does not have exponential performance for data URLs', function () {
    for (var index = 0; index < 1000; index += 50) {
      var url = 'data:' + Array.from({
        length: index
      }).fill(',#').join('') + '\ra';
      var start = Date.now();

      try {
        normalizeUrl__default['default'](url);
      } catch (_unused) {}

      var difference = Date.now() - start;
      chai.expect(difference < 100, "Execution time: ".concat(difference)).to.deep.equal(true);
    }
  });
})(chai, normalizeUrl);
