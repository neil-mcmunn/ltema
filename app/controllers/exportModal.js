// Server address to send files to
// var serverAddress = "";

function backBtnClick(){
	$.modalNav.close();
}

function surveyBtn() {
	$.formView.opacity = .2;
    $.surveyPkrView.visible = true;
}

function doneSelectBtn() {
    $.selectLbl.text = $.surveyPkr.getSelectedRow(0).title;
    $.formView.opacity = 1;
    $.surveyPkrView.visible = false;
    if ($.selectLbl.text != "Select") {
    	$.exportBtn.enabled = true;
    }
}

// Query the database based for site surveys that are eligable for export
// A site survey must have at least 1 transect with 1 plot with 1 observation before it can be exported
try {
	var db = Ti.Database.open('ltemaDB');
	
	var rows = db.execute('SELECT svy.site_id, prk.park_name, svy.year, pro.protocol_name \
		FROM site_survey svy, park prk, protocol pro, transect tst, plot plt, plot_observation pob \
		WHERE svy.park_id = prk.park_id AND \
		svy.protocol_id = pro.protocol_id AND \
		svy.site_id = tst.site_id AND \
		tst.transect_id = plt.transect_id AND \
		plt.plot_id = pob.plot_id \
		GROUP BY svy.site_id');
	
	// Create a picker row for each site survey that can be exported
	var data = [];
	var index = 0;
	while (rows.isValidRow()) {	
		
		var siteID = rows.fieldByName('site_id');
		var year = rows.fieldByName('year');
		var protocolName = rows.fieldByName('protocol_name');
		var parkName = rows.fieldByName('park_name');
		
		// Build the picker row title
		var siteSurvey = year + ' - ' + protocolName + ' - ' + parkName; 
		
		// Create a new picker row
		var newRow = Ti.UI.createPickerRow({
			title : siteSurvey,
			siteID : siteID
		});
		
		data[index] = newRow;
		index ++;
		rows.next();
	}
	
	// Add the rows to the picker
	$.surveyPkr.add(data);
	
} catch (e) {
	Ti.App.fireEvent("app:dataBaseError", e);
} finally {
	rows.close();
	db.close();
}

// Create the CSV files for the Site Survey selected for export
function makeCSV() {
	var siteID = $.surveyPkr.getSelectedRow(0).siteID;
	var siteName = $.surveyPkr.getSelectedRow(0).title;
	var allFiles = [];
	
	try{
		// Query the database based on the siteID selected
		var db = Ti.Database.open('ltemaDB');
		
		// Get the transects for the site
		var transects = db.execute('SELECT prk.park_name, tct.transect_id, tct.transect_name, tct.surveyor, med.media_name AS transect_photo \
			FROM transect tct, media med, park prk, site_survey svy \
			WHERE tct.media_id = med.media_id AND \
			prk.park_id = svy.park_id AND \
			svy.site_id = tct.site_id AND \
			tct.site_id = ?', siteID);
		
		var results = [];
		var fieldCount = transects.fieldCount();
		var transectIDs = [];
		while (transects.isValidRow()) {
			// Get the pictures to upload
			// allFiles.push(transects.fieldByName('transect_photo'));
			
			// Get the transectIDs
			transectIDs.push(transects.fieldByName('transect_id'));
			
			// Create transect objects
			var row = {};
			for (var j = 0; j < fieldCount; j++) {
				row[transects.getFieldName(j)] = transects.field(j);
			}
			results.push(row);
			
			transects.next();
		}

		// Get the plots for the transects		
		var tids = '(' + transectIDs + ')';
		var plots = db.execute('SELECT plt.plot_id, plt.plot_name, plt.utm_zone, plt.utm_easting, plt.transect_id, \
			plt.utm_northing, plt.stake_deviation, plt.distance_deviation, plt.utc, med.media_name AS plot_photo\
			FROM plot plt, media med \
			WHERE plt.media_id = med.media_id AND \
			plt.transect_id IN ' + tids);
		
		fieldCount = plots.fieldCount();
		var plotIDs = [];
		while (plots.isValidRow()) {
			// Get the pictures to upload
			// allFiles.push(plots.fieldByName('plot_photo'));
			
			// Get the plotIDs
			plotIDs.push(plots.fieldByName('plot_id'));
			
			// Create plot objects
			var row = {};
			for (var j = 0; j < fieldCount; j++) {
				row[plots.getFieldName(j)] = plots.field(j);
			}
			
			// Associate with the correct transect
			for (var i in results) {
				if (results[i].transect_id === row.transect_id) {
					var pid = plots.fieldByName('plot_id');
					results[i][pid] = row;
				}
			}
			
			plots.next();
		}
		
		// Get the plot observations for the plots
		var pids = '(' + plotIDs + ')';
		var plotObservations = db.execute('SELECT pob.observation_id, pob.observation, pob."count", pob.comments, pob.plot_id, pob.ground_cover, med.media_name AS observation_photo \
			FROM plot_observation pob, media med \
			WHERE pob.media_id = med.media_id AND \
			pob.plot_id IN '+ pids);
		
		fieldCount = plotObservations.fieldCount();	
		while (plotObservations.isValidRow()) {
			// Get the pictures to upload
			// allFiles.push(plotObservations.fieldByName('observation_photo'));
			
			// Create observation objects
			var row = {};
			for (var j = 0; j < fieldCount; j++) {
				row[plotObservations.getFieldName(j)] = plotObservations.field(j);
			}
			
			// Associate with the correct plot			
			for (var i in results) {
				for(var j in results[i]) {				
					if(results[i][j].plot_id === row.plot_id) {
						var pobid = plotObservations.fieldByName('observation_id');
						results[i][j][pobid] = row;
					}
				}
			}
			plotObservations.next();
		}		
	} catch(e) {
		Ti.App.fireEvent("app:dataBaseError", e);
	} finally {
		transects.close();
		plots.close();
		plotObservations.close();
		db.close();
	}
		
	// Prepare the CSV files
	var sampleStationTxt = "";
	var generalSurveyTxt = "";
	var nl = '\n';
	var c = ',';
	var dq = '"';
	
	for (var transect in results) {
		for (var plot in results[transect]) {
			// CSV for Sample Station output
			if (results[transect][plot].plot_id != null) {
				sampleStationTxt += dq + results[transect].park_name + dq + c;
				sampleStationTxt += dq + results[transect].transect_name + " ";
				sampleStationTxt += results[transect][plot].plot_name + dq + c;
				sampleStationTxt += dq + results[transect][plot].utm_zone + dq + c;
				sampleStationTxt += dq + results[transect][plot].utm_easting + dq + c;
				sampleStationTxt += dq + results[transect][plot].utm_northing + dq + c;
				sampleStationTxt += dq + results[transect][plot].plot_photo + dq + nl;
			}		
			
			for (var observation in results[transect][plot]) {
				if (typeof results[transect][plot][observation] === 'object' && results[transect][plot][observation] != null) {
					// Convert utc to date and time
					var utc = parseInt(results[transect][plot].utc);
					var d = new Date(utc);
					
					var date = d.toDateString().split(" ");
					var plotDate = dq + date[2] + date[1] + date[3] + dq;
					
					var time = d.toTimeString().split(":");
					var plotTime = dq + time[0] + ":" + time[1] + dq;
					
					// CSV for General Survey output
					generalSurveyTxt += dq + results[transect].park_name + dq + c;
					generalSurveyTxt += dq + results[transect].transect_name + " ";
					generalSurveyTxt += results[transect][plot].plot_name + dq + c;
					generalSurveyTxt += plotDate + c + plotTime + c + c;
					generalSurveyTxt += dq + results[transect].surveyor + dq + c;
					generalSurveyTxt += dq + results[transect][plot][observation].observation + dq + c;
					generalSurveyTxt += dq + results[transect][plot][observation].count + dq + c + c + c + c;
					generalSurveyTxt += dq + results[transect][plot][observation].comments + dq + c;
					generalSurveyTxt += dq + results[transect][plot][observation].ground_cover + dq + c;
					generalSurveyTxt += dq + results[transect][plot][observation].observation_photo + dq + nl;
				}					
			}
		}
	}

    // Create the CSV files
    try{
    	var dir = "site" + siteID;
				
		// Create Directory for site
		var siteDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
		if (! siteDir.exists()) {
	    	siteDir.createDirectory();
		}
    	
    	// Create Sample Station file
	    var ssFileName = "SampleStation.csv";
	    var sampleStationFile = Titanium.Filesystem.getFile(siteDir.resolve(), ssFileName);
	    sampleStationFile.write(sampleStationTxt); 
	    // allFiles.push(ssFileName);
	    
	    // Create General Survey file
	    var gsFileName = "GeneralSurvey.csv";
	    var generalSurveyFile = Titanium.Filesystem.getFile(siteDir.resolve(), gsFileName);
	    generalSurveyFile.write(generalSurveyTxt);
	    // allFiles.push(gsFileName);
	} catch(e) {
		Ti.App.fireEvent("app:fileSystemError", e);
	} finally {
		return allFiles;
	}
}

function exportBtn() {
	// Create the CSV and export all files and photos
	var files = makeCSV();
	$.exportWin.fireEvent("doneSending");
	// Setup the progress bar
	// $.progressBar.hide();
	// $.progressBar.message = "Uploading...";
	// $.progressBar.min = 0;
	// $.progressBar.max = files.length;
	// $.progressBar.value = 0;
	// $.progressBar.show();
	
	// Upload all the files for selected survey
	// exportFiles(files);	
}

/*
// Upload a single file to the server
Ti.include('HttpRequestsHandler.js');
function exportFiles(toExport) {
	var siteID = $.surveyPkr.getSelectedRow(0).siteID;
	var dir = 'site' + siteID + '/';
	var didNotSend = [];
	var doesNotExist = [];
	
	for (var i=0; i < toExport.length; i++) {
		var fileName = toExport[i];
		
		var folderName = $.surveyPkr.getSelectedRow(0).title;
		// Open the file
		try {
			var fileToExport = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, dir + fileName);
			
			// Check if the file you are trying to upload exists
			if (!fileToExport.exists()) {
				doesNotExist.push(fileName);
				$.progressBar.value ++;
				continue;
			}
		
			// Send the file to the server
			var toSend = { 
			    "file": fileToExport.read(),
			    "path": folderName
			};
			
			ui.fetch.loadData(serverAddress, toSend, function(response) {
    			// Check if the files sent
			    if(response === "success") {
			    	
			    	//Update the progress
			    	$.progressBar.value ++;
			    	
			    } else {
			    	// There was an error sending
			    	$.progressBar.value ++;
			    	didNotSend.push(response); 
			    }
			    
			    if($.progressBar.value === toExport.length) {
			    	// Upload is finished
					$.exportWin.fireEvent("doneSending", {
						"doesNotExist": doesNotExist,
						"didNotSend": didNotSend
					});
			    }
  			});
  			
		} catch(e) {
			Ti.App.fireEvent("app:fileSystemError", e);
		}
	}
}
*/
// All the HTTP requests have sent successfully
$.exportWin.addEventListener("doneSending", function() { 
    
    // If all files did not send, let user retry
	//if (e.doesNotExist.length > 0 || e.didNotSend.length > 0) {
	//	//TODO: Prompt user to try again
	//}
    
    try{
    	var db = Ti.Database.open('ltemaDB');
    	var siteID = $.surveyPkr.getSelectedRow(0).siteID;
    	var d = new Date();
		var utc = d.getTime();
    	
    	// Timestamp the export in the database
    	db.execute('UPDATE OR FAIL site_survey SET exported = ? WHERE site_id = ?', utc, siteID);
    } catch(e) {
    	Ti.App.fireEvent("app:fileSystemError", e);
    } finally {
    	db.close();
    	// $.progressBar.message = "Done";
		alert("Data for " + $.surveyPkr.getSelectedRow(0).title + " is ready for export");
    } 
});
