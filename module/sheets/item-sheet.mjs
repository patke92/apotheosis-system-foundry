// import {
//     onManageActiveEffect,
//     prepareActiveEffectCategories,
// } from "../helpers/effects.mjs"

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class ApotheosisItemSheet extends ItemSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["apotheosis", "sheet", "item"],
            width: 520,
            height: 480,
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "description",
                },
            ],
        })
    }

    /** @override */
    get template() {
        const path = "systems/apotheosis/templates/item"
        // Return a single sheet for all item types.
        // return `${path}/item-sheet.html`;

        // Alternatively, you could use the following return statement to do a
        // unique item sheet by type, like `weapon-sheet.html`.
        return `${path}/item-${this.item.data.type}-sheet.html`
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        // Retrieve base data structure.
        const context = super.getData()

        // Use a safe clone of the item data for further operations.
        const itemData = context.item.data

        if (itemData.type === "weapon") {
            const weaponAttackAttribute = itemData.data.weaponAttackAttribute
            const weaponDamageAttribute = itemData.data.weaponDamageAttribute
            if (itemData.data.customDamageFormula === false) {
                itemData.data.damageFormula = `${itemData.data.damageDie} + ceil((@attributes.${weaponDamageAttribute}.base + @attributes.${weaponDamageAttribute}.mod) / 2)`
            }

            if (itemData.data.customAttackFormula === false) {
                if (itemData.data.expertise === true) {
                    itemData.data.formula = `d20 + max(ceil((@attributes.${weaponAttackAttribute}.base + @attributes.${weaponAttackAttribute}.mod) * 1.5), 0) + @attackMod`
                } else {
                    itemData.data.formula = `d20 + @attributes.${weaponAttackAttribute}.base + @attributes.${weaponAttackAttribute}.mod + @attackMod`
                }
            }
        }

        // Retrieve the roll data for TinyMCE editors.
        context.rollData = {}
        let actor = this.object?.parent ?? null
        if (actor) {
            context.rollData = actor.getRollData()
        }

        // Add the actor's data to context.data for easier access, as well as flags.
        context.data = itemData.data
        context.flags = itemData.flags

        if (context.data.attributeModifiers) {
            for (let [k, v] of Object.entries(
                context.data.attributeModifiers
            )) {
                v.label =
                    game.i18n.localize(CONFIG.APOTHEOSIS.attributes[k]) ?? k
            }
        }

        if (context.data.checkModifiers) {
            for (let [k, v] of Object.entries(context.data.checkModifiers)) {
                v.label = game.i18n.localize(CONFIG.APOTHEOSIS.checks[k]) ?? k
            }
        }

        // Prepare active effects
        // context.effects = prepareActiveEffectCategories(itemData.effects)

        console.log(context)

        return context
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html)

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return

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
        // html.find(".effect-control").click((ev) =>
        //     onManageActiveEffect(ev, this.item)
        // )
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
        return await Item.create(itemData, { parent: this.item })
    }
}
