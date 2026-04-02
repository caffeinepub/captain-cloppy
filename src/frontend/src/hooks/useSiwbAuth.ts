import { HttpAgent } from "@dfinity/agent";
import { Actor } from "@dfinity/agent";
import type { DerEncodedPublicKey, Signature } from "@dfinity/agent";
import {
  Delegation,
  DelegationChain,
  DelegationIdentity,
  Ed25519KeyIdentity,
} from "@dfinity/identity";
import { Principal } from "@dfinity/principal";
import { useEffect, useState } from "react";

const SIWB_CANISTER_ID = "bcxqa-kqaaa-aaaak-qotba-cai";
const IC_HOST = "https://ic0.app";

const idlFactory = ({ IDL }: any) => {
  const Address = IDL.Text;
  const SiwbMessage = IDL.Text;
  const PrepareLoginResponse = IDL.Variant({ Ok: SiwbMessage, Err: IDL.Text });
  const PublicKey = IDL.Vec(IDL.Nat8);
  const SessionKey = PublicKey;
  const Timestamp = IDL.Nat64;
  const CanisterPublicKey = PublicKey;
  const LoginDetails = IDL.Record({
    user_canister_pubkey: CanisterPublicKey,
    expiration: Timestamp,
  });
  const LoginResponse = IDL.Variant({ Ok: LoginDetails, Err: IDL.Text });
  const DelegationIDL = IDL.Record({
    pubkey: PublicKey,
    targets: IDL.Opt(IDL.Vec(IDL.Principal)),
    expiration: Timestamp,
  });
  const SignedDelegation = IDL.Record({
    signature: IDL.Vec(IDL.Nat8),
    delegation: DelegationIDL,
  });
  const GetDelegationResponse = IDL.Variant({
    Ok: SignedDelegation,
    Err: IDL.Text,
  });
  const SignMessageType = IDL.Variant({
    Bip322Simple: IDL.Null,
    ECDSA: IDL.Null,
  });
  return IDL.Service({
    siwb_prepare_login: IDL.Func([Address], [PrepareLoginResponse], []),
    siwb_login: IDL.Func(
      [IDL.Text, Address, IDL.Text, SessionKey, SignMessageType],
      [LoginResponse],
      [],
    ),
    siwb_get_delegation: IDL.Func(
      [Address, SessionKey, Timestamp],
      [GetDelegationResponse],
      ["query"],
    ),
  });
};

export type WalletType = "unisat" | "xverse" | "okx";

export interface SiwbAuthState {
  status: "idle" | "connecting" | "connected" | "error";
  principal: string;
  btcAddress: string;
  error: string;
}

export function useSiwbAuth() {
  const [state, setState] = useState<SiwbAuthState>(() => ({
    status: localStorage.getItem("odin_principal") ? "connected" : "idle",
    principal: localStorage.getItem("odin_principal") ?? "",
    btcAddress: localStorage.getItem("odin_btc_address") ?? "",
    error: "",
  }));

  useEffect(() => {
    const stored = localStorage.getItem("odin_principal");
    if (stored) {
      setState({
        status: "connected",
        principal: stored,
        btcAddress: localStorage.getItem("odin_btc_address") ?? "",
        error: "",
      });
    }
  }, []);

  const connectWallet = async (walletType: WalletType) => {
    setState((prev) => ({ ...prev, status: "connecting", error: "" }));
    try {
      const w = window as any;

      // Step 1: Get Bitcoin address
      let address = "";
      let publicKeyHex = "";

      if (walletType === "unisat") {
        if (!w.unisat) throw new Error("Unisat wallet not installed");
        const accounts: string[] = await w.unisat.requestAccounts();
        address = accounts[0];
      } else if (walletType === "xverse") {
        const provider =
          w.XverseProviders?.BitcoinProvider ?? w.BitcoinProvider;
        if (!provider) throw new Error("Xverse wallet not installed");
        const resp = await provider.request("getAccounts", null);
        const accounts =
          resp?.result?.addresses ?? resp?.addresses ?? resp ?? [];
        const account = Array.isArray(accounts) ? accounts[0] : accounts;
        address = account?.address ?? account;
        publicKeyHex = account?.publicKey ?? "";
      } else if (walletType === "okx") {
        if (!w.okxwallet?.bitcoin) throw new Error("OKX wallet not installed");
        const accounts: string[] = await w.okxwallet.bitcoin.requestAccounts();
        address = accounts[0];
      }

      if (!address)
        throw new Error("Could not get Bitcoin address from wallet");

      // Step 2: Create SIWB actor
      const agent = await HttpAgent.create({ host: IC_HOST });
      const siwbActor = Actor.createActor(idlFactory, {
        agent,
        canisterId: Principal.fromText(SIWB_CANISTER_ID),
      });

      // Step 3: Prepare login
      const prepareResp: any = await siwbActor.siwb_prepare_login(address);
      if (prepareResp.Err) throw new Error(prepareResp.Err);
      const message: string = prepareResp.Ok;

      // Step 4: Generate session key
      const sessionIdentity = Ed25519KeyIdentity.generate();
      const sessionPublicKeyBytes = new Uint8Array(
        sessionIdentity.getPublicKey().toDer(),
      );

      // Step 5: Sign message with wallet
      let signature = "";

      if (walletType === "unisat") {
        signature = await w.unisat.signMessage(message, "bip322-simple");
        publicKeyHex = await w.unisat.getPublicKey();
      } else if (walletType === "xverse") {
        const provider =
          w.XverseProviders?.BitcoinProvider ?? w.BitcoinProvider;
        const signResp = await provider.request("signMessage", {
          address,
          message,
        });
        signature =
          signResp?.result?.signature ?? signResp?.signature ?? signResp;
      } else if (walletType === "okx") {
        signature = await w.okxwallet.bitcoin.signMessage(message, {
          type: "bip322-simple",
        });
        publicKeyHex = await w.okxwallet.bitcoin.getPublicKey();
      }

      if (!signature) throw new Error("Failed to sign message");

      // Step 6: Login
      const loginResp: any = await siwbActor.siwb_login(
        signature,
        address,
        publicKeyHex,
        Array.from(sessionPublicKeyBytes),
        { Bip322Simple: null },
      );
      if (loginResp.Err) throw new Error(loginResp.Err);
      const loginDetails = loginResp.Ok;

      // Step 7: Get delegation
      const delegationResp: any = await siwbActor.siwb_get_delegation(
        address,
        Array.from(sessionPublicKeyBytes),
        loginDetails.expiration,
      );
      if (delegationResp.Err) throw new Error(delegationResp.Err);
      const signedDelegation = delegationResp.Ok;

      // Step 8: Build DelegationChain and DelegationIdentity
      const delegPubkey = new Uint8Array(signedDelegation.delegation.pubkey);
      const delegExpiration: bigint = signedDelegation.delegation.expiration;
      const delegTargets: Principal[] | undefined = signedDelegation.delegation
        .targets?.[0]?.length
        ? signedDelegation.delegation.targets[0]
        : undefined;

      const delegation = new Delegation(
        delegPubkey,
        delegExpiration,
        delegTargets,
      );

      // Cast signature to the branded Uint8Array type
      const sigBytes = new Uint8Array(signedDelegation.signature) as Signature;

      // Cast the public key bytes to DerEncodedPublicKey branded type
      const derEncodedKey = new Uint8Array(
        loginDetails.user_canister_pubkey,
      ) as DerEncodedPublicKey;

      const delegationChain = DelegationChain.fromDelegations(
        [{ delegation, signature: sigBytes }],
        derEncodedKey,
      );

      const identity = DelegationIdentity.fromDelegation(
        sessionIdentity,
        delegationChain,
      );

      // Step 9: Get JWT from Odin API
      let jwtToken = "";
      try {
        const timestamp = Date.now().toString();
        const signatureBuffer = await identity.sign(
          new TextEncoder().encode(timestamp),
        );
        const payload = {
          timestamp,
          signature: btoa(
            String.fromCharCode(...new Uint8Array(signatureBuffer)),
          ),
          delegation: JSON.stringify(identity.getDelegation().toJSON()),
        };
        const resp = await fetch("https://api.odin.fun/v1/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const data = await resp.json();
          jwtToken = data.token ?? "";
        }
      } catch {
        // JWT optional — don't fail the whole flow
      }

      // Step 10: Extract principal and persist
      const principal = identity.getPrincipal().toString();
      localStorage.setItem("odin_principal", principal);
      localStorage.setItem("odin_btc_address", address);
      if (jwtToken) localStorage.setItem("odin_jwt", jwtToken);

      setState({
        status: "connected",
        principal,
        btcAddress: address,
        error: "",
      });

      return { principal, btcAddress: address, jwtToken };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setState((prev) => ({ ...prev, status: "error", error: msg }));
      throw err;
    }
  };

  const disconnect = () => {
    localStorage.removeItem("odin_principal");
    localStorage.removeItem("odin_btc_address");
    localStorage.removeItem("odin_jwt");
    setState({ status: "idle", principal: "", btcAddress: "", error: "" });
  };

  const setManualPrincipal = (p: string) => {
    localStorage.setItem("odin_principal", p);
    localStorage.removeItem("odin_btc_address");
    setState({ status: "connected", principal: p, btcAddress: "", error: "" });
  };

  return { ...state, connectWallet, disconnect, setManualPrincipal };
}
