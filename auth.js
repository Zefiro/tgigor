
module.exports = function() {
    let self = {

	init: function(god) {
	},

	checkPermission: async function(ctx, permission, silent) {
	    var user = ctx.state.oUser
        	if (!user) {
                	console.log("Permission '" + permission + "' denied für unknown user")
                	return false
        	}
	        if (~user.permissions.split(/[\s,;]+/).indexOf(permission) != -1 || user.permissions == 'dragon') {
        	        console.log("Permission '" + permission + "' granted for " + user.username)
	                return true
        	} else {
	                console.log("Permission '" + permission + "' denied for " + user.username)
	                if (!silent) {
                	        await ctx.reply("Sorry, you need permission '" + permission + "' for this.")
        	        }
                	return false
        	}
	},
    }
    self.init.apply(self, arguments)
    return self
}
