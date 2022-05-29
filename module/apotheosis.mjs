// Import document classes.
import { ApotheosisActor } from "./documents/actor.mjs"
import { ApotheosisItem } from "./documents/item.mjs"
// Import sheet classes.
import { ApotheosisActorSheet } from "./sheets/actor-sheet.mjs"
import { ApotheosisItemSheet } from "./sheets/item-sheet.mjs"
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs"
import { APOTHEOSIS } from "./helpers/config.mjs"

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", async function () {
    // Add utility classes to the global game object so that they're more easily
    // accessible in global contexts.
    game.apotheosis = {
        ApotheosisActor,
        ApotheosisItem,
        rollItemMacro,
    }

    // Add custom constants for configuration.
    CONFIG.APOTHEOSIS = APOTHEOSIS

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "1d20 + @attributes.dex.base + @attributes.dex.mod",
        decimals: 2,
    }

    // Define custom Document classes
    CONFIG.Actor.documentClass = ApotheosisActor
    CONFIG.Item.documentClass = ApotheosisItem

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet)
    Actors.registerSheet("apotheosis", ApotheosisActorSheet, {
        makeDefault: true,
    })
    Items.unregisterSheet("core", ItemSheet)
    Items.registerSheet("apotheosis", ApotheosisItemSheet, {
        makeDefault: true,
    })

    // Preload Handlebars templates.
    return preloadHandlebarsTemplates()
})

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper("concat", function () {
    var outStr = ""
    for (var arg in arguments) {
        if (typeof arguments[arg] != "object") {
            outStr += arguments[arg]
        }
    }
    return outStr
})

Handlebars.registerHelper("toLowerCase", function (str) {
    return str.toLowerCase()
})

Handlebars.registerHelper("add", function (value1, value2) {
    return value1 + value2
})

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
    // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
    Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot))
})

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
    if (data.type !== "Item") return
    if (!("data" in data))
        return ui.notifications.warn(
            "You can only create macro buttons for owned Items"
        )
    const item = data.data

    // Create the macro command
    const command = `game.apotheosis.rollItemMacro("${item.name}");`
    let macro = game.macros.find(
        (m) => m.name === item.name && m.command === command
    )
    if (!macro) {
        macro = await Macro.create({
            name: item.name,
            type: "script",
            img: item.img,
            command: command,
            flags: { "apotheosis.itemMacro": true },
        })
    }
    game.user.assignHotbarMacro(macro, slot)
    return false
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
    const speaker = ChatMessage.getSpeaker()
    let actor
    if (speaker.token) actor = game.actors.tokens[speaker.token]
    if (!actor) actor = game.actors.get(speaker.actor)
    const item = actor ? actor.items.find((i) => i.name === itemName) : null
    if (!item)
        return ui.notifications.warn(
            `Your controlled Actor does not have an item named ${itemName}`
        )

    // Trigger the item roll
    return item.roll()
}
