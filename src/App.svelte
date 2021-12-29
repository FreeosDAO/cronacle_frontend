<script>
	import { onMount } from "svelte";
	import { ConnectWallet } from "@proton/web-sdk";
	import { Transfer } from "@proton/web-sdk";
	import { Asset } from '@greymass/eosio';
	import SvelteTable from "svelte-table";
	const { JsonRpc, Api } = require('eosjs');

	// endpoints
	const rpc = new JsonRpc("https://proton.greymass.com", { fetch })

	// timing system data
	const AUCTION_LENGTH_SECONDS = 600;            // 10 minutes
	const AUCTION_BIDDING_PERIOD_SECONDS = 540;    // 9 minutes
	let init_secs_utc = 0;
	let now_secs_utc = 0;
	let auction_period = 0;

	// auction data
	let nftid1;
	let nftid2;
	let top_bid = 0;
	let bid_increment = 1;
	let bid1 = ""
	let bid2 = ""
	let bid3 = ""

	// user data
	let registered = false;
	let registered_indicator = "";
	
	// from Auth
	import { AuthClient } from "@dfinity/auth-client"

	// motoko declarations
	import { spda } from "./declarations/spda";

	// from Auth
	let signedIn = false
	let client
	let principal = ""
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

	async function transfer() {
		// Send Transaction
		let amount = parseInt(document.getElementById("transferAmount").value);
		console.log("Amount:"+amount);
		const result = await session.transact({
			transaction: {
				actions: [
					{
						// Token contract for FOOBAR
						account: "xtokens",
						// Action name
						name: "transfer",
						// Action parameters
						data: {
							from: session.auth.actor,
							to: "cronacle",
							quantity: amount+".000000 FOOBAR",
							memo: "Auction credit",
						},
						authorization: [session.auth],
					},
				],
			},
			broadcast: true,
		});
		console.log("Transaction ID", result.processed.id);
	}
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

	function is_bid_time() {
		let auction_elapsed_secs = (now_secs_utc - init_secs_utc) % AUCTION_LENGTH_SECONDS;
		let can_bid = auction_elapsed_secs <= AUCTION_BIDDING_PERIOD_SECONDS ? true : false;

		console.log("can bid = " + can_bid);

		return can_bid;
	}


	// FETCH DATA    FETCH DATA    FETCH DATA    FETCH DATA
	// FETCH DATA    FETCH DATA    FETCH DATA    FETCH DATA
	// FETCH DATA    FETCH DATA    FETCH DATA    FETCH DATA

	async function getSystemInitTime() {
		// get the system record
        let system_params = {
                    json: true,
                    code: 'cronacle', // account containing smart contract
                    scope: 'cronacle', // the subset of the table to query
                    table: 'system', // the name of the table
                    limit: 1 // limit on number of rows returned
            }

        let system_result = await rpc.get_table_rows(system_params);

        let system_init_date = Date.parse(system_result.rows[0].init);

        init_secs_utc = Math.floor(system_init_date / 1000);
		console.log("system init utc seconds = " + init_secs_utc);
	}

	async function getAuctionTimes() {
		const now = new Date()
    	now_secs_utc = Math.floor(now / 1000)

		auction_period = Math.floor((now_secs_utc - init_secs_utc) / AUCTION_LENGTH_SECONDS) + 1;

        console.log("now_secs_utc = " + now_secs_utc + ", auction_period = " + auction_period);
	}

	async function getNFTs() {

		// Method 1 - using the REST API
		//const response_all_nfts = await fetch('https://proton.api.atomicassets.io/atomicassets/v1/assets?owner=cronacle&page=1&limit=100&order=desc&sort=asset_id')
		//const nftdata = await response_all_nfts.json()

		//nftdata.data.forEach(nft => {
			// Log each nft's title
			//console.log(">>>>>>>>>>>>>")
			//console.log("REST API: asset id: " + nft.asset_id)
			//console.log("image: " + nft.template.immutable_data.image)
			//console.log("collection: " + nft.collection.name)
			//console.log("template_mint: " + nft.template_mint)
			//console.log("template issued supply: " + nft.template.issued_supply)
			//console.log("series: " + nft.template.immutable_data.series)
			//console.log("name: " + nft.template.immutable_data.name)
			//console.log("description: " + nft.template.immutable_data.desc)
		//})

		// Method 2 - using the NFTs table
		let nfts_params = {
				json: true,
				code: 'cronacle', // account containing smart contract
				scope: 'cronacle', // the subset of the table to query
				table: 'nfts', // the name of the table
				reverse: false,
				limit: 4 // limit on number of rows returned
			};

		let nfts_result = await rpc.get_table_rows(nfts_params);
		console.log(nfts_result.rows.length + " nft records returned");

		nfts_result.rows.forEach(nft => {
			console.log("Proton table: asset id: " + nft.nftid)
		})

		// display nft 1 info
		const nft1image = document.getElementById("nft1_image");
		const nft1Collection = document.getElementById("nft1_collection");
		const nft1name = document.getElementById("nft1_name");
		const nft1Id = document.getElementById("nft1_id");
		const nft1desc = document.getElementById("nft1_desc");

		// get the REST API data for nft1
		let rest_url1 = 'https://proton.api.atomicassets.io/atomicassets/v1/assets/' + nfts_result.rows[0].nftid
		const response1 = await fetch(rest_url1)
		const nftdata1 = await response1.json()

		nft1image.src = "https://ipfs.io/ipfs/" + nftdata1.data.template.immutable_data.image;
		nft1Id.textContent = "NFT " + nftdata1.data.asset_id;
		nft1Collection.textContent = nftdata1.data.collection.name;
		nft1name.textContent = nftdata1.data.template.immutable_data.name +" (" + nftdata1.data.template_mint + "/" + nftdata1.data.template.issued_supply + ")";
		nft1desc.textContent = nftdata1.data.template.immutable_data.desc;
		
		nftid1 = nftdata1.data.asset_id;

		// display nft 2 info
		const nft2image = document.getElementById("nft2_image");
		const nft2name = document.getElementById("nft2_name")
		const nft2desc = document.getElementById("nft2_desc")

		// get the REST API data for nft2
		let rest_url2 = 'https://proton.api.atomicassets.io/atomicassets/v1/assets/' + nfts_result.rows[1].nftid
		const response2 = await fetch(rest_url2)
		const nftdata2 = await response2.json()

		nft2image.src = "https://ipfs.io/ipfs/" + nftdata2.data.template.immutable_data.image
		nft2name.textContent = "NFT " + nftdata2.data.asset_id + ": " + nftdata2.data.template.immutable_data.name + " (" + nftdata2.data.template_mint + "/" + nftdata2.data.template.issued_supply + ")"

		nftid2 = nftdata2.data.asset_id;
	}


	async function getBids() {
		if (session) {
			console.log('fetching top 3 bids');

			let bids_params = {
				json: true,
				code: 'cronacle', // account containing smart contract
				scope: 'cronacle', // the subset of the table to query
				table: 'bids', // the name of the table
				index_position: 2,	// secondary index
				key_type: 'i64',
				reverse: true,
				limit: 3 // limit on number of rows returned
			};

			let bids_result = await rpc.get_table_rows(bids_params);
			console.log(bids_result.rows.length + " bid records returned");

			/*
			bids_result.rows.forEach(bid => {
				console.log(bid.bidder + " : " + bid.bidamount)
			})
			*/

			if (bids_result.rows.length > 0) {
				bid1 = bids_result.rows[0].bidder + " : " + bids_result.rows[0].bidamount
			} else {
				bid1 = ""
			}
			
			if (bids_result.rows.length > 1) {
				bid2 = bids_result.rows[1].bidder + " : " + bids_result.rows[1].bidamount
			} else {
				bid2 = ""
			}
			
			if (bids_result.rows.length > 2) {
				bid3 = bids_result.rows[2].bidder + " : " + bids_result.rows[2].bidamount
			} else {
				bid3 = ""
			}

			// extract top bid amount (integer)
			if (bids_result.rows.length > 0) {
				let top_bid_foobar = bids_result.rows[0].bidamount
				top_bid = parseInt(top_bid_foobar)
				console.log("top_bid_str = " + top_bid)
			} else {
				// there are no bids so top_bid = 0
				top_bid = 0;
			}

			
		}
	}

	// get user data
	async function getUser() {
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

			registered = registration_result.rows.length == 0 ? false : true;
			registered_indicator = registered == true ? "(registered)" : "";
			console.log("registered_indicator = " + registered_indicator)


			// get the user's credit balance
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
				credit = "0";
			}
			document.getElementById("credit").textContent = credit;
		}
	}

	let lastFetchDataTime = 0;
	// fetch and parse data tables
	async function fetchData() {
		console.log("current time " + (now_secs_utc - lastFetchDataTime));
		if(now_secs_utc - lastFetchDataTime > 10)
		{

			lastFetchDataTime = now_secs_utc
			// enable or disable button based on the time
			let btnBid = document.getElementById("btnBid").disabled = !is_bid_time() || !canBid();

			getUser();
			getNFTs();
			getBids();
			//getAuctions();
			getAuctionTimes();

			// update the bid amount input control
			let inputBidAmount = document.getElementById("bidAmount");
			inputBidAmount.min = inputBidAmount.placeholder = top_bid + bid_increment;
		}

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

	async function bid() {

		// read the bidAmount input control and convert it to a FOOBAR asset
		let amount = parseInt(document.getElementById("bidAmount").value);
		let bid_amount_foobar = amount + ".000000 FOOBAR";

		console.log("Bidding " + bid_amount_foobar + " for nft " + nftid1 + " in auction " + auction_period);

		const bid_amount_asset = Asset.from(bid_amount_foobar);
		console.log("bid_amount_asset : " + bid_amount_asset)

		try {
			const result = await session.transact({
				transaction: {
					actions: [
						{
							// Contract
							account: "cronacle",
							// Action name
							name: "bid",
							// Action parameters
							data: {
								user: session.auth.actor,
								nft_id: nftid1,
								bidamount: bid_amount_foobar
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
		
	}


	onMount(() => {
		
		reconnect();

		// get the system initialisation time in seconds
		getSystemInitTime();

		fetchData();	// i'd like to fetch data as soon as the page loads, but this doesn't seem to work (maybe it is, but just taking time)
		const interval = setInterval(update, 100);

		return () => clearInterval(interval);
	});

	function canBid()
	{
		return session != null && registered;
	}

	
	function update()
	{
		const now = new Date()
		now_secs_utc = Math.floor(now / 1000);
		fetchData();
	}
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
		<h4>Signed in as: {principal}</h4>
		<button on:click={signOut} class="auth-button">Sign out</button>
		{/if}
	</div>
		
	<h1>Welcome back {session.auth.actor}! {#if registered} You are ready to go! {:else} Please register to start bidding!{/if}</h1>

		{#if session && !registered}
		<button class="app-button" on:click={reguser}>Register</button>
		{/if}
		<button class="app-button" on:click={logout}>Proton Logout</button>
	{:else}
		<button class="app-button" on:click={login}>Log In</button>

	{/if}

	<div id="auction-section">
		<h3 class="text-4xl">Current Auction</h3>
		<div id="container1">
			<!-- svelte-ignore a11y-img-redundant-alt -->
			
			<div class="auction-item-display">
				<div class="auction-header auction-container">
					<p id="nft1_name" class="nameHeadline"></p>
					<p id="nft1_collection" class="collectionHeadline"></p>
				</div>
				<div class="auction-nft-image">
					<img src="" id="nft1_image" alt="nft image" width="400px" height="auto" />
				</div>
				<p id="nft1_desc" class="auction-nft-description"></p>
				<p id="nft1_id" class="auction-footer auction-container"></p>
			</div>
			<div id="bid-container">
				
				<div class="bid-form" >
					<h2>Make Your Bid</h2>
					<h3 id="credit">Available Credit: {credit}</h3>
					<input id="transferAmount" type="number" min="1"/>
					<button class="px-4 py-2 btn-primary" id="btnTransfer" on:click={transfer}>Transfer</button>
					<input id="bidAmount" type="number" min="1"/>
					<img src="https://foobar.protonchain.com/images/coin.svg" class="inline-block foobar-icon px-4 py-2" alt="FOOBAR"/>
					<button class="inline-block px-4 py-2 btn-primary rounded rounded-l-none" id="btnBid" on:click={bid}>Bid</button>
					<p id="hint" class="hint">You need to be logged in and registered to bid for this auction</p>
				</div>
			</div>			
		</div>
	</div>

	<div>
		<strong>Auction Leaderboard</strong>
		<p>{bid1}</p>
		<p>{bid2}</p>
		<p>{bid3}</p>
	</div>

	<div>
		<h3 class="text-4xl">Next Auction</h3>
		<div id="container2" class="container">
			<!-- svelte-ignore a11y-img-redundant-alt -->
			<p id="nft2_name"></p>
			<img src="" id="nft2_image" alt="nft image" width="200px" height="auto" />
		</div>
	</div>
</main>

<footer class="bg-secondary z-10 relative py-8 text-white">
	<div id="footer-logo-container">
		<a href="https://freeos.io" target="_blank" rel="noopener" class="inline-flex mx-auto flex-col justify-center bg-secondary p-8 rounded-freeos-logo">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" class="freeos-logo-icon fill-current text-white" style="width:8rem">
				<path d="M41.7 0C18.7 0 0 18.7 0 41.7c0 23 18.7 41.7 41.7 41.7 23 0 41.7-18.7 41.7-41.7C83.4 18.7 64.8 0 41.7 0zM26.9 68.6c-2.7 0-5.3-1-7.3-2.8-13.3-12.2-14.2-32.9-2-46.3C23.8 12.8 32.6 9 41.7 9c1.7 0 3.4.1 5.1.4h.2c-5.6 2.3-9.7 7.5-10.6 13.5-.1.6-.2 1.3-.2 1.9V26c-.1 4.1.1 8.2.6 12.3l-10.6 3.9c-.7.3-1.1 1.1-.8 1.8l.5 1.2c1.4 4 5.8 6 9.8 4.6.4-.2.9-.4 1.3-.6l1-.6.3-.2v.4c.2 3 .1 6-.2 9H38c0 .3 0 .6-.1 1-.1.6-.2 1.2-.4 1.8-1.4 4.8-5.7 8-10.6 8zm14.8 5.9c-1.8 0-3.7-.2-5.5-.5 6-2.5 10.1-8 10.8-14.5.7-5.4.7-10.9-.1-16.3l10.8-6.4c1.2-.7 1.7-2.2 1.2-3.5l-.1-.3c-.5-1.4-2-2.1-3.4-1.6L45.9 35l-.2.1V35c-.4-2.8-.5-5.7-.4-8.5.4-8.3 5.3-11.7 11.3-11.6 2.5.1 4.8.9 6.8 2.4.5.4.9.8 1.4 1.3 12.8 12.6 12.9 33.3.2 46.2-6.2 6.2-14.5 9.7-23.3 9.7z"></path>
			</svg>
				
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 120" class="freeos-logo-text fill-current text-white mt-2 mx-auto" style="width:6rem">
				<path d="M262.4 34.4c-18.1 0-31.2 15.8-31.2 32.9 0 14.4 9.6 24.6 26.3 24.6 18.1 0 31.2-15.6 31.2-32.8 0-14.4-9.6-24.7-26.3-24.7zm-4.5 47c-9 0-14.3-5.7-14.3-14.6 0-11.1 7.6-21.8 18.5-21.8 9 0 14.3 5.7 14.3 14.6 0 11.2-7.6 21.8-18.5 21.8zM318.4 57.4c-5.7-2-10.5-3.9-10.5-7 0-3.6 3.5-6.5 9.6-6.5 6.8 0 13.6 3.6 16.2 7.3l6.3-7.8c-4.5-5.2-12.9-9-22.2-9-14.1 0-21.8 8.5-21.8 17.8 0 9.1 9.4 12.5 17.3 15.3 5.8 2 10.9 3.9 10.9 7.6 0 3.9-3.7 7.4-9.9 7.4-8 0-15.6-4.5-18.7-8.6l-7 8.3c5.7 6.3 14.7 9.7 24.7 9.7 14.4 0 22.8-8.6 22.8-18.7 0-9.4-9.7-12.9-17.7-15.8zM111.4 46.9l2.8-12.8h-.5c-7.9 0-13.7 2.4-19.1 8l1.6-6.8H83.5L71.2 90.9h12.7l8.2-37.3c2.8-3.4 8.1-7.4 14.1-7.4 2.1 0 4 .3 4.8.6l.4.1zM141.8 34c-17.8 0-31.7 14.7-31.7 33.4 0 15.3 10.7 24.9 28 24.9 7 0 14.3-2.3 19.5-6.1l.3-.2-4.1-9-.4.3c-3.5 2.7-9.2 4.5-14.4 4.5-10.6 0-16.3-6.6-16.3-12.7l.1-1.6h42.3l.1-.3c.5-1.9 1-5.6 1-8.5.1-14.8-9.7-24.7-24.4-24.7zm13 24.3h-30.6c1.5-6.7 7.8-13.7 16.6-13.7 8.5 0 14 4.9 14 12.5.1.3.1.8 0 1.2zM202.2 34c-17.8 0-31.7 14.7-31.7 33.4 0 15.3 10.7 24.9 28 24.9 7 0 14.3-2.3 19.5-6.1l.3-.2-4.1-9-.4.3c-3.5 2.7-9.2 4.5-14.4 4.5-10.6 0-16.3-6.6-16.3-12.7l.1-1.6h42.3l.1-.3c.5-1.9 1-5.6 1-8.5.1-14.8-9.7-24.7-24.4-24.7zm13.1 24.3h-30.6c1.5-6.7 7.8-13.7 16.6-13.7 8.5 0 14 4.9 14 12.5v1.2zM75.2 33.1H58.5l1.3-5.6c2.3-10.5 7-15.3 14.8-15.3 3-.1 6.1.7 8.6 2.4l.3.2 5.3-9.6-.3-.2c-4.5-2.7-9.7-4-15-3.8-14.1 0-23.3 8.8-27.3 26.2L44.9 33H31.3l-2.7 11.6h13.6l-7.4 32.5-2.9 10-1.7 6c-2.8 10.3-7.8 15-15.6 14.6-3 0-6-1-8.5-2.8l-.3-.3-5.8 9.3.3.2c4.4 2.9 9.5 4.5 14.8 4.6h1.7c13.2 0 22.3-8.3 27-24.8l1.7-6.1.2-1 10.2-42.2h16.7l2.6-11.5z"></path>
			</svg>
		</a>
	</div>
</footer>

<style>
	main {
		text-align: center;
		padding: 1em 0;
		max-width: 240px;
		margin: 0 auto;
		color: var(--color-text);
	}
	


	.app-button {
		font-weight: 600;
		font-size: 1.125rem;
		padding: 10px 25px;
	}

	@media (min-width: 400px) {
		main {
			max-width: none;
		}
	}

	.auth-section {
        padding: 0.2em 0.6em;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        text-align: right;
        position: fixed;
		width: auto;
		background-color: whitesmoke;
		box-shadow: 0 0.4rem 0.4rem rgb(0 0 0 / 5%);
        top: 0;
        right: 0;
		left: 0;
		z-index: 50;
    }

	.hint
	{
		border-left-style: solid;
		border-left-width: 0.3em;
		padding: 0.5em 0.5em;
		border-left-color: var(--color-primary);
		background-color: #414141;
		color: whitesmoke;
		width: fit-content;
		margin: 0.6em auto;
	}

	.collectionHeadline
	{
		font-size: 1em;
		font-weight: bold;
		margin: 0.4em 0.1em;
	}

	.nameHeadline
	{
		font-size: 1.5em;
		font-weight: bold;
		margin: 0.4em 0.1em;
	}

	#auction-section
	{
		padding: 1em 0;
        display: block;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
	}

	.auction-nft-image
	{
		display: block;
		margin: 0 0;
		padding: 0.5em 0.5em;
		line-height: 0;
		background-color: var(--color-tertiary);
	}

	.auction-nft-description
	{
		margin: 0 0;
    	padding: 0.6em 0.6em;
	}

	.auction-item-display
	{
		padding: 0;
		margin: auto;
		align-items: center;
		text-align: center;
		color: var(--color-text);
		border-radius: 15px;
		border-color: var(--color-secondary);
		border-style: solid;
		border-width: 0.01em;
		background-color: white;
		width: 420px;
	}

	.auction-container
	{
		background-color: var(--color-secondary);
		padding: 0.6em 0.6em;
		margin: 0 0;
		color: whitesmoke;
		text-transform: none;
		font-size: 1em;
		font-weight: bold;
		display: block;
	}

	.auction-header
	{
		border-top-left-radius: 10px;
		border-top-right-radius: 10px;
	}

	.auction-footer
	{
		border-bottom-left-radius: 10px;
		border-bottom-right-radius: 10px;
	}

	#bid-container
	{
		margin: auto auto;
	}

	.bid-form {
		margin: 1em 0;
		padding: 0.6em 0.6em;
		background-color: var(--color-tertiary);
	}

	.foobar-icon {
		width: 50px;
		padding: 0em 0.6em 0 0;
		bottom: 3px;
		height: 50px;
		outline: 0;
		vertical-align: middle;
		border: 0;
		position: relative;
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

	#footer-logo-container
	{
		margin: 2em 0;
		display: flex;   
		justify-content: center;
		text-align:center;
	}

	.rounded-freeos-logo {
		border-radius: 9999px;
		border-style: solid;
		border-color: var(--color-secondary);
		border-width: 2rem;
		transform: translateY(-2rem);
		color: whitesmoke;
		fill: whitesmoke;
	}

	
	.rounded-l-none {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.rounded {
		border-radius: 0.25rem;
	}
	

</style>