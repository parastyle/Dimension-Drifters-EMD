# Weapon bank — B27 invariant review

The earlier advocate review modeled a player-authored relationship between two instances. B27
retired that model. The security and conservation boundary is now simpler:

1. one live entry contains one exact instance;
2. one instance exists in exactly one of Stash, Intake, expedition, Active, Pack, or field state;
3. selecting or moving an entry cannot mutate another entry;
4. same-class placement never creates hidden state;
5. pre-made dual behavior is immutable catalog data, not account-authored topology;
6. the account sanitizer converts obsolete saved composites into independent entries before any
   gameplay or account transaction reads them;
7. settlement, sale, archive salvage, and prestige consume only the explicitly named entries; and
8. no client message may submit component membership, damage, value, rarity, or affix authority.

The critical regression set is: duplicate/alias rejection, legacy-save losslessness, exact Carry
materialization, independent same-class position switching, extraction/defeat conservation, and
the authored-dual render census.
