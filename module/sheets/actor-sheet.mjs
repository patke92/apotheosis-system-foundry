import {
    onManageActiveEffect,
    prepareActiveEffectCategories,
} from "../helpers/effects.mjs"

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class ApotheosisActorSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["apotheosis", "sheet", "actor"],
            template: "systems/apotheosis/templates/actor/actor-sheet.html",
            width: 600,
            height: 600,
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "features",
                },
            ],
        })
    }

    /** @override */
    get template() {
        return `systems/apotheosis/templates/actor/actor-${this.actor.data.type}-sheet.html`
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData()

        // Use a safe clone of the actor data for further operations.
        const actorData = this.actor.data.toObject(false)

        // Add the actor's data to context.data for easier access, as well as flags.
        context.data = actorData.data
        context.flags = actorData.flags

        // Prepare character data and items.
        if (actorData.type == "character") {
            this._prepareItems(context)
            this._prepareCharacterData(context)
        }

        // Prepare NPC data and items.
        if (actorData.type == "npc") {
            this._prepareItems(context)
        }

        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData()

        return context
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareCharacterData(context) {
        // Handle ability scores.
        for (let [k, v] of Object.entries(context.data.attributes)) {
            v.label = game.i18n.localize(CONFIG.APOTHEOSIS.attributes[k]) ?? k

            v.total = v.base

            // Get attribute modifiers from race
            if (context.race !== undefined) {
                v.total =
                    v.total + context.race.data.attributeModifiers[k].value
            }

            // Get attribute modifiers from background
            if (context.background !== undefined) {
                v.total =
                    v.total +
                    context.background.data.attributeModifiers[k].value
            }

            for (let ability of context.abilities) {
                v.total = v.total + ability.data.attributeModifiers[k].value
            }

            // Update the actor with the new total
            const attributeToUpdate = "data.attributes." + k + ".total"
            this.actor.update({
                [attributeToUpdate]: v.total,
            })
        }

        // Handle EP max
        context.data.EP.max =
            context.data.attributes.con.total * 5 +
            context.data.attributes.str.total * 2 +
            context.data.attributes.dex.total * 2

        if (context.data.EP.max < 2) {
            context.data.EP.max = 2
        }

        // Update the actor with the new EP max
        this.actor.update({
            "data.EP.max": context.data.EP.max,
        })

        for (let ability of context.abilities) {
            context.data.EP.max = context.data.EP.max + ability.data.EPModifier
        }

        // todo Handle Mana max

        context.data.defense.value = Math.ceil(
            10 + context.data.attributes.dex.total / 2
        )

        for (let armor of context.gear.armor) {
            if (armor.data.equipped === true) {
                context.data.defense.value =
                    context.data.defense.value + armor.data.defense
            }
        }
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareItems(context) {
        // Initialize containers.
        const gear = {
            weapons: [],
            armor: [],
        }
        const items = []
        const features = []
        const abilities = []
        const spells = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: [],
            5: [],
            6: [],
        }
        let race
        let background

        // Iterate through items, allocating to containers
        for (let i of context.items) {
            i.img = i.img || DEFAULT_TOKEN
            // Append to gear.
            if (i.type === "weapon") {
                gear.weapons.push(i)
            } else if (i.type === "armor") {
                gear.armor.push(i)
            } else if (i.type === "item") {
                items.push(i)
            }
            // Append to features, set race and background.
            else if (i.type === "feature") {
                features.push(i)
            } else if (i.type === "race") {
                features.push(i)
                // todo add race abilities
                race = i
            } else if (i.type === "background") {
                features.push(i)
                background = i
            } else if (i.type === "ability") {
                abilities.push(i)
            }
            // Append to spells.
            else if (i.type === "spell") {
                if (i.data.spellCost != undefined) {
                    spells[i.data.spellCost].push(i)
                }
            }
        }

        // Assign and return
        context.gear = gear
        context.items = items
        context.features = features
        context.spells = spells
        context.race = race
        context.background = background
        context.abilities = abilities
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html)

        // Render the item sheet for viewing/editing prior to the editable check.
        html.find(".item-edit").click((ev) => {
            const li = $(ev.currentTarget).parents(".item")
            const item = this.actor.items.get(li.data("itemId"))
            item.sheet.render(true)
        })

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return

        html.find(".increase-progress").click((ev) => {
            ev.preventDefault()

            const attribute = ev.currentTarget.classList[1]
            const valueToChange = "data.attributes." + attribute + ".progress"
            const attributeValue =
                this.actor.data.data.attributes[attribute].base
            const newAttributeValue = attributeValue + 1
            const attributeToAdjust = "data.attributes." + attribute + ".base"
            const trainingBoolean =
                this.actor.data.data.attributes[attribute].training
            const trainingBooleanString =
                "data.attributes." + attribute + ".training"
            let newProgressValue =
                this.actor.data.data.attributes[attribute].progress +
                (trainingBoolean ? 2 : 1)

            // increase ability base value
            if (
                (attributeValue === 0 ||
                    newProgressValue >= attributeValue * 10) &&
                newProgressValue >= 10
            ) {
                const oldAttributeValue = attributeValue
                this.actor.update({
                    [attributeToAdjust]: newAttributeValue,
                })

                if (trainingBoolean) {
                    this.actor.update({
                        [trainingBooleanString]: false,
                    })
                }
                const rest =
                    newProgressValue -
                    (oldAttributeValue !== 0 ? oldAttributeValue : 1) * 10

                if (rest < 0) rest = 0

                newProgressValue = rest
            }

            // set new ability progress value
            this.actor.update({
                [valueToChange]: newProgressValue,
            })
        })

        html.find(".decrease-progress").click((ev) => {
            ev.preventDefault()
            const attribute = ev.currentTarget.classList[1]
            const valueToChange = "data.attributes." + attribute + ".progress"
            let newProgressValue =
                this.actor.data.data.attributes[attribute].progress - 1
            if (newProgressValue < 0) newProgressValue = 0
            this.actor.update({
                [valueToChange]: newProgressValue,
            })
        })

        // Add Inventory Item
        html.find(".item-create").click(this._onItemCreate.bind(this))

        // Delete Inventory Item
        html.find(".item-delete").click((ev) => {
            const li = $(ev.currentTarget).parents(".item")
            const item = this.actor.items.get(li.data("itemId"))
            item.delete()
            li.slideUp(200, () => this.render(false))
        })

        // Active Effect management
        html.find(".effect-control").click((ev) =>
            onManageActiveEffect(ev, this.actor)
        )

        // Rollable abilities.
        html.find(".rollable").click(this._onRoll.bind(this))

        // Drag events for macros.
        if (this.actor.owner) {
            let handler = (ev) => this._onDragStart(ev)
            html.find("li.item").each((i, li) => {
                if (li.classList.contains("inventory-header")) return
                li.setAttribute("draggable", true)
                li.addEventListener("dragstart", handler, false)
            })
        }
    }

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    async _onItemCreate(event) {
        event.preventDefault()
        const header = event.currentTarget
        // Get the type of item to create.
        const type = header.dataset.type
        // Grab any data associated with this control.
        const data = duplicate(header.dataset)
        // Initialize a default name.
        const name = `New ${type.capitalize()}`
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data,
        }
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"]

        // Finally, create the item!
        return await Item.create(itemData, { parent: this.actor })
    }

    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    _onRoll(event) {
        event.preventDefault()
        const element = event.currentTarget
        const dataset = element.dataset

        // Handle item rolls.
        if (dataset.rollType) {
            if (dataset.rollType == "item") {
                const itemId = element.closest(".item").dataset.itemId
                const item = this.actor.items.get(itemId)
                if (item) return item.roll()
            }
        }

        // Handle rolls that supply the formula directly.
        if (dataset.roll) {
            let label = dataset.label ? `[roll] ${dataset.label}` : ""
            let roll = new Roll(dataset.roll, this.actor.getRollData())
            roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: label,
                rollMode: game.settings.get("core", "rollMode"),
            })
            return roll
        }
    }
}
