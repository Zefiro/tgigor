var moment = require('moment')
const util = require('util')

function rethrow(msg) {
	return function(cause) {
		throw util.format(msg, cause)
	}
}

module.exports = function() {
    let self = {

	reminders: [],
	executeSql: {},
	bot: {},
	auth: {},

	init: function(god) {
		this.executeSql = god.executeSql
		this.bot = god.bot
		this.auth = god.auth
		this.bot.hears(/^(.*)$/, onUserInput)
	},

	onUserInput: function(ctx, next) {
		let oUser = ctx.state.oUser
        	try {
                	await this.auth.checkPermission(ctx, "qself", true)
	        } catch(cause) {
        		next()
        	        return
	   	 }
	        let row = {
        	        tg_id: oUser.id,
                	gramm: ctx.match[1],
	                comment: ctx.match[4] ? ctx.match[4] : "",
        }
        // TODO if there is already a value for today, remove it?
    let rows = await executeSql("SELECT * FROM qself_weight WHERE DATE(TIMESTAMP) = CURDAT$
console.log("Select returned:")
console.log(rows)

    rows = await executeSql("INSERT INTO qself_weight SET ?", [row]).catch(rethrow("reactW$
        // TODO add undo action to delete rows.insertId
        var sReply = "Gewicht: " + (row.gramm/100) + " kg" + (row.comment ? " (" + row.com$
        console.log("'" + sReply + "' inserted as row #" + rows.insertId)
        await ctx.reply(sReply)
    await next()
	},

	add: async function(displayName, fnUndo) {
		cmd = {
			displayName: displayName,
			fnUndo: fnUndo,
			time: moment(),
		}
		undolist.push(cmd)
	},

	}
    self.init.apply(self, arguments)
    return self
}
