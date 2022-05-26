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

        // Attributes
        for (let [k, v] of Object.entries(data.attributes)) {
            v.total = v.base
        }

        // todo make sure there can only be one race
        const race = actorData.items.find((item) => {
            return item.data.type === "race"
        })
        if (race) {
            for (let [k, v] of Object.entries(
                race.data.data.attributeModifiers
            )) {
                data.attributes[k].total += v.value
                data.attributes[k].saveModifier = +v.saveModifier
            }
        }

        // todo make sure there can only be one background
        const background = actorData.items.find((item) => {
            return item.data.type === "background"
        })
        if (background) {
            for (let [modifier, v] of Object.entries(
                background.data.data.attributeModifiers
            )) {
                data.attributes[modifier].total += v.value
            }
        }

        // Checks
        for (let [checkName, v] of Object.entries(data.checks)) {
            v.base = data.attributes[v.attribute].total
            v.total = v.base
        }
        if (race) {
            console.log(race.data.data.checkModifiers)
            for (let [k, v] of Object.entries(race.data.data.checkModifiers)) {
                console.log(k)
                console.log(v)
                data.checks[k].total += v.value
            }
        }

        data.defense.value = Math.ceil(10 + data.attributes.dex.total / 2)

        // EP
        data.EP.max =
            data.attributes.con.total * 5 +
            data.attributes.str.total * 2 +
            data.attributes.dex.total * 2

        if (data.EP.max < 2) {
            data.EP.max = 2
        }

        // Mana
        if (data.maxManaAttribute === "int") {
            data.mana.max = data.attributes[data.maxManaAttribute].total
        }
        if (data.maxManaAttribute === "con") {
            data.mana.max = data.attributes[data.maxManaAttribute].total / 2
        }

        // Attributes and other modifiers from items
        for (let item of actorData.items) {
            // Armor
            if (item.data.type === "armor") {
                if (item.data.data.equipped === true) {
                    data.defense.value += item.data.data.defense
                    data.defense.damageReduction +=
                        item.data.data.damageReduction
                }
            }
            if (item.data.type === "ability") {
                if (item.data.data.spellcasting === true) {
                    console.log(`set spellcasting to true`)
                    data.spellcasting = true
                    data.maxManaAttribute = item.data.data.maxManaAttribute
                }
                data.mana.expenditureLimit +=
                    item.data.data.expenditureLimitBonus
                data.EP.max += item.data.data.EPModifier
            }
        }
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
}
