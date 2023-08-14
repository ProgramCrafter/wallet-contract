# Wallet v5r2
Wallet v5 is custom version of wallet for use instead of v4.

There are three main differences from previous versions:
1. execute arbitrary code onchain. User can pass a continuation to be executed -- this is useful for predicting unsafe random.
2. plugin functionality: plugins are continuations, like small inlined contracts. They may be executed upon getting an incoming message.
   Actual plugin's code is stored in masterchain, so that plugins are just masterchain libraries.
3. secp256r1 keys are supported in addition to Ed25519 ones.

All plugin functions must be inlined or `inline_ref`ed, as otherwise call will go out of plugin control so the function won't be found.

# Considerations

- [x] Making all functions inline is not the optimal way if you call them in different parts of code.
  - Mentioned that `inline_ref` is also working. Putting functions in cell references incurs no significant overhead and allows to use them in several places.
- [x] Plugins are considered to be trusted and called without isolation but they should not be trusted.
  - Verifying that plugin outgoing messages are valid is expensive and involves pretty large number of cases. Thus, I think that public plugins should come with formal proof of properties checkable by wallet application.
- [x] Continuations in signed messages are considered to be trusted and called without isolation but they should not be trusted.
  - In presence of isolation, calling code onchain does not make much sense except for forming large software-generated messages. No isolation allows to use wallet v5 for more exotic usecases, such as changing public key.
  - The fact whether execution of some code breaks the wallet should be determined offchain before signing message.
- [x] Timestamp of the signed message does not have upper limit, delayed message attack is possible.
  - Delayed messages may be useful for prolonging domain contracts.
  - If wallet application signs the message, nothing saves it from setting the wrong upper limit timestamp as well.
  - If a delayed signed message is recorded, it is possible to change seqno (or public key, though it's more complicated way) to invalidate that message.
- [ ] Plugins should be tested for reentrancy issues just like Ethereum smart contracts.
