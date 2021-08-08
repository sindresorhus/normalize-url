(() => {
  // browser-test/global-chai.js
  var { expect } = chai;

  // index.js
  var DATA_URL_DEFAULT_MIME_TYPE = "text/plain";
  var DATA_URL_DEFAULT_CHARSET = "us-ascii";
  var testParameter = (name, filters) => filters.some((filter) => filter instanceof RegExp ? filter.test(name) : filter === name);
  var normalizeDataURL = (urlString, { stripHash }) => {
    const match = /^data:(?<type>[^,]*?),(?<data>[^#]*?)(?:#(?<hash>.*))?$/.exec(urlString);
    if (!match) {
      throw new Error(`Invalid URL: ${urlString}`);
    }
    let { type, data, hash } = match.groups;
    const mediaType = type.split(";");
    hash = stripHash ? "" : hash;
    let isBase64 = false;
    if (mediaType[mediaType.length - 1] === "base64") {
      mediaType.pop();
      isBase64 = true;
    }
    const mimeType = (mediaType.shift() || "").toLowerCase();
    const attributes = mediaType.map((attribute) => {
      let [key, value = ""] = attribute.split("=").map((string) => string.trim());
      if (key === "charset") {
        value = value.toLowerCase();
        if (value === DATA_URL_DEFAULT_CHARSET) {
          return "";
        }
      }
      return `${key}${value ? `=${value}` : ""}`;
    }).filter(Boolean);
    const normalizedMediaType = [
      ...attributes
    ];
    if (isBase64) {
      normalizedMediaType.push("base64");
    }
    if (normalizedMediaType.length > 0 || mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE) {
      normalizedMediaType.unshift(mimeType);
    }
    return `data:${normalizedMediaType.join(";")},${isBase64 ? data.trim() : data}${hash ? `#${hash}` : ""}`;
  };
  function normalizeUrl(urlString, options) {
    options = {
      defaultProtocol: "http:",
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
      ...options
    };
    urlString = urlString.trim();
    if (/^data:/i.test(urlString)) {
      return normalizeDataURL(urlString, options);
    }
    if (/^view-source:/i.test(urlString)) {
      throw new Error("`view-source:` is not supported as it is a non-standard protocol");
    }
    const hasRelativeProtocol = urlString.startsWith("//");
    const isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString);
    if (!isRelativeUrl) {
      urlString = urlString.replace(/^(?!(?:\w+:)?\/\/)|^\/\//, options.defaultProtocol);
    }
    const urlObject = new URL(urlString);
    if (options.forceHttp && options.forceHttps) {
      throw new Error("The `forceHttp` and `forceHttps` options cannot be used together");
    }
    if (options.forceHttp && urlObject.protocol === "https:") {
      urlObject.protocol = "http:";
    }
    if (options.forceHttps && urlObject.protocol === "http:") {
      urlObject.protocol = "https:";
    }
    if (options.stripAuthentication) {
      urlObject.username = "";
      urlObject.password = "";
    }
    if (options.stripHash) {
      urlObject.hash = "";
    } else if (options.stripTextFragment) {
      urlObject.hash = urlObject.hash.replace(/#?:~:text.*?$/i, "");
    }
    if (urlObject.pathname) {
      try {
        urlObject.pathname = urlObject.pathname.replace(new RegExp("(?<!\\b[a-z][a-z\\d+\\-.]{1,50}:)\\/{2,}", "g"), "/");
      } catch {
        urlObject.pathname = urlObject.pathname.replace(/((?!:).|^)\/{2,}/g, (_, p1) => {
          if (/^(?!\/)/g.test(p1)) {
            return `${p1}/`;
          }
          return "/";
        });
      }
    }
    if (urlObject.pathname) {
      try {
        urlObject.pathname = decodeURI(urlObject.pathname);
      } catch {
      }
    }
    if (options.removeDirectoryIndex === true) {
      options.removeDirectoryIndex = [/^index\.[a-z]+$/];
    }
    if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
      let pathComponents = urlObject.pathname.split("/");
      const lastComponent = pathComponents[pathComponents.length - 1];
      if (testParameter(lastComponent, options.removeDirectoryIndex)) {
        pathComponents = pathComponents.slice(0, -1);
        urlObject.pathname = pathComponents.slice(1).join("/") + "/";
      }
    }
    if (urlObject.hostname) {
      urlObject.hostname = urlObject.hostname.replace(/\.$/, "");
      if (options.stripWWW && /^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(urlObject.hostname)) {
        urlObject.hostname = urlObject.hostname.replace(/^www\./, "");
      }
    }
    if (Array.isArray(options.removeQueryParameters)) {
      for (const key of [...urlObject.searchParams.keys()]) {
        if (testParameter(key, options.removeQueryParameters)) {
          urlObject.searchParams.delete(key);
        }
      }
    }
    if (options.removeQueryParameters === true) {
      urlObject.search = "";
    }
    if (options.sortQueryParameters) {
      urlObject.searchParams.sort();
    }
    if (options.removeTrailingSlash) {
      urlObject.pathname = urlObject.pathname.replace(/\/$/, "");
    }
    const oldUrlString = urlString;
    urlString = urlObject.toString();
    if (!options.removeSingleSlash && urlObject.pathname === "/" && !oldUrlString.endsWith("/") && urlObject.hash === "") {
      urlString = urlString.replace(/\/$/, "");
    }
    if ((options.removeTrailingSlash || urlObject.pathname === "/") && urlObject.hash === "" && options.removeSingleSlash) {
      urlString = urlString.replace(/\/$/, "");
    }
    if (hasRelativeProtocol && !options.normalizeProtocol) {
      urlString = urlString.replace(/^http:\/\//, "//");
    }
    if (options.stripProtocol) {
      urlString = urlString.replace(/^(?:https?:)?\/\//, "");
    }
    return urlString;
  }

  // test.js
  it("main", async () => {
    expect(normalizeUrl("sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("sindresorhus.com ")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("sindresorhus.com.")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("SindreSorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("sindresorhus.com", { defaultProtocol: "https:" })).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("HTTP://sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("//sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com:80")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("https://sindresorhus.com:443")).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("ftp://sindresorhus.com:21")).to.deep.equal("ftp://sindresorhus.com");
    expect(normalizeUrl("http://www.sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("www.com")).to.deep.equal("http://www.com");
    expect(normalizeUrl("http://www.www.sindresorhus.com")).to.deep.equal("http://www.www.sindresorhus.com");
    expect(normalizeUrl("www.sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/foo/")).to.deep.equal("http://sindresorhus.com/foo");
    expect(normalizeUrl("sindresorhus.com/?foo=bar baz")).to.deep.equal("http://sindresorhus.com/?foo=bar+baz");
    expect(normalizeUrl("https://foo.com/https://bar.com")).to.deep.equal("https://foo.com/https://bar.com");
    expect(normalizeUrl("https://foo.com/https://bar.com/foo//bar")).to.deep.equal("https://foo.com/https://bar.com/foo/bar");
    expect(normalizeUrl("https://foo.com/http://bar.com")).to.deep.equal("https://foo.com/http://bar.com");
    expect(normalizeUrl("https://foo.com/http://bar.com/foo//bar")).to.deep.equal("https://foo.com/http://bar.com/foo/bar");
    expect(normalizeUrl("http://sindresorhus.com/%7Efoo/")).to.deep.equal("http://sindresorhus.com/~foo", "decode URI octets");
    expect(normalizeUrl("https://foo.com/%FAIL%/07/94/ca/55.jpg")).to.deep.equal("https://foo.com/%FAIL%/07/94/ca/55.jpg");
    expect(normalizeUrl("http://sindresorhus.com/?")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("\xEAxample.com")).to.deep.equal("http://xn--xample-hva.com");
    expect(normalizeUrl("http://sindresorhus.com/?b=bar&a=foo")).to.deep.equal("http://sindresorhus.com/?a=foo&b=bar");
    expect(normalizeUrl('http://sindresorhus.com/?foo=bar*|<>:"')).to.deep.equal("http://sindresorhus.com/?foo=bar*%7C%3C%3E%3A%22");
    expect(normalizeUrl("http://sindresorhus.com:5000")).to.deep.equal("http://sindresorhus.com:5000");
    expect(normalizeUrl("//sindresorhus.com/", { normalizeProtocol: false })).to.deep.equal("//sindresorhus.com");
    expect(normalizeUrl("//sindresorhus.com:80/", { normalizeProtocol: false })).to.deep.equal("//sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/foo#bar")).to.deep.equal("http://sindresorhus.com/foo#bar");
    expect(normalizeUrl("http://sindresorhus.com/foo#bar", { stripHash: true })).to.deep.equal("http://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/foo#bar:~:text=hello%20world", { stripHash: true })).to.deep.equal("http://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/foo/bar/../baz")).to.deep.equal("http://sindresorhus.com/foo/baz");
    expect(normalizeUrl("http://sindresorhus.com/foo/bar/./baz")).to.deep.equal("http://sindresorhus.com/foo/bar/baz");
    expect(normalizeUrl("https://i.vimeocdn.com/filter/overlay?src0=https://i.vimeocdn.com/video/598160082_1280x720.jpg&src1=https://f.vimeocdn.com/images_v6/share/play_icon_overlay.png")).to.deep.equal("https://i.vimeocdn.com/filter/overlay?src0=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F598160082_1280x720.jpg&src1=https%3A%2F%2Ff.vimeocdn.com%2Fimages_v6%2Fshare%2Fplay_icon_overlay.png");
  });
  it("main: non-special-protocol-schemes", async () => {
    expect(normalizeUrl("sindre://www.sorhus.com")).to.deep.equal("sindre://sorhus.com");
    expect(normalizeUrl("sindre://www.sorhus.com/")).to.deep.equal("sindre://sorhus.com");
    expect(normalizeUrl("sindre://www.sorhus.com/foo/bar")).to.deep.equal("sindre://sorhus.com/foo/bar");
  });
  it("stripAuthentication option", async () => {
    expect(normalizeUrl("http://user:password@www.sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("https://user:password@www.sindresorhus.com")).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("https://user:password@www.sindresorhus.com/@user")).to.deep.equal("https://sindresorhus.com/@user");
    expect(normalizeUrl("user:password@sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://user:password@www.\xEAxample.com")).to.deep.equal("http://xn--xample-hva.com");
    const options = { stripAuthentication: false };
    expect(normalizeUrl("http://user:password@www.sindresorhus.com", options)).to.deep.equal("http://user:password@sindresorhus.com");
    expect(normalizeUrl("https://user:password@www.sindresorhus.com", options)).to.deep.equal("https://user:password@sindresorhus.com");
    expect(normalizeUrl("https://user:password@www.sindresorhus.com/@user", options)).to.deep.equal("https://user:password@sindresorhus.com/@user");
    expect(normalizeUrl("user:password@sindresorhus.com", options)).to.deep.equal("http://user:password@sindresorhus.com");
    expect(normalizeUrl("http://user:password@www.\xEAxample.com", options)).to.deep.equal("http://user:password@xn--xample-hva.com");
  });
  it("stripAuthentication option: non-special-protocol-schemes", async () => {
    expect(normalizeUrl("sindre://user:password@www.sorhus.com")).to.deep.equal("sindre://sorhus.com");
    const options = { stripAuthentication: false };
    expect(normalizeUrl("sindre://user:password@www.sorhus.com", options)).to.deep.equal("sindre://user:password@sorhus.com");
  });
  it("stripProtocol option", async () => {
    const options = { stripProtocol: true };
    expect(normalizeUrl("http://www.sindresorhus.com", options)).to.deep.equal("sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com", options)).to.deep.equal("sindresorhus.com");
    expect(normalizeUrl("https://www.sindresorhus.com", options)).to.deep.equal("sindresorhus.com");
    expect(normalizeUrl("//www.sindresorhus.com", options)).to.deep.equal("sindresorhus.com");
  });
  it("stripProtocol option: non-special-protocol-schemes", async () => {
    const options = { stripProtocol: true };
    expect(normalizeUrl("sindre://user:password@www.sorhus.com", options)).to.deep.equal("sindre://sorhus.com");
    expect(normalizeUrl("sindre://www.sorhus.com", options)).to.deep.equal("sindre://sorhus.com");
  });
  it("stripTextFragment option", async () => {
    expect(normalizeUrl("http://sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/about#")).to.deep.equal("http://sindresorhus.com/about");
    expect(normalizeUrl("http://sindresorhus.com/about#:~:text=hello")).to.deep.equal("http://sindresorhus.com/about");
    expect(normalizeUrl("http://sindresorhus.com/about#main")).to.deep.equal("http://sindresorhus.com/about#main");
    expect(normalizeUrl("http://sindresorhus.com/about#main:~:text=hello")).to.deep.equal("http://sindresorhus.com/about#main");
    expect(normalizeUrl("http://sindresorhus.com/about#main:~:text=hello%20world")).to.deep.equal("http://sindresorhus.com/about#main");
    const options = { stripTextFragment: false };
    expect(normalizeUrl("http://sindresorhus.com", options)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/about#:~:text=hello", options)).to.deep.equal("http://sindresorhus.com/about#:~:text=hello");
    expect(normalizeUrl("http://sindresorhus.com/about#main", options)).to.deep.equal("http://sindresorhus.com/about#main");
    expect(normalizeUrl("http://sindresorhus.com/about#main:~:text=hello", options)).to.deep.equal("http://sindresorhus.com/about#main:~:text=hello");
    expect(normalizeUrl("http://sindresorhus.com/about#main:~:text=hello%20world", options)).to.deep.equal("http://sindresorhus.com/about#main:~:text=hello%20world");
    const options2 = { stripHash: true, stripTextFragment: false };
    expect(normalizeUrl("http://sindresorhus.com", options2)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/about#:~:text=hello", options2)).to.deep.equal("http://sindresorhus.com/about");
    expect(normalizeUrl("http://sindresorhus.com/about#main", options2)).to.deep.equal("http://sindresorhus.com/about");
    expect(normalizeUrl("http://sindresorhus.com/about#main:~:text=hello", options2)).to.deep.equal("http://sindresorhus.com/about");
    expect(normalizeUrl("http://sindresorhus.com/about#main:~:text=hello%20world", options2)).to.deep.equal("http://sindresorhus.com/about");
  });
  it("stripWWW option", async () => {
    const options = { stripWWW: false };
    expect(normalizeUrl("http://www.sindresorhus.com", options)).to.deep.equal("http://www.sindresorhus.com");
    expect(normalizeUrl("www.sindresorhus.com", options)).to.deep.equal("http://www.sindresorhus.com");
    expect(normalizeUrl("http://www.\xEAxample.com", options)).to.deep.equal("http://www.xn--xample-hva.com");
    const options2 = { stripWWW: true };
    expect(normalizeUrl("http://www.vue.amsterdam", options2)).to.deep.equal("http://vue.amsterdam");
    expect(normalizeUrl("http://www.sorhus.xx--bck1b9a5dre4c", options2)).to.deep.equal("http://sorhus.xx--bck1b9a5dre4c");
    const tooLongTLDURL = "http://www.sorhus." + "".padEnd(64, "a");
    expect(normalizeUrl(tooLongTLDURL, options2)).to.deep.equal(tooLongTLDURL);
  });
  it("stripWWW option: non-special-protocol-schemes", async () => {
    const options = { stripWWW: false };
    expect(normalizeUrl("sindre://www.sorhus.com", options)).to.deep.equal("sindre://www.sorhus.com");
  });
  it("removeQueryParameters option", async () => {
    const options = {
      stripWWW: false,
      removeQueryParameters: [/^utm_\w+/i, "ref"]
    };
    expect(normalizeUrl("www.sindresorhus.com?foo=bar&utm_medium=test")).to.deep.equal("http://sindresorhus.com/?foo=bar");
    expect(normalizeUrl("http://www.sindresorhus.com", options)).to.deep.equal("http://www.sindresorhus.com");
    expect(normalizeUrl("www.sindresorhus.com?foo=bar", options)).to.deep.equal("http://www.sindresorhus.com/?foo=bar");
    expect(normalizeUrl("www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref", options)).to.deep.equal("http://www.sindresorhus.com/?foo=bar");
  });
  it("removeQueryParameters boolean `true` option", async () => {
    const options = {
      stripWWW: false,
      removeQueryParameters: true
    };
    expect(normalizeUrl("http://www.sindresorhus.com", options)).to.deep.equal("http://www.sindresorhus.com");
    expect(normalizeUrl("www.sindresorhus.com?foo=bar", options)).to.deep.equal("http://www.sindresorhus.com");
    expect(normalizeUrl("www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref", options)).to.deep.equal("http://www.sindresorhus.com");
  });
  it("removeQueryParameters boolean `false` option", async () => {
    const options = {
      stripWWW: false,
      removeQueryParameters: false
    };
    expect(normalizeUrl("http://www.sindresorhus.com", options)).to.deep.equal("http://www.sindresorhus.com");
    expect(normalizeUrl("www.sindresorhus.com?foo=bar", options)).to.deep.equal("http://www.sindresorhus.com/?foo=bar");
    expect(normalizeUrl("www.sindresorhus.com?foo=bar&utm_medium=test&ref=test_ref", options)).to.deep.equal("http://www.sindresorhus.com/?foo=bar&ref=test_ref&utm_medium=test");
  });
  it("forceHttp option", async () => {
    const options = { forceHttp: true };
    expect(normalizeUrl("https://sindresorhus.com")).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com", options)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("https://www.sindresorhus.com", options)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("//sindresorhus.com", options)).to.deep.equal("http://sindresorhus.com");
  });
  it("forceHttp option with forceHttps", async () => {
    expect(() => {
      normalizeUrl("https://www.sindresorhus.com", { forceHttp: true, forceHttps: true });
    }).to.throw("The `forceHttp` and `forceHttps` options cannot be used together");
  });
  it("forceHttps option", async () => {
    const options = { forceHttps: true };
    expect(normalizeUrl("https://sindresorhus.com")).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com", options)).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("https://www.sindresorhus.com", options)).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("//sindresorhus.com", options)).to.deep.equal("https://sindresorhus.com");
  });
  it("removeTrailingSlash option", async () => {
    const options = { removeTrailingSlash: false };
    expect(normalizeUrl("http://sindresorhus.com")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/")).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com", options)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/", options)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/redirect")).to.deep.equal("http://sindresorhus.com/redirect");
    expect(normalizeUrl("http://sindresorhus.com/redirect/")).to.deep.equal("http://sindresorhus.com/redirect");
    expect(normalizeUrl("http://sindresorhus.com/redirect/", options)).to.deep.equal("http://sindresorhus.com/redirect/");
    expect(normalizeUrl("http://sindresorhus.com/redirect/", options)).to.deep.equal("http://sindresorhus.com/redirect/");
    expect(normalizeUrl("http://sindresorhus.com/#/")).to.deep.equal("http://sindresorhus.com/#/");
    expect(normalizeUrl("http://sindresorhus.com/#/", options)).to.deep.equal("http://sindresorhus.com/#/");
    expect(normalizeUrl("http://sindresorhus.com/?unicorns=true")).to.deep.equal("http://sindresorhus.com/?unicorns=true");
    expect(normalizeUrl("http://sindresorhus.com/?unicorns=true", options)).to.deep.equal("http://sindresorhus.com/?unicorns=true");
  });
  it("removeSingleSlash option", async () => {
    const options = { removeSingleSlash: false };
    expect(normalizeUrl("https://sindresorhus.com", options)).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("https://sindresorhus.com/", options)).to.deep.equal("https://sindresorhus.com/");
    expect(normalizeUrl("https://sindresorhus.com/redirect", options)).to.deep.equal("https://sindresorhus.com/redirect");
    expect(normalizeUrl("https://sindresorhus.com/redirect/", options)).to.deep.equal("https://sindresorhus.com/redirect");
    expect(normalizeUrl("https://sindresorhus.com/#/", options)).to.deep.equal("https://sindresorhus.com/#/");
    expect(normalizeUrl("https://sindresorhus.com/?unicorns=true", options)).to.deep.equal("https://sindresorhus.com/?unicorns=true");
  });
  it("removeSingleSlash option combined with removeTrailingSlash option", async () => {
    const options = { removeTrailingSlash: false, removeSingleSlash: false };
    expect(normalizeUrl("https://sindresorhus.com", options)).to.deep.equal("https://sindresorhus.com");
    expect(normalizeUrl("https://sindresorhus.com/", options)).to.deep.equal("https://sindresorhus.com/");
    expect(normalizeUrl("https://sindresorhus.com/redirect", options)).to.deep.equal("https://sindresorhus.com/redirect");
    expect(normalizeUrl("https://sindresorhus.com/redirect/", options)).to.deep.equal("https://sindresorhus.com/redirect/");
    expect(normalizeUrl("https://sindresorhus.com/#/", options)).to.deep.equal("https://sindresorhus.com/#/");
    expect(normalizeUrl("https://sindresorhus.com/?unicorns=true", options)).to.deep.equal("https://sindresorhus.com/?unicorns=true");
  });
  it("removeDirectoryIndex option", async () => {
    const options1 = { removeDirectoryIndex: ["index.html", "index.php"] };
    expect(normalizeUrl("http://sindresorhus.com/index.html")).to.deep.equal("http://sindresorhus.com/index.html");
    expect(normalizeUrl("http://sindresorhus.com/index.html", options1)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/index.htm", options1)).to.deep.equal("http://sindresorhus.com/index.htm");
    expect(normalizeUrl("http://sindresorhus.com/index.php", options1)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/path/index.html")).to.deep.equal("http://sindresorhus.com/path/index.html");
    expect(normalizeUrl("http://sindresorhus.com/path/index.html", options1)).to.deep.equal("http://sindresorhus.com/path");
    expect(normalizeUrl("http://sindresorhus.com/path/index.htm", options1)).to.deep.equal("http://sindresorhus.com/path/index.htm");
    expect(normalizeUrl("http://sindresorhus.com/path/index.php", options1)).to.deep.equal("http://sindresorhus.com/path");
    expect(normalizeUrl("http://sindresorhus.com/foo/bar/index.html", options1)).to.deep.equal("http://sindresorhus.com/foo/bar");
    const options2 = { removeDirectoryIndex: [/^index\.[a-z]+$/, "remove.html"] };
    expect(normalizeUrl("http://sindresorhus.com/index.html")).to.deep.equal("http://sindresorhus.com/index.html");
    expect(normalizeUrl("http://sindresorhus.com/index.html", options2)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/index/index.html", options2)).to.deep.equal("http://sindresorhus.com/index");
    expect(normalizeUrl("http://sindresorhus.com/remove.html", options2)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/default.htm", options2)).to.deep.equal("http://sindresorhus.com/default.htm");
    expect(normalizeUrl("http://sindresorhus.com/index.php", options2)).to.deep.equal("http://sindresorhus.com");
    const options3 = { removeDirectoryIndex: true };
    expect(normalizeUrl("http://sindresorhus.com/index.html")).to.deep.equal("http://sindresorhus.com/index.html");
    expect(normalizeUrl("http://sindresorhus.com/index.html", options3)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/index.htm", options3)).to.deep.equal("http://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/index.php", options3)).to.deep.equal("http://sindresorhus.com");
  });
  it("removeTrailingSlash and removeDirectoryIndex options)", async () => {
    const options1 = {
      removeTrailingSlash: true,
      removeDirectoryIndex: true
    };
    expect(normalizeUrl("http://sindresorhus.com/path/", options1)).to.deep.equal("http://sindresorhus.com/path");
    expect(normalizeUrl("http://sindresorhus.com/path/index.html", options1)).to.deep.equal("http://sindresorhus.com/path");
    expect(normalizeUrl("http://sindresorhus.com/#/path/", options1)).to.deep.equal("http://sindresorhus.com/#/path/");
    expect(normalizeUrl("http://sindresorhus.com/foo/#/bar/", options1)).to.deep.equal("http://sindresorhus.com/foo#/bar/");
    const options2 = {
      removeTrailingSlash: false,
      removeDirectoryIndex: true
    };
    expect(normalizeUrl("http://sindresorhus.com/path/", options2)).to.deep.equal("http://sindresorhus.com/path/");
    expect(normalizeUrl("http://sindresorhus.com/path/index.html", options2)).to.deep.equal("http://sindresorhus.com/path/");
    expect(normalizeUrl("http://sindresorhus.com/#/path/", options2)).to.deep.equal("http://sindresorhus.com/#/path/");
  });
  it("sortQueryParameters option", async () => {
    const options1 = {
      sortQueryParameters: true
    };
    expect(normalizeUrl("http://sindresorhus.com/?a=Z&b=Y&c=X&d=W", options1)).to.deep.equal("http://sindresorhus.com/?a=Z&b=Y&c=X&d=W");
    expect(normalizeUrl("http://sindresorhus.com/?b=Y&c=X&a=Z&d=W", options1)).to.deep.equal("http://sindresorhus.com/?a=Z&b=Y&c=X&d=W");
    expect(normalizeUrl("http://sindresorhus.com/?a=Z&d=W&b=Y&c=X", options1)).to.deep.equal("http://sindresorhus.com/?a=Z&b=Y&c=X&d=W");
    expect(normalizeUrl("http://sindresorhus.com/", options1)).to.deep.equal("http://sindresorhus.com");
    const options2 = {
      sortQueryParameters: false
    };
    expect(normalizeUrl("http://sindresorhus.com/?a=Z&b=Y&c=X&d=W", options2)).to.deep.equal("http://sindresorhus.com/?a=Z&b=Y&c=X&d=W");
    expect(normalizeUrl("http://sindresorhus.com/?b=Y&c=X&a=Z&d=W", options2)).to.deep.equal("http://sindresorhus.com/?b=Y&c=X&a=Z&d=W");
    expect(normalizeUrl("http://sindresorhus.com/?a=Z&d=W&b=Y&c=X", options2)).to.deep.equal("http://sindresorhus.com/?a=Z&d=W&b=Y&c=X");
    expect(normalizeUrl("http://sindresorhus.com/", options2)).to.deep.equal("http://sindresorhus.com");
  });
  it("invalid urls", async () => {
    const INVALID_URL_REGEXP = /^Invalid URL: .*$|^Failed to construct 'URL': Invalid URL$|^URL constructor: .* is not a valid URL\.$/;
    expect(() => {
      normalizeUrl("http://");
    }).to.throw(INVALID_URL_REGEXP);
    expect(() => {
      normalizeUrl("/");
    }).to.throw(INVALID_URL_REGEXP);
    expect(() => {
      normalizeUrl("/relative/path/");
    }).to.throw(INVALID_URL_REGEXP);
  });
  it("remove duplicate pathname slashes", async () => {
    expect(normalizeUrl("http://sindresorhus.com////foo/bar")).to.deep.equal("http://sindresorhus.com/foo/bar");
    expect(normalizeUrl("http://sindresorhus.com////foo////bar")).to.deep.equal("http://sindresorhus.com/foo/bar");
    expect(normalizeUrl("//sindresorhus.com//foo", { normalizeProtocol: false })).to.deep.equal("//sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com:5000///foo")).to.deep.equal("http://sindresorhus.com:5000/foo");
    expect(normalizeUrl("http://sindresorhus.com///foo")).to.deep.equal("http://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com:5000//foo")).to.deep.equal("http://sindresorhus.com:5000/foo");
    expect(normalizeUrl("http://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/s3://sindresorhus.com")).to.deep.equal("http://sindresorhus.com/s3://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/s3://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/s3://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com//foo/s3://sindresorhus.com")).to.deep.equal("http://sindresorhus.com/foo/s3://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/git://sindresorhus.com")).to.deep.equal("http://sindresorhus.com/git://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/git://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/git://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com//foo/git://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/foo/git://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/a://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/a:/sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/alongprotocolwithin50charlimitxxxxxxxxxxxxxxxxxxxx://sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx://sindresorhus.com//foo")).to.deep.equal("http://sindresorhus.com/alongprotocolexceeds50charlimitxxxxxxxxxxxxxxxxxxxxx:/sindresorhus.com/foo");
    expect(normalizeUrl("http://sindresorhus.com/a2-.+://sindresorhus.com")).to.deep.equal("http://sindresorhus.com/a2-.+://sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/a2-.+_://sindresorhus.com")).to.deep.equal("http://sindresorhus.com/a2-.+_:/sindresorhus.com");
    expect(normalizeUrl("http://sindresorhus.com/2abc://sindresorhus.com")).to.deep.equal("http://sindresorhus.com/2abc:/sindresorhus.com");
  });
  it("data URL", async () => {
    expect(() => {
      normalizeUrl("data:");
    }).to.throw("Invalid URL: data:");
    expect(normalizeUrl("data:text/plain,foo")).to.deep.equal("data:,foo");
    expect(normalizeUrl("data:;charset=us-ascii,foo")).to.deep.equal("data:,foo");
    expect(normalizeUrl("data:;charset=UTF-8;,foo")).to.deep.equal("data:;charset=utf-8,foo");
    expect(normalizeUrl("data:,")).to.deep.equal("data:,");
    expect(normalizeUrl("data:;charset=utf-8,foo")).to.deep.equal("data:;charset=utf-8,foo");
    expect(normalizeUrl("data:TEXT/HTML,foo")).to.deep.equal("data:text/html,foo");
    expect(normalizeUrl("data:,foo# ")).to.deep.equal("data:,foo");
    expect(normalizeUrl("data:;foo=;bar,")).to.deep.equal("data:;foo;bar,");
    expect(normalizeUrl("data:;charset=UTF-8,foo")).to.deep.equal("data:;charset=utf-8,foo");
    expect(normalizeUrl("data:;base64, Zm9v #foo #bar")).to.deep.equal("data:;base64,Zm9v#foo #bar");
    expect(normalizeUrl("data:, foo #bar")).to.deep.equal("data:, foo #bar");
    const options = {
      defaultProtocol: "http:",
      normalizeProtocol: true,
      forceHttp: true,
      stripHash: true,
      stripWWW: true,
      stripProtocol: true,
      removeQueryParameters: [/^utm_\w+/i, "ref"],
      sortQueryParameters: true,
      removeTrailingSlash: true,
      removeDirectoryIndex: true
    };
    expect(normalizeUrl("data:,sindresorhus.com/", options)).to.deep.equal("data:,sindresorhus.com/");
    expect(normalizeUrl("data:,sindresorhus.com/index.html", options)).to.deep.equal("data:,sindresorhus.com/index.html");
    expect(normalizeUrl("data:,sindresorhus.com?foo=bar&a=a&utm_medium=test", options)).to.deep.equal("data:,sindresorhus.com?foo=bar&a=a&utm_medium=test");
    expect(normalizeUrl("data:,foo#bar", options)).to.deep.equal("data:,foo");
    expect(normalizeUrl("data:,www.sindresorhus.com", options)).to.deep.equal("data:,www.sindresorhus.com");
  });
  it("prevents homograph attack", async () => {
    expect(normalizeUrl("https://eb\u0430y.com")).to.deep.equal("https://xn--eby-7cd.com");
  });
  it("view-source URL", async () => {
    expect(() => {
      normalizeUrl("view-source:https://www.sindresorhus.com");
    }).to.throw("`view-source:` is not supported as it is a non-standard protocol");
  });
  it("does not have exponential performance for data URLs", async () => {
    for (let index = 0; index < 1e3; index += 50) {
      const url = "data:" + Array.from({ length: index }).fill(",#").join("") + "\ra";
      const start = Date.now();
      try {
        normalizeUrl(url);
      } catch {
      }
      const difference = Date.now() - start;
      expect(difference < 100, `Execution time: ${difference}`).to.deep.equal(true);
    }
  });
})();
