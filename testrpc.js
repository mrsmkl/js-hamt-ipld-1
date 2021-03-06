
const {LotusRPC} = require('@filecoin-shipyard/lotus-client-rpc')
const {NodejsProvider: Provider} = require('@filecoin-shipyard/lotus-client-provider-nodejs')
const {testnet} = require('@filecoin-shipyard/lotus-client-schema')
const fs = require('fs')
const signer = require("@zondax/filecoin-signing-tools")
const mysigner = require("./signer")
const cbor = require('cbor')
const utils = require('./utils')
const { ProtocolIndicator } = require("./constants");
const blake = require('blakejs')

const endpointUrl = 'ws://localhost:1234/rpc/v0'
const provider = new Provider(endpointUrl, {token: async () => {
    return fs.readFileSync('/home/sami/.lotus/token')
}})

const client = new LotusRPC(provider, { schema: testnet.fullNode })

const mnemonic = 'robot matrix ribbon husband feature attitude noise imitate matrix shaft resist cliff lab now gold menu grocery truth deliver camp about stand consider number'
let key = signer.keyDerive(mnemonic, "m/44'/1'/1/0/2", "")
console.log("address", key.address)

async function sendTx({to, method, params}) {
    const head = await client.chainHead()
    let state = await client.stateGetActor(key.address, head.Cids)
    console.log(params)
    console.log(state)
    let msg = {
        "to": to,
        "from": key.address,
        "nonce": state.Nonce,
        "value": "123456789",
        "gasprice": "0",
        "gaslimit": 25000,
        "method": method,
        "params": params,
    }
    // let signed_str1 = transactionSign(msg, key.private_hexstring)
    let signed_str = mysigner.transactionSignLotus(msg, key.private_hexstring)
    console.log(signed_str)
    await client.mpoolPush(JSON.parse(signed_str))
    process.exit(0)
}

function encodeBig(bn) {
    if (bn.toString() == 0) return Buffer.from("")
    return Buffer.from('00' + bn.toString(16), 'hex')
}

async function sendVerify(verified, cap) {
    console.log([utils.addressAsBytes(verified), encodeBig(cap)])
    await sendTx("t06", 4, cbor.encode([utils.addressAsBytes(verified), encodeBig(cap)]))
}

// sendTx("t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy", 0, "")

// sendTx("t1uu7jrpff4sh7g2clfjv7oc2oafui5hrlxeuax7q", 123456789101112n)

function encodeSend(to) {
    return {
        to,
        method:0,
        params: "",
    }
}

function encodeAddVerifier(verified, cap) {
    return {
        to: "t06",
        method: 2,
        params: cbor.encode([utils.addressAsBytes(verified), encodeBig(cap)]),
    }
}

function encodeAddVerifiedClient(verified, cap) {
    return {
        to: "t06",
        method: 4,
        params: cbor.encode([utils.addressAsBytes(verified), encodeBig(cap)]),
    }
}

function encodePropose(msig, msg) {
    return {
        to: msig,
        method: 2,
        params: cbor.encode([utils.addressAsBytes(msg.to), encodeBig(msg.value || 0), msg.method, msg.params])
    }
}

function encodeProposalHashdata(from, msg) {
    console.log(from, msg.to)
    return cbor.encode([utils.addressAsBytes(from), utils.addressAsBytes(msg.to), encodeBig(msg.value || 0), msg.method, msg.params])
}

function encodeApprove(msig, txid, from, msg) {
    console.log(from, msg)
    let hashData = encodeProposalHashdata(from, msg)
    let hash = blake.blake2bHex(hashData, null, 32)
    return {
        to: msig,
        method: 3,
        params: cbor.encode([txid, Buffer.from(hash, "hex")])
    }
}

console.log(encodeAddVerifier("t01003", 7777777))
console.log(encodePropose("t01006", encodeAddVerifier("t01003", 7777777)))

// sendTx(encodePropose("t01006", encodeAddVerifier("t01003", 7777777)))

// console.log(encodeProposalHashdata("t01003", encodeAddVerifier("t01003", 7777777)).toString("hex"))
console.log(encodeApprove("t01006", 1, "t01007", encodeAddVerifier("t01005", 7777777)).toString("hex"))

sendTx(encodeApprove("t01006", 1, "t01007", encodeAddVerifier("t01005", 7777777)))
