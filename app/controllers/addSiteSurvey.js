/* 
 *  Site survey creation screen with validation 
 * 
 */

// Tabbed Bar Labels
var pickBiomeLabels = [];
var pickProtocolLabels = [];

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
	font:{fontSize:20,fontWeight:'bold'},
});
$.addSiteSurveyWin.setTitleControl(titleLabel);

// Instruciton text
var instructions =  "Type in the search bar to find a park.\n\n" +
					"Pick a Biome to show the Protocols to choose from.\n\n" +
					"Pick a Protocol and click the Done button to create the new site survey.\n\n\n";
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
	if ((pickProtocolLabels[e.index].title !== "Alpine") && (pickProtocolLabels[e.index].title !== "Grassland")
		&& (pickProtocolLabels[e.index].title !== "Sessile organisms") && (pickProtocolLabels[e.index].title !== "Mobile organisms")
		&& (pickProtocolLabels[e.index].title !== "Sea stars")) {

		$.pickProtocolError.text = "* Unsupported protocol by LTEMA at this time";
		$.pickProtocolError.visible = true;
	} else {
		$.pickProtocolError.visible = false;
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
	if (($.parkSrch.value == "") || ($.parkSrch.value == null) && ($.parkSrch.value == "") || ($.parkSrch.value == null)) {
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

    var protocolName = $.pickProtocol.labels[$.pickProtocol.index].title;
    if (($.pickProtocol.index == null) || ($.pickProtocol.index == -1)) {
		$.pickProtocolError.text = "* Please select a protocol";
		$.pickProtocolError.visible = true;
		errorFlag = true;
	//is an elseif because an unselected TabbedBar has no title to check and will error out - there might be a better way to do this
	} else if ((protocolName !== "Alpine") && (protocolName !== "Grassland")
        && (protocolName !== "Sessile organisms") && (protocolName !== "Mobile organisms")
        && (protocolName !== "Sea stars")) {

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
			var protocolResult = db.execute('SELECT protocol_id FROM protocol WHERE protocol_name =?', protocolName);
			var protocolID = protocolResult.fieldByName('protocol_id');
			var parkResult = db.execute('SELECT park_id FROM park WHERE park_name =?', $.parkSrch.value);
			var parkID = parkResult.fieldByName('park_id');
			
			// Check if this site has been previously surveyed
			var previousSurveys = db.execute('SELECT site_id FROM site_survey \
											WHERE protocol_id = ? \
											AND park_id = ?', protocolID, parkID);
			
			// Get the most recently entered survey
			var id;								
			while (previousSurveys.isValidRow()) {
				id = previousSurveys.fieldByName('site_id');
				previousSurveys.next();
			}
			
			
			// Insert the new survey
			db.execute( 'INSERT INTO site_survey (year, protocol_id, park_id) VALUES (?,?,?)', currentYear, protocolID, parkID);
			
			//get the id of the last row inserted into the database - *not sure if this is acceptable sql code to use?
			var results = db.execute('SELECT last_insert_rowid() as siteID');
			var siteID = results.fieldByName('siteID');
			
			// Get the transects associated with the survey
			if (id != null) {
                var transects = db.execute('SELECT * FROM transect WHERE site_id = ?', id);

                // Copy and associate any exiting transects
                while (transects.isValidRow()) {
                    var transectName = transects.fieldByName('transect_name');
                    var surveyor = transects.fieldByName('surveyor');
                    var otherSurveyors = transects.fieldByName('other_surveyors');
                    var plotDistance = transects.fieldByName('plot_distance');
                    var stakeOrientation = transects.fieldByName('stake_orientation');
                    var utmZone = transects.fieldByName('utm_zone');
                    var utmEasting = transects.fieldByName('utm_easting');
                    var utmNorthing = transects.fieldByName('utm_northing');
                    var tComments = transects.fieldByName('comments');
                    var transectID = transects.fieldByName('transect_id');
                    var intertidalUTMTop = transects.fieldByName('intertidal_utm_top');
                    var intertidalUTMMid = transects.fieldByName('intertidal_utm_mid');
                    var isBoundary = transects.fieldByName('is_boundary');

                    // should handle Alpine, Grasslands, and intertidal protocols. Fields are nullable.
                    db.execute('INSERT INTO transect (transect_name, surveyor, other_surveyors, plot_distance, stake_orientation, \
						utm_zone, utm_easting, utm_northing, comments, site_id, intertidal_utm_top, intertidal_utm_mid, is_boundary) \
						VALUES (?,?,?,?,?,?,?,?,?,?)', transectName, surveyor, otherSurveyors, plotDistance, stakeOrientation, utmZone,
                        utmEasting, utmNorthing, tComments, siteID, intertidalUTMTop, intertidalUTMMid, isBoundary);

                    // Get the transect_id for the last row inserted
                    results = db.execute('SELECT last_insert_rowid() as transectID');
                    var newTransectID = results.fieldByName('transectID');

                    // Check protocol and associate related sub-categories (plots, quadrats)
                    if (protocolName == 'Alpine' || protocolName == 'Grasslands') {
                        var plots = db.execute('SELECT * FROM plot WHERE transect_id = ?', transectID);

                        // Copy and associate any existing plots
                        while (plots.isValidRow()) {
                            var plotName = plots.fieldByName('plot_name');
                            var plotUtmZone = plots.fieldByName('utm_zone');
                            var plotUtmEasting = plots.fieldByName('utm_easting');
                            var plotUtmNorthing = plots.fieldByName('utm_northing');
                            var utc = plots.fieldByName('utc');
                            var stakeDeviation = plots.fieldByName('stake_deviation');
                            var distanceDeviation = plots.fieldByName('distance_deviation');
                            var comments = plots.fieldByName('comments');
                            var plotID = plots.fieldByName('plot_id');

                            db.execute('INSERT INTO plot (plot_name, utm_zone, utm_easting, utm_northing, utc, stake_deviation, distance_deviation, \
							transect_id, comments) VALUES (?,?,?,?,?,?,?,?,?)', plotName, plotUtmZone, plotUtmEasting, plotUtmNorthing,
                                utc, stakeDeviation, distanceDeviation, newTransectID, comments);

                            // Get the plot_id for the last row inserted
                            results = db.execute('SELECT last_insert_rowid() as plotID');
                            var newPlotID = results.fieldByName('plotID');

                            // Get any plot observations associated with the plot
                            var observations = db.execute('SELECT * FROM plot_observation WHERE plot_id = ?', plotID);

                            // Copy and associate any existing plot observations
                            while (observations.isValidRow()) {
                                var observation = observations.fieldByName('observation');
                                var groundCover = 0;
                                var count = observations.fieldByName('count');
                                var observationComments = observations.fieldByName('comments');

                                db.execute('INSERT INTO plot_observation (observation, ground_cover, count, comments, plot_id) \
								VALUES (?,?,?,?,?)', observation, groundCover, count, observationComments, newPlotID);

                                observations.next();
                            }
                            plots.next();
                        }
                        transects.next();
                        plots.close();

                    } else if (protocolName == 'Mobile organisms') {
                        var quadrats = db.execute('SELECT * FROM quadrat WHERE transect_id = ?', transectID);

                        while (quadrats.isValidRow()) {
                            var quadratID = quadrats.fieldByName('quadrat_id');
                            var quadratName = quadrats.fieldByName('quadrat_name');
                            var quadratZone = quadrats.fieldByName('quadrat_zone');
                            var randomDrop = quadrats.fieldByName('random_drop');
                            var comments = quadrats.fieldByName('comments');

                            db.execute('INSERT INTO quadrat (quadrat_name, quadrat_zone, random_drop, comments) VALUES (?,?,?,?)',
                                quadratName, quadratZone, randomDrop, comments);

                            // Get the quadrat_id for the last row inserted
                            results = db.execute('SELECT last_insert_rowid() as quadratID');
                            var newQuadratID = results.fieldByName('quadratID');

                            // Get any quadrat observations associated with the quadrat
                            var observations = db.execute('SELECT * from quadrat_observation WHERE quadrat_id = ?', quadratID);

                            // Copy and associate any existing quadrat observations
                            while (observation.isValidRow()) {
                                var observation = observations.fieldByName('observation');
                                var nonSessileCode = observations.fieldByName('non_sessile_code');
                                var nonSessileOther = observations.fieldByName('non_sessile_other');
                                var count = observations.fieldByName('count');
                                var comments = observations.fieldByName('comments');

                                db.execute('INSERT INTO quadrat_observation (observation, count, non_sessile_code, non_sessile_other, comments',
                                    observation, count, nonSessileCode, nonSessileOther, comments);

                                observations.next();
                            }
                            quadrats.next();
                        }
                        transects.next();
                        quadrats.close();

                    } else if (protocolName == 'Sessile organisms') {


                    } else if (protocolName == 'Sea stars') {

                    }

                    observations.close();
                    transects.close();
                }
            }
        } catch (e){
            var errorMessage = e.message;
            Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
        } finally {
            protocolResult.close();
            parkResult.close();
            previousSurveys.close();
            results.close();
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
	top : 135,
	borderRadius : 0,
	borderWidth: 3,
	title : 'park names',
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
			
			//Query - Retrieve matching park names from database
			var rows = db.execute('SELECT park_name ' + 'FROM park ' + 'WHERE park_name LIKE ?', search_term + '%');
			
			//Ti.API.info(rows.getRowCount());
			
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
						title : parkName
					});
	
					//Add row to the table view
					autocomplete_table.appendRow(newRow);
					rows.next();
				}
			}
		} catch (e) {
			var errorMessage = e.message;
			Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		} finally {
			rows.close();
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
