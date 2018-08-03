var moment = require('moment')
const util = require('util')

// trigger_type: 0=date, 1=location

function rethrow(msg) {
	return function(cause) {
		throw util.format(msg, cause)
	}
}

module.exports = function() { 
	let self = {

	reminders: [],
	executeSql: {},
	
	init: function(god) {
		this.executeSql = god.executeSql
		this.loadReminders()
	},
	
	loadReminders: async function() {
		let rows = await this.executeSql("SELECT * FROM reminders").catch(rethrow("Failed to load reminders: "))
		console.log("Loaded " + rows.length + " reminders.")
		this.reminders = rows
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
