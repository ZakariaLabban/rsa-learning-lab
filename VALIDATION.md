# First implementation validation

Validated locally on October 22, 2026.

## Automated

- `python -m pytest -q`: **40 passed**. One third-party AnyIO/Starlette deprecation warning; no test failures.
- `npm.cmd run build`: TypeScript compilation and Vite production build pass.
- Local `/` and `/api/health` return successful responses.
- Independent `cryptography` OAEP interoperability passes in both directions with both required key sizes.

## Browser checks

- Generated actual 2048-bit and 1024-bit keys through the UI.
- Completed OAEP and textbook message round trips; verified recovered Arabic text, punctuation, and emoji.
- Revealed private key components in Key Studio, then hid them.
- Padding experiment showed identical textbook ciphertexts, different OAEP ciphertexts, and successful recovery.
- Math Explorer: changing the message integer to 123 yielded ciphertext 855 and recovered integer 123, with the square-and-multiply trace visible.
- Navigated away and back: the Workbench retained its message and recovered result.
- Measured the active key after warm-up and exported the actual samples to JSON through the browser download action.
- Checked desktop layout at 1440px and narrow layout at 390px. No document-wide horizontal overflow at the narrow viewport; the message diagram intentionally scrolls within its own canvas.
- Browser warning/error log was empty at the time checked.

## Limits of this validation

The browser checks were performed interactively, not with a committed automated browser test suite. They do not establish a production security audit, exhaustive accessibility compliance, or cross-browser compatibility. Reduced-motion support is implemented through Motion configuration and CSS; an OS-preference simulation was not part of this pass. Performance samples describe this machine and active key only.

See README.md for the implemented feature list, setup instructions, and remaining optional extensions.
