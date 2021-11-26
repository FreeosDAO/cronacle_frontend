const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

const mode = process.env.NODE_ENV || 'development';
const prod = mode === 'production';

let localCanisters, prodCanisters, canisters;

function initCanisterIds() {
  try {
    localCanisters = require(path.resolve(".dfx", "local", "canister_ids.json"));
  } catch (error) {
    console.log("No local canister_ids.json found. Continuing production");
  }
  try {
    prodCanisters = require(path.resolve("canister_ids.json"));
  } catch (error) {
    console.log("No production canister_ids.json found. Continuing with local");
  }

  const network =
    process.env.DFX_NETWORK ||
    (process.env.NODE_ENV === "production" ? "ic" : "local");

  canisters = network === "local" ? localCanisters : prodCanisters;

  for (const canister in canisters) {
    process.env[canister.toUpperCase() + "_CANISTER_ID"] =
      canisters[canister][network];
  }

  return process.env;
}
//initCanisterIds();
const canisterEnvVariables = initCanisterIds();
const frontendDirectory = "spda_assets";


module.exports = {
	entry: {
		'build/bundle': ['./src/main.js']
	},
	resolve: {
		alias: {
			svelte: path.dirname(require.resolve('svelte/package.json'))
		},
		extensions: ['.mjs', '.js', '.svelte'],
		mainFields: ['svelte', 'browser', 'module', 'main']
	},
	output: {
		path: path.join(__dirname, '/public'),
		filename: '[name].js',
		chunkFilename: '[name].[id].js'
	},
	module: {
		rules: [
			{
				test: /\.svelte$/,
				use: {
					loader: 'svelte-loader',
					options: {
						compilerOptions: {
							dev: !prod
						},
						emitCss: prod,
						hotReload: !prod
					}
				}
			},
			{
				test: /\.css$/,
				use: [
					MiniCssExtractPlugin.loader,
					'css-loader'
				]
			},
			{
				// required to prevent errors from Svelte on Webpack 5+
				test: /node_modules\/svelte\/.*\.mjs$/,
				resolve: {
					fullySpecified: false
				}
			}
		]
	},
	mode,
	plugins: [
		new NodePolyfillPlugin(),
		new MiniCssExtractPlugin({
			filename: '[name].css'
		}),
		new webpack.EnvironmentPlugin({
			NODE_ENV: "development",
			...canisterEnvVariables,
		  }),
	],
	devtool: prod ? false : 'source-map',
	devServer: {
		proxy: {
		  "/api": {
			target: "http://localhost:8000",
			changeOrigin: true,
			pathRewrite: {
			  "^/api": "/api",
			},
		  },
		},
		hot: true,
		watchFiles: [path.resolve(__dirname, "src", frontendDirectory)],
		liveReload: true,
	  },
};
