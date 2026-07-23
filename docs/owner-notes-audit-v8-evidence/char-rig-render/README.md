# Whole-art character rig evidence

The retained live-capture harness is `e2e/tests/char-proto.spec.ts`. For each of
`proto-sheriff`, `proto-samurai`, and `proto-witch`, it boots a real Colyseus + Vite stack on private
ephemeral ports and requires:

- all six `char:<id>:<role>` keys in Phaser's TextureManager;
- the retained body, head, hands, and feet to use exactly those six keys while synced wardrobe fields
  remain populated;
- no `gear-bake:*` rig texture and no gear attachments;
- the manifest head offset, bounded bob range, and a maximum head/body gap below four pixels.

On success it writes `<id>-capture.json`, `<id>-rest.png`, and `<id>-bob.png` in this directory.

The implementation run on 2026-07-23 booted the private stack successfully on server port 60417 and
client port 60418, but the browser-control environment exposed no available browser session after its
required recovery check. Its workflow forbids substituting a separate automation backend, so the nine
live artifacts are not represented as captured here. This note is intentionally not acceptance proof.
