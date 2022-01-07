<script>
	import { onMount } from "svelte";
	import { ConnectWallet } from "@proton/web-sdk";
	import { Asset } from '@greymass/eosio';
	import SvelteTable from "svelte-table";
	const { JsonRpc, Api } = require('eosjs');
	// from Auth
	import { AuthClient } from "@dfinity/auth-client"

	// motoko declarations
	import { spda } from "./declarations/spda";

	// endpoints
	const rpc = new JsonRpc("https://proton.greymass.com", { fetch })

	$: title = "freeos Cronacle"

	$: {
		document.title = title
	}

	// timing system data
	let auctionLengthSeconds = 600;            // 10 minutes - inital value
	let auctionBiddingPeriodSeconds = 540;    // 9 minutes - initial value


	let bitcoinPrice = 0;
	let init_secs_utc = 0;
	let now_secs_utc = 0;
	let auction_period = 0;

	let fetchDataUpdateTimeSeconds = 0;
	let fetchDataIntervalSeconds = 10;
	let auctionNFTId = -1;

	// auction data
	let top_bid = 0;
	let bid_increment = 1;
	let bid1 = ""
	let bid2 = ""
	let bid3 = ""

	let currentAuction = null;
	let auctionBids = [];
	let nfts = [];

	// user data
	let isUserRegistered = false;
	let registered_indicator = "";
	
	const auctionsLoadingText = "Loading auctions...";
	const auctionsCompleteText = "All auctions are complete. Thank you for your participation!";
	let auctionsLoaded = false;

	// from Auth
	let signedInInternetIdentity = false
	let client
	let principal = ""
	let totalCredit = "";

	const initAuth = async () => {
		client = await AuthClient.create()
		const isAuthenticated = await client.isAuthenticated()

		if (isAuthenticated) {
		const identity = client.getIdentity()
		principal = identity.getPrincipal().toString()
		console.log("Auth. already authenticated. principal = " + principal)      
		signedInInternetIdentity = true
		}
	}

	const signInInternetIdentity = async () => {
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
		signedInInternetIdentity = true
	}

	const signOutInternetIdentity = async () => {
		await client.logout()
		signedInInternetIdentity = false
		principal = ""
		principal_id = principal
		console.log("Auth. signed out. principal id = " + principal)
	}

	onMount(initAuth)	// TODO - merge onMount code

	async function deposit() {

		try {
			let amount = parseInt(document.getElementById("depositAmount").value);
			const result = await session.transact({
				transaction: {
					actions: [
						{
							account: "xtokens",
							// Action name
							name: "transfer",
							// Action parameters
							data: {
								from: session.auth.actor,
								to: "cronacle",
								quantity: amount+".000000 FOOBAR",
								memo: "auction credit"
							},
							authorization: [session.auth],
						},
					],
				},
				broadcast: true,
			});
			
			console.log("Transaction ID", result.processed.id);
			await getCredits();
		} catch (error) {
			displayRequestError(error);
		}
		
		
	}

	async function withdraw() {
		try {
			const result = await session.transact({
				transaction: {
					actions: [
						{
							account: "cronacle",
							// Action name
							name: "withdraw",
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
			console.log("Transaction ID", result.processed.id);
		} catch (error) {
			displayRequestError(error);
		}
	}


	async function getParameters() {
		try {
			let params = {
                    json: true,
                    code: 'cronacle', // account containing smart contract
                    scope: 'cronacle', // the subset of the table to query
                    table: 'parameters', // the name of the table
            }

			let result = await rpc.get_table_rows(params);

			
			for(let i = 0; i < result.rows.length; i++)
			{
				var entry = result.rows[i];
				console.log("Loaded parameter '"+ entry.paramname + "' with value: " + entry.value);
				switch(entry.paramname)
				{
					case "auctperiod": auctionLengthSeconds = parseInt(entry.value); break;
					case "bidperiod": auctionBiddingPeriodSeconds = parseInt(entry.value); break;
					case "minimumbid": bid_increment = parseInt(entry.value); break;
				}
			}
			console.log("parameter loading complete!");

			
		} catch (error) {
			displayRequestError(error);
		}
	}

	async function claimNFT() {
		try {
			const result = await session.transact({
				transaction: {
					actions: [
						{
							account: "cronacle",
							// Action name
							name: "claim",
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
			console.log("Transaction ID", result.processed.id);
			auctionBids = null;

			await getBids();
			nfts = [];
			await getNFTs();
			
			currentAuction = null;
			await getAuctions();
		} catch (error) {
			displayRequestError(error);
		}
		
		
	}
	// end of from Auth

	// Constants
	const appIdentifier = "cronacle";
	let link, session;

	async function createLink({ restoreSession }) {
		try {
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
		} catch (error) {
			displayRequestError(error);
		}
		
	}

	async function login() {
		// Create link
		try {
			await createLink({ restoreSession: false });
		} catch (error) {
			displayRequestError(error);
		}
		
		console.log("User authorization:", session.auth); // { actor: 'fred', permission: 'active }
	}

	async function logout() {
		await link.removeSession(appIdentifier, session.auth);
		session = undefined;
	}

	async function reconnect() {
		try {
			await createLink({ restoreSession: true });
		} catch (e) {
			displayRequestError(e);
		}
	}

	function isBidTime() {
		let auction_elapsed_secs = (now_secs_utc - init_secs_utc) % auctionLengthSeconds;
		let can_bid = auction_elapsed_secs <= auctionBiddingPeriodSeconds ? true : false;

		return can_bid;
	}

	function getNFTCollectionURL()
	{
		return "https://www.protonmarket.com/user/"+ session.auth.actor;
	}

	function getFOOBARFaucetURL()
	{
		return "https://foobar.protonchain.com/";
	}

	function getFOOBARExchangeURL()
	{
		return "https://proton.alcor.exchange/markets";
	}


	function getRemainingAuctionTimeS()
	{
		let auction_elapsed_secs = (now_secs_utc - init_secs_utc) % auctionLengthSeconds;
		let remainingSeconds = auctionBiddingPeriodSeconds - auction_elapsed_secs;
		return new Date(remainingSeconds * 1000).toISOString().substring(11, 19);
	}

	function getAvailableCredit()
	{
		let credit = parseInt(totalCredit);
		
		for(let i = 0; i < auctionBids.length; i ++)
		{
			let bid = auctionBids[i];
			if(bid.bidder == session.auth.actor)
			{
				let bidAmount = parseInt(bid.bidamount);
				credit -= bidAmount;
			}
		}
		return credit ? credit + ".000000 FOOBAR" : "0.000000 FOOBAR" ;
	}


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

		auction_period = Math.floor((now_secs_utc - init_secs_utc) / auctionLengthSeconds) + 1;
	}

	async function getNFTs() {


		let nfts_params = {
				json: true,
				code: 'cronacle', // account containing smart contract
				scope: 'cronacle', // the subset of the table to query
				table: 'nfts', // the name of the table
				reverse: false,
				limit: 3 // limit on number of rows returned
			};

		let nfts_result = await rpc.get_table_rows(nfts_params);


		for(let index = 0; index < nfts_result.rows.length; ++index)
		{	
			let element = nfts_result.rows[index];
			let rest_url = 'https://proton.api.atomicassets.io/atomicassets/v1/assets/' + element.nftid;
			try {
				const response = await fetch(rest_url);
				const nftdata = await response.json();	
				nfts[index] = nftdata;
				
			} catch (error) {
				displayRequestError(e);
			}
		}
	}


	async function getBids() {
		if (session) {
			console.log('fetching all bids');

			let bids_params = {
				json: true,
				code: 'cronacle', // account containing smart contract
				scope: 'cronacle', // the subset of the table to query
				table: 'bids', // the name of the table
				index_position: 2,	// secondary index
				key_type: 'i64',
				reverse: true
			};

			let bids_result = await rpc.get_table_rows(bids_params);

			auctionBids = bids_result.rows;

			// extract top bid amount (integer)
			if (bids_result.rows.length > 0 && bids_result.rows[0].nftid == auctionNFTId) {
				let top_bid_foobar = bids_result.rows[0].bidamount
				top_bid = parseInt(top_bid_foobar)
				console.log("top_bid_str = " + top_bid)
			} else {
				// there are no bids so top_bid = 0
				top_bid = 0;
			}

			// update the bid amount input control
			let inputBidAmount = document.getElementById("bidAmount");
			let minBidAmount = top_bid + bid_increment;
			if(inputBidAmount.min != minBidAmount)
			{
				inputBidAmount.min = inputBidAmount.value = minBidAmount;
			}
			
		}
	}

	async function getAuctions()
	{
		let parameters = {
				json: true,
				code: 'cronacle', // account containing smart contract
				scope: 'cronacle', // the subset of the table to query
				table: 'auctions', // the name of the table
				reverse: true,
				limit: 1 
		};

		let result = await rpc.get_table_rows(parameters);
		if(result.rows.length > 0)
		{
			currentAuction = result.rows[0];
			auctionNFTId = currentAuction.nftid;
		}
		
	}


	async function getCredits()
	{
		if (session) {
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
			if (credit_result.rows.length > 0) {
				totalCredit = credit_result.rows[0].amount;
				isUserRegistered =  true;
			
			} else {
				totalCredit = "0";
				isUserRegistered =  false;
			}
			registered_indicator = isUserRegistered == true ? "(registered)" : "";
		}
	}


	// fetch and parse data tables
	async function fetchData() {
		await getBitcoinPrice();
		await getNFTs();
		await getCredits();
		await getAuctions();
		await getBids();
		auctionsLoaded = true;
		update();
		
	}


	async function reguser() {
		if(session)
		{
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
				displayRequestError(e);
			}
		}

	}

	async function getBitcoinPrice() {
		var request = new XMLHttpRequest() // inserted the CoinGecko stuff from prior

		// Open a new connection, using the GET request on the URL endpoint
		request.open('GET', 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin', true)
		request.onload = function () {
		// Begin accessing JSON data here
		var newdata = JSON.parse(this.response)
		newdata.forEach((object) => {
			bitcoinPrice = object.current_price;
		})
		}
		// Send request
		request.send();
	}

	async function bid() {
		if(session)
		{
			currentAuction = null;
			// read the bidAmount input control and convert it to a FOOBAR asset
			let amount = parseInt(document.getElementById("bidAmount").value);
			let bid_amount_foobar = amount + ".000000 FOOBAR";

			console.log("Bidding " + bid_amount_foobar + " for nft " + auctionNFTId + " in auction " + auction_period);

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
									nft_id: auctionNFTId,
									bidamount: bid_amount_foobar,
									btcprice: parseInt(bitcoinPrice)
								},
								authorization: [session.auth],
							},
						],
					},
					broadcast: true,
				});
				currentAuction = null;
				await getAuctions();
				await getBids();
				
				
			} catch (e) {
				displayRequestError(e);
			}
		}
		
	}


	onMount(() => {
		
		reconnect();
		document.getElementById("depositAmount").placeholder =
		document.getElementById("bidAmount").placeholder = "Input FOOBAR amount";
		// get the system initialisation time in seconds
		getSystemInitTime();
		getParameters();
		fetchData();	// i'd like to fetch data as soon as the page loads, but this doesn't seem to work (maybe it is, but just taking time)
		update();
		const interval = setInterval(update, 100);

		return () => clearInterval(interval);
	});

	function isRegisteredAndLoggedIn()
	{
		return isLoggedIn() && isUserRegistered;
	}

	function displayRequestError(error)
	{
		//alert(error);
		console.log(console.error());
	}

	function isLoggedIn()
	{
		return session != null;
	}

	function canBid()
	{
		return isRegisteredAndLoggedIn() && isBidTime();
	}

	function isAuctionTimeRunning()
	{
		for(let index = 0; index < auctionBids.length; ++index)
		{
			var bid = auctionBids[index];
			if(bid.nftid == auctionNFTId)
			{
				return true;
			}
			
		}
		return false;
	}

	function getBidStartTime()
	{
		let bidStartTime = new Date();
		for(let index = 0; index < auctionBids.length; ++index)
		{
			let bid = auctionBids[index];
			if(bid.nftid == auctionNFTId)
			{
				let bidTime = parseDateTimeString(auctionBids[index].bidtime);
				if(bidTime.getTime() < bidStartTime.getTime())
				{
					bidStartTime = bidTime;
				}
					
			}
			
		}
		return bidStartTime;
	}

	function parseDateTimeString(dateTimeString)
	{	
		return new Date(dateTimeString + 'Z');
	}

	function canClaim()
	{
		if(session)
		{
			let hasHighestBid = false;
			if(session && auctionBids.length > 0)
			{
				hasHighestBid = auctionBids[0].bidder == session.auth.actor;
			}
			return currentAuction && currentAuction.winner == "" && hasHighestBid && (auctionNFTId != currentAuction.nftid || (auctionNFTId == currentAuction.nftid && !isBidTime()));
		}
		else
		{
			return false;
		}
		
	}



	function update()
	{
		const now = new Date()
		now_secs_utc = Math.floor(now / 1000);
		getAuctionTimes();
		document.getElementById("txtRemainingAuctionTime").innerText = isBidTime() ?  getRemainingAuctionTimeS() : "Auction in cooldown!";
		if(canBid())
		{
			document.getElementById("txtBidTime").innerText = getRemainingAuctionTimeS();
		}
		
		
		if(nfts.length > 0 && currentAuction && currentAuction.nftid == auctionNFTId  && isAuctionTimeRunning)
		{
			let bidStartTime = getBidStartTime().getTime();
			let bidStartTimeSeconds = Math.floor(bidStartTime / 1000);
			let start_secs  = bidStartTimeSeconds - ((bidStartTimeSeconds - init_secs_utc) % auctionLengthSeconds);
			let end_secs = start_secs + auctionLengthSeconds;

			let auctionPeriodEnd = new Date(end_secs * 1000);
			
			if(auctionPeriodEnd.getTime() < now.getTime())
			{
				if(nfts.length > 1)
				{
					auctionNFTId = nfts[1].data.asset_id;
				}
				else
				{
					auctionNFTId = -1;
				}
			}
			else
			{
				auctionNFTId = nfts[0].data.asset_id;	
			}
			
		}
		
		
		const nft1image = document.getElementById("nft1_image");
		const nft1Collection = document.getElementById("nft1_collection");
		const nft1name = document.getElementById("nft1_name");
		const nft1Id = document.getElementById("nft1_id");
		const nft1desc = document.getElementById("nft1_desc");

		// display nft 2 info
		const nft2image = document.getElementById("nft2_image");
		const nft2name = document.getElementById("nft2_name");
		const nft2desc = document.getElementById("nft2_desc");
		
		let isNextNFTUpcomingAuction = false;

		//update NFTS
		for(let index = 0; index < nfts.length; ++index)
		{	
			
			let nftdata = nfts[index];
			let imageSource = "https://ipfs.io/ipfs/" + nftdata.data.template.immutable_data.image;
			
			if(nftdata.data.asset_id == auctionNFTId)
			{
				var nftTextId = "NFT " + nftdata.data.asset_id;
				if(nft1Id.textContent != nftTextId)
				{
					nft1image.src = imageSource;
					nft1Id.textContent = nftTextId;
					nft1Collection.textContent = nftdata.data.collection.name;
					nft1name.textContent = nftdata.data.template.immutable_data.name +" (" + nftdata.data.template_mint + "/" + nftdata.data.template.issued_supply + ")";
					nft1desc.textContent = nftdata.data.template.immutable_data.desc;
				}
				
				
				isNextNFTUpcomingAuction = true;
			}
			else if(isNextNFTUpcomingAuction){
				var nftTextId = "NFT " + nftdata.data.asset_id;
				if(nft2name.textContent != nftTextId)
				{
					nft2image.src = imageSource;
					nft2name.textContent = nftTextId;
				}
				isNextNFTUpcomingAuction = false;
				
			}
			
		}
		bid1 = "";
		bid2 = "";
		bid3 = "";
		let isLeaderboardVisible = false;
		//update Bids
		for(let index = 0; index < auctionBids.length; ++index)
		{
			var bid = auctionBids[index];
			if(bid.nftid == auctionNFTId)
			{
				isLeaderboardVisible = true;
				if (index == 0) {
					bid1 = bid.bidder + " : " + bid.bidamount
				}
				else if (index == 1) {
					bid2 = bid.bidder + " : " + bid.bidamount
				}
				else if (index == 2) {
					bid3 = bid.bidder + " : " + bid.bidamount
				}
			}
			
		}
		
		if(canClaim())
		{
			let claimNFTName = document.getElementById("claim_nft_name");
			var nftTextId = "NFT " + nfts[0].data.asset_id;
			if(claimNFTName.textContent != nftTextId)
			{
				let imageSource = "https://ipfs.io/ipfs/" + nfts[0].data.template.immutable_data.image;
				document.getElementById("claim_nft_image").src = imageSource;
				document.getElementById("claim_nft_name").textContent = nftTextId;
			}
		}
		document.getElementById("claim-section").style = canClaim() ?  "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		document.getElementById("btnClaim").disabled = !canClaim();
		
		
		document.getElementById("btnBid").disabled = !canBid();
		document.getElementById("bidAmount").disabled = !isRegisteredAndLoggedIn();
		document.getElementById("btnDeposit").disabled = !isLoggedIn();
		document.getElementById("btnWithdraw").disabled = !isRegisteredAndLoggedIn();
		document.getElementById("remainingAuctionTimeContainer").style = isAuctionTimeRunning() && isBidTime() ? "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		document.getElementById("auctionCooldownContainer").style = !isBidTime() ?  "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		document.getElementById("loggedInAndRegisteredHint").style = !isRegisteredAndLoggedIn() ?  "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		document.getElementById("creditTransfer").style = isLoggedIn() ?  "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		
		document.getElementById("availableCredit").textContent = getAvailableCredit();
		document.getElementById("totalCredit").textContent = totalCredit;

		document.getElementById("leaderboard").style = isLeaderboardVisible ? "visibility:visible; display:block;" : "visibility:hidden; display:none;";

		document.getElementById("auction-section").style = nfts.length > 0 && auctionNFTId != -1 && auctionsLoaded ? "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		document.getElementById("no-auctions-section").style = nfts.length == 0 || auctionNFTId == -1 ? "visibility:visible; display:block;" : "visibility:hidden; display:none;";
		document.getElementById("no-auctions-section").innerText = auctionsLoaded ? auctionsCompleteText : auctionsLoadingText;
		//Update the data every fetchDataIntervalSeconds
		if(fetchDataUpdateTimeSeconds < now_secs_utc)
		{
			
			fetchDataUpdateTimeSeconds = now_secs_utc + fetchDataIntervalSeconds;
			fetchData();
		}
	}

</script>
<svelte:head>
  <title>{title}</title>
</svelte:head>
<main>

	<div class="auth-section">

		<!--{#if client && !signedInInternetIdentity}
		<button on:click={signInInternetIdentity} class="auth-button">
			Internet Identity Sign In
		</button>
		{/if}
	
		{#if signedInInternetIdentity}
		<h4>Signed in as: {principal}</h4>
		<button on:click={signOutInternetIdentity} class="auth-button">Sign out</button>
		{/if}-->

		{#if session}
		<a class="auth-button" href="{getNFTCollectionURL()}" target="_blank">Open NFT Collection</a>
		<a class="auth-button"  href="{getFOOBARFaucetURL()}" target="_blank" >Get free FOOBAR</a>
		<a class="auth-button"  href="{getFOOBARExchangeURL()}" target="_blank">Buy FOOBAR</a>
		<button class="auth-button" on:click={logout}>Proton Logout</button>
	{:else}
		<button class="auth-button" on:click={login}>Proton Login</button>
		{/if}
	</div>
	{#if session}
	<h1>Welcome back {session.auth.actor}!</h1>
	<h2> {#if isUserRegistered} You are ready to go! {:else} Please deposit FOOBAR to start bidding!{/if}</h2>
	{/if}
	<div id="no-auctions-section">
	</div>
	<div id="claim-section">
		<h3>Claim previous auction</h3>
		<p id="claim_nft_name"></p>
		<img src="" id="claim_nft_image" alt="claim auction nft" width="200px" height="auto" />
		<p><button class="inline-block px-4 py-2 btn-primary rounded rounded-l-none" id="btnClaim" on:click={claimNFT}>Claim NFT</button></p>
	</div>
	<div id="creditTransfer" class="bid-form">
		<h3>Credit Transfer</h3>
		<table id="creditSection">
			<tr>
				<td>	
					<input class="foobarInputField" id="depositAmount" type="number" min="1"/>
				</td>
				<td>
					<img src="https://foobar.protonchain.com/images/coin.svg" class="inline-block foobar-icon px-4 py-2 " alt="FOOBAR"/>
				</td>
				<td>
					<button class="px-4 py-2 btn-primary rounded rounded-l-none" style="width:10em" id="btnDeposit" on:click={deposit}>Deposit</button>
				</td>
			</tr>
			<tr>
				<td style="font-size: larger;">
					Available Credit: <span id="availableCredit">{getAvailableCredit()}</span>
				</td>
				<td>
					<img src="https://foobar.protonchain.com/images/coin.svg" class="inline-block foobar-icon px-4 py-2 " alt="FOOBAR"/>
				</td>
				<td>
					<button class="px-4 py-2 btn-primary rounded rounded-l-none" style="width:10em" id="btnWithdraw" on:click={withdraw}>Withdraw</button>
				</td>
			</tr>
		</table>	
	</div>
	<div id="auction-section">
		
		<h2>Current Auction | #{auction_period} | <span id="txtRemainingAuctionTime">{getRemainingAuctionTimeS()}</span> </h2>
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
			<div id="leaderboard">
				<h2>Auction Leaderboard</h2>
				<p>{bid1}</p>
				<p>{bid2}</p>
				<p>{bid3}</p>
			</div>
			<div id="bid-container">
				
				<div class="bid-form" >
					<h3>Make Your Bid</h3>
					<p style="font-size: larger;">
						Total Credit: <span id="totalCredit">{totalCredit}</span>
					</p>
					<p style="font-size: larger;" id="remainingAuctionTimeContainer">Remaining Bid Time: <span id="txtBidTime">{getRemainingAuctionTimeS()}</span></p>
					<p style="font-size: larger;" id="auctionCooldownContainer">Auction in cooldown</p>
					<input class="foobarInputField" id="bidAmount" type="number" min="1"/>
					<img src="https://foobar.protonchain.com/images/coin.svg" class="inline-block foobar-icon px-4 py-2" alt="FOOBAR"/>
					<button class="inline-block px-4 py-2 btn-primary rounded rounded-l-none" id="btnBid" on:click={bid}>Bid</button>
					<p id="loggedInAndRegisteredHint" class="hint">You need to be logged in and registered to bid for this auction</p>
				</div>
			</div>			
		</div>
	</div>

	{#if nfts.length > 1}
	<div>
		<h2>Next Auction</h2>
		<div id="container2" class="container">
			<!-- svelte-ignore a11y-img-redundant-alt -->
			<p id="nft2_name"></p>
			<img src="" id="nft2_image" alt="next auction nft" width="200px" height="auto" />
		</div>
	</div>
	{/if}
</main>
<footer id="footer" class="bg-secondary z-10 relative py-8 text-white">
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
		padding: 6rem 0 14rem 0;
		max-width: 240px;
		margin: 0 auto;
		color: var(--color-text);
	}


	@media (min-width: 400px) {
		main {
			max-width: none;
		}
	}

	#container1
	{
		padding: 1em;
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

	#creditSection
	{
		margin: auto auto;
		row-gap: 2em;
		table-layout: auto;
		justify-content: flex-end;
		text-align: right;
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
	
	.foobarInputField
	{
		width: 12em;
		text-align: right;
		vertical-align: middle;
	}
	
	.foobarInputField::placeholder 
	{
		color: lightgray;
		font-size: 1em;
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
		margin: 1em;
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

	#claim-section
	{
		padding: 0.1em 0.1em;
		margin: 1em;
	}

	#no-auctions-section
	{
		margin: 2em;
		justify-content: center;
		text-align:center;
		text-color: var(--color-text);
	}
	
	#footer
	{
		position:fixed;
		bottom: 0px;
		left:0px;
		right:0px;
		height: 12rem;
	}

	#footer-logo-container
	{
		margin: 2em 0;
		display: flex;   
		justify-content: center;
		text-align:center;
		bottom: 3rem;
		position:relative;
	}

	.rounded-freeos-logo {
		border-radius: 9999px;
		border-style: solid;
		border-color: var(--color-secondary);
		border-width: 0.15rem;
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