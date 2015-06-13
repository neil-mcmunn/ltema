/* 
 *  Site survey creation screen with validation 
 * 
 */

// Tabbed Bar Labels
var pickBiomeLabels = [];
var pickProtocolLabels = [];
var uuid = require('uuid');
var resurvey = require('resurvey');

var currentProtocol;
var downloadedSurveys = Ti.App.Properties.getString('downloaded_local_surveys');
var localSurveys = Ti.App.Properties.getString('local_surveys');
var cloudSurveys = Ti.App.Properties.getString('cloud_surveys');
console.log('addSiteurvey property strings');
console.log(downloadedSurveys);

/*
// show downloaded surveys
try {
	console.log('creating picker rows');
	var db = Ti.Database.open('ltemaDB');
		
	var column1 = Ti.UI.createPickerColumn();
	
	for (var i = 0, len = downloadedSurveys.length; i < len; i++) {
		var siteGUID = downloadedSurveys[i].site_survey_guid;
		var row = db.execute('SELECT park_name, protocol_name FROM park prk, site_survey s, protocol p \
							WHERE prk.park_id = s.park_id \
							AND p.protocol_id = s.protocol_id \
							AND s.site_survey_guid = ?', siteGUID);
		var parkName = row.fieldByName('park_name');
		var protocolName = row.fieldByName('protocol_name');
		
		var newRow = Ti.UI.createPickerRow({
					title : parkName + ' ' + protocolName,
					color : 'black'
				});
				
		column1.addRow(newRow);
	}
	
	$.picker.add(column1);
	
	console.log('pickers should be created');
} catch (e) {
	var errorMessage = e.message;
	Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
} finally {
	db.close();
}
*/


// Populate the biome TabbedBar with database-derived labels
try {
	var db = Ti.Database.open('ltemaDB');
	var biomeResultRows = db.execute('SELECT biome_name FROM biome ');
	while (biomeResultRows.isValidRow()) {
		var biomeName = biomeResultRows.fieldByName('biome_name');
		pickBiomeLabels.push({title:biomeName, enabled:true});
		biomeResultRows.next();
	}
} catch(e) {
	var errorMessage = e.message;
	Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
} finally {
	biomeResultRows.close();
	db.close();
	$.pickBiome.labels = pickBiomeLabels;
}

// Nav Bar title label
var titleLabel = Titanium.UI.createLabel({
	top:10,
	text: 'New Site Survey',
	textAlign:'center',
	font:{fontSize:20,fontWeight:'bold'}
});
$.addSiteSurveyWin.setTitleControl(titleLabel);

// Instruciton text
var instructions =  "Type in the search bar to find a park.\n\n" +
					"Pick a Biome to show the Protocols to choose from.\n\n" +
					"Pick a Protocol and click the Done button to create the new site survey.\n\n" +
					"\n" +
					"LTEMA currently supports the Grassland and Alpine protocols.\n\n\n";
$.info.text = instructions;

/* Event Listeners */

// Regenerate protocol TabbedBar based on biome selected
$.pickBiome.addEventListener('click', function(e) {
	//remove old list
	$.pickProtocol.index = -1;
	$.pickBiomeError.visible = false;
	$.pickProtocolError.visible = false;
	while (pickProtocolLabels.length > 0) {
		pickProtocolLabels.pop();
	}
	//populate new list based on new biome selected
	try {
		var db = Ti.Database.open('ltemaDB');
		var protocolResultRows = db.execute('SELECT protocol_name \
											FROM protocol p, biome b \
											WHERE p.biome_id = b.biome_id \
											AND  b.biome_name =?', pickBiomeLabels[e.index].title);
		while (protocolResultRows.isValidRow()) {
			var protocolName = protocolResultRows.fieldByName('protocol_name');
			pickProtocolLabels.push({title:protocolName, enabled:true});
			protocolResultRows.next();
		}
	} catch (e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		protocolResultRows.close();
		db.close();
	}
	
	//refresh TabbedBar
	$.pickProtocol.labels = pickProtocolLabels;
});

// Check for unsupported protocols
$.pickProtocol.addEventListener('click', function(e) {
	if ((pickProtocolLabels[e.index].title !== "Alpine") && (pickProtocolLabels[e.index].title !== "Grassland")) {
		$.pickProtocolError.text = "* Unsupported protocol by LTEMA at this time";
		$.pickProtocolError.visible = true;
	} else {
		$.pickProtocolError.visible = false;
		currentProtocol = pickProtocolLabels[e.index].title;
	}
});

// Closes the popup result window if user navigates away from this screen 
// (improves performance related to issue #14)
$.parkSrch.addEventListener('blur', function(e) {
	win.close();
});

// Enabled site survey list screen Add button, related to issue #28
$.addSiteSurveyWin.addEventListener('close', function(e) {
	Ti.App.fireEvent("app:enableIndexAddButton");
});


/* Functions */

//Test for form completeness before adding to database
function doneBtn(e){
	//disable button to prevent double entry
	e.source.enabled = false;
	
	var errorFlag = false;
	if (($.parkSrch.value == "") || ($.parkSrch.value == null)) {
		$.parkSrchError.text = "* Please select a park";
		$.parkSrchError.visible = true;
		errorFlag = true;
	}else{
		try{
			//Check if the park name that was entered matches one from the database list of park names
			var db = Ti.Database.open('ltemaDB');
			var parkResultExists = db.execute('SELECT park_id FROM park WHERE park_name =?', $.parkSrch.value);
			if(parkResultExists.rowCount <= 0){
				$.parkSrchError.text = "* Please select a park";
				$.parkSrchError.visible = true;
				errorFlag = true;
			}
		}catch(e){
		
		}finally{
			db.close();
		}
	}
	
	if ($.pickBiome.index == null) {
		$.pickBiomeError.text = "* Please select a biome";
		$.pickBiomeError.visible = true;
		errorFlag - true;
	}
	if (($.pickProtocol.index == null) || ($.pickProtocol.index == -1)) {
		$.pickProtocolError.text = "* Please select a protocol";
		$.pickProtocolError.visible = true;
		errorFlag = true;
	//is an elseif because an unselected TabbedBar has no title to check and will error out - there might be a better way to do this
	} else if (($.pickProtocol.labels[$.pickProtocol.index].title !== "Alpine") && ($.pickProtocol.labels[$.pickProtocol.index].title !== "Grassland")) {
		$.pickProtocolError.text = "* Unsupported protocol by LTEMA at this time";
		$.pickProtocolError.visible = true;
		errorFlag = true;
	}
	
	if (errorFlag === true) {
		e.source.enabled = true;
		$.parkSrch.blur();
		return;
	} else { //no error, insert into database and close this screen
		$.parkSrchError.visible = false;
		$.pickBiomeError.visible = false;
		$.pickProtocolError.visible = false;
		try {
			var db = Ti.Database.open('ltemaDB');
			var currentYear = new Date().getFullYear().toString();
			var protocolResult = db.execute('SELECT protocol_id FROM protocol WHERE protocol_name =?', $.pickProtocol.labels[$.pickProtocol.index].title);
			var protocolID = protocolResult.fieldByName('protocol_id');
			var parkResult = db.execute('SELECT park_id FROM park WHERE park_name =?', $.parkSrch.value);
			var parkID = parkResult.fieldByName('park_id');
						
			// Check if this site has been previously surveyed
			var previousID = db.execute('SELECT site_id, site_survey_guid FROM site_survey \
											WHERE protocol_id = ? \
											AND park_id = ?', protocolID, parkID);

			var prevSiteID = previousID.fieldByName('site_id');
			var prevSiteGUID = previousID.fieldByName('site_survey_guid');

			console.log('id line 171 (addSiteSurvey): ' + prevSiteID + ' and guid: ' + prevSiteGUID);

			if (!prevSiteGUID) {
				// Insert the new survey
				var siteGUID = String(uuid.generateUUID());
				//var results = db.execute('SELECT last_insert_rowid() as siteID');
				db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id, version_no) VALUES (?,?,?,?,?)', siteGUID, currentYear, protocolID, parkID, 1);

			// Get the transects associated with the survey
			} else {
				db.close();
				resurvey.resurvey(prevSiteGUID);
			}
					
		} catch (e){
			var errorMessage = e.message;
			Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		} finally {
			//protocolResult.close();
			//parkResult.close();
			db.close();
			Ti.App.fireEvent("app:refreshSiteSurveys");
			$.addSiteSurveyWin.close();
		}
	} 
}


/* Everything that follows is search bar related */

// SEARCH BAR ACTIONS

var timers = 0;

//create the popup window to show search results
var win = Ti.UI.createWindow({
	borderColor : "#C0C0C0",
	scrollable : true,
	height: 281,
	left : 200,
	right : 40,
	top : 260,
	borderRadius : 0,
	borderWidth: 3,
	title : 'park names'
});


//AUTOCOMPLETE TABLE - list of results from search
var table_data = [];
var autocomplete_table = Titanium.UI.createTableView({
	search : $.parkSrch.value,
	top : 0,
	height: Ti.UI.FILL
});
win.add(autocomplete_table);

//Auto-complete search
function auto_complete(search_term) {
	if (search_term.length >= 1) {
		//clear the table view results
		autocomplete_table.setData([]);
		autocomplete_table.setData(table_data);

		//open database
		try {
			var db = Ti.Database.open('ltemaDB');
			
			var rows = db.execute('SELECT park_name ' + 'FROM park ' + 'WHERE park_name LIKE ?', search_term + '%');
			//check if any results are returned
			if (rows.getRowCount() <= 0) {
				//TODO: determine if the user can create a new park name, and how to implement
				//for now, the next line is commented out, close() allows the user to enter an invalid park name
				//win.close();
			} else {
				win.open();
				
				while (rows.isValidRow()) {
					var parkName = rows.fieldByName('park_name');
					
					//create a new row
					var newRow = Ti.UI.createTableViewRow({
						title : parkName,
						color : 'gray'
					});
					
					// check if downloaded already
					var park_id;
					var results = db.execute('SELECT s.park_id, park_name, protocol_name FROM site_survey s, park prk, protocol p WHERE s.park_id = prk.park_id AND s.protocol_id = p.protocol_id');
					while(results.isValidRow()){
						var downloadedPark = results.fieldByName('park_name');
						var protocol = results.fieldByName('protocol_name');
						if ((parkName === downloadedPark) && (protocol === currentProtocol)) {
							//parkName += ' ***ON DEVICE as ' + protocol + '***';
							var parkID = results.fieldByName('park_id');
							newRow.title = parkName;
							newRow.color = 'black';
						}
						results.next();
					}
					
					//Add row to the table view
					autocomplete_table.appendRow(newRow);
					rows.next();
				}
			}
			
			/*
			//Query - Retrieve all parks to match with downloaded parks
			var rows = db.execute('SELECT park_name FROM park');
			
			// store matches to avoid duplicating
			var matchArray = [];
			
			//check if any results are returned
			if (rows.getRowCount() <= 0) {
				//TODO: determine if the user can create a new park name, and how to implement
				//for now, the next line is commented out, close() allows the user to enter an invalid park name
				//win.close();
			} else {
				win.open();
	
				while (rows.isValidRow()) {
					var parkName = rows.fieldByName('park_name');
					
					//var park_id;
					//var alreadyDownloadedSurveys = db.execute('SELECT s.park_id, park_name, protocol_name FROM site_survey s, park prk, protocol p WHERE s.park_id = prk.park_id AND s.protocol_id = p.protocol_id');
					var alreadyDownloadedSurveys = db.execute('SELECT park_name FROM site_survey s, park prk WHERE s.park_id = prk.park_id AND s.site_survey_guid IS NOT NULL');
					while(alreadyDownloadedSurveys.isValidRow()){
						var downloadedParkName = alreadyDownloadedSurveys.fieldByName('park_name');
						//var protocol = results.fieldByName('protocol_name');
						if (parkName === downloadedParkName) {
							//parkName += ' (ON DEVICE as ' + protocol + ')';
							//var parkID = results.fieldByName('park_id');//create a new row
							var newRow = Ti.UI.createTableViewRow({
								title : parkName,
								fontWeight : 'bold',
								color : 'black'
							});
							//Add row to the table view
							autocomplete_table.appendRow(newRow);
						} 
						alreadyDownloadedSurveys.next();
					} 
					rows.next();
				}
			}
			
			var rows = db.execute('SELECT park_name ' + 'FROM park ' + 'WHERE park_name LIKE ?', search_term + '%');

			//check if any results are returned
			if (rows.getRowCount() <= 0) {
				//TODO: determine if the user can create a new park name, and how to implement
				//for now, the next line is commented out, close() allows the user to enter an invalid park name
				//win.close();
			} else {
				win.open();
	
				while (rows.isValidRow()) {
					var parkName = rows.fieldByName('park_name');
					
					//var results = db.execute('SELECT s.park_id, park_name, protocol_name FROM site_survey s, park prk, protocol p WHERE s.park_id = prk.park_id AND s.protocol_id = p.protocol_id');
					for (var i = 0, m = matchArray.length; i < m; i++) {
						var downloadedParkName = matchArray[i].park_name;
						//var protocol = results.fieldByName('protocol_name');
						if (parkName === downloadedParkName) {
							rows.next();
							break;
						}
					}
					
					var newRow = Ti.UI.createTableViewRow({
						title : parkName
					});
					//Add row to the table view
					autocomplete_table.appendRow(newRow);
					
					rows.next();
				}
			}
			*/
		} catch (e) {
			var errorMessage = e.message;
			Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		} finally {
			//rows.close();
			db.close();
		}
	}
}

//Event Listener - when user types in the search bar
$.parkSrch.addEventListener('change', function(e) {
	var match = /^[A-Za-z]/;  //santatize search input by reqauiring a letter as the first character
	if ((e.source.value.length < 1) || (!e.source.value.match(match)) ) { 
		autocomplete_table.setData([]);
		autocomplete_table.setData(table_data);
		win.close();
	} else {
		win.open();
		clearTimeout(timers['autocomplete']);
		timers['autocomplete'] = setTimeout(function() {
			auto_complete(e.source.value);
		}, 300);		
	}
	return false;
});

//Event Listener - search results selected by user
autocomplete_table.addEventListener('click', function(e) {
	//add selected park name to the search bar value
	$.parkSrch.value = e.source.title;
	$.parkSrchError.visible = false;
	win.close();
	$.parkSrch.blur();
});
