<script>
	import { onMount } from "svelte";
	import { ConnectWallet } from "@proton/web-sdk";
	import SvelteTable from "svelte-table";
	const { JsonRpc } = require('eosjs');

	// endpoints
	const rpc = new JsonRpc("https://proton.greymass.com", { fetch })
	const rpctestnet = new JsonRpc("https://protontestnet.greymass.com", { fetch })

	// from Auth
	import { AuthClient } from "@dfinity/auth-client"

	// motoko declarations
	import { spda } from "./declarations/spda";

	// from Auth
	let signedIn = false
	let client
	let principal = ""
	let registered = false;
	let registered_indicator = "";
	let credit = "";

	const initAuth = async () => {
		client = await AuthClient.create()
		const isAuthenticated = await client.isAuthenticated()

		if (isAuthenticated) {
		const identity = client.getIdentity()
		principal = identity.getPrincipal().toString()
		console.log("Auth. already authenticated. principal = " + principal)      
		signedIn = true
		}
	}

	const signIn = async () => {
		const result = await new Promise((resolve, reject) => {
		client.login({
			identityProvider: "https://identity.ic0.app",
			onSuccess: () => {
			const identity = client.getIdentity()
			const principal = identity.getPrincipal().toString()
			resolve({ identity, principal })
			},
			onError: reject,
		})
		})
		principal = result.principal
		console.log("Auth. signed in. principal = " + principal)
		signedIn = true
	}

	const signOut = async () => {
		await client.logout()
		signedIn = false
		principal = ""
		principal_id = principal
		console.log("Auth. signed out. principal id = " + principal)
	}

	onMount(initAuth)	// TODO - merge onMount code
	// end of from Auth

	// Constants
	const appIdentifier = "cronacle";
	let link, session;

	async function createLink({ restoreSession }) {
		const result = await ConnectWallet({
			linkOptions: {
				endpoints: ["https://proton.greymass.com"],
				restoreSession,
			},
			transportOptions: {
				requestAccount: "myprotonacc", // Your proton account
				requestStatus: true,
			},
			selectorOptions: {
				appName: "Cronacle",
				appLogo:
					"https://freeos.io/freeos-appLogo.svg?v=3",
				customStyleOptions: {
					modalBackgroundColor: "#F4F7FA",
					logoBackgroundColor: "white",
					isLogoRound: true,
					optionBackgroundColor: "white",
					optionFontColor: "black",
					primaryFontColor: "black",
					secondaryFontColor: "#6B727F",
					linkColor: "#752EEB",
				},
			},
		});
		link = result.link;
		session = result.session;
	}

	async function login() {
		// Create link
		await createLink({ restoreSession: false });
		console.log("User authorization:", session.auth); // { actor: 'fred', permission: 'active }
	}

	async function proton_storeid() {

		//let principal_id = principal;
		//alert(principal_id)
		console.log("App. principal = " + principal)

		// store the value
		// Send Transaction
		const result = await session.transact({
			transaction: {
				actions: [
					{
						// Token contract for btc records
						account: "cronacle",
						// Action name
						name: "storeid",
						// Action parameters
						data: {
							user: session.auth.actor,
							principal: principal
						},
						authorization: [session.auth],
					},
				],
			},
			broadcast: true,
		});
		// console.log("Transaction ID", result.processed.id);

	}

	async function ic_storeid() {
		console.log("In ic_storeid")
		console.log(principal)
		console.log(session.auth.actor)
		const dfinity_result = await spda.storeid(session.auth.actor, principal)
		console.log(dfinity_result)
	}


	async function storebtc() {

		var request = new XMLHttpRequest() // inserted the CoinGecko stuff from prior
		let btc_value = "";

		// Open a new connection, using the GET request on the URL endpoint
		request.open('GET', 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin', true)

		request.onload = function () {
		// Begin accessing JSON data here
		var newdata = JSON.parse(this.response)
		console.log(newdata)

		newdata.forEach((object) => {
			console.log(object.name)
			console.log(object.current_price)
			// `vm.a` is now reactive
			// document.getElementById('demo').innerHTML = object.current_price + ' is the price of Bitcoin' // this displays the price up in the template.  There might be a more Vue way to do this, but I don't know how.
			btc_value = object.current_price;
		})

		// store the value
		// Send Transaction
		const result = session.transact({
			transaction: {
				actions: [
					{
						// Token contract for btc records
						account: "cronacle",
						// Action name
						name: "storebtc",
						// Action parameters
						data: {
							btcprice: btc_value
						},
						authorization: [session.auth],
					},
				],
			},
			broadcast: true,
		});
		// console.log("Transaction ID", result.processed.id);
		}

		// Send request
		request.send()

	}

	async function logout() {
		await link.removeSession(appIdentifier, session.auth);
		session = undefined;
	}

	async function reconnect() {
		try {
			await createLink({ restoreSession: true });
		} catch (e) {
			console.warn(e);
		}
	}


	// FETCH DATA    FETCH DATA    FETCH DATA    FETCH DATA
	// FETCH DATA    FETCH DATA    FETCH DATA    FETCH DATA
	// FETCH DATA    FETCH DATA    FETCH DATA    FETCH DATA

	async function getNFTData() {
		const response = await fetch('https://proton.api.atomicassets.io/atomicassets/v1/assets?owner=cronacle&page=1&limit=100&order=desc&sort=asset_id')
		const nftdata = await response.json()

		//nftdata.data.forEach(nft => {
			// Log each nft's title
			//console.log(">>>>>>>>>>>>>")
			//console.log("asset id: " + nft.asset_id)
			//console.log("image: " + nft.template.immutable_data.image)
			//console.log("collection: " + nft.collection.name)
			//console.log("template_mint: " + nft.template_mint)
			//console.log("template issued supply: " + nft.template.issued_supply)
			//console.log("series: " + nft.template.immutable_data.series)
			//console.log("name: " + nft.template.immutable_data.name)
			//console.log("description: " + nft.template.immutable_data.desc)
		//})

		// display nft info
		// nft 1
		const nft1image = document.getElementById("nft1_image");
		const nft1name = document.getElementById("nft1_name")
		const nft1desc = document.getElementById("nft1_desc")

		nft1image.src = "https://ipfs.io/ipfs/" + nftdata.data[0].template.immutable_data.image
		nft1name.textContent = "NFT " + nftdata.data[0].asset_id + ": " + nftdata.data[0].template.immutable_data.name + " (" + nftdata.data[0].template_mint + "/" + nftdata.data[0].template.issued_supply + ")"
		nft1desc.textContent = nftdata.data[0].template.immutable_data.desc

		// nft 2
		const nft2image = document.getElementById("nft2_image");
		const nft2name = document.getElementById("nft2_name")
		const nft2desc = document.getElementById("nft2_desc")

		nft2image.src = "https://ipfs.io/ipfs/" + nftdata.data[1].template.immutable_data.image
		nft2name.textContent = "NFT " + nftdata.data[1].asset_id + ": " + nftdata.data[1].template.immutable_data.name + " (" + nftdata.data[1].template_mint + "/" + nftdata.data[1].template.issued_supply + ")"
		nft2desc.textContent = nftdata.data[1].template.immutable_data.desc
		
	}

	// fetch and parse data tables
	async function fetchData() {

		// if (typeof session !== "undefined") {
		if (session) {
			console.log('fetching user data for ' + session.auth.actor);

			// is the user registered?
			let registration_params = {
					json: true,
					code: 'cronacle', // account containing smart contract
					scope: session.auth.actor, // the subset of the table to query
					table: 'users', // the name of the table
					lower_bound: session.auth.actor,
					limit: 1 // limit on number of rows returned
			};

			let registration_result = await rpc.get_table_rows(registration_params);
			console.log(registration_result.rows.length + " user records returned")

			// Number of elements returned: result.rows.length;
			// A particular value from the first element: result.rows[0].dfinity_principal

			let registered = registration_result.rows.length == 0 ? false : true;
			let registered_indicator = registered == true ? "(registered)" : "";
			console.log("registered_indicator = " + registered_indicator)

			// the user's credit balance
			let credit_params = {
					json: true,
					code: 'cronacle', // account containing smart contract
					scope: session.auth.actor, // the subset of the table to query
					table: 'credits', // the name of the table
					//lower_bound: session.auth.actor,
					limit: 1 // limit on number of rows returned
			}

			let credit_result = await rpc.get_table_rows(credit_params);

			//console.log("credit start")
			if (credit_result.rows.length > 0) {
				credit = credit_result.rows[0].amount;
			} else {
				credit = "";
			}
		}

		getNFTData()
		

		// Iterate over the registration records
		// registration_result.rows.forEach(element => console.log(element.proton_account + " " + element.dfinity_principal));
	}

	async function reguser() {
		console.log("registering " + session.auth.actor);

		try {
			const result = await session.transact({
				transaction: {
					actions: [
						{
							// Contract
							account: "cronacle",
							// Action name
							name: "reguser",
							// Action parameters
							data: {
								user: session.auth.actor
							},
							authorization: [session.auth],
						},
					],
				},
				broadcast: true,
			});
		} catch (e) {
			console.log(e);
		}

		// console.log(result);
	}

	let bidamount = "1.000000 FOOBAR";

	async function bid() {

		
	}


	onMount(() => {
		
		reconnect();

		fetchData();	// i'd like to fetch data as soon as the page loads, but this doesn't seem to work
		const interval = setInterval(fetchData, 10000);

		return () => clearInterval(interval);
	});
</script>

<main>
	{#if session}
	<div class="auth-section">

		{#if !signedIn && client}
		<button on:click={signIn} class="auth-button">
			Internet Identity Sign In
		</button>
		{/if}
	
		{#if signedIn}
		<h2>Signed in as: {principal}</h2>
		<button on:click={signOut} class="auth-button">Sign out</button>
		{/if}
	</div>
		
		<h1>{session.auth.actor} {registered_indicator}</h1>
		<h2>Credit: {credit}</h2>
		{#if session && !registered}
		<button class="app-button" on:click={reguser}>Proton Register</button>
		{/if}
		<button class="app-button" on:click={storebtc}>Store BTC price</button>
		<button class="app-button" on:click={proton_storeid}>Proton Store ID</button>
		<button class="app-button" on:click={ic_storeid}>IC Store ID</button>
		<button class="app-button" on:click={logout}>Proton Logout</button>
	{:else}
		<button class="app-button" on:click={login}>Proton Sign In</button>
	{/if}

	<div>
		<h3>Current Auction</h3>
		<div id="container1" class="container">
			<!-- svelte-ignore a11y-img-redundant-alt -->
			<img
				src=""
				id="nft1_image"
				alt="nft image"
				width="300px"
				height="auto" />
			<p id="nft1_name"></p>
			<p id="nft1_desc"></p>
			<button class="app-button" on:click={bid}>Bid</button>
			<input type="number" min="1" /> FOOBAR
		</div>
	</div>

	<div>
		<h3>Next Auction</h3>
		<div id="container2" class="container">
			<!-- svelte-ignore a11y-img-redundant-alt -->
			<img
				src=""
				id="nft2_image"
				alt="nft image"
				width="200px"
				height="auto" />
			<p id="nft2_name"></p>
			<p id="nft2_desc"></p>
		</div>
	</div>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}
	
	h1 {
		color: #2600ff;
		padding: 2em;
		text-transform: none;
		font-size: 2em;
		font-weight: 100;
	}

	h2 {
		color: black;
		padding: 1em;
		font-size: 0.5em;
		font-weight: 50;
	}

	.app-button {
		font-weight: 600;
		font-size: 1.125rem;
		padding: 10px 25px;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}

	.auth-section {
        padding: 1em;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        text-align: right;
        position: fixed;
        top: 0;
        right: 0;
    }

    .auth-button {
        color: black;
        background: white;
        padding: 0 2em;
        border-radius: 60px;
        font-size: 1em;
        line-height: 40px;
        height: 33px;
        outline: 0;
        border: 0;
        cursor: pointer;
        text-decoration: underline;
        display: flex;
        align-items: center;
    }

</style>