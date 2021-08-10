import alias from '@rollup/plugin-alias';
import {terser} from 'rollup-plugin-terser';
import {getBabelOutputPlugin} from '@rollup/plugin-babel';

const config = [
	{
		input: 'index.js',
		output: [
			{
				file: 'browser-test/normalizeUrl.esm.js',
				format: 'esm',
				plugins: [
					getBabelOutputPlugin({
						moduleId: 'normalizeUrl',
						presets: [['@babel/env']],
					}),
				],
			},
			{
				file: 'browser-test/normalizeUrl.umd.min.js',
				format: 'esm',
				plugins: [
					getBabelOutputPlugin({
						moduleId: 'normalizeUrl',
						presets: [['@babel/env', {modules: 'umd'}]],
					}),
					terser(),
				],
			},
		],
	},
	{
		input: 'test.js',
		external: ['chai', 'normalize-url'],
		plugins: [
			alias({
				entries: [
					{find: './index.js', replacement: 'normalize-url'},
				],
			}),
		],
		output: {
			globals: {
				chai: 'chai',
				'normalize-url': 'normalizeUrl',
			},
			file: 'browser-test/tests.spec.js',
			format: 'iife',
			plugins: [
				getBabelOutputPlugin({
					allowAllFormats: true,
					presets: ['@babel/env'],
				}),
			],
		},
	},
];

export default config;
