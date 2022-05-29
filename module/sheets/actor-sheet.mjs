// import {
//     onManageActiveEffect,
//     prepareActiveEffectCategories,
// } from "../helpers/effects.mjs"

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
            width: 720,
            height: 800,
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

        // Handle attribute scores.
        for (let [k, v] of Object.entries(context.data.attributes)) {
            v.label = game.i18n.localize(CONFIG.APOTHEOSIS.attributes[k]) ?? k
        }

        for (let [checkName, v] of Object.entries(context.data.checks)) {
            v.label =
                game.i18n.localize(CONFIG.APOTHEOSIS.checks[checkName]) ??
                checkName
        }

        // Prepare character data and items.
        if (actorData.type == "character") {
            this._prepareItems(context)
            // this._prepareCharacterData(context)
        }

        // Prepare NPC data and items.
        if (actorData.type == "npc") {
            this._prepareItems(context)
        }

        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData()

        // context.effects = prepareActiveEffectCategories(this.actor.effects)

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
        // Handle attribute scores.
        for (let [k, v] of Object.entries(context.data.attributes)) {
            v.label = game.i18n.localize(CONFIG.APOTHEOSIS.attributes[k]) ?? k
        }

        for (let [checkName, v] of Object.entries(context.data.checks)) {
            v.label =
                game.i18n.localize(CONFIG.APOTHEOSIS.checks[checkName]) ??
                checkName
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
        if (context.gear !== gear) context.gear = gear
        if (context.items !== items) context.items = items
        if (context.features !== features) context.features = features
        if (context.spells !== spells) context.spells = spells
        if (context.race !== race) context.race = race
        if (context.background !== background) context.background = background
        if (context.abilities !== abilities) context.abilities = abilities
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

        html.find(".roll-damage").click((ev) => {
            const formula = ev.currentTarget.attributes.damageFormula
            const roll = new Roll(formula.value, this.actor.getRollData())
            roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: "Damage",
                rollMode: game.settings.get("core", "rollMode"),
            })
            return roll
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

        // // Active Effect management
        // html.find(".effect-control").click((ev) =>
        //     onManageActiveEffect(ev, this.actor)
        // )

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
