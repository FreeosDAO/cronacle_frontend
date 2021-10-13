<script>
	import { onMount } from "svelte";
	import { ConnectWallet } from "@proton/web-sdk";
	import Auth from "./Auth.svelte"
	import principal_id from "./Auth.svelte"

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

	async function storeid() {

		//let principal_id = principal;
		//alert(principal_id)
		console.log("App. principal_id = " + principal_id)

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
							principal: principal_id
						},
						authorization: [session.auth],
					},
				],
			},
			broadcast: true,
		});
		// console.log("Transaction ID", result.processed.id);

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

	onMount(() => {
		reconnect();
	});
</script>

<main>
	{#if session}
		<Auth />
		
		<h1>Account: {session.auth.actor}</h1>
		<button class="app-button" on:click={storebtc}>Store BTC price</button>
		<button class="app-button" on:click={storeid}>Store Id</button>
		<button class="app-button" on:click={logout}>Logout</button>
	{:else}
		<button class="app-button" on:click={login}>Login</button>
	{/if}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 2em;
		font-weight: 100;
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
</style>
