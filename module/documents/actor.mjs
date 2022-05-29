/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ApotheosisActor extends Actor {
    /** @override */
    prepareData() {
        // Prepare data for the actor. Calling the super version of this executes
        // the following, in order: data reset (to clear active effects),
        // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
        // prepareDerivedData().
        super.prepareData()
    }

    /** @override */
    prepareBaseData() {
        // Data modifications in this step occur before processing embedded
        // documents or derived data.
    }

    /**
     * @override
     * Augment the basic actor data with additional dynamic data. Typically,
     * you'll want to handle most of your calculated/derived data in this step.
     * Data calculated in this step should generally not exist in template.json
     * (such as ability modifiers rather than ability scores) and should be
     * available both inside and outside of character sheets (such as if an actor
     * is queried and has a roll executed directly from it).
     */
    prepareDerivedData() {
        const actorData = this.data
        const data = actorData.data
        const flags = actorData.flags.apotheosis || {}

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        this._prepareCharacterData(actorData)
        this._prepareNpcData(actorData)
    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        if (actorData.type !== "character") return

        // Make modifications to data here. For example:
        const data = actorData.data

        // todo make sure there can only be one race
        const race = actorData.items.find((item) => {
            return item.data.type === "race"
        })
        // Get race attribute modifiers and movement speed
        if (race) {
            for (let [k, v] of Object.entries(
                race.data.data.attributeModifiers
            )) {
                data.attributes[k].mod += v.value
                data.attributes[k].saveMod = +v.saveMod
            }
            data.movementSpeed = race.data.data.movementSpeed
        }

        // todo make sure there can only be one background
        const background = actorData.items.find((item) => {
            return item.data.type === "background"
        })
        // Get background attribute modifiers
        if (background) {
            for (let [modifier, v] of Object.entries(
                background.data.data.attributeModifiers
            )) {
                data.attributes[modifier].mod += v.value
            }
        }

        // Encumbrance
        data.encumbranceLimit =
            (data.attributes.str.base + data.attributes.str.mod) * 2
        if (data.encumbranceLimit < 0) {
            data.encumbranceLimit = 0
        }
        if (race) {
            data.encumbranceSpeedDecreaseThreshold =
                race.data.data.encumbranceSpeedDecreaseThreshold
            switch (race.data.data.size) {
                case "small":
                    data.encumbranceLimit += 4
                    break
                case "medium":
                    data.encumbranceLimit += 16
                    break
            }
        }

        data.defense.value.base = Math.ceil(
            10 + (data.attributes.dex.base + data.attributes.dex.mod) / 2
        )
        data.defense.value.total += data.defense.value.base

        // EP
        this._calculateEP(data)

        // Attributes and other modifiers from items
        for (let item of actorData.items) {
            // Armor
            if (item.data.type === "armor") {
                if (item.data.data.equipped === true) {
                    data.defense.value += item.data.data.defense
                    data.defense.damageReduction +=
                        item.data.data.damageReduction
                }
                data.currentEncumbrance += item.data.data.weight
            }
            if (item.data.type === "ability") {
                if (item.data.data.spellcasting === true) {
                    data.spellcasting = true
                    data.maxManaAttribute = item.data.data.maxManaAttribute
                }
                data.mana.expenditureLimit +=
                    item.data.data.expenditureLimitBonus
                data.EP.max += item.data.data.EPModifier
                if (race) {
                    data.encumbranceSpeedDecreaseThreshold = Math.max(
                        item.data.data.encumbranceSpeedDecreaseThreshold,
                        race.data.data.encumbranceSpeedDecreaseThreshold
                    )
                } else {
                    data.encumbranceSpeedDecreaseThreshold =
                        item.data.data.encumbranceSpeedDecreaseThreshold
                }
            }
        }

        // Mana
        if (data.maxManaAttribute === "int") {
            data.mana.max =
                data.attributes[data.maxManaAttribute].base +
                data.attributes[data.maxManaAttribute].mod
        }
        if (data.maxManaAttribute === "con") {
            data.mana.max =
                (data.attributes[data.maxManaAttribute].base +
                    data.attributes[data.maxManaAttribute].mod) /
                2
        }

        // Exhaustion
        if (data.exhaustion < 0) {
            data.exhaustion = 0
        }
        if (data.exhaustion > 6) {
            data.exhaustion = 6
        }
        if (data.exhaustion >= 2) {
            for (let [k, v] of Object.entries(data.attributes)) {
                v.mod -= 1
            }
            if (data.exhaustion < 5) {
                this._calculateEP(data)
            }
        }
        if (data.exhaustion >= 3) {
            for (let [k, v] of Object.entries(data.attributes)) {
                v.mod -= 2
            }
            if (data.exhaustion < 5) {
                this._calculateEP(data)
            }
        }
        if (data.exhaustion >= 4) {
            data.movementSpeed = Math.ceil(data.movementSpeed / 2)
        }
        if (data.exhaustion >= 5) {
            data.EP.value = 0
            data.EP.max = 0
        }

        // Checks
        for (let [checkName, v] of Object.entries(data.checks)) {
            v.base =
                data.attributes[v.attribute].base +
                data.attributes[v.attribute].mod
        }
        // Get race check modifiers
        if (race) {
            for (let [k, v] of Object.entries(race.data.data.checkModifiers)) {
                data.checks[k].mod += v.value
            }
        }

        // Overencumbrance
        const overEncumbrance =
            (data.encumbranceLimit - data.currentEncumbrance) * -1
        if (overEncumbrance >= data.encumbranceSpeedDecreaseThreshold) {
            let movementSpeedReductionCounter = overEncumbrance
            while (
                movementSpeedReductionCounter >=
                data.encumbranceSpeedDecreaseThreshold
            ) {
                console.log(`reducing speed...`)
                data.movementSpeed -= 1
                movementSpeedReductionCounter -=
                    data.encumbranceSpeedDecreaseThreshold
            }
        }
        if (overEncumbrance >= 20) {
            let dexReductionCounter = overEncumbrance
            while (dexReductionCounter >= 20) {
                data.attributes.dex.saveMod -= 3
                data.attributes.dex.mod -= 3

                for (let [k, v] of Object.entries(data.checks)) {
                    if (v.attribute === "dex") {
                        v.mod -= 3
                    }
                }

                dexReductionCounter -= 20
            }
        }

        // Movespeed can't be less than 0
        if (data.movementSpeed < 0) {
            data.movementSpeed = 0
        }

        // Hunger / Thirst
        if (data.hungerThirst >= 2) {
            data.attackMod -= 3
            for (let [k, v] of Object.entries(data.attributes)) {
                v.saveMod -= 3
            }
            for (let [k, v] of Object.entries(data.checks)) {
                v.mod -= 3
            }
            this._calculateEP(data)
        }
        if (data.hungerThirst >= 3) {
            for (let [k, v] of Object.entries(data.attributes)) {
                v.mod -= 1
            }
            for (let [k, v] of Object.entries(data.checks)) {
                v.mod -= 1
            }
            this._calculateEP(data)
        }
        if (data.hungerThirst >= 4) {
            data.movementSpeed = Math.ceil(data.movementSpeed / 2)
        }

        console.log(data)
    }

    /**
     * Prepare NPC type specific data.
     */
    _prepareNpcData(actorData) {
        if (actorData.type !== "npc") return

        // Make modifications to data here. For example:
        const data = actorData.data
    }

    /**
     * Override getRollData() that's supplied to rolls.
     */
    getRollData() {
        const data = super.getRollData()

        // Prepare character roll data.
        this._getCharacterRollData(data)
        this._getNpcRollData(data)

        return data
    }

    /**
     * Prepare character roll data.
     */
    _getCharacterRollData(data) {
        if (this.data.type !== "character") return

        // Copy the ability scores to the top level, so that rolls can use
        // formulas like `@str.value + 4`.
        // if (data.attributes) {
        //     for (let [k, v] of Object.entries(data.attributes)) {
        //         data[k] = foundry.utils.deepClone(v)
        //     }
        // }
    }

    /**
     * Prepare NPC roll data.
     */
    _getNpcRollData(data) {
        if (this.data.type !== "npc") return

        // Process additional NPC data here.
    }

    _calculateEP(data) {
        data.EP.max =
            (data.attributes.con.base + data.attributes.con.mod) * 5 +
            (data.attributes.str.base + data.attributes.str.mod) * 2 +
            (data.attributes.dex.base + data.attributes.dex.mod) * 2

        if (data.EP.max < 2) {
            data.EP.max = 2
        }
    }
}
