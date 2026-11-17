# Animated workshop and Legacy lab

The default entrance is the animated RSA workshop. `/playground` always opens it;
`/legacy` always opens the previous overview and sidebar. Existing `/learn/*`,
`/break/*`, `/contacts` and `/experiments` addresses keep their previous screens.
The workshop's lesson directory links to every existing lesson and tool.

Use **Legacy lab** or **Animated workshop** in the header to switch. The choice
is remembered under `rsa-lab-interface` and used on the next visit to `/`.
Explicit experience URLs still work with browser storage disabled. Switching
does not change the key-persistence policy or key files.
After its first visit, the Legacy shell stays mounted and hidden while the
workshop is visible. Its key session, keyring and mounted Encrypt/Decrypt
workbench survive a switch in the same tab. Other routed lesson forms may reset;
refreshing still follows the existing private-key persistence setting.

## Learning experience

- **Guide me:** follow five numbered stops or play the complete journey. Playback
  enters each machine, shows every calculation, then continues along the wire.
- **Explore freely:** select Alice, either machine, Eve or Bob directly. Change
  the message, alter the ciphertext, or replay individual calculations.
- Inside a machine, each exponent bit squares the running result. A 1 bit adds
  a multiplication by the original input; a 0 bit skips it. The remainder filter
  shows the exact identity `product = quotient × 187 + remainder`.
- Play/pause, previous, next, per-operation selection, speed and reduced motion
  remain available. Keyboard controls use native buttons and inputs. Clocks are
  cancelled on unmount and pause while the document is hidden.

The keys are the deliberately insecure lecture example `p=17`, `q=11`, `e=7`,
`n=187`, `d=23`. Messages are bounded integers `0..186`. This is textbook RSA;
there is no OAEP or integrity protection in the workshop. Eve's +1 operation
changes the real ciphertext and the actual decrypted result. The practical
encryption, file exchange, signatures and other lessons remain in Legacy.

## Implementation and rollback

`features/workshop/model.ts` expands the existing BigInt engine's
`squareAndMultiply` trace. It does not maintain a separate crypto implementation.
`WorkshopScene` draws the journey; `MachineCutaway` animates each multiplication,
division into full modulus groups and stored remainder. Their visual clocks do
not affect the arithmetic. No new service, account, network call or dependency
is needed. `LabThemeProvider` shares the light/dark preference between interfaces;
the new palette is scoped to `.rsa-playground`.

For an immediate personal return, choose **Legacy lab**; `/` then opens Legacy.
Both permanent URLs remain available. A future product-wide rollback can change
the default in `app/interfacePreference.ts` while leaving both experiences and
all lesson routes in place, without restoring deleted components.

Validation includes exhaustive roundtrips for all 187 messages, expanded-trace
identities, interruption at machine boundaries, full guided playback, manual
stepping, zero-bit behavior, tampering, storage-disabled navigation, retained
Legacy keys, light/dark phone layouts and reduced-motion keyboard operation.
