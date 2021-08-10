module.exports = function (config) {
	config.set({
		plugins: [
			'karma-mocha',
			'karma-chai',
			'karma-firefox-launcher',
			'karma-chrome-launcher',
		],

		// Base path that will be used to resolve all patterns (eg. files, exclude)
		basePath: '',

		// Frameworks to use
		// available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
		frameworks: ['mocha', 'chai'],

		// List of files / patterns to load in the browser
		files: [
			'browser-test/normalizeUrl.umd.min.js',
			'browser-test/tests.spec.js',
		],

		// List of files / patterns to exclude
		exclude: [
		],

		// Preprocess matching files before serving them to the browser
		// available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
		preprocessors: {},

		// Test results reporter to use
		// possible values: 'dots', 'progress'
		// available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
		reporters: ['progress'],

		// Web server port
		port: 9876,

		// Enable / disable colors in the output (reporters and logs)
		colors: true,

		// Level of logging
		// possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
		logLevel: config.LOG_INFO,

		// Enable / disable watching file and executing tests whenever any file changes
		autoWatch: true,

		// Start these browsers
		// available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
		browsers: ['ChromeNoExt', 'FirefoxNoExt'],

		customLaunchers: {
			ChromeNoExt: {
				// Desc: name of output subdir
				// @ts-ignore
				displayName: 'chrome',
				base: 'ChromeHeadless',
				flags: ['--disable-extensions', '--disable-plugins'],
			},

			FirefoxNoExt: {
				// Desc: name of output subdir
				// @ts-ignore
				displayName: 'firefox',
				base: 'FirefoxHeadless',
				// Flags: ["-safe-mode"],

				prefs: {
					// #ref: https://extensionworkshop.com/documentation/enterprise/enterprise-distribution/
					'extensions.enabledScopes': 0,
					'toolkit.telemetry.reportingpolicy.firstRun': false,
				},
				extensions: [],
			},
		},

		// Continuous Integration mode
		// if true, Karma captures browsers, runs the tests and exits
		singleRun: !process.argv.includes('--watch'),

		// Concurrency level
		// how many browser instances should be started simultaneously
		concurrency: Number.POSITIVE_INFINITY,
	});
};
