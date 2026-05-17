const { signAsync } = require('@electron/osx-sign')

/**
 * Ad-hoc sign the macOS app bundle for local development/test builds.
 *
 * This avoids the fully unsigned app bundle that macOS Gatekeeper can report as
 * "damaged" after installing from a downloaded artifact, while still requiring
 * no Apple Developer account, certificate, or notarization credentials.
 */
exports.sign = async function sign(configuration) {
  await signAsync({
    ...configuration,
    identity: '-',
    identityValidation: false,
    strictVerify: false,
  })
}
