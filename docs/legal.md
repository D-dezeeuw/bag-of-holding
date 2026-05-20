# Legal, what we can and can't reference

A pragmatic guide for contributors. The rules below are the working
agreement, not legal advice. When in doubt, default to a generic or
invented name.

## We're built on the SRD 5.2

The mechanical rules and the named content this engine implements
come from Wizards of the Coast's **System Reference Document 5.2
(2025)**, released under **CC-BY-4.0**. That license gives us the
right to use everything *in the SRD itself* in any project, open or
closed, as long as we credit Wizards (see the README footer).

> The CC license is irrevocable. The SRD 5.2 cannot be taken back.

## What we can do

- **Game mechanics, always.** Rules are not copyrightable, and the
  SRD grants explicit permission on top of that. Attack rolls,
  saving throws, condition effects, spell slot tables, multiclassing
  formulas, all fine.
- **SRD-listed named content.** The standard monsters (Goblin, Orc,
  Red Dragon, Owlbear, ...), the canonical magic items (Bag of
  Holding, Cloak of Elvenkind, Wand of Magic Missiles, Staff of the
  Magi, Potion of Healing, ...), the SRD spells (Fireball, Magic
  Missile, Counterspell, ...), the classes / subclasses / species /
  backgrounds / feats explicitly in the SRD 5.2 document, all
  usable by their real names.
- **Generic terms.** Words like *fighter*, *cleric*, *sword*,
  *dragon*, *spell slot* are not Wizards' to own.
- **Invented homebrew.** Anything we make up ourselves
  (`Void Thrall`, `Helm of Some-Adjective`), fine to use as
  examples, fixtures, and recipes.

## What we don't do

- **Product-identity creatures.** Beholder, Mind Flayer / Illithid,
  Yuan-ti, Slaad, Displacer Beast, Carrion Crawler, Githyanki /
  Githzerai, Kuo-toa, and similar are Wizards' Product Identity and
  are *not* in the SRD. Don't reference them by name, even in tests
  or recipes; invent something generic instead.
- **Named NPCs and wizards.** Mordenkainen, Tasha, Bigby, Tenser,
  Drizzt, Elminster, Acererak, Strahd, Vecna, etc. These are
  characters Wizards owns. If a spell historically used a wizard's
  name (Bigby's Hand, Tenser's Floating Disk, Mordenkainen's
  Magnificent Mansion), the SRD 5.2 renames it (Arcane Hand,
  Floating Disk, Magnificent Mansion), use the SRD name.
- **Setting names.** Forgotten Realms, Eberron, Greyhawk, Faerûn,
  Waterdeep, Baldur's Gate, Neverwinter, Sword Coast, the Underdark.
  None of these belong to us. Recipe examples should stay setting-
  neutral.
- **Adventure-module specifics.** Specific dungeons, plotlines, or
  NPCs from published modules (*Curse of Strahd*, *Tomb of
  Annihilation*, etc.).
- **Trademarks and trade dress.** "Dungeons & Dragons", "D&D", and
  the official logos are trademarks. We refer to the *SRD 5.2*
  and to *5e* generically; we don't claim D&D compatibility in
  marketing copy beyond pointing at the SRD attribution.

## When you're adding content

If you're writing a new test, a recipe, a fixture, or expanding the
SRD registry:

1. **Is it in the SRD 5.2 document?** Open the PDF / official
   listing and search for the name. If it's there, use the real
   name freely.
2. **Is it generic?** "Cave fish", "abandoned shrine guard", fine.
3. **Otherwise, invent.** Make up a clearly homebrew name. The
   `extraMonsters` / `extraSpells` / `extraItems` plugin surfaces
   exist precisely for this; see the `void-thrall` example in
   `tests/integration.test.js`.

## Attribution

The README's footer and the `LICENSE` file together do the
attribution work. If you're cutting a derivative or a downstream
package, keep both intact.

## When in doubt

Default to a generic or invented name. The cost of renaming a test
fixture is zero; the cost of getting it wrong is non-zero. Ask in a
PR if you're unsure, flagging it is much cheaper than untangling
it after release.
