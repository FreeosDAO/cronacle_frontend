<script>
  import { onMount } from "svelte"
  import { AuthClient } from "@dfinity/auth-client"

  let signedIn = false
  let client
  export let principal = ""

  const initAuth = async () => {
    client = await AuthClient.create()
    const isAuthenticated = await client.isAuthenticated()

    if (isAuthenticated) {
      const identity = client.getIdentity()
      principal = identity.getPrincipal().toString()
      principal_id = principal
      console.log("Auth. already authenticated. principal_id = " + principal_id)      
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
    principal_id = principal
    console.log("Auth. signed in. principal_id = " + principal_id)
    signedIn = true
  }

  const signOut = async () => {
    await client.logout()
    signedIn = false
    principal = ""
    principal_id = principal
    console.log("Auth. signed out. principal_id = " + principal_id)
  }

  onMount(initAuth)

</script>

<div class="auth-section">

  {#if !signedIn && client}
    <button on:click={signIn} class="auth-button">
      dfinity Sign In
    </button>
  {/if}

  {#if signedIn}
    <p>Signed in as: {principal}</p>
    <button on:click={signOut} class="auth-button">Sign out</button>
  {/if}
</div>

<style>
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
