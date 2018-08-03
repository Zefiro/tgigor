var moment = require('moment')

module.exports = function() { 
	let self = {

	undolist: [],
	
	init: function() {
	},
	
	add: function(displayName, fnUndo) {
		cmd = {
			displayName: displayName,
			fnUndo: fnUndo,
			time: moment(),
		}
		undolist.push(cmd)
	},
	
	}
    self.init(parameters)
    return self
}