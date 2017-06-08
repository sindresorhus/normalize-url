/// Type definitions for normalize-url

declare module NormalizeUrl {
  interface INormalizeUrlArgs {
		normalizeProtocol: boolean;
		normalizeHttps: boolean;
		stripFragment: boolean;
		stripWWW: boolean;
		removeQueryParameters: string[];
		removeTrailingSlash: boolean;
		removeDirectoryIndex: RegExp[];
	}
								
	function normalizeUrl(url: string, args?: INormalizeUrlArgs): string;
}

export = NormalizeUrl.normalizeUrl;
