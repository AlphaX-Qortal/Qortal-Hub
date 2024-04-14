// @ts-nocheck

import { crypto } from '../constants/decryptWallet'
import Base58 from '../deps/Base58'
import {AES_CBC, HmacSha512} from 'asmcrypto.js'
import { doInitWorkers, kdf } from '../deps/kdf'


export const decryptStoredWallet = async (password, wallet) => {
	const threads = doInitWorkers(crypto.kdfThreads)
	const encryptedSeedBytes = Base58.decode(wallet.encryptedSeed)
	const iv = Base58.decode(wallet.iv)
	const salt = Base58.decode(wallet.salt)
	
	const key = await kdf(password, salt, threads)
    console.log('key2', key)
	const encryptionKey = key.slice(0, 32)
	const macKey = key.slice(32, 63)
	const mac = new HmacSha512(macKey).process(encryptedSeedBytes).finish().result
    console.log(Base58.encode(mac), wallet.mac)
	if (Base58.encode(mac) !== wallet.mac) {
		throw new Error("Incorrect password")
	}
	const decryptedBytes = AES_CBC.decrypt(encryptedSeedBytes, encryptionKey, false, iv)
	return decryptedBytes
}