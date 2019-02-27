/*
  Menu
  - an inline keyboard with several menu items
  - (per user) one is active, for 'other' actions it's deleted and either gone ("reset") or re-posted so that it keeps being the last message ("keep")
  - menu thus is a state machine
  Todo Lists
  - Locations are also todo lists, just shortcuts
  - Options for todo lists entries:
    - done (remove, undo-able)
	- edit: change title / text
	- at: change todo list, which might be a location
  - Todo lists itself:
    - lists all todo lists, select one
    - show: shows all entries as items (click -> open one entry)
	- edit: 
  
  Main Menu:
  - Current List: $todolist[$current].name
  - [Home]: set $current = 'home' (if not already home) -- custom link, per user (config or LRU)
  - [Work]: like home


*/


module.exports = function() { 
    let self = {

	init: function(god) {
	},


    }
    self.init.apply(self, arguments)
    return self
}
